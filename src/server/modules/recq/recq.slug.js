import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

// Build plan P9 (/recq flow): per-agency job slugs for
// /recq/:agencySlug/:jobSlug. Mirrors the company-slug helper in
// careers.service.js, but a job's slug is unique only within its company
// (@@unique([companyId, slug])), so two agencies can both have a
// "software-engineer".

// Words that would clash with /recq sub-paths or read oddly as a job slug.
const RESERVED = new Set(['jobs', 'match', 'apply', 'otp', 'applications', 'new', 'track']);

export function slugifyJob(title) {
  return (
    String(title || '')
      .toLowerCase()
      .normalize('NFKD')
      // "AI/ML Engineer" → "ai-ml-engineer", "R&D Lead" → "r-d-lead"
      .replace(/[/\\&+]/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'job'
  );
}

// Gives a job a slug the first time it's needed, racing safely against a
// concurrent writer (only claims the slug while the row still has none).
// Returns the slug (existing or newly set).
export async function ensureJobSlug(jobId) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, companyId: true, slug: true, title: true } });
  if (!job) throw ApiError.notFound('Job not found');
  if (job.slug) return job.slug;

  const base = slugifyJob(job.title);
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 && !RESERVED.has(base) ? base : `${base}-${crypto.randomBytes(2).toString('hex')}`;
    // Is this slug free within the company?
    const taken = await prisma.job.findFirst({
      where: { companyId: job.companyId, slug: candidate, NOT: { id: job.id } },
      select: { id: true },
    });
    if (taken) continue;
    try {
      const { count } = await prisma.job.updateMany({ where: { id: job.id, slug: null }, data: { slug: candidate } });
      if (count === 1) return candidate;
      // Set concurrently by another writer — return whatever stuck.
      const fresh = await prisma.job.findUnique({ where: { id: job.id }, select: { slug: true } });
      if (fresh?.slug) return fresh.slug;
    } catch (err) {
      if (err.code === 'P2002') continue; // unique race — try another suffix
      throw err;
    }
  }
  throw ApiError.internal('Could not generate a job link. Please try again.');
}

// Set/rename a job's slug explicitly (recruiter chooses a nicer link).
export async function setJobSlug(jobId, rawSlug) {
  const slug = slugifyJob(rawSlug);
  if (RESERVED.has(slug)) throw ApiError.badRequest('That link name is reserved — please choose another', 'SLUG_RESERVED');
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { companyId: true } });
  if (!job) throw ApiError.notFound('Job not found');
  try {
    const updated = await prisma.job.update({ where: { id: jobId }, data: { slug } });
    return updated.slug;
  } catch (err) {
    if (err.code === 'P2002') throw ApiError.conflict('That link is already used by another job — please choose another', 'SLUG_TAKEN');
    throw err;
  }
}
