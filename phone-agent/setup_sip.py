"""One-time LiveKit setup for RecruitIQ telephonic interviews.

On a fresh LiveKit project it creates the inbound trunk (with the header
mapping) and the dispatch rule. On livekit-twilow's existing project it
reuses them and only adds the mapping, as described below.

Reuses the inbound trunk + dispatch rule that livekit-twilow's setup_sip.py
already created for TWILIO_PHONE_NUMBER, and only ADDS one thing: a mapping
from the X-Interview-Id SIP header (sent by dialer.py's TwiML) to a
participant attribute, so the agent knows which interview each call is for.
Nothing is removed. Safe to re-run.

Run:  python setup_sip.py
"""

import asyncio
import os

from dotenv import load_dotenv
from livekit import api

load_dotenv()

HEADER_MAPPING = {
    "X-Interview-Id": "recruitiq.interview_id",
    "x-interview-id": "recruitiq.interview_id",
}


async def main():
    # number = os.environ["TWILIO_PHONE_NUMBER"]
    number = os.getenv("LIVEKIT_TRUNK_NUMBER") or os.environ["TWILIO_PHONE_NUMBER"]
    agent_name = os.getenv("LIVEKIT_AGENT_NAME", "doc-agent")

    lk = api.LiveKitAPI()  # reads LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET
    try:
        trunks = await lk.sip.list_inbound_trunk(api.ListSIPInboundTrunkRequest())
        trunk = next((t for t in trunks.items if number in t.numbers), None)
        # if trunk is None:
        #     print(f"No LiveKit inbound trunk found for {number}.")
        #     print("Run livekit-twilow's setup_sip.py first (it creates the trunk + dispatch rule), then re-run this.")
        #     return
        if trunk is None:
            # Fresh LiveKit project: create the inbound trunk ourselves (same
            # as livekit-twilow's setup_sip.py, plus the header mapping).
            trunk = await lk.sip.create_inbound_trunk(
                api.CreateSIPInboundTrunkRequest(
                    trunk=api.SIPInboundTrunkInfo(
                        name="RecruitIQ phone interviews",
                        numbers=[number],
                        auth_username=os.environ["SIP_AUTH_USER"],
                        auth_password=os.environ["SIP_AUTH_PASS"],
                        headers_to_attributes=HEADER_MAPPING,
                    )
                )
            )
            print("Created inbound trunk:", trunk.sip_trunk_id)

        if all(trunk.headers_to_attributes.get(k) == v for k, v in HEADER_MAPPING.items()):
            print("Inbound trunk already maps X-Interview-Id:", trunk.sip_trunk_id)
        else:
            updated = api.SIPInboundTrunkInfo()
            updated.CopyFrom(trunk)
            for header, attribute in HEADER_MAPPING.items():
                updated.headers_to_attributes[header] = attribute
            # The list API may not return the password — set the login from
            # .env (the same values Twilio uses) so a full update can't blank it.
            updated.auth_username = os.environ["SIP_AUTH_USER"]
            updated.auth_password = os.environ["SIP_AUTH_PASS"]
            await lk.sip.update_inbound_trunk(trunk.sip_trunk_id, updated)
            print("Added X-Interview-Id header mapping to inbound trunk:", trunk.sip_trunk_id)

        rules = await lk.sip.list_dispatch_rule(api.ListSIPDispatchRuleRequest())
        rule = next((r for r in rules.items if trunk.sip_trunk_id in r.trunk_ids), None)
        # if rule is None:
        #     print("No dispatch rule for this trunk — run livekit-twilow's setup_sip.py first.")
        #     return
        if rule is None:
            # Each call gets its own room ("call-<random>") with the interview agent in it.
            rule = await lk.sip.create_dispatch_rule(
                api.CreateSIPDispatchRuleRequest(
                    dispatch_rule=api.SIPDispatchRuleInfo(
                        name="Calls to RecruitIQ interviewer",
                        trunk_ids=[trunk.sip_trunk_id],
                        rule=api.SIPDispatchRule(dispatch_rule_individual=api.SIPDispatchRuleIndividual(room_prefix="call-")),
                        room_config=api.RoomConfiguration(agents=[api.RoomAgentDispatch(agent_name=agent_name)]),
                    )
                )
            )
            print(f'Created dispatch rule {rule.sip_dispatch_rule_id} -> agent "{agent_name}"')
        agents = [a.agent_name for a in rule.room_config.agents]
        if agent_name in agents:
            print(f'Dispatch rule sends calls to agent "{agent_name}" — matches LIVEKIT_AGENT_NAME. Ready.')
        else:
            print(f'WARNING: dispatch rule dispatches {agents or "no named agent"}, but LIVEKIT_AGENT_NAME is "{agent_name}".')
            print("Set LIVEKIT_AGENT_NAME in phone-agent/.env to match, or calls won't reach the interview agent.")
    finally:
        await lk.aclose()


if __name__ == "__main__":
    asyncio.run(main())
