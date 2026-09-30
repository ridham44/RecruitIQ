// Strips demographic/PII lines (gender, DOB, age, marital status, etc.) and
// a person's own name out of raw resume/transcript text before it ever
// reaches an LLM prompt. Shared by every AI service that includes resume
// text or interview transcripts in a prompt (candidate-matcher,
// interview-question-generator, interview-report-generator) — a deliberate
// second layer of defense alongside each system prompt's own instruction:
// bias-relevant fields must never even be visible to the model, not just
// "ignored" by instruction.
const DEMOGRAPHIC_LINE_PATTERN =
  /^.*\b(gender|sex|date of birth|dob|age|marital status|religion|nationality|caste)\b\s*[:\-].*$/gim;

// Build plan P6: recruiter-written guidance is free text, not "label: value"
// lines, so it gets a stricter filter — any sentence that mentions a
// demographic / protected characteristic is dropped entirely before it can
// reach a prompt (e.g. "Prefer candidates under 30" disappears; "Ask about
// Kubernetes" stays).
const DEMOGRAPHIC_WORD_PATTERN =
  /\b(gender|sex|sexual|orientation|male|female|men|women|man|woman|boys?|girls?|age|aged|years?\s+old|young(er)?|older|elderly|religio\w*|caste|marital|married|pregnan\w*|maternity|nationality|ethnic\w*|race|racial|disab\w*|handicap\w*)\b/i;

export function sanitizeRecruiterGuidance(text) {
  if (!text?.trim()) return { text: '', removed: 0 };
  const pieces = text
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = pieces.filter((s) => !DEMOGRAPHIC_WORD_PATTERN.test(s));
  return { text: kept.join('\n').slice(0, 2000), removed: pieces.length - kept.length };
}

export function sanitizePersonalText(text, personName) {
  if (!text) return '';
  let sanitized = text.replace(DEMOGRAPHIC_LINE_PATTERN, '');

  if (personName?.trim()) {
    const escapedName = personName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escapedName, 'gi'), '[Candidate]');
  }

  return sanitized;
}
