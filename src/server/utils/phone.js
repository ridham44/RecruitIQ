import { env } from '../config/env.js';

// Build plan P4: normalizes what a candidate types into E.164 (+919876543210)
// so the OTP, rate limits and the Candidate.phone all use one format.
// Returns null when it can't be a valid number.
//   "98765 43210"      -> +919876543210 (DEFAULT_PHONE_COUNTRY_CODE)
//   "098765 43210"     -> +919876543210
//   "91 98765 43210"   -> +919876543210
//   "+1 (415) 555-0100"-> +14155550100
export function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  const cc = env.defaultPhoneCountryCode.replace(/\D/g, '');
  let e164;
  if (trimmed.startsWith('+')) e164 = `+${digits}`;
  else if (trimmed.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else if (digits.length === 10) e164 = `+${cc}${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) e164 = `+${cc}${digits.slice(1)}`;
  else if (digits.length === cc.length + 10 && digits.startsWith(cc)) e164 = `+${digits}`;
  else return null;

  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

// "+919876543210" -> "+91 ••••• ••210" for display in messages/logs.
export function maskPhone(e164) {
  if (!e164) return '';
  return `${e164.slice(0, -3).replace(/\d/g, '•')}${e164.slice(-3)}`;
}
