"""RecruitIQ telephonic AI interviewer (LiveKit voice agent).

Adapted from livekit-twilow's document agent. Instead of answering from
uploaded documents, it is the "voice" of RecruitIQ's interview engine:

  candidate speaks -> Deepgram STT -> POST /interviews/:id/worker/answer
  RecruitIQ decides the next question (resume/job based, follow-ups,
  difficulty) -> Cartesia TTS -> candidate hears it

No LLM runs here — every word the interviewer says comes from RecruitIQ, so a
phone interview asks the same questions, and produces the same report, as an
online one.

Run:   python agent.py dev          (plus  python dialer.py  to place calls)
Test:  set TEST_INTERVIEW_ID=<a PHONE interview id>, then  python agent.py console
       — runs that interview through your computer's mic/speaker, no phone.
"""

import asyncio
import logging
import os
import time

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli
from livekit.agents.llm import StopResponse
from livekit.plugins import silero

from backend import BackendError, RecruitIQBackend

load_dotenv()
logger = logging.getLogger("interview-agent")

# Must match the agent name in the LiveKit SIP dispatch rule. livekit-twilow's
# setup_sip.py created that rule for "doc-agent", so the default reuses it
# unchanged. Explicit dispatch also keeps this agent OUT of RecruitIQ's
# browser interview rooms (same LiveKit project) — it only joins phone calls.
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "doc-agent")

# Extra quiet time after the candidate stops talking before their answer is
# submitted — people pause to think mid-answer on the phone.
ANSWER_GRACE_SECONDS = float(os.getenv("ANSWER_GRACE_SECONDS", "2.5"))

# Short acknowledgements spoken while RecruitIQ works out the next question
# (it runs a few LLM calls), so the line never goes silent.
FILLERS = ["Thank you.", "Okay, thanks.", "Got it, thank you.", "Alright.", "Thanks for sharing that."]

# SIP header -> participant attribute (configured on the LiveKit inbound trunk
# by setup_sip.py). The rest are fallbacks for LiveKit's automatic
# header-to-attribute naming.
INTERVIEW_ID_ATTRIBUTES = ("recruitiq.interview_id", "sip.h.x-interview-id", "sip.h.X-Interview-Id")


def tts_model_for(voice_gender: str | None) -> str:
    """TTS_MODEL, optionally with the company's configured voice gender.

    Format: provider/model[:voice_id]. Set TTS_VOICE_FEMALE / TTS_VOICE_MALE to
    voice ids of your TTS provider to follow the AI interviewer's voice setting.
    """
    model = os.getenv("TTS_MODEL", "cartesia/sonic-3")
    voice = {"FEMALE": os.getenv("TTS_VOICE_FEMALE"), "MALE": os.getenv("TTS_VOICE_MALE")}.get(voice_gender or "")
    return f"{model}:{voice}" if voice and ":" not in model else model


def interview_id_from(participant: rtc.RemoteParticipant) -> str | None:
    attrs = dict(participant.attributes or {})
    for key in INTERVIEW_ID_ATTRIBUTES:
        if attrs.get(key):
            return attrs[key]
    for key, value in attrs.items():
        if "interview" in key.lower() and value:
            return value
    return None


