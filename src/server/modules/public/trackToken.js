import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

// The candidate's personal status link (/careers/track?token=…). It works
// without a login: the signed token is the credential, and it only ever
// shows (and, for slot booking, acts on) that one application.
// Moved here from guestApply.service.js so emails can include the link too.

export const TRACK_TOKEN_TTL = '30d';

function clientOrigin() {
  return env.clientUrl.split(',')[0].trim();
}

export function trackUrl(token) {
  return `${clientOrigin()}/careers/track?token=${token}`;
}

export function signTrackToken(kind, id) {
  return jwt.sign({ typ: 'track', kind, id }, env.jwtSecret, { expiresIn: TRACK_TOKEN_TTL });
}

export function readTrackToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.typ === 'track' && (payload.kind === 'application' || payload.kind === 'submission')) return payload;
  } catch {
    /* fall through */
  }
  throw ApiError.notFound('This tracking link is invalid or has expired', 'TRACK_TOKEN_INVALID');
}

// Fresh status link for one application (used in candidate emails).
export function applicationTrackUrl(applicationId) {
  return trackUrl(signTrackToken('application', applicationId));
}
