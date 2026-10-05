import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, TX_OPTIONS } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { APPLICATION_STATUS, JOB_STATUS } from '../../../shared/constants/statuses.js';
import { extractResumeText } from '../../resume/extract.service.js';
import { storage } from '../../resume/storage/index.js';
import { analyzeResume } from '../../ai/resume-analyzer.service.js';
import { computeMatch, persistPrecomputedScreening } from '../screening/screening.service.js';
import { computeSkillOverlap } from '../screening/deterministic.util.js';
import { loadPortalCompany } from '../public/careers.service.js';
import { ensureJobSlug } from './recq.slug.js';
import { maskEmail, normalizeEmail, sendEmailOtp, verifyEmailOtp, issueRecqToken, assertRecqToken } from './emailOtp.service.js';
import { createRecqInterviewAccess, interviewLinkFor } from '../interviews/instantInterview.service.js';
import { sendRecqInterviewAccessEmail } from '../notifications/email.service.js';

// Build plan P9 — the /recq agency-link candidate journey (§1–§11, §43).
//   /recq/:agencySlug              → agency's OPEN jobs (Option A) + resume
//                                    discovery across those jobs (Option B)
//   /recq/:agencySlug/:jobSlug     → one OPEN job (Part 2)
// Everything is scoped to one agency and OPEN jobs, server-side — never "fetch
// all and filter in React" (§27). Reuses loadPortalCompany (same Company.slug
// as the careers portal), computeMatch (same screening engine, §4/§46), the
// secure per-interview token scheme (§24) and the email infra (§30).

// How many of an agency's open jobs get a full AI match in resume-discovery
// (Option B). The rest are pre-ranked out; keeps the in-request cost bounded.
const DISCOVERY_AI_LIMIT = 6;
const UPLOAD_TTL_MS = 24 * 3600 * 1000;

// Only public, non-sensitive job fields (never client names, HR, scores,
// thresholds or internal settings — §26).
const PUBLIC_JOB_FIELDS = {
  id: true,
  slug: true,
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
  educationRequirements: true,
  createdAt: true,
};

function publicJob(job) {
  // Internal id is intentionally dropped from the public shape — the public
  // API addresses jobs by slug (§40).
  const { id, ...rest } = job;
  return rest;
}

// ─────────────────────────────────────────────────────────────
// Agency + job pages (read, server-filtered to OPEN)
// ─────────────────────────────────────────────────────────────

export async function getAgency(agencySlug) {
  const agency = await loadPortalCompany(agencySlug); // 404s unless ACTIVE
  const jobs = await prisma.job.findMany({
    where: { companyId: agency.id, status: JOB_STATUS.OPEN },
    select: PUBLIC_JOB_FIELDS,
    orderBy: { createdAt: 'desc' },
  });

  // Make sure every listed job has a shareable slug so its /recq/:agency/:job
  // link works (backfills jobs that predate P9, idempotently).
  const withSlugs = await Promise.all(
    jobs.map(async (job) => (job.slug ? job : { ...job, slug: await ensureJobSlug(job.id) }))
  );

  return { agency, jobs: withSlugs.map(publicJob) };
}

export async function getAgencyJob(agencySlug, jobSlug) {
  const agency = await loadPortalCompany(agencySlug);
  const job = await prisma.job.findFirst({
    where: { companyId: agency.id, status: JOB_STATUS.OPEN, slug: String(jobSlug || '').toLowerCase() },
    select: PUBLIC_JOB_FIELDS,
  });
  if (!job) throw ApiError.notFound('This job is no longer accepting applications', 'JOB_NOT_OPEN');
  return { agency, job: publicJob(job) };
}

// ─────────────────────────────────────────────────────────────
// Resume upload + parsing (pre-account)
// ─────────────────────────────────────────────────────────────

async function parseAndStore(file) {
  if (!file) throw ApiError.badRequest('Please choose a resume file (PDF or DOCX)', 'FILE_REQUIRED');
  const { text } = await extractResumeText(file.buffer);
  const { storageKey, storageUrl } = await storage.save(file.buffer, {
    fileName: file.originalname,
    mimeType: file.mimetype,
    candidateId: 'guest-uploads',
  });

  let parsedData = null;
  try {
    parsedData = await analyzeResume(text);
  } catch (err) {
    console.error('[recq] resume analysis failed, continuing without it:', err.message);
  }

  const upload = await prisma.guestUpload.create({
    data: {
      storageKey,
      storageUrl,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      rawText: text,
      parsedData,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_MS),
    },
  });

  return upload;
}

function resumeEmail(upload) {
  return normalizeEmail(upload.parsedData?.email || '');
}

