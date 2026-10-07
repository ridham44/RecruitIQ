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

// Boolean env flag: "true"/"1"/"yes"/"on" → true, "false"/"0"/"no"/"off" →
// false, unset/empty/anything else → the given default.
function flag(name, fallback) {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'off'].includes(raw)) return false;
  return fallback;
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
  // Build plan P9: the public address of the live product, e.g.
  // https://recruitiq-eta.vercel.app — every link that leaves the app uses it:
  // emailed links (interview, set password, status, login, application,
  // Company HR submission) and the /recq links recruiters copy and share.
  // Falls back to CLIENT_URL (which stays the CORS origin list). Point it at
  // the instance that holds the data (local dev/demo → http://localhost:5173).
  // On Vercel without PUBLIC_APP_URL, the project's production domain
  // (VERCEL_PROJECT_PRODUCTION_URL, e.g. recruitiq-eta.vercel.app) is used —
  // never a localhost CLIENT_URL left over from local development.
  publicAppUrl: (
    process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL
      ? (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) || deployedOrigin
      : null) ||
    process.env.CLIENT_URL ||
    deployedOrigin ||
    'http://localhost:5173'
  )
    .split(',')[0]
    .trim()
    .replace(/\/+$/, ''),

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

  // Phase 3 — AI voice interviews. This Vercel app only ever generates
  // LiveKit access tokens (livekit.service.js) — it never joins a room or
  // touches audio itself; that's the separate livekit-worker/ service's
  // job (see its own .env). apiSecret must never reach the frontend.
  liveKit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },
  // Shared secret the livekit-worker authenticates its calls back to this
  // app's /interviews/*/worker/* endpoints with (no candidate JWT exists on
  // the worker side — it acts on behalf of the system, not a specific
  // user). Required in production once Phase 3 is actually used.
  interviewWorkerSecret: process.env.INTERVIEW_WORKER_SECRET || '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  // Build plan P4 — phone OTP. "console" prints codes in the server log.
  smsDriver: (process.env.SMS_DRIVER || 'console').trim().toLowerCase(),
  // Numbers typed without a country code (e.g. 9876543210) get this prefix.
  defaultPhoneCountryCode: (process.env.DEFAULT_PHONE_COUNTRY_CODE || '+91').trim(),

  // Pending-features build plan (docs/implementation-plan.html). Every flag
  // defaults to today's behavior, so new functionality stays off until it's
  // explicitly turned on per environment.
  features: {
    // P1 — when false, POST /auth/register/company returns 403 and only a
    // Platform Admin can onboard companies. Off by default: agencies are added
    // by the Portal Admin (there is no sign-up page). Create the first admin
    // with scripts/create-admin.mjs.
    allowCompanySelfRegister: flag('ALLOW_COMPANY_SELF_REGISTER', false),
    // P4 — public careers portal, guest apply with phone OTP, CV-only submit.
    guestApply: flag('FEATURE_GUEST_APPLY', false),
    // P5 — instant interview link (attend now or later) instead of slot booking.
    instantInterview: flag('FEATURE_INSTANT_INTERVIEW', false),
    // P8 — client HR / hiring person portal.
    clientPortal: flag('FEATURE_CLIENT_PORTAL', false),
    // P9 — /recq agency-link candidate flow (resume match → email OTP →
    // interview access). The new canonical public candidate journey, so it
    // defaults ON; /careers/* redirects into it. Turn off to hide every
    // /recq route (they answer 404, and the careers redirect goes nowhere).
    recq: flag('FEATURE_RECQ', true),
    // P9 (§1/§19) — the old cross-agency candidate job board: GET /jobs
    // (every agency's open jobs), public GET /jobs/:id and logged-in
    // POST /applications to any job. OFF by default — candidates only reach
    // an agency's jobs through its /recq link. Legacy test scripts that
    // exercise the old flow need it on.
    candidateJobBoard: flag('FEATURE_CANDIDATE_JOB_BOARD', false),
    // "Start here" demo page: when on, /start shows the demo accounts'
    // password (DEMO_PASSWORD). Off → the page still lists roles and links.
    demoPage: flag('DEMO_PAGE', false),
  },
  // Password shared by the demo accounts (scripts/seed-demo.mjs).
  demoPassword: (process.env.DEMO_PASSWORD || 'Demo@123').trim(),
};

export const isProduction = isProd;
