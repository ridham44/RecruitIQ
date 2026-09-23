import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { extractResumeText } from '../../resume/extract.service.js';
import { storage } from '../../resume/storage/index.js';
import { analyzeResume } from '../../ai/resume-analyzer.service.js';

async function getCandidateForUser(userId) {
  const candidate = await prisma.candidate.findUnique({ where: { userId } });
  if (!candidate) throw ApiError.notFound('Candidate profile not found');
  return candidate;
}

function normalizeGender(value) {
  const normalized = (value || '').trim().toLowerCase();
  if (['male', 'm'].includes(normalized)) return 'MALE';
  if (['female', 'f'].includes(normalized)) return 'FEMALE';
  if (normalized) return 'OTHER';
  return null;
}

// Diffs AI-parsed resume data against the candidate's CURRENT profile and
// returns only what's worth suggesting (Section 6/7). Nothing here is
// persisted — it's handed back to the client so the candidate can review
// and edit before anything is saved, and a field that's already filled in
// is never suggested for overwrite.
// NOTE: university/college/degree/latestSpi are no longer flat Candidate
// fields — they live in the Education model. Suggestions for those are
// omitted here to avoid trying to write removed DB columns.
function buildProfileSuggestions(candidate, parsedData) {
  if (!parsedData) return null;

  const suggestions = {};

  const suggestIfEmpty = (field, value) => {
    const hasValue = typeof value === 'string' ? value.trim().length > 0 : value != null;
    if (hasValue && !candidate[field]) suggestions[field] = value;
  };

  suggestIfEmpty('phone', parsedData.phone);

  const normalizedGender = normalizeGender(parsedData.gender);
  if (normalizedGender && !candidate.gender) suggestions.gender = normalizedGender;

  const newSkills = (parsedData.skills || []).filter(
    (skill) => !candidate.skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())
  );
  if (newSkills.length > 0) suggestions.skills = newSkills;

  return Object.keys(suggestions).length > 0 ? suggestions : null;
}


// resume.pdf/docx -> text extraction -> storage -> AI analysis -> persisted
// Resume row (Section 9/11). AI failure does not block the upload; the
// resume is saved with rawText and empty parsedData so screening can be
// retried later.
export async function uploadResume(userId, file) {
  const candidate = await getCandidateForUser(userId);

  const { text } = await extractResumeText(file.buffer);
  const { storageKey, storageUrl } = await storage.save(file.buffer, {
    fileName: file.originalname,
    mimeType: file.mimetype,
    candidateId: candidate.id,
  });

  let parsedData = null;
  try {
    parsedData = await analyzeResume(text);
  } catch (err) {
    console.error('[resumes] AI analysis failed, saving raw text only:', err.message);
  }

  await prisma.resume.updateMany({ where: { candidateId: candidate.id }, data: { isPrimary: false } });

  const resume = await prisma.resume.create({
    data: {
      candidateId: candidate.id,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      storageKey,
      storageUrl,
      rawText: text,
      parsedData,
      isPrimary: true,
    },
  });

  return { resume, profileSuggestions: buildProfileSuggestions(candidate, parsedData) };
}

export async function listMyResumes(userId) {
  const candidate = await getCandidateForUser(userId);
  return prisma.resume.findMany({ where: { candidateId: candidate.id }, orderBy: { createdAt: 'desc' } });
}

export async function getResumeById(resumeId) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw ApiError.notFound('Resume not found');
  return resume;
}
