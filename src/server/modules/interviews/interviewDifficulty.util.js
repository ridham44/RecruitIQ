// Pure, deterministic helpers for the adaptive-difficulty state machine
// (Section 5: "Create clear rules for when difficulty can increase/decrease"
// — never left to the LLM's own judgement). Kept separate from
// screening/deterministic.util.js since this is interview-specific tuning
// that may evolve independently of screening's skill-overlap math.

// Job's minimumExperience (years) -> a coarse seniority framing passed into
// the question-generation prompt as a hard constraint (Section 4).
export function computeExperienceTier(minimumExperience) {
  const yrs = Number(minimumExperience) || 0;
  if (yrs < 1) return 'FRESHER';
  if (yrs < 3) return 'JUNIOR';
  if (yrs < 6) return 'MID';
  return 'SENIOR';
}

// Buckets the lightweight live evaluator's 0-100 relevance score into a
// coarse strength signal used only to move difficulty, not to score the
// candidate. A missing/undefined relevance (timed-out or empty answer)
// buckets to WEAK.
export function bucketAnswerStrength(relevance) {
  const r = relevance ?? 0;
  if (r < 40) return 'WEAK';
  if (r < 75) return 'ADEQUATE';
  return 'STRONG';
}

const DIFFICULTY_ORDER = ['EASY', 'MEDIUM', 'HARD'];

// The one place difficulty transitions happen. STRONG moves up one level,
// WEAK moves down one level, ADEQUATE holds — clamped at both ends, and
// never influenced by anything other than this table.
export function nextDifficulty(currentDifficulty, answerStrength) {
  const idx = DIFFICULTY_ORDER.indexOf(currentDifficulty || 'MEDIUM');
  const safeIdx = idx === -1 ? 1 : idx;
  if (answerStrength === 'STRONG') return DIFFICULTY_ORDER[Math.min(safeIdx + 1, DIFFICULTY_ORDER.length - 1)];
  if (answerStrength === 'WEAK') return DIFFICULTY_ORDER[Math.max(safeIdx - 1, 0)];
  return DIFFICULTY_ORDER[safeIdx];
}
