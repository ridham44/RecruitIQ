import crypto from 'crypto';
import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';
import { prisma, TX_OPTIONS } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { APPLICATION_STATUS, JOB_STATUS, SCREENING_STATUS, candidateFacingStatus } from '../../../shared/constants/statuses.js';
import { extractResumeText } from '../../resume/extract.service.js';
import { storage } from '../../resume/storage/index.js';
import { analyzeResume } from '../../ai/resume-analyzer.service.js';
import { normalizePhone } from '../../utils/phone.js';
import { assertOtpToken } from './otp.service.js';
import { loadPortalCompany } from './careers.service.js';
import { issuePasswordToken } from '../auth/passwordToken.service.js';
import { sendCandidateApplicationReceivedEmail } from '../notifications/email.service.js';
import { screenApplicationById } from '../screening/screening.service.js';
import { matchCvSubmission } from '../screening/bestMatch.service.js';
import { interviewLinkFor } from '../interviews/instantInterview.service.js';
// Status-link token helpers now live in trackToken.js (shared with emails).
import { trackUrl as sharedTrackUrl, signTrackToken, readTrackToken } from './trackToken.js';
import { getBookingForApplicationId, bookSlotForApplicationId, cancelBookingForApplicationId } from '../scheduling/scheduling.service.js';

// Build plan P4 (§6A, §6B, §7, §8) — apply on a careers portal without an
// account. The guest becomes an ordinary CANDIDATE user (passwordSet=false)
// so the candidate dashboard, application detail and interview room all work
// for them once they set a password from the emailed link.

const UPLOAD_TTL_MS = 24 * 3600 * 1000;
// const TRACK_TOKEN_TTL = '30d';
//
// function clientOrigin() {
//   return env.clientUrl.split(',')[0].trim();
// }
//
// export function trackUrl(token) {
//   return `${clientOrigin()}/careers/track?token=${token}`;
// }
//
// function signTrackToken(kind, id) {
//   return jwt.sign({ typ: 'track', kind, id }, env.jwtSecret, { expiresIn: TRACK_TOKEN_TTL });
// }
//
// function readTrackToken(token) {
//   try {
//     const payload = jwt.verify(token, env.jwtSecret);
//     if (payload.typ === 'track' && (payload.kind === 'application' || payload.kind === 'submission')) return payload;
//   } catch {
//     /* fall through */
//   }
//   throw ApiError.notFound('This tracking link is invalid or has expired', 'TRACK_TOKEN_INVALID');
// }
export const trackUrl = sharedTrackUrl;

// ─── Step 1: upload + read the CV ───

export async function parseGuestCv(file) {
  if (!file) throw ApiError.badRequest('Please choose a CV file (PDF or DOCX)', 'FILE_REQUIRED');
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
    console.error('[guest-apply] resume analysis failed, continuing without it:', err.message);
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

  const detectedPhone = parsedData?.phone ? normalizePhone(parsedData.phone) || parsedData.phone : '';
  return {
    uploadId: upload.id,
    fileName: upload.fileName,
    detected: {
      fullName: parsedData?.name || '',
      email: parsedData?.email || '',
      phone: detectedPhone,
    },
  };
}

// ─── Step 2: submit ───

