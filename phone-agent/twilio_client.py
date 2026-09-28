"""Minimal Twilio REST client: place an outbound call and read its status.

How the AI reaches the candidate (works on a Twilio trial, no Elastic SIP
Trunking needed):

  1. Twilio calls the candidate's phone.
  2. When they pick up, Twilio runs the TwiML below: <Dial><Sip> into the
     LiveKit inbound trunk that livekit-twilow's setup_sip.py created, with
     an X-Interview-Id SIP header saying which interview this call is for.
  3. LiveKit's dispatch rule puts the call in a room and dispatches the agent
     (agent.py), which reads the header and runs that interview.
"""

import os
from xml.sax.saxutils import escape

import aiohttp

TWILIO_API = "https://api.twilio.com/2010-04-01"

# Twilio call statuses: https://www.twilio.com/docs/voice/api/call-resource#call-status-values
NOT_ANSWERED = {"busy", "no-answer", "canceled"}
FAILED = {"failed"}
FINISHED = {"completed"} | NOT_ANSWERED | FAILED


class TwilioClient:
    def __init__(self):
        self.account_sid = os.environ["TWILIO_ACCOUNT_SID"]
        self.auth_token = os.environ["TWILIO_AUTH_TOKEN"]
        # Caller ID shown to the candidate: a number this Twilio account owns
        # (or a Verified Caller ID).
        self.from_number = os.environ["TWILIO_PHONE_NUMBER"]
        # The number the LiveKit inbound trunk was created for (livekit-twilow's
        # setup_sip.py). Only used inside the SIP address so LiveKit accepts the
        # bridged call; defaults to TWILIO_PHONE_NUMBER when they're the same.
        self.trunk_number = os.getenv("LIVEKIT_TRUNK_NUMBER") or self.from_number
        self.sip_host = os.environ["LIVEKIT_SIP_URI"].removeprefix("sip:").strip()
        self.sip_user = os.environ["SIP_AUTH_USER"]
        self.sip_pass = os.environ["SIP_AUTH_PASS"]
        self.ring_seconds = int(os.getenv("CALL_RING_SECONDS", "30"))
        self._session: aiohttp.ClientSession | None = None

    def _http(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                auth=aiohttp.BasicAuth(self.account_sid, self.auth_token),
                timeout=aiohttp.ClientTimeout(total=30),
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def twiml_for(self, interview_id: str) -> str:
        # The number in the SIP URI must match the LiveKit inbound trunk's
        # numbers or LiveKit rejects the call.
        # sip_uri = f"sip:{self.from_number}@{self.sip_host};transport=tcp?X-Interview-Id={interview_id}"
        sip_uri = f"sip:{self.trunk_number}@{self.sip_host};transport=tcp?X-Interview-Id={interview_id}"
        return (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response>"
            '<Dial answerOnBridge="true">'
            f'<Sip username="{escape(self.sip_user)}" password="{escape(self.sip_pass)}">{escape(sip_uri)}</Sip>'
            "</Dial>"
            "</Response>"
        )

    async def create_call(self, to_number: str, interview_id: str) -> dict:
        data = {
            "To": to_number,
            "From": self.from_number,
            "Twiml": self.twiml_for(interview_id),
            "Timeout": str(self.ring_seconds),
        }
        async with self._http().post(f"{TWILIO_API}/Accounts/{self.account_sid}/Calls.json", data=data) as resp:
            body = await resp.json(content_type=None)
            if resp.status >= 400:
                raise RuntimeError(f"Twilio {resp.status}: {body.get('message') if body else 'call create failed'}")
            return body

    async def call_status(self, call_sid: str) -> str:
        async with self._http().get(f"{TWILIO_API}/Accounts/{self.account_sid}/Calls/{call_sid}.json") as resp:
            body = await resp.json(content_type=None)
            if resp.status >= 400:
                raise RuntimeError(f"Twilio {resp.status}: {body.get('message') if body else 'status fetch failed'}")
            return body.get("status", "")
