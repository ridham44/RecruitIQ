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

export function sanitizePersonalText(text, personName) {
  if (!text) return '';
  let sanitized = text.replace(DEMOGRAPHIC_LINE_PATTERN, '');

  if (personName?.trim()) {
    const escapedName = personName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escapedName, 'gi'), '[Candidate]');
  }

  return sanitized;
}
