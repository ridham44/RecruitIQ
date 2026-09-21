import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { extractResumeText } from '../../resume/extract.service.js';
import { storage } from '../../resume/storage/index.js';
import { analyzeResume } from '../../ai/resume-analyzer.service.js';

async function getCandidateIdForUser(userId) {
  const candidate = await prisma.candidate.findUnique({ where: { userId } });
  if (!candidate) throw ApiError.notFound('Candidate profile not found');
  return candidate.id;
}

// resume.pdf/docx -> text extraction -> storage -> AI analysis -> persisted
// Resume row (Section 9/11). AI failure does not block the upload; the
// resume is saved with rawText and empty parsedData so screening can be
// retried later.
export async function uploadResume(userId, file) {
  const candidateId = await getCandidateIdForUser(userId);

  const { text } = await extractResumeText(file.buffer);
  const { storageKey, storageUrl } = await storage.save(file.buffer, {
    fileName: file.originalname,
    mimeType: file.mimetype,
    candidateId,
  });

  let parsedData = null;
  try {
    parsedData = await analyzeResume(text);
  } catch (err) {
    console.error('[resumes] AI analysis failed, saving raw text only:', err.message);
  }

  await prisma.resume.updateMany({ where: { candidateId }, data: { isPrimary: false } });

  return prisma.resume.create({
    data: {
      candidateId,
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
}

export async function listMyResumes(userId) {
  const candidateId = await getCandidateIdForUser(userId);
  return prisma.resume.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' } });
}

export async function getResumeById(resumeId) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw ApiError.notFound('Resume not found');
  return resume;
}
