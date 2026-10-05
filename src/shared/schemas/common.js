import { z } from 'zod';

// Shared field rules, used by every request schema (server) and every form
// (client) so both sides accept exactly the same input.

// Strips characters that have no place in plain-text fields: control chars and
// angle brackets (blocks HTML/script injection into emails and PDFs).
const UNSAFE_TEXT = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const requiredText = (label, max) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .refine((v) => !UNSAFE_TEXT.test(v), `${label} contains characters that aren't allowed (< >)`);

// '' and null are kept so an update can clear the field.
export const optionalText = (label, max) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .refine((v) => !UNSAFE_TEXT.test(v), `${label} contains characters that aren't allowed (< >)`)
    .nullable()
    .optional();

// Person names: letters (any language), spaces, and . ' - only.
const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;
export const personNameSchema = (label = 'Name') =>
  requiredText(label, 120).refine((v) => PERSON_NAME.test(v), `${label} can only contain letters, spaces, . ' and -`);

export const optionalPersonNameSchema = (label = 'Name') =>
  z
    .string()
    .trim()
    .max(120, `${label} must be at most 120 characters`)
    .refine((v) => v === '' || PERSON_NAME.test(v), `${label} can only contain letters, spaces, . ' and -`)
    .nullable()
    .optional();

// Organisation names: must contain at least one letter or digit.
export const orgNameSchema = (label, max = 200) =>
  requiredText(label, max).refine((v) => /[\p{L}\p{N}]/u.test(v), `${label} must contain letters or numbers`);

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .email('Please enter a valid email address');

export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Please enter a valid email address')
  .nullable()
  .optional();

// Only http(s) with a real domain — blocks javascript:, data:, file: and similar schemes.
function urlProblem(v, label) {
  if (!/^https?:\/\//i.test(v)) return `${label} must start with http:// or https://`;
  let url;
  try {
    url = new URL(v);
  } catch {
    return 'Enter a valid URL, e.g. https://example.com';
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url.hostname)) return 'Enter a valid website domain, e.g. https://example.com';
  return null;
}

export const optionalUrlFor = (label) =>
  z
    .string()
    .trim()
    .max(500, `${label} must be at most 500 characters`)
    .superRefine((v, ctx) => {
      const problem = v === '' ? null : urlProblem(v, label);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    })
    .nullable()
    .optional();

export const optionalUrlSchema = optionalUrlFor('Website');

// Phone: one optional leading +, then digits with optional spaces, dashes,
// dots or brackets; 7–15 digits in total (E.164 limit). Rejects "+39+39 …",
// letters and repeated separators. Stored cleaned up: "+39 319 123 4567".
const PHONE_SHAPE = /^\+?\(?[0-9]+\)?(?:[ .-]{1,2}\(?[0-9]+\)?)*$/;
export function cleanPhone(value) {
  return value.trim().replace(/\s+/g, ' ');
}
export function phoneProblem(value) {
  const v = cleanPhone(value);
  if ((v.match(/\+/g) || []).length > 1 || (v.includes('+') && !v.startsWith('+'))) {
    return 'Use only one + at the start, before the country code';
  }
  if (/[^0-9+ .\-()]/.test(v)) return 'Phone number can only contain digits, spaces, +, - and brackets';
  if (!PHONE_SHAPE.test(v)) return 'Enter a valid phone number, e.g. +39 319 123 4567';
  const digits = v.replace(/\D/g, '').length;
  if (digits < 7) return 'Phone number is too short';
  if (digits > 15) return 'Phone number is too long (max 15 digits)';
  return null;
}

const phoneRule = (required) =>
  z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .max(24, 'Phone number is too long')
    .superRefine((v, ctx) => {
      const problem = v === '' ? (required ? 'Phone number is required' : null) : phoneProblem(v);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    })
    .transform(cleanPhone);

export const phoneSchema = phoneRule(true);
export const optionalPhoneSchema = phoneRule(false).nullable().optional();

// Tag-style lists (skills, languages…): trimmed, no blanks, no duplicates, capped.
export const tagListSchema = (label, { maxItems = 50, maxLength = 60 } = {}) =>
  z
    .array(
      z
        .string()
        .trim()
        .min(1, `${label} can't be blank`)
        .max(maxLength, `Each ${label.toLowerCase()} entry must be at most ${maxLength} characters`)
        .refine((v) => !UNSAFE_TEXT.test(v), `${label} contains characters that aren't allowed (< >)`),
    )
    .max(maxItems, `Add at most ${maxItems} ${label.toLowerCase()}`)
    .transform((list) => list.filter((v, i) => list.findIndex((w) => w.toLowerCase() === v.toLowerCase()) === i));

export const idSchema = (label = 'id') =>
  z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).max(64, `Invalid ${label}`);

export const CURRENT_YEAR = new Date().getFullYear();

// Turns a Zod error into { field: message } for forms (first message per field).
export function fieldErrors(zodError) {
  const out = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// Client helper: { data } on success, { errors } on failure.
export function checkForm(schema, values) {
  const result = schema.safeParse(values);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrors(result.error) };
}