// Candidate-facing match shape — scores and skill lists only, never the AI's
// internal reasoning/concerns (§16).
function candidateFacingMatch(job, match) {
  const pass = match.overallScore >= job.minAcceptableScore;
  return {
    score: Math.round(match.overallScore),
    pass,
    breakdown: {
      skills: Math.round(match.skillMatchScore),
      experience: Math.round(match.experienceMatchScore),
      education: Math.round(match.educationMatchScore),
    },
    matchedSkills: match.matchedSkills.slice(0, 12),
    missingSkills: pass ? [] : match.missingSkills.slice(0, 8),
  };
}

// ─────────────────────────────────────────────────────────────
// Option A / Part 2 — upload resume for ONE job, get a match score
// ─────────────────────────────────────────────────────────────

export async function matchForJob(agencySlug, jobSlug, file) {
  const agency = await loadPortalCompany(agencySlug);
  const job = await prisma.job.findFirst({
    where: { companyId: agency.id, status: JOB_STATUS.OPEN, slug: String(jobSlug || '').toLowerCase() },
  });
  if (!job) throw ApiError.notFound('This job is no longer accepting applications', 'JOB_NOT_OPEN');

  const upload = await parseAndStore(file);
  const match = await computeMatch(job, { parsedData: upload.parsedData, rawText: upload.rawText });

  const email = resumeEmail(upload);
  return {
    uploadId: upload.id,
    fileName: upload.fileName,
    resumeEmail: email ? maskEmail(email) : null,
    hasResumeEmail: Boolean(email),
    job: { title: job.title, slug: job.slug },
    match: candidateFacingMatch(job, match),
  };
}

// ─────────────────────────────────────────────────────────────
// Option B — upload resume, discover matching jobs across the agency
// ─────────────────────────────────────────────────────────────

// Cheap, AI-free pre-rank (skill overlap + title/description keyword hits),
// same idea as bestMatch.service.js, scoped to ONE agency's open jobs.
const STOP_WORDS = new Set(['and', 'the', 'with', 'for', 'developer', 'engineer', 'senior', 'junior', 'lead', 'manager']);
function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
  );
}
function preScore(parsedData, job) {
  const skills = parsedData?.skills || [];
  const overlap = computeSkillOverlap(skills, [...job.requiredSkills, ...job.preferredSkills]);
  const hasSkills = job.requiredSkills.length + job.preferredSkills.length > 0;
  const jobWords = tokens(`${job.title} ${job.description}`);
  const cvWords = [...tokens(skills.join(' ')), ...tokens((parsedData?.experience || []).map((e) => e.role).join(' '))];
  const hits = cvWords.filter((w) => jobWords.has(w)).length;
  const keyword = cvWords.length ? Math.min(100, Math.round((hits / Math.min(cvWords.length, 15)) * 100)) : 0;
  return hasSkills ? Math.round(overlap.score * 0.7 + keyword * 0.3) : keyword;
}

export async function discoverJobs(agencySlug, file) {
  const agency = await loadPortalCompany(agencySlug);
  const upload = await parseAndStore(file);

  const jobs = await prisma.job.findMany({ where: { companyId: agency.id, status: JOB_STATUS.OPEN } });
  const ranked = jobs
    .map((job) => ({ job, pre: preScore(upload.parsedData, job) }))
    .sort((a, b) => b.pre - a.pre)
    .slice(0, DISCOVERY_AI_LIMIT);

  const scored = await Promise.all(
    ranked.map(async ({ job }) => {
      try {
        const match = await computeMatch(job, { parsedData: upload.parsedData, rawText: upload.rawText });
        const slug = job.slug || (await ensureJobSlug(job.id));
        return { job: { ...job, slug }, match };
      } catch (err) {
        console.error('[recq] discovery match failed for job', job.id, err.message);
        return null;
      }
    })
  );

  const results = scored
    .filter(Boolean)
    .map(({ job, match }) => ({
      slug: job.slug,
      title: job.title,
      location: job.location,
      employmentType: job.employmentType,
      ...candidateFacingMatch(job, match),
    }))
    .sort((a, b) => b.score - a.score);

  const email = resumeEmail(upload);
  return {
    uploadId: upload.id,
    fileName: upload.fileName,
    resumeEmail: email ? maskEmail(email) : null,
    hasResumeEmail: Boolean(email),
    jobs: results,
    anyEligible: results.some((r) => r.pass),
  };
}

// ─────────────────────────────────────────────────────────────
// Email OTP — sent ONLY to the address extracted from the resume (§5/§11)
// ─────────────────────────────────────────────────────────────

