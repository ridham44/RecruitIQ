# RecruitIQ Phone Agent: telephonic AI interviews

When a company creates a **Telephonic** interview slot and a candidate books it, this agent **calls the candidate at the slot time**. The AI interviewer then runs the interview over the phone.

The interview is RecruitIQ's own engine, the same one the online interview uses: same stages, resume-based questions, follow-ups and adaptive difficulty. It produces the **same final report** (overall, technical and communication %). This process only handles the call and the audio.

It's adapted from `livekit-twilow` (Twilio → LiveKit → Python agent). It reuses that project's LiveKit inbound trunk and dispatch rule.

```
dialer.py ── at slot time ──► Twilio REST: call +91<candidate>
                                │ candidate picks up
                                ▼
Twilio <Dial><Sip …?X-Interview-Id=…> ──► LiveKit inbound trunk ──► agent.py
agent.py:  speech ─STT─► POST /interviews/:id/worker/answer ─► next question ─TTS─► phone
```

| File | What it does |
|---|---|
| `dialer.py` | Polls RecruitIQ for due phone interviews, claims one (never dials twice), places the Twilio call, reports no-answer/failure so RecruitIQ can retry |
| `agent.py` | LiveKit voice agent. Asks RecruitIQ's questions and sends back answers. Handles pauses, the silence timer, hang-ups and redials |
| `backend.py` | Client for RecruitIQ's `/interviews/*/worker/*` endpoints (shared secret) |
| `twilio_client.py` | Places the outbound call and reads its status |
| `setup_sip.py` | One-time step. Adds the `X-Interview-Id` header mapping to the existing LiveKit trunk |

## Setup

```bash
cd phone-agent
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env           # then fill it in
```

In `.env`:
- **LiveKit / SIP values:** copy them from `livekit-twilow/.env` (`LIVEKIT_*`, `TWILIO_PHONE_NUMBER`, `LIVEKIT_SIP_URI`, `SIP_AUTH_USER`, `SIP_AUTH_PASS`).
- **`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`:** find them in Twilio Console → Account Info. livekit-twilow's `.env` doesn't have them; it only ever received calls.
- **`INTERVIEW_WORKER_SECRET`:** use the same value as in RecruitIQ's root `.env`.
- **`BACKEND_URL`:** `http://localhost:3001` for local dev.

Then run this once:

```bash
python setup_sip.py
```

## Run

Stop livekit-twilow's agent first. Both register as `doc-agent` on the same number.

```bash
# RecruitIQ (repo root):  npm run dev
python agent.py dev      # terminal 2: the voice agent
python dialer.py         # terminal 3: places the calls
```

## Test it

1. **No phone, full flow:** from the repo root, run `node scripts/test-phone-interview.mjs path/to/resume.docx`. It plays this agent's role against the real API, covering booking, dialing, retries, a redial, the full interview and the report.
2. **Voice, no phone:** book a telephonic slot, set `TEST_INTERVIEW_ID=<interview id>` in `.env`, then run `python agent.py console` and talk through your mic.
3. **Real call:**
   - As the company, go to Interviews, pick **Telephonic**, and add a slot.
   - As the candidate, book it with your number.
   - As the company, click **Call now** (or wait for the slot time).
   - Pick up and answer the questions. The report then appears on the company's interview page.

**Twilio trial notes:**
- Trial accounts can only call **Verified Caller IDs**, so add your number under Phone Numbers → Verified Caller IDs.
- Trial calls play a short Twilio message and ask you to **press a key** before the interview starts.

## Behaviour

- **No answer:** retried up to `PHONE_INTERVIEW_MAX_CALL_ATTEMPTS` (default 3) times, `PHONE_INTERVIEW_RETRY_DELAY_MINUTES` (default 3) minutes apart. Both settings live in RecruitIQ's `.env`. If every attempt fails, the booking is cancelled and the candidate can book again.
- **Hang-up mid-interview:** the agent redials after about 1 minute and resumes at the same question. If the retries run out, the interview is finished with the answers given so far, so a report is still produced.
- **Answer timing:** an answer is submitted after a short pause (`ANSWER_GRACE_SECONDS`), or when the job's answer time runs out, the same as the online countdown.
- **Voice:** set `TTS_VOICE_FEMALE` / `TTS_VOICE_MALE` so the AI voice follows the company's interviewer voice setting.
