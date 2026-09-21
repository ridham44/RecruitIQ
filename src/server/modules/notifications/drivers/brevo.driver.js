import { env } from '../../../config/env.js';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// Sends via Brevo's transactional email REST API directly (no SDK
// dependency) — mirrors the style of src/server/ai/openrouter.service.js.
// Throws on failure; the caller (email.service.js) is responsible for
// catching it, logging to EmailLog, and never letting an email failure
// break the request that triggered it.
export async function send({ to, subject, html }) {
  if (!env.brevoApiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }
  if (!env.brevoFromEmail) {
    throw new Error('BREVO_FROM_EMAIL is not configured');
  }

  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': env.brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: env.brevoFromEmail, name: env.brevoFromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo request failed (${response.status}): ${body}`);
  }
}
