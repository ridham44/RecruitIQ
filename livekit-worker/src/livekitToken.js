import { AccessToken } from 'livekit-server-sdk';
import { config } from './config.js';

// The worker signs its own token to join as the "ai-interviewer" agent
// participant — separate from the candidate's token, which the main Vercel
// app generates (src/server/modules/interviews/livekit.service.js). Same
// room-naming convention (`interview-<id>`) on both sides.
export function roomNameForInterview(interviewId) {
  return `interview-${interviewId}`;
}

export async function createAgentToken(roomName) {
  const token = new AccessToken(config.liveKitApiKey, config.liveKitApiSecret, {
    identity: 'ai-interviewer',
    name: 'AI Interviewer',
    ttl: '4h',
  });
  token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
  return token.toJwt();
}
