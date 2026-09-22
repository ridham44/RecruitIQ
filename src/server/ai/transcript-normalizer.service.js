import { env } from '../config/env.js';
import { callOpenRouter } from './openrouter.service.js';
import { transcriptCorrectionSchema } from '../../shared/schemas/interview-ai.schema.js';

// Section 2: STT correction pipeline — RAW AUDIO -> STT -> raw transcript ->
// normalization -> evaluation. The normalizer must never invent information
// the candidate didn't say; when in doubt it leaves the raw text alone.

const FILLER_WORD_PATTERN = /\b(um+|uh+|erm+|hmm+)\b/gi;
const REPEATED_WORD_PATTERN = /\b(\w+)( \1\b)+/gi;

// Deterministic, zero-hallucination-risk cleanup: whitespace, filler words,
// and STT-stutter repetition only. Never reorders words, never touches
// technical terms, never rephrases.
export function deterministicCleanup(rawTranscript) {
  if (!rawTranscript) return '';
  return rawTranscript
    .replace(FILLER_WORD_PATTERN, ' ')
    .replace(REPEATED_WORD_PATTERN, '$1')
    .replace(/\s+([.,?!])/g, '$1')
    // A filler word often sat between two commas ("I use, uh, React") —
    // removing it above can leave the two commas adjacent.
    .replace(/([.,?!])(\s*\1)+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordTokens(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Word-level Levenshtein distance — used only to measure how far an LLM
// "correction" drifted from the input, not for any scoring purpose.
function wordLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// The hallucination guard (Section 2: "preserve the ambiguity rather than
// hallucinating an answer"). Rejects a proposed correction if it drifted too
// far from the cleaned input by any of three independent measures.
export function isCorrectionTooDivergent(cleanedText, correctedText) {
  if (!correctedText?.trim()) return true;

  const lengthRatio = correctedText.length / Math.max(cleanedText.length, 1);
  if (lengthRatio < 0.7 || lengthRatio > 1.3) return true;

  const cleanedWords = wordTokens(cleanedText);
  const correctedWords = wordTokens(correctedText);

  const wordCountDelta = Math.abs(correctedWords.length - cleanedWords.length) / Math.max(cleanedWords.length, 1);
  if (wordCountDelta > 0.2) return true;

  const editRatio = wordLevenshtein(cleanedWords, correctedWords) / Math.max(cleanedWords.length, 1);
  if (editRatio > 0.3) return true;

  return false;
}

const NORMALIZER_SYSTEM_PROMPT = `You are correcting a speech-to-text transcript of a candidate's spoken interview answer.
Your ONLY job is to fix obvious speech-to-text mistranscriptions of technical terms, product names, and
proper nouns (e.g. "react js" -> "React.js", "no dot js" -> "Node.js", "my sequel" -> "MySQL") using the
job's listed skills as context for what the candidate likely meant.

STRICT RULES — you MUST follow these:
1. Never add, remove, or rephrase any idea, claim, or fact the candidate did not say.
2. Never fix grammar, filler words, sentence structure, or word order — only fix clearly-misheard
   technical terms/proper nouns.
3. If you are not confident a word is a mistranscription, leave it exactly as-is.
4. The corrected text must stay extremely close in length and wording to the input — this is a narrow
   spell-correction pass, not a rewrite.
5. If the input is already clean, return it completely unchanged.

Return ONLY a JSON object: { "correctedText": string }. Respond with JSON only, no prose.`;

// rawTranscript -> best-effort normalized transcript (Section 2). Hybrid
// pipeline: cheap deterministic cleanup always runs; a tightly-constrained
// LLM pass then attempts technical-term correction, but its output is
// discarded (falling back to the deterministic-only result) whenever it's
// unavailable, fails, or drifts too far from the input. Never throws.
export async function normalizeTranscript(rawTranscript, { jobSkills = [] } = {}) {
  const cleaned = deterministicCleanup(rawTranscript);
  if (!cleaned) return '';
  if (!env.openRouterApiKey) return cleaned;

  try {
    const userPrompt = JSON.stringify({ jobSkills, transcript: cleaned }, null, 2);
    const raw = await callOpenRouter({ systemPrompt: NORMALIZER_SYSTEM_PROMPT, userPrompt, temperature: 0 });
    const result = transcriptCorrectionSchema.safeParse(raw);
    const correctedText = result.success ? result.data.correctedText : '';

    if (!correctedText || isCorrectionTooDivergent(cleaned, correctedText)) return cleaned;
    return correctedText;
  } catch (err) {
    console.error('[transcript-normalizer] LLM pass failed, falling back to deterministic-only cleanup:', err.message);
    return cleaned;
  }
}
