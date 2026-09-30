import { callOpenRouter } from './openrouter.service.js';

// Closing turn of the AI interview: the candidate has just been asked "Do
// you have any questions for us?". Reply briefly and politely using ONLY the
// job and company information we actually have, then close the interview.
// Never invents facts, never promises an outcome.

const SYSTEM_PROMPT = `You are the AI interviewer finishing a job interview. The candidate was just asked
whether they have any questions about the role or the company. Reply to what they said in 2-4 short,
warm, spoken-style sentences.

Rules:
- Answer ONLY from the provided "job" and "company" information. If they ask about the role, the work or
  the responsibilities, briefly describe them from the job description (and location / work mode when
  given). If the answer isn't there, say the recruiting team will follow up with those details — never
  guess or invent facts.
- Never promise or hint at the interview outcome, selection, salary or start date unless it is stated in
  the provided information — say the team will review the interview and be in touch about next steps.
- If they had no questions, simply thank them.
- Always end by thanking them for their time and saying the interview is now complete.
- Plain text for speech: no lists, no markdown, no emojis.

Return ONLY a JSON object: { "reply": string }. Respond with JSON only, no prose.`;

export function fallbackClosing(companyName) {
  return `Thank you for your questions and for your time today. The ${companyName || 'hiring'} team will review your interview and get back to you about next steps. This interview is now complete.`;
}

export async function generateClosingReply({ job, company, candidateText }) {
  if (!candidateText?.trim()) return fallbackClosing(company?.name);
  const userPrompt = JSON.stringify(
    {
      job: {
        title: job.title,
        location: job.location,
        workMode: job.workMode,
        employmentType: job.employmentType,
        description: job.description?.slice(0, 3000),
      },
      company: {
        name: company?.name,
        description: company?.description?.slice(0, 1500) || null,
        location: company?.location || null,
        website: company?.website || null,
      },
      candidateSaid: candidateText.slice(0, 1500),
    },
    null,
    2
  );
  try {
    const raw = await callOpenRouter({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.3 });
    const reply = typeof raw?.reply === 'string' ? raw.reply.trim() : '';
    return reply ? reply.slice(0, 800) : fallbackClosing(company?.name);
  } catch (err) {
    console.error('[interview-closing] reply failed, using the standard closing:', err.message);
    return fallbackClosing(company?.name);
  }
}
