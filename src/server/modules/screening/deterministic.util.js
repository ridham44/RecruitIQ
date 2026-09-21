// Rule-based checks computed without the LLM (Section 13: "Do not make the
// LLM the only source of truth. Use deterministic checks where possible").
// These are blended with the AI's semantic scores in screening.service.js
// and stored under ScreeningResult.deterministicChecks for transparency.

function normalizeSkill(skill) {
  return skill.trim().toLowerCase();
}

export function computeSkillOverlap(candidateSkills = [], jobSkills = []) {
  const candidateSet = new Set(candidateSkills.map(normalizeSkill));
  const matched = [];
  const missing = [];

  for (const skill of jobSkills) {
    if (candidateSet.has(normalizeSkill(skill))) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  const ratio = jobSkills.length === 0 ? 1 : matched.length / jobSkills.length;
  return { matched, missing, score: Math.round(ratio * 100) };
}

export function computeExperienceScore(candidateYears, minExperience, maxExperience) {
  const years = Number(candidateYears) || 0;
  const min = Number(minExperience) || 0;
  const max = maxExperience == null ? null : Number(maxExperience);

  if (years >= min && (max == null || years <= max)) {
    return { score: 100, meetsRequirement: true };
  }

  if (years < min) {
    const gap = min - years;
    // Lose 20 points per missing year, floor at 0.
    return { score: Math.max(0, 100 - gap * 20), meetsRequirement: false };
  }

  // Over the max — not penalized as heavily as being under-qualified.
  const over = max == null ? 0 : years - max;
  return { score: Math.max(50, 100 - over * 5), meetsRequirement: true };
}

export function computeEducationScore(candidateEducation = [], requirements = []) {
  if (requirements.length === 0) {
    return { score: 100, meetsRequirement: true };
  }

  const candidateFields = candidateEducation.flatMap((e) =>
    [e.degree, e.field].filter(Boolean).map((s) => s.toLowerCase())
  );

  const meetsRequirement = requirements.some((req) =>
    candidateFields.some((field) => field.includes(req.toLowerCase()) || req.toLowerCase().includes(field))
  );

  return { score: meetsRequirement ? 100 : 40, meetsRequirement };
}
