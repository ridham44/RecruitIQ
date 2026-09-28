"""Calls candidates at their telephonic interview time.

Polls RecruitIQ for due phone interviews, claims each one (atomic — never
dialed twice), rings the candidate through Twilio, and reports no-answer /
failure back so RecruitIQ can schedule a retry. Once the candidate picks up,
agent.py takes over the conversation.

Run:  python dialer.py      (alongside:  python agent.py dev)
"""

import asyncio
import logging
import os
import time

from dotenv import load_dotenv

from backend import BackendError, RecruitIQBackend
from twilio_client import FAILED, FINISHED, NOT_ANSWERED, TwilioClient

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("dialer")

POLL_SECONDS = int(os.getenv("DIALER_POLL_SECONDS", "15"))
MAX_CONCURRENT_CALLS = int(os.getenv("MAX_CONCURRENT_CALLS", "3"))
STATUS_POLL_SECONDS = 3


async def watch_call(backend: RecruitIQBackend, twilio: TwilioClient, interview_id: str, call_sid: str):
    """Follow the Twilio call until it's answered or definitely not."""
    status = ""
    while True:
        try:
            status = await twilio.call_status(call_sid)
        except Exception as err:  # transient Twilio/API hiccup — keep watching
            logger.warning("status check failed for %s: %s", call_sid, err)
            status = ""
        if status == "in-progress":
            logger.info("interview %s: candidate picked up", interview_id)
            break
        if status in NOT_ANSWERED:
            await backend.call_status(interview_id, "NO_ANSWER", reason=f"twilio:{status}")
            logger.info("interview %s: not answered (%s)", interview_id, status)
            return
        if status in FAILED:
            await backend.call_status(interview_id, "FAILED", reason="twilio:failed")
            logger.info("interview %s: call failed", interview_id)
            return
        if status == "completed":
            break
        await asyncio.sleep(STATUS_POLL_SECONDS)

    # Answered. agent.py reports IN_CALL once it joins and COMPLETED/DROPPED
    # when the line ends. If the call ends while RecruitIQ still says DIALING,
    # the agent never connected (e.g. SIP/dispatch problem) — report it so the
    # interview isn't stuck and a retry can happen.
    while status not in FINISHED:
        await asyncio.sleep(5)
        try:
            status = await twilio.call_status(call_sid)
        except Exception as err:
            logger.warning("status check failed for %s: %s", call_sid, err)
    try:
        state = await backend.context(interview_id)
    except BackendError as err:
        logger.warning("interview %s: context check failed: %s", interview_id, err)
        return
    if state.get("callStatus") == "DIALING":
        logger.warning("interview %s: answered but the agent never joined — marking dropped", interview_id)
        await backend.call_status(interview_id, "DROPPED", reason="answered but agent never connected")


async def handle_interview(backend: RecruitIQBackend, twilio: TwilioClient, item: dict):
    interview_id = item["id"]
    try:
        claimed = await backend.claim(interview_id)
    except BackendError as err:
        if err.status == 409:
            return  # someone else claimed it, or it's no longer due
        raise

    logger.info(
        "interview %s: calling %s for %s (%s), attempt %s",
        interview_id, claimed.get("phoneNumber"), item.get("candidateName"), item.get("jobTitle"), claimed.get("callAttempts"),
    )
    try:
        call = await twilio.create_call(claimed["phoneNumber"], interview_id)
    except Exception as err:
        logger.error("interview %s: could not place call: %s", interview_id, err)
        await backend.call_status(interview_id, "FAILED", reason=str(err))
        return

    await backend.call_status(interview_id, "DIALING", twilio_call_sid=call["sid"])
    await watch_call(backend, twilio, interview_id, call["sid"])


async def main():
    backend = RecruitIQBackend()
    twilio = TwilioClient()
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_CALLS)
    in_flight: set[str] = set()

    async def run(item: dict):
        async with semaphore:
            try:
                await handle_interview(backend, twilio, item)
            except Exception:
                logger.exception("interview %s: dialing error", item["id"])
            finally:
                in_flight.discard(item["id"])

    logger.info("dialer started — polling %s every %ss", backend.base_url, POLL_SECONDS)
    last_error_log = 0.0
    try:
        while True:
            try:
                for item in await backend.due_interviews(limit=MAX_CONCURRENT_CALLS):
                    if item["id"] not in in_flight:
                        in_flight.add(item["id"])
                        asyncio.create_task(run(item))
            except Exception as err:
                # Backend down/restarting — log at most once a minute.
                if time.time() - last_error_log > 60:
                    logger.warning("could not fetch due interviews: %s", err)
                    last_error_log = time.time()
            await asyncio.sleep(POLL_SECONDS)
    finally:
        await backend.close()
        await twilio.close()


if __name__ == "__main__":
    asyncio.run(main())
