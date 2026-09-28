"""Client for RecruitIQ's /interviews/*/worker/* endpoints.

The phone agent never touches the database or decides interview logic. Every
question, follow-up and "interview finished" decision comes from RecruitIQ's
interview engine; this client only moves transcripts in and question text out.
"""

import logging
import os

import aiohttp

logger = logging.getLogger("recruitiq-backend")


class BackendError(Exception):
    def __init__(self, status: int, code: str | None, message: str):
        super().__init__(f"{status} {code or ''} {message}".strip())
        self.status = status
        self.code = code


class RecruitIQBackend:
    def __init__(self, base_url: str | None = None, worker_secret: str | None = None):
        # BACKEND_URL is RecruitIQ's origin, e.g. http://localhost:3001 (dev server)
        # or https://your-app.vercel.app. The /api/v1 prefix is added here.
        self.base_url = (base_url or os.environ["BACKEND_URL"]).rstrip("/") + "/api/v1/interviews"
        self.worker_secret = worker_secret or os.environ["INTERVIEW_WORKER_SECRET"]
        self._session: aiohttp.ClientSession | None = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await self.close()

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def _http(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            # Answer submission runs 2-3 LLM calls server-side (normalize,
            # evaluate, next question) — give it room.
            self._session = aiohttp.ClientSession(
                headers={"x-worker-secret": self.worker_secret},
                timeout=aiohttp.ClientTimeout(total=90),
            )
        return self._session

    async def _request(self, method: str, path: str, payload: dict | None = None) -> dict:
        async with self._http().request(method, f"{self.base_url}{path}", json=payload) as resp:
            body = await resp.json(content_type=None)
            if resp.status >= 400 or not body or not body.get("success"):
                # Error shape: { success: false, message, error: "<CODE>" }
                body = body or {}
                code = body.get("error") if isinstance(body.get("error"), str) else None
                raise BackendError(resp.status, code, body.get("message", "request failed"))
            return body.get("data") or {}

    # ── dialer ──
    async def due_interviews(self, limit: int = 5) -> list[dict]:
        return (await self._request("GET", f"/worker/phone-interviews/due?limit={limit}")).get("interviews", [])

    async def dialing_interviews(self) -> list[dict]:
        return (await self._request("GET", "/worker/phone-interviews/dialing")).get("interviews", [])

    async def claim(self, interview_id: str) -> dict:
        return (await self._request("POST", f"/{interview_id}/worker/claim")).get("interview", {})

    async def call_status(self, interview_id: str, status: str, *, twilio_call_sid: str | None = None, reason: str | None = None) -> dict:
        payload = {"status": status}
        if twilio_call_sid:
            payload["twilioCallSid"] = twilio_call_sid
        if reason:
            payload["reason"] = reason[:500]
        return await self._request("POST", f"/{interview_id}/worker/call-status", payload)

    # ── voice agent ──
    async def start(self, interview_id: str, room_name: str) -> dict:
        return (await self._request("POST", f"/{interview_id}/worker/start", {"roomName": room_name})).get("state", {})

    async def context(self, interview_id: str) -> dict:
        return (await self._request("GET", f"/{interview_id}/worker/context")).get("state", {})

    async def answer(self, interview_id: str, *, question_id: str, transcript: str, duration_seconds: int | None, timed_out: bool) -> dict:
        payload = {
            "questionId": question_id,
            "transcript": transcript,
            "rawTranscript": transcript,
            "timedOut": timed_out,
        }
        if duration_seconds is not None:
            payload["durationSeconds"] = duration_seconds
        return await self._request("POST", f"/{interview_id}/worker/answer", payload)
