import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  liveKitUrl: required('LIVEKIT_URL'),
  liveKitApiKey: required('LIVEKIT_API_KEY'),
  liveKitApiSecret: required('LIVEKIT_API_SECRET'),

  // Same values the main Vercel app's env.js reads — this worker generates
  // its own tokens for the "ai-interviewer" participant identity, so it
  // needs the LiveKit key pair too (see livekitToken.js).
  deepgramApiKey: required('DEEPGRAM_API_KEY'),

  // The Vercel app's own URL and the shared secret it authenticates worker
  // requests with (Section 6). Must match INTERVIEW_WORKER_SECRET there.
  backendUrl: (process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, ''),
  workerSecret: required('INTERVIEW_WORKER_SECRET'),

  webhookPort: Number(process.env.WEBHOOK_PORT || 4001),
};