export async function submitGuestApplication({ slug, uploadId, jobId, fullName, email, phone: rawPhone, otpToken }) {
  const company = await loadPortalCompany(slug);
  const phone = assertOtpToken(otpToken, rawPhone);
  const normalizedEmail = email.trim().toLowerCase();

  const job = jobId ? await prisma.job.findUnique({ where: { id: jobId } }) : null;
  if (jobId && (!job || job.companyId !== company.id || job.status !== JOB_STATUS.OPEN)) {
    throw ApiError.badRequest('This job is no longer accepting applications', 'JOB_NOT_OPEN');
  }

  const upload = await prisma.guestUpload.findUnique({ where: { id: uploadId } });
  if (!upload || upload.consumedAt || upload.expiresAt <= new Date()) {
    throw ApiError.badRequest('Your CV upload has expired. Please upload it again.', 'UPLOAD_EXPIRED');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, include: { candidate: true } });
  if (existingUser && existingUser.role !== ROLES.CANDIDATE) {
    throw ApiError.conflict('This email belongs to a company account. Please use a different email.', 'EMAIL_NOT_CANDIDATE');
  }
  if (existingUser && !existingUser.isActive) {
    throw ApiError.forbidden('This account is inactive. Please contact support.', 'ACCOUNT_INACTIVE');
  }
  // The email itself isn't verified here, only the phone. So an existing
  // account may only be used when the OTP-verified phone is the one already
  // saved on it — otherwise anyone could apply (and later interview) in
  // someone else's name just by knowing their email.
  if (existingUser && (!existingUser.candidate?.phone || normalizePhone(existingUser.candidate.phone) !== phone)) {
    throw ApiError.conflict(
      'An account with this email already exists. Please log in to apply, or use a different email.',
      'EMAIL_HAS_ACCOUNT',
    );
  }
  if (job && existingUser?.candidate) {
    const dup = await prisma.application.findUnique({
      where: { candidateId_jobId: { candidateId: existingUser.candidate.id, jobId: job.id } },
    });
    if (dup) throw ApiError.conflict('You have already applied to this job. Log in to track it.', 'ALREADY_APPLIED');
  }

  const unusablePasswordHash = existingUser ? null : await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  const result = await prisma.$transaction(async (tx) => {
    // The upload can be used exactly once, even if submitted twice at once.
    const { count } = await tx.guestUpload.updateMany({
      where: { id: upload.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count === 0) throw ApiError.badRequest('Your CV upload has expired. Please upload it again.', 'UPLOAD_EXPIRED');

    let user = existingUser;
    let candidate = existingUser?.candidate;
    if (!user) {
      user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: unusablePasswordHash,
          role: ROLES.CANDIDATE,
          passwordSet: false,
          candidate: { create: { fullName: fullName.trim(), phone, phoneVerifiedAt: new Date() } },
        },
        include: { candidate: true },
      });
      candidate = user.candidate;
    } else {
      // Phone matches the saved one (checked above) — record the verification.
      candidate = await tx.candidate.update({
        where: { id: candidate.id },
        data: { phoneVerifiedAt: new Date() },
      });
    }

    await tx.resume.updateMany({ where: { candidateId: candidate.id }, data: { isPrimary: false } });
    const resume = await tx.resume.create({
      data: {
        candidateId: candidate.id,
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

    if (job) {
      const application = await tx.application.create({
        data: { candidateId: candidate.id, jobId: job.id, resumeId: resume.id, source: 'GUEST', status: APPLICATION_STATUS.APPLIED },
      });
      return { user, candidate, kind: 'application', id: application.id };
    }
    const submission = await tx.cvSubmission.create({
      data: { companyId: company.id, candidateId: candidate.id, resumeId: resume.id },
    });
    return { user, candidate, kind: 'submission', id: submission.id };
  }, TX_OPTIONS);

  const trackingToken = signTrackToken(result.kind, result.id);

  // New guest, or an earlier guest who never set a password → set-password
  // link. Someone with a real password is told to log in instead.
  const needsPassword = !existingUser || !existingUser.passwordSet;
  const invite = needsPassword ? await issuePasswordToken(result.user.id) : null;
  await sendCandidateApplicationReceivedEmail({
    to: normalizedEmail,
    fullName: result.candidate.fullName,
    companyName: company.name,
    jobTitle: job?.title,
    link: invite?.link ?? null,
    trackUrl: trackUrl(trackingToken),
  });

  return {
    kind: result.kind,
    id: result.id,
    trackingToken,
    account: existingUser ? (existingUser.passwordSet ? 'existing' : 'pending') : 'created',
  };
}

// ─── Step 3: screening / matching (runs inside a request — see routes) ───

export async function processTracked(token) {
  const { kind, id } = readTrackToken(token);
  if (kind === 'application') {
    // Guest applications are always screened, so the recruiter sees a score;
    // only jobs with autoAdvanceOnMatch decide automatically.
    try {
      await screenApplicationById(id);
    } catch (err) {
      console.error('[guest-apply] screening failed:', err.message);
    }
  } else {
    await matchCvSubmission(id);
  }
  return getTrackStatus(token);
}

// Candidate-facing status. Deliberately no scores or AI reasoning.
function describeApplication(application) {
  const screening = application.screeningResult?.status;
  let stage = 'received';
  if (application.status === APPLICATION_STATUS.REJECTED) stage = 'not_selected';
  else if (application.status === APPLICATION_STATUS.SHORTLISTED) stage = 'shortlisted';
  else if (application.status === APPLICATION_STATUS.INTERVIEW_SCHEDULED) stage = 'interview_scheduled';
  // else if (application.status === APPLICATION_STATUS.INTERVIEW_COMPLETED) stage = 'interview_completed';
  // Build plan P7: post-interview decisions look like "interview completed" to the candidate.
  else if (candidateFacingStatus(application.status) === APPLICATION_STATUS.INTERVIEW_COMPLETED) stage = 'interview_completed';
  else if (screening === SCREENING_STATUS.COMPLETED || screening === SCREENING_STATUS.FAILED) stage = 'under_review';
  else if (application.status === APPLICATION_STATUS.SCREENING) stage = 'screening';

  // Build plan P5: an instant interview link, when one is ready.
  // const instant = env.features.instantInterview
  //   ? (application.interviews || []).find((i) => !i.slotId && (i.status === 'SCHEDULED' || i.status === 'IN_PROGRESS'))
  //   : null;
  // Second-round links work even with instant links switched off.
  const instant = (application.interviews || []).find(
    (i) => !i.slotId && (i.status === 'SCHEDULED' || i.status === 'IN_PROGRESS') && (env.features.instantInterview || i.round > 1)
  );

  // Slot-booking jobs: has the candidate booked (or started) a slot interview?
  const slotInterview = (application.interviews || []).find((i) => i.slotId && (i.status === 'SCHEDULED' || i.status === 'IN_PROGRESS'));

  return {
    applicationId: application.id,
    // status: application.status,
    status: candidateFacingStatus(application.status),
    stage,
    // For the progress page: SLOT jobs offer booking from this link.
    usesSlots: application.job.interviewFlow !== 'INSTANT',
    hasBookedSlot: Boolean(slotInterview),
    job: { id: application.job.id, title: application.job.title },
    company: { name: application.job.company.name },
    // ...(instant ? { interview: { link: interviewLinkFor(instant), expiresAt: instant.inviteExpiresAt, status: instant.status } } : {}),
    ...(instant ? { interview: { link: interviewLinkFor(instant), expiresAt: instant.inviteExpiresAt, status: instant.status, round: instant.round || 1 } } : {}),
  };
}

// ─── Slot booking from the status link (no login) ───

async function applicationIdFromTrack(token) {
  const { kind, id } = readTrackToken(token);
  if (kind === 'application') return id;
  const submission = await prisma.cvSubmission.findUnique({ where: { id }, select: { applicationId: true } });
  if (!submission?.applicationId) throw ApiError.badRequest('This CV has not been placed on a job yet', 'NO_APPLICATION');
  return submission.applicationId;
}

export async function getTrackBooking(token) {
  return getBookingForApplicationId(await applicationIdFromTrack(token));
}

export async function bookFromTrack(token, slotId) {
  return bookSlotForApplicationId(await applicationIdFromTrack(token), slotId);
}

export async function cancelFromTrack(token) {
  return cancelBookingForApplicationId(await applicationIdFromTrack(token));
}

export async function getTrackStatus(token) {
  const { kind, id } = readTrackToken(token);
  // const include = { job: { include: { company: { select: { name: true } } } }, screeningResult: { select: { status: true } } };
  const include = {
    job: { include: { company: { select: { name: true } } } },
    screeningResult: { select: { status: true } },
    // Build plan P5
    interviews: { orderBy: { createdAt: 'desc' }, take: 3 },
  };

  if (kind === 'application') {
    const application = await prisma.application.findUnique({ where: { id }, include });
    if (!application) throw ApiError.notFound('Application not found');
    const described = describeApplication(application);
    return { kind, done: described.stage !== 'screening' && described.stage !== 'received', ...described };
  }

  const submission = await prisma.cvSubmission.findUnique({
    where: { id },
    include: { company: { select: { name: true } }, application: { include } },
  });
  if (!submission) throw ApiError.notFound('Submission not found');
  const pending = submission.status === 'PENDING' || submission.status === 'MATCHING';
  const app = submission.application ? describeApplication(submission.application) : null;
  return {
    kind,
    status: submission.status,
    done: !pending && (!app || (app.stage !== 'screening' && app.stage !== 'received')),
    portalCompany: { name: submission.company.name },
    ...(app ? { match: app } : {}),
  };
}