class InterviewAgent(Agent):
    def __init__(self, backend: RecruitIQBackend, interview_id: str, state: dict, on_finished):
        super().__init__(instructions="Telephonic interviewer. Everything spoken is provided by RecruitIQ.")
        self.backend = backend
        self.interview_id = interview_id
        self.state = state
        self.question: dict | None = state.get("question")
        self.answer_seconds = int(state.get("answerTimeSeconds") or 30)
        self.on_finished = on_finished

        self.parts: list[str] = []
        self.question_ready_at: float | None = None
        self.deadline_passed = False
        self.submitting = False
        self.finished = False
        self._grace_task: asyncio.Task | None = None
        self._deadline_task: asyncio.Task | None = None
        self._filler_index = 0

    # ── lifecycle ──
    async def on_enter(self):
        self.session.on("user_state_changed", self._on_user_state_changed)
        if not self.question:
            # Nothing left to ask (e.g. redial after the last answer) — close out.
            await self._finish("Thank you. Your interview is already complete. Goodbye!")
            return
        opener = "Sorry, we got disconnected. Let's continue where we left off. " if self.state.get("resumed") else ""
        await self._ask(self.question, prefix=opener)

    # ── speaking ──
    async def _ask(self, question: dict, prefix: str = ""):
        self.question = question
        self.parts = []
        self.deadline_passed = False
        self.question_ready_at = None
        handle = self.session.say(f"{prefix}{question['text']}", allow_interruptions=False)
        await handle.wait_for_playout()
        # The answer timer starts once the question has been fully heard,
        # like the on-screen countdown in the online interview.
        self.question_ready_at = time.time()
        self._cancel(self._deadline_task)
        self._deadline_task = asyncio.create_task(self._deadline())

    def _next_filler(self) -> str:
        text = FILLERS[self._filler_index % len(FILLERS)]
        self._filler_index += 1
        return text

    # ── listening ──
    def _on_user_state_changed(self, ev):
        # Candidate started talking again during the grace pause — they
        # weren't finished; keep collecting instead of submitting.
        if ev.new_state == "speaking":
            self._cancel(self._grace_task)

    async def on_user_turn_completed(self, turn_ctx, new_message):
        text = (new_message.text_content or "").strip()
        if self.finished or self.submitting or self.question_ready_at is None or not text:
            raise StopResponse()

        self.parts.append(text)
        self._cancel(self._grace_task)
        if self.deadline_passed:
            asyncio.create_task(self._submit(timed_out=True))
        else:
            self._grace_task = asyncio.create_task(self._grace_then_submit())
        raise StopResponse()  # never let an LLM reply — RecruitIQ decides what's next

    async def _grace_then_submit(self):
        await asyncio.sleep(ANSWER_GRACE_SECONDS)
        # Past the grace pause: detach from _grace_task so speech detected
        # later (e.g. while the NEXT question plays) can't cancel this task
        # midway through submitting / asking.
        self._grace_task = None
        await self._submit(timed_out=False)

    async def _deadline(self):
        await asyncio.sleep(self.answer_seconds)
        self.deadline_passed = True
        if self.session.user_state == "speaking":
            # Mid-sentence at the limit: submit as soon as this turn ends,
            # but never wait forever.
            await asyncio.sleep(15)
        if not self.submitting and not self.finished:
            await self._submit(timed_out=not self.parts)

    # ── RecruitIQ round trip ──
    async def _submit(self, timed_out: bool):
        if self.submitting or self.finished or not self.question:
            return
        self.submitting = True
        self._cancel(self._grace_task)
        self._cancel(self._deadline_task)

        transcript = " ".join(self.parts).strip()
        duration = int(time.time() - self.question_ready_at) if self.question_ready_at else None
        is_last = self.question.get("stage") == "CANDIDATE_QUESTIONS"

        try:
            if is_last:
                # The final answer also triggers report generation server-side,
                # which takes a while — say goodbye first instead of waiting in silence.
                closing = self.session.say(
                    "Thank you so much for your time today. That completes your interview. "
                    "The hiring team will review it and get back to you. Goodbye!",
                    allow_interruptions=False,
                )
                result, _ = await asyncio.gather(
                    self.backend.answer(
                        self.interview_id,
                        question_id=self.question["id"],
                        transcript=transcript,
                        duration_seconds=duration,
                        timed_out=timed_out,
                    ),
                    closing.wait_for_playout(),
                )
            else:
                self.session.say(self._next_filler() if transcript else "Let's move on.", allow_interruptions=False)
                result = await self.backend.answer(
                    self.interview_id,
                    question_id=self.question["id"],
                    transcript=transcript,
                    duration_seconds=duration,
                    timed_out=timed_out,
                )
        except BackendError as err:
            logger.error("answer submit failed for %s: %s", self.interview_id, err)
            if err.code == "STALE_QUESTION":
                # Already answered (e.g. retry) — re-sync to RecruitIQ's current question.
                state = await self.backend.context(self.interview_id)
                self.submitting = False
                if state.get("question"):
                    await self._ask(state["question"])
                    return
            self.submitting = False
            await self._finish("Sorry, we're having a technical problem. The team will reach out to you. Goodbye.", completed=False)
            return

        self.submitting = False
        if result.get("done"):
            await self._finish(None if is_last else "Thank you, that completes your interview. Goodbye!")
            return
        await self._ask(result["question"])

    async def _finish(self, goodbye: str | None, completed: bool = True):
        if self.finished:
            return
        self.finished = True
        self._cancel(self._grace_task)
        self._cancel(self._deadline_task)
        if goodbye:
            await self.session.say(goodbye, allow_interruptions=False).wait_for_playout()
        await self.on_finished(completed)

    @staticmethod
    def _cancel(task: asyncio.Task | None):
        if task and not task.done() and task is not asyncio.current_task():
            task.cancel()


