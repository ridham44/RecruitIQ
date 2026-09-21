import { config } from './config.js';

// Every call to the Vercel app goes through here, authenticated with the
// shared worker secret (Section 6: "Sending candidate transcript to
// interview engine, Receiving AI response"). This worker never talks to
// OpenRouter or the database directly — all business logic/state lives in
// the backend, matching the architecture split the spec asks for.
async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${config.backendUrl}/api/v1/interviews${path}`, {
    method,
    headers: {
      'x-worker-secret': config.workerSecret,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Backend request failed: ${method} ${path} -> ${res.status}`);
  }
  return json.data;
}

export const backendClient = {
  getContext: (interviewId) => request(`/${interviewId}/worker/context`),
  submitAnswer: (interviewId, payload) => request(`/${interviewId}/worker/answer`, { method: 'POST', body: payload }),
  logEvent: (interviewId, type, metadata) =>
    request(`/${interviewId}/worker/events`, { method: 'POST', body: { type, metadata } }).catch((err) =>
      console.error(`[backendClient] failed to log ${type} for ${interviewId}:`, err.message)
    ),
};