// Optional jobSlug lets the OTP email name the specific job.
export async function sendOtp(agencySlug, { uploadId, jobSlug }, ip) {
  const agency = await loadPortalCompany(agencySlug);
  const upload = await loadUploadOrThrow(uploadId);
  if (!upload || upload.expiresAt <= new Date()) {
    throw ApiError.badRequest('Your resume upload has expired. Please upload it again.', 'UPLOAD_EXPIRED');
  }
  const email = resumeEmail(upload);
  let jobTitle;
  if (jobSlug) {
    const job = await prisma.job.findFirst({
      where: { companyId: agency.id, status: JOB_STATUS.OPEN, slug: String(jobSlug).toLowerCase() },
      select: { title: true },
    });
    jobTitle = job?.title;
  }
  // sendEmailOtp validates the email came through (NO_RESUME_EMAIL otherwise).
  return sendEmailOtp({ email, ip, context: { agencyName: agency.name, jobTitle } });
}

export async function verifyOtp(agencySlug, { uploadId, code }) {
  const agency = await loadPortalCompany(agencySlug);
  const upload = await loadUploadOrThrow(uploadId);
  if (!upload || upload.expiresAt <= new Date()) {
    throw ApiError.badRequest('Your resume upload has expired. Please upload it again.', 'UPLOAD_EXPIRED');
  }
  const email = resumeEmail(upload);
  if (!email) throw ApiError.badRequest("We couldn't find an email on your resume.", 'NO_RESUME_EMAIL');
  await verifyEmailOtp({ email, code });
  const recqToken = issueRecqToken({ email, agencyId: agency.id, uploadId });
  return { recqToken, resumeEmail: maskEmail(email) };
}

// ─────────────────────────────────────────────────────────────
// Apply (after email OTP) — one application per selected job
// ─────────────────────────────────────────────────────────────

function loadUploadOrThrow(uploadId) {
  return prisma.guestUpload.findUnique({ where: { id: uploadId } });
}

// Resolves the OTP-verified candidate email for an upload, and asserts the
// recqToken belongs to exactly (this email, this agency, this upload). The
// email ALWAYS comes from the resume, never from the request body (§5).
async function assertVerified({ agency, uploadId, recqToken }) {
  const upload = await loadUploadOrThrow(uploadId);
  if (!upload || upload.expiresAt <= new Date()) {
    throw ApiError.badRequest('Your resume upload has expired. Please upload it again.', 'UPLOAD_EXPIRED');
  }
  const email = resumeEmail(upload);
  if (!email) throw ApiError.badRequest("We couldn't find an email on your resume.", 'NO_RESUME_EMAIL');
  assertRecqToken(recqToken, { email, agencyId: agency.id, uploadId });
  return { upload, email };
}