def build_session(voice_gender: str | None) -> AgentSession:
    return AgentSession(
        vad=silero.VAD.load(),
        stt=os.getenv("STT_MODEL", "deepgram/nova-3:multi"),
        tts=tts_model_for(voice_gender),
        # Longer end-of-turn wait than a chatbot: interview answers have pauses.
        turn_handling={"endpointing": {"min_delay": 1.2, "max_delay": 6.0}},
    )


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    backend = RecruitIQBackend()
    ctx.add_shutdown_callback(backend.close)

    test_interview_id = os.getenv("TEST_INTERVIEW_ID")
    participant = None
    if test_interview_id:
        interview_id = test_interview_id
    else:
        participant = await ctx.wait_for_participant(kind=rtc.ParticipantKind.PARTICIPANT_KIND_SIP)
        interview_id = interview_id_from(participant)
        if not interview_id:
            # Header missing — fall back to the one call currently ringing.
            dialing = await backend.dialing_interviews()
            if len(dialing) == 1:
                interview_id = dialing[0]["id"]
                logger.warning("no X-Interview-Id on call; using the only dialing interview %s", interview_id)

    if not interview_id:
        # An unexpected inbound call to the number (not one we placed).
        session = build_session(None)
        await session.start(room=ctx.room, agent=Agent(instructions=""))
        await session.say(
            "Hello. This number is used by RecruitIQ to conduct scheduled interviews. "
            "We will call you at your interview time. Goodbye.",
            allow_interruptions=False,
        ).wait_for_playout()
        ctx.delete_room()
        return

    try:
        state = await backend.start(interview_id, ctx.room.name)
    except BackendError as err:
        logger.error("could not start interview %s: %s", interview_id, err)
        session = build_session(None)
        await session.start(room=ctx.room, agent=Agent(instructions=""))
        await session.say("Sorry, this interview is not available right now. Goodbye.", allow_interruptions=False).wait_for_playout()
        ctx.delete_room()
        return

    logger.info("interview %s started over the phone (resumed=%s)", interview_id, state.get("resumed"))
    reported = False

    async def report(status: str, reason: str | None = None):
        nonlocal reported
        if reported:
            return
        reported = True
        try:
            await backend.call_status(interview_id, status, reason=reason)
        except BackendError as err:
            logger.error("could not report %s for %s: %s", status, interview_id, err)

    async def on_finished(completed: bool):
        await report("COMPLETED" if completed else "DROPPED", None if completed else "agent error")
        ctx.delete_room()  # hangs up the phone call

    agent = InterviewAgent(backend, interview_id, state, on_finished)

    async def on_caller_left():
        await report("DROPPED", "caller hung up")
        ctx.delete_room()  # nobody left on the line — close the room

    def on_participant_disconnected(p: rtc.RemoteParticipant):
        # Candidate hung up / line dropped before the interview finished.
        if participant is not None and p.identity == participant.identity and not agent.finished:
            agent.finished = True
            asyncio.create_task(on_caller_left())

    ctx.room.on("participant_disconnected", on_participant_disconnected)

    session = build_session(state.get("voiceGender"))
    await session.start(room=ctx.room, agent=agent)


if __name__ == "__main__":
    cli.run_app(server)
