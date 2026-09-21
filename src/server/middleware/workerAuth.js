import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// The livekit-worker service has no candidate/company JWT — it acts on
// behalf of the system, not a specific user. It authenticates with a
// shared secret instead (Section 6/Phase 3: "Vercel handles ... interview
// state/business logic", worker only calls in with STT transcripts and
// reads back what to say next). Never accept this on any route a browser
// could reach — worker routes are mounted separately, see interviews.routes.js.
export function authenticateWorker(req, res, next) {
  const provided = req.headers['x-worker-secret'];

  if (!env.interviewWorkerSecret) {
    throw ApiError.internal('INTERVIEW_WORKER_SECRET is not configured', 'WORKER_AUTH_NOT_CONFIGURED');
  }
  if (!provided || provided !== env.interviewWorkerSecret) {
    throw ApiError.unauthorized('Invalid worker secret', 'INVALID_WORKER_SECRET');
  }
  next();
}
