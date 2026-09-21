// Fallback driver used when Brevo isn't configured (no BREVO_API_KEY) —
// logs instead of sending, so local development and demos work without an
// email provider set up. Never used automatically once BREVO_API_KEY is
// present (see index.js).
export async function send({ to, subject }) {
  console.log(`[email:console] Would send to ${to} — "${subject}" (BREVO_API_KEY not configured)`);
}
