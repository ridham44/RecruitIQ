import 'dotenv/config';

function required(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // Fail fast in any environment that actually needs the variable, but
    // avoid throwing at import time for optional/future-phase keys.
    console.warn(`[env] Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  // OPENROUTER_MODEL is the documented name (.env.example); OPENROUTER_CHAT_MODEL
  // is accepted as an alias so alternate .env conventions still work — the
  // model is still never hard-coded anywhere in application code.
  openRouterModel: process.env.OPENROUTER_MODEL || process.env.OPENROUTER_CHAT_MODEL || 'openai/gpt-4o-mini',
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
  openRouterAppName: process.env.OPENROUTER_APP_NAME || 'RecruitIQ',

  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxResumeSizeMb: Number(process.env.MAX_RESUME_SIZE_MB || 5),

  // Score (0-100) at/above which a screened application is auto-marked
  // SHORTLISTED rather than REJECTED (Section 13/14). Configurable so the
  // scoring bar can be tuned per deployment without code changes.
  screeningShortlistThreshold: Number(process.env.SCREENING_SHORTLIST_THRESHOLD || 60),

  // Phase 2 / Phase 3 — read for forward-compat, unused in Phase 1.
  brevoApiKey: process.env.BREVO_API_KEY || '',
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

export const isProduction = env.nodeEnv === 'production';
