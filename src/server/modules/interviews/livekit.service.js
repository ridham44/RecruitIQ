import { AccessToken } from 'livekit-server-sdk';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

// The only place LIVEKIT_API_SECRET is ever read — it signs a short-lived
// room-scoped token here, on the server, and only the resulting JWT is sent
// to the browser. The secret itself never reaches frontend code (Section
// 3/6). This Vercel app never joins a room or touches audio; that's
// livekit-worker/'s job.
export function roomNameForInterview(interviewId) {
  return `interview-${interviewId}`;
}

export async function createInterviewToken({ interviewId, identity, name }) {
  if (!env.liveKit.apiKey || !env.liveKit.apiSecret || !env.liveKit.url) {
    throw ApiError.internal('LiveKit is not configured (LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET)', 'LIVEKIT_NOT_CONFIGURED');
  }

  const roomName = roomNameForInterview(interviewId);
  const token = new AccessToken(env.liveKit.apiKey, env.liveKit.apiSecret, {
    identity,
    name,
    // Short-lived — a fresh token is requested each time the candidate
    // (re)joins, so there's no long-lived credential to worry about leaking.
    ttl: '2h',
  });
  token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });

  return { token: await token.toJwt(), url: env.liveKit.url, roomName };
}
