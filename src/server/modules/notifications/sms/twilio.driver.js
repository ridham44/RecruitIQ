import { env } from '../../../config/env.js';

// Build plan P4: Twilio Messages REST API (no SDK dependency). Uses the same
// TWILIO_* credentials as the rest of the app. Note: Twilio trial accounts
// only deliver to verified numbers, and Indian numbers need DLT registration
// for production traffic.
export const name = 'twilio';

export async function send({ to, body }) {
  const { accountSid, authToken, phoneNumber } = env.twilio;
  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error('Twilio SMS is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)');
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: phoneNumber, Body: body }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Twilio SMS failed (${res.status}): ${detail.message || 'unknown error'}`);
  }
}