export async function apply(agencySlug, { uploadId, jobSlugs, recqToken }) {
  const agency = await loadPortalCompany(agencySlug);
  const { upload, email } = await assertVerified({ agency, uploadId, recqToken });

  const slugs = Array.from(new Set((jobSlugs || []).map((s) => String(s || '').toLowerCase()).filter(Boolean)));
  if (slugs.length === 0) throw ApiError.badRequest('Please choose at least one job to apply to', 'NO_JOBS_SELECTED');

  const jobs = await prisma.job.findMany({
    where: { companyId: agency.id, status: JOB_STATUS.OPEN, slug: { in: slugs } },
  });
  if (jobs.length === 0) throw ApiError.badRequest('These jobs are no longer accepting applications', 'JOB_NOT_OPEN');

  // Re-score every selected job authoritatively — eligibility is decided on
  // the server, never trusted from the earlier client-side match (§4).
  const scored = await Promise.all(
    jobs.map(async (job) => {
      try {
        const match = await computeMatch(job, { parsedData: upload.parsedData, rawText: upload.rawText });
        return { job, match, eligible: match.overallScore >= job.minAcceptableScore };
      } catch (err) {
        console.error('[recq] apply match failed for job', job.id, err.message);
        return { job, match: null, eligible: false, error: true };
      }
    })
  );

  // Existing account by this (OTP-verified) email → reuse it; a non-candidate
  // account with the same email is rejected.
  const existingUser = await prisma.user.findUnique({ where: { email }, include: { candidate: true } });
  if (existingUser && existingUser.role !== ROLES.CANDIDATE) {
    throw ApiError.conflict('This email is already used by another RecruitIQ account.', 'EMAIL_NOT_CANDIDATE');
  }
  if (existingUser && !existingUser.isActive) {
    throw ApiError.forbidden('This account is inactive. Please contact support.', 'ACCOUNT_INACTIVE');
  }

  const fullName = (upload.parsedData?.name || email.split('@')[0] || 'Candidate').toString().trim().slice(0, 120);
  const unusablePasswordHash = existingUser ? null : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  // Create the account + ONE resume once; the upload is single-use.
  const { candidate, accountKind } = await prisma.$transaction(async (tx) => {
    const { count } = await tx.guestUpload.updateMany({ where: { id: upload.id, consumedAt: null }, data: { consumedAt: new Date() } });
    const alreadyConsumed = count === 0;

    let user = existingUser;
    let cand = existingUser?.candidate;
    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          passwordHash: unusablePasswordHash,
          role: ROLES.CANDIDATE,
          passwordSet: false,
          candidate: { create: { fullName } },
        },
        include: { candidate: true },
      });
      cand = user.candidate;
    }

    let resume;
    if (alreadyConsumed) {
      // A double-submit: the resume was already created on the first call.
      resume = await tx.resume.findFirst({ where: { candidateId: cand.id, storageKey: upload.storageKey }, orderBy: { createdAt: 'desc' } });
    }
    if (!resume) {
      await tx.resume.updateMany({ where: { candidateId: cand.id }, data: { isPrimary: false } });
      resume = await tx.resume.create({
        data: {
          candidateId: cand.id,
          fileName: upload.fileName,
          fileType: upload.fileType,
          fileSize: upload.fileSize,
          storageKey: upload.storageKey,
          storageUrl: upload.storageUrl,
          rawText: upload.rawText,
          parsedData: upload.parsedData ?? undefined,
          isPrimary: true,
        },
      });
    }
    return { candidate: cand, resume, accountKind: existingUser ? (existingUser.passwordSet ? 'existing' : 'pending') : 'created', _resume: resume };
  }, TX_OPTIONS);

  const resume = await prisma.resume.findFirst({ where: { candidateId: candidate.id, storageKey: upload.storageKey }, orderBy: { createdAt: 'desc' } });

  // One application per selected job, each fully independent (§10/§36).
  const applications = [];
  for (const { job, match, eligible } of scored) {
    const existingApp = await prisma.application.findUnique({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
      include: { interviews: { where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (existingApp) {
      // §37: never create a duplicate — report the existing one.
      const interview = existingApp.interviews[0];
      applications.push({
        jobTitle: job.title,
        jobSlug: job.slug,
        alreadyApplied: true,
        eligible: Boolean(interview),
        matchScore: match ? Math.round(match.overallScore) : null,
        interview: interview
          ? { link: interviewLinkFor(interview), status: interview.status, expiresAt: interview.inviteExpiresAt }
          : null,
        window: { start: job.interviewAvailabilityStart, end: job.interviewAvailabilityEnd },
      });
      continue;
    }

    if (!eligible) {
      applications.push({
        jobTitle: job.title,
        jobSlug: job.slug,
        alreadyApplied: false,
        eligible: false,
        matchScore: match ? Math.round(match.overallScore) : null,
        interview: null,
        window: { start: job.interviewAvailabilityStart, end: job.interviewAvailabilityEnd },
      });
      continue;
    }

    const application = await prisma.application.create({
      data: { candidateId: candidate.id, jobId: job.id, resumeId: resume.id, source: 'RECQ', status: APPLICATION_STATUS.APPLIED },
    });
    // Persist the score so recruiters see the CV match (reuses the precomputed
    // match — no second AI call; no auto-advance/email side effects), then
    // grant windowed interview access.
    await persistPrecomputedScreening(application.id, match).catch((err) =>
      console.error('[recq] screening persist failed:', err.message)
    );
    const { interview, link } = await createRecqInterviewAccess(application.id);

    // Email the interview link to the verified resume address (§6/§12/§30).
    await sendRecqInterviewAccessEmail({
      to: email,
      candidateName: candidate.fullName,
      jobTitle: job.title,
      companyName: agency.name,
      link,
      windowStart: job.interviewAvailabilityStart,
      windowEnd: job.interviewAvailabilityEnd,
      applicationId: application.id,
    }).catch((err) => console.error('[recq] interview access email failed:', err.message));

    applications.push({
      jobTitle: job.title,
      jobSlug: job.slug,
      alreadyApplied: false,
      eligible: true,
      matchScore: Math.round(match.overallScore),
      interview: { link, status: interview.status, expiresAt: interview.inviteExpiresAt },
      window: { start: job.interviewAvailabilityStart, end: job.interviewAvailabilityEnd },
    });
  }

  return {
    account: accountKind,
    resumeEmail: maskEmail(email),
    applications,
    anyEligible: applications.some((a) => a.eligible),
  };
}

export { resumeEmail };
