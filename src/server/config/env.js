import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Fail fast in any environment that actually needs the variable, but
    // avoid throwing at import time for optional/future-phase keys.
    console.warn(`[env] Missing environment variable: ${name}`);
  }
  return value;
}

// Vercel injects VERCEL_URL (the deployment's own hostname, no protocol) —
// used as a same-origin fallback so nothing ever defaults to a localhost
// URL once actually deployed, without requiring every env var to be set
// explicitly for a first deploy.
const deployedOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

function jwtSecret() {
  const value = process.env.JWT_SECRET;
  if (value) return value;

  if (isProd) {
    // Never fall back to a shared, guessable default in production — that
    // would let anyone forge valid auth tokens.
    throw new Error('JWT_SECRET must be set in production');
  }

  console.warn('[env] JWT_SECRET is not set — using an insecure development-only default.');
  return 'dev-insecure-secret-change-me';
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || 3001),
  clientUrl: process.env.CLIENT_URL || deployedOrigin || 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: jwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  // OPENROUTER_MODEL is the documented name (.env.example); OPENROUTER_CHAT_MODEL
  // is accepted as an alias so alternate .env conventions still work — the
  // model is still never hard-coded anywhere in application code.
  openRouterModel: process.env.OPENROUTER_MODEL || process.env.OPENROUTER_CHAT_MODEL || 'openai/gpt-4o-mini',
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL || deployedOrigin || 'http://localhost:5173',
  openRouterAppName: process.env.OPENROUTER_APP_NAME || 'RecruitIQ',

  uploadDir: process.env.UPLOAD_DIR || './uploads',
  // Default kept safely under Vercel's ~4.5MB request body ceiling for
  // Node.js serverless functions — a larger multer limit here wouldn't
  // help, since Vercel's platform would reject the request before Express
  // ever saw it.
  maxResumeSizeMb: Number(process.env.MAX_RESUME_SIZE_MB || 4),

  // Phase 2 — email notifications (src/server/notifications/email). Not
  // required: the email driver falls back to logging instead of sending
  // when BREVO_API_KEY is unset, so nothing crashes without it configured.
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoFromEmail: process.env.BREVO_FROM_EMAIL || '',
  brevoFromName: process.env.BREVO_FROM_NAME || 'RecruitIQ',

  // Phase 3 — read for forward-compat, unused in Phase 1/2.
  liveKit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },
};

export const isProduction = isProd;
