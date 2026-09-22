// Best-effort browser-TTS voice matching for the company-configured
// voiceGender ('FEMALE' | 'MALE' | 'NEUTRAL'). SpeechSynthesisVoice exposes
// no reliable gender metadata on any browser, so this is a name-substring
// heuristic over a curated list of common voice names, falling back to the
// browser/OS default. Must never throw and must never block the interview
// if no match is found — worst case the candidate just hears the OS default
// voice (Section 8: "keep this best-effort, never error the interview").
const GENDER_NAME_HINTS = {
  FEMALE: ['female', 'zira', 'samantha', 'victoria', 'susan', 'karen', 'moira', 'tessa', 'fiona', 'veena', 'aria', 'jenny'],
  MALE: ['male', 'david', 'mark', 'daniel', 'alex', 'fred', 'george', 'james', 'ravi', 'guy', 'christopher'],
};

export function pickVoiceForGender(voices, genderPref = 'FEMALE') {
  if (!voices?.length) return null;
  if (genderPref === 'NEUTRAL') return voices.find((v) => v.default) || voices[0];

  const hints = GENDER_NAME_HINTS[genderPref] || [];
  const englishVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  const pool = englishVoices.length ? englishVoices : voices;
  const match = pool.find((v) => hints.some((h) => v.name.toLowerCase().includes(h)));
  return match || pool.find((v) => v.default) || pool[0] || null;
}
