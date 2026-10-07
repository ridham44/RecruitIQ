import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { JOB_STATUS } from '../../../shared/constants/statuses.js';

// Build plan P4 — one public careers portal per recruitment company
// (/careers/:slug). Only public job fields are exposed: never client
// names, HR contacts, scores or internal settings.

const PUBLIC_JOB_SELECT = {
  id: true,
  title: true,
  description: true,
  location: true,
  workMode: true,
  employmentType: true,
  jobLevel: true,
  openings: true,
  salaryRange: true,
  minimumExperience: true,
  maximumExperience: true,
  requiredSkills: true,
  preferredSkills: true,
  createdAt: true,
};

const PUBLIC_COMPANY_SELECT = { id: true, name: true, logoUrl: true, description: true, location: true, website: true, slug: true };

const RESERVED = new Set(['track', 'admin', 'api', 'new', 'jobs', 'submit-cv', 'login']);

// Build plan P9: the shareable candidate link is the /recq agency page on the
// live product's address (/careers/:slug only redirects there now).
export function careersUrl(slug) {
  return `${env.publicAppUrl}/recq/${slug}`;
}

export async function loadPortalCompany(slug) {
  const company = await prisma.company.findUnique({
    where: { slug: String(slug || '').toLowerCase() },
    select: { ...PUBLIC_COMPANY_SELECT, status: true },
  });
  if (!company || company.status !== 'ACTIVE') throw ApiError.notFound('This careers page does not exist', 'PORTAL_NOT_FOUND');
  const { status, ...publicCompany } = company;
  return publicCompany;
}

export async function getPortal(slug) {
  const company = await loadPortalCompany(slug);
  const jobs = await prisma.job.findMany({
    where: { companyId: company.id, status: JOB_STATUS.OPEN },
    select: PUBLIC_JOB_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  return { company, jobs };
}

export async function getPortalJob(slug, jobId) {
  const company = await loadPortalCompany(slug);
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: company.id, status: JOB_STATUS.OPEN },
    select: PUBLIC_JOB_SELECT,
  });
  if (!job) throw ApiError.notFound('This job is no longer open', 'JOB_NOT_OPEN');
  return { company, job };
}

function slugify(name) {
  return (
    String(name || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'company'
  );
}

// Gives the company a slug the first time it's needed.
export async function ensureCompanySlug(companyId) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (company.slug) return company.slug;

  const base = slugify(company.name);
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 && !RESERVED.has(base) ? base : `${base}-${crypto.randomBytes(2).toString('hex')}`;
    try {
      // Only claims the slug if none was set in the meantime.
      const { count } = await prisma.company.updateMany({ where: { id: companyId, slug: null }, data: { slug: candidate } });
      if (count === 1) return candidate;
      return (await prisma.company.findUnique({ where: { id: companyId } })).slug; // set concurrently
    } catch (err) {
      if (err.code === 'P2002') continue; // taken — try another suffix
      throw err;
    }
  }
  throw ApiError.internal('Could not generate a careers link. Please try again.');
}

export async function setCompanySlug(companyId, slug) {
  if (RESERVED.has(slug)) throw ApiError.badRequest('That link name is reserved — please choose another', 'SLUG_RESERVED');
  try {
    const updated = await prisma.company.update({ where: { id: companyId }, data: { slug } });
    return updated.slug;
  } catch (err) {
    if (err.code === 'P2002') throw ApiError.conflict('That link is already taken — please choose another', 'SLUG_TAKEN');
    throw err;
  }
}
