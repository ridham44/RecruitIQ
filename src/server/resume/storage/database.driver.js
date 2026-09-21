import { prisma } from '../../config/prisma.js';

// Production-safe default (Section 19/21): stores the raw file bytes in
// Postgres via the ResumeBlob table instead of the local filesystem, which
// doesn't exist persistently on Vercel serverless functions. Works with any
// PostgreSQL provider out of the box — no extra credentials or third-party
// account needed. Resumes are small (MAX_RESUME_SIZE_MB, default 4MB), well
// within what a bytea column handles comfortably.
export async function save(buffer) {
  const blob = await prisma.resumeBlob.create({ data: { data: buffer } });
  return { storageKey: blob.id, storageUrl: null };
}

export async function read(storageKey) {
  const blob = await prisma.resumeBlob.findUnique({ where: { id: storageKey } });
  if (!blob) throw new Error(`Resume blob not found for key: ${storageKey}`);
  return blob.data;
}
