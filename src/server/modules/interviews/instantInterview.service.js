import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma, TX_OPTIONS } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPLICATION_STATUS, INTERVIEW_STATUS } from '../../../shared/constants/statuses.js';
// import { sendInterviewInviteEmail } from '../notifications/email.service.js';
import { sendInterviewInviteEmail, sendInterviewConfirmationEmail } from '../notifications/email.service.js';
import { smsDriver } from '../notifications/sms/index.js';
import { maskPhone } from '../../utils/phone.js';

// Build plan P5 (§9) — instant interview link: attend now or later, no slot.
//
// The link token is HMAC(server secret, interview id + inviteNonce): it can
// be recomputed to re-send or show the same link, and only its SHA-256 hash
// is stored for lookup. Rotating inviteNonce revokes every earlier link.
// Opening the link exchanges it for a short-lived candidate JWT scoped to
// this one interview (see middleware/auth.js), then the existing interview
// room / engine / LiveKit / report run completely unchanged.

const SESSION_TTL = '3h';
const SEND_LIMIT = { count: 3, windowMs: 60 * 60 * 1000 };
const ACTIVE = [INTERVIEW_STATUS.SCHEDULED, INTERVIEW_STATUS.IN_PROGRESS];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function tokenFor(interview) {
  return crypto.createHmac('sha256', env.jwtSecret).update(`interview-link:${interview.id}:${interview.inviteNonce}`).digest('hex');
}

export function interviewLinkFor(interview) {
  if (!interview?.inviteNonce) return null;
  return `${env.clientUrl.split(',')[0].trim()}/interview/${tokenFor(interview)}`;
}

function assertEnabled() {
  if (!env.features.instantInterview) {
    throw ApiError.notFound('Instant interview links are not enabled', 'FEATURE_DISABLED');
  }
}

const INCLUDE = {
  // Slot interviews booked from the status link use these links too.
  slot: true,
  application: {
    include: {
      job: { include: { company: { select: { name: true, logoUrl: true } } } },
      candidate: { include: { user: { select: { id: true, email: true, isActive: true } } } },
    },
  },
};

// Creates (or refreshes) the instant interview for a shortlisted
// application. Returns { interview, link }.
//   rotate: true → new link, old ones stop working
export async function createOrRefreshInstantInterview(applicationId, { rotate = false } = {}) {
  assertEnabled();
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, interviews: { where: { status: { in: ACTIVE } }, orderBy: { createdAt: 'desc' } } },
  });
  if (!application) throw ApiError.notFound('Application not found');

  const active = application.interviews[0];
  if (active?.slotId) {
    throw ApiError.conflict('This candidate already has a booked interview slot', 'SLOT_INTERVIEW_EXISTS');
  }
  if (!active && application.status !== APPLICATION_STATUS.SHORTLISTED) {
    throw ApiError.badRequest('Only shortlisted candidates can get an interview link', 'NOT_SHORTLISTED');
  }

  const expiresAt = new Date(Date.now() + application.job.inviteValidDays * 24 * 3600 * 1000);

  if (active) {
    const needsNewExpiry = !active.inviteExpiresAt || active.inviteExpiresAt <= new Date();
    if (!rotate && !needsNewExpiry && active.inviteNonce) {
      return { interview: active, link: interviewLinkFor(active) };
    }
    const inviteNonce = rotate || !active.inviteNonce ? crypto.randomBytes(16).toString('hex') : active.inviteNonce;
    const draft = { ...active, inviteNonce };
    const updated = await prisma.interview.update({
      where: { id: active.id },
      data: { inviteNonce, accessTokenHash: sha256(tokenFor(draft)), inviteExpiresAt: needsNewExpiry ? expiresAt : active.inviteExpiresAt },
    });
    return { interview: updated, link: interviewLinkFor(updated) };
  }

  const interview = await prisma.$transaction(async (tx) => {
    const created = await tx.interview.create({
      data: { applicationId, status: INTERVIEW_STATUS.SCHEDULED, inviteNonce: crypto.randomBytes(16).toString('hex') },
    });
    await tx.application.update({ where: { id: applicationId }, data: { status: APPLICATION_STATUS.INTERVIEW_SCHEDULED } });
    return tx.interview.update({
      where: { id: created.id },
      data: { accessTokenHash: sha256(tokenFor(created)), inviteExpiresAt: expiresAt },
    });
  }, TX_OPTIONS);

  return { interview, link: interviewLinkFor(interview) };
}

// Join link for a SLOT interview booked from the candidate's status link (no
// login). Same token scheme as instant links; it stops working after the
// slot ends (+1 hour grace, matching a late/dropped join). Returns the link.
export async function ensureSlotInterviewLink(interviewId) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId }, include: { slot: true } });
  if (!interview?.slot) return null;
  const expiresAt = new Date(new Date(interview.slot.endTime).getTime() + 3600 * 1000);
  if (interview.inviteNonce && interview.accessTokenHash) {
    if (!interview.inviteExpiresAt || interview.inviteExpiresAt.getTime() !== expiresAt.getTime()) {
      await prisma.interview.update({ where: { id: interview.id }, data: { inviteExpiresAt: expiresAt } });
    }
    return interviewLinkFor(interview);
  }
  const inviteNonce = crypto.randomBytes(16).toString('hex');
  const updated = await prisma.interview.update({
    where: { id: interview.id },
    data: { inviteNonce, accessTokenHash: sha256(tokenFor({ ...interview, inviteNonce })), inviteExpiresAt: expiresAt },
  });
  return interviewLinkFor(updated);
}

// Instant links need FEATURE_INSTANT_INTERVIEW; slot-interview join links
// (status-link bookings) and second-round links work regardless of that flag.
async function findForLink(token) {
  if (env.features.instantInterview) return findByToken(token);
  const interview = await findByToken(token).catch(() => null);
  // if (interview?.slotId) return interview;
  if (interview?.slotId || interview?.round > 1) return interview;
  assertEnabled();
  return findByToken(token);
}

async function findByToken(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw ApiError.notFound('This interview link is invalid', 'INVITE_INVALID');
  const interview = await prisma.interview.findUnique({ where: { accessTokenHash: sha256(token) }, include: INCLUDE });
  if (!interview) throw ApiError.notFound('This interview link is invalid or has been replaced by a newer one', 'INVITE_INVALID');
  return interview;
}

// Why a link can't be used right now (or null when it can).
function blocker(interview) {
  if (interview.status === INTERVIEW_STATUS.COMPLETED) {
    return { code: 'INTERVIEW_COMPLETED', message: "You've already completed this interview. Thank you!" };
  }
  if (interview.status === INTERVIEW_STATUS.CANCELLED) {
    return { code: 'INTERVIEW_CANCELLED', message: 'This interview has been cancelled.' };
  }
  // An interview already in progress can always be rejoined (dropped connection).
  if (interview.status === INTERVIEW_STATUS.SCHEDULED && interview.inviteExpiresAt && interview.inviteExpiresAt <= new Date()) {
    return { code: 'INVITE_EXPIRED', message: 'This interview link has expired. Please contact the recruiter for a new one.' };
  }
  if (!interview.application.candidate.user.isActive) {
    return { code: 'ACCOUNT_INACTIVE', message: 'This account is inactive.' };
  }
  return null;
}

function publicSummary(interview) {
  const { job, candidate } = interview.application;
  const b = blocker(interview);
  return {
    interviewId: interview.id,
    status: interview.status,
    canJoin: !b,
    ...(b ? { reason: b.code, message: b.message } : {}),
    expiresAt: interview.inviteExpiresAt,
    candidateName: candidate.fullName,
    // Booked slot (null for instant links).
    slot: interview.slot ? { startTime: interview.slot.startTime, endTime: interview.slot.endTime } : null,
    job: { title: job.title },
    company: { name: job.company.name, logoUrl: job.company.logoUrl },
    channels: {
      email: candidate.user.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2'),
      sms: candidate.phone ? maskPhone(candidate.phone) : null,
    },
  };
}

export async function getInvite(token) {
  // assertEnabled();
  // return publicSummary(await findByToken(token));
  return publicSummary(await findForLink(token));
}

// Link → 3-hour candidate JWT that only works on /interviews/:thisId/*.
export async function createSession(token) {
  // assertEnabled();
  // const interview = await findByToken(token);
  const interview = await findForLink(token);
  const b = blocker(interview);
  if (b) throw ApiError.badRequest(b.message, b.code);
  const user = interview.application.candidate.user;
  const sessionToken = jwt.sign(
    { sub: user.id, role: 'CANDIDATE', email: user.email, typ: 'interview', interviewId: interview.id },
    env.jwtSecret,
    { expiresIn: SESSION_TTL }
  );
  return { sessionToken, interviewId: interview.id, ...publicSummary(interview) };
}

// Sends the link to the candidate's OWN email or phone (never to an address
// supplied in the request). At most 3 sends per interview per hour.
async function deliver(interview, channel) {
  const now = Date.now();
  const inWindow = interview.inviteSendWindowAt && now - interview.inviteSendWindowAt.getTime() < SEND_LIMIT.windowMs;
  if (inWindow && interview.inviteSendCount >= SEND_LIMIT.count) {
    throw new ApiError(429, 'INVITE_SEND_LIMIT', 'The link was sent several times already. Please check your inbox or try again later.');
  }

  const { job, candidate } = interview.application;
  const link = interviewLinkFor(interview);
  if (channel === 'sms') {
    if (!candidate.phone) throw ApiError.badRequest('No phone number on file', 'NO_PHONE');
    try {
      await smsDriver.send({ to: candidate.phone, body: `Your ${job.company.name} interview for ${job.title}: ${link}` });
    } catch (err) {
      console.error('[instant-interview] SMS failed:', err.message);
      throw new ApiError(502, 'SMS_FAILED', "We couldn't send the SMS. Please try email instead.");
    }
  } else if (interview.slot) {
    // Slot interview (booked from the status link): re-send the booking
    // confirmation with its join link, not the "no booking needed" invite.
    await sendInterviewConfirmationEmail({ application: { ...interview.application, id: interview.applicationId }, slot: interview.slot, joinLink: link });
  } else {
    await sendInterviewInviteEmail({
      to: candidate.user.email,
      candidateName: candidate.fullName,
      jobTitle: job.title,
      companyName: job.company.name,
      link,
      expiresAt: interview.inviteExpiresAt,
      applicationId: interview.applicationId,
      // Second-round interview: different wording ("a second interview").
      secondRound: interview.round > 1,
    });
  }

  await prisma.interview.update({
    where: { id: interview.id },
    data: {
      inviteSentAt: new Date(),
      inviteSendCount: inWindow ? { increment: 1 } : 1,
      ...(inWindow ? {} : { inviteSendWindowAt: new Date() }),
    },
  });
  return { sent: true, channel, to: channel === 'sms' ? maskPhone(candidate.phone) : publicSummary(interview).channels.email };
}

export async function sendInviteByToken(token, channel) {
  // assertEnabled();
  // const interview = await findByToken(token);
  const interview = await findForLink(token);
  const b = blocker(interview);
  if (b) throw ApiError.badRequest(b.message, b.code);
  return deliver(interview, channel);
}

// ─── Second-round AI interview (retake) ───
// Requested by Company HR (from their portal) or by the agency. Always an
// instant link (attend now or before it expires), emailed straight away.
// Round 1 and its report stay untouched; the final score then uses the
// latest completed round (finalScore.service.js).

export const MAX_INTERVIEW_ROUND = 2;
export const SECOND_ROUND_REASONS = ['TECHNICAL_ISSUE', 'NOT_READY', 'NEED_MORE_DETAIL', 'OTHER'];

export async function createSecondRound(applicationId, { reason, notes, requestedById, requestedByRole }) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, interviews: true },
  });
  if (!application) throw ApiError.notFound('Application not found');
  if (application.status === APPLICATION_STATUS.REJECTED) {
    throw ApiError.badRequest('This candidate was rejected', 'APPLICATION_REJECTED');
  }
  const live = application.interviews.filter((i) => i.status !== INTERVIEW_STATUS.CANCELLED);
  if (!live.some((i) => i.status === INTERVIEW_STATUS.COMPLETED)) {
    throw ApiError.badRequest('A second round is possible once the first interview is completed', 'NO_COMPLETED_INTERVIEW');
  }
  if (live.some((i) => ACTIVE.includes(i.status))) {
    throw ApiError.conflict('An interview is already open for this candidate', 'INTERVIEW_ACTIVE');
  }
  const lastRound = Math.max(...live.map((i) => i.round || 1));
  if (lastRound >= MAX_INTERVIEW_ROUND) {
    throw ApiError.conflict('This candidate has already been given a second round', 'ROUND_LIMIT');
  }

  // A candidate already sent to the company stays "Submitted to company".
  const keepStatus = application.status === APPLICATION_STATUS.SUBMITTED_TO_CLIENT;
  const expiresAt = new Date(Date.now() + (application.job.inviteValidDays || 7) * 24 * 3600 * 1000);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.interview.create({
      data: {
        applicationId,
        status: INTERVIEW_STATUS.SCHEDULED,
        round: lastRound + 1,
        roundReason: SECOND_ROUND_REASONS.includes(reason) ? reason : 'OTHER',
        roundNotes: notes?.trim() ? notes.trim().slice(0, 1000) : null,
        roundRequestedById: requestedById || null,
        roundRequestedByRole: requestedByRole || null,
        inviteNonce: crypto.randomBytes(16).toString('hex'),
      },
    });
    if (!keepStatus) {
      await tx.application.update({ where: { id: applicationId }, data: { status: APPLICATION_STATUS.INTERVIEW_SCHEDULED } });
    }
    return tx.interview.update({ where: { id: row.id }, data: { accessTokenHash: sha256(tokenFor(row)), inviteExpiresAt: expiresAt } });
  }, TX_OPTIONS);

  const full = await prisma.interview.findUnique({ where: { id: created.id }, include: INCLUDE });
  const sent = await deliver(full, 'email').catch((err) => ({ sent: false, error: err.message }));
  return { interview: full, link: interviewLinkFor(full), sent };
}

// Round history for one application (agency + Company HR views).
// withLink: only the agency gets the candidate's join link.
export async function roundsForApplication(applicationId, { withLink = false } = {}) {
  const rows = await prisma.interview.findMany({
    where: { applicationId, status: { not: INTERVIEW_STATUS.CANCELLED } },
    include: { report: true },
    orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
  });
  const lastCompleted = rows.some((i) => i.status === INTERVIEW_STATUS.COMPLETED);
  const open = rows.some((i) => ACTIVE.includes(i.status));
  const lastRound = rows.length ? Math.max(...rows.map((i) => i.round || 1)) : 0;
  return {
    canRequestSecondRound: lastCompleted && !open && lastRound < MAX_INTERVIEW_ROUND,
    rounds: rows.map((i) => ({
      interviewId: i.id,
      round: i.round || 1,
      status: i.status,
      reason: i.roundReason,
      notes: i.roundNotes,
      requestedByRole: i.roundRequestedByRole,
      createdAt: i.createdAt,
      endedAt: i.endedAt,
      expiresAt: i.round > 1 ? i.inviteExpiresAt : null,
      ...(withLink && i.round > 1 && ACTIVE.includes(i.status) ? { link: interviewLinkFor(i) } : {}),
      report:
        i.report?.status === 'COMPLETED'
          ? {
              overallScore: i.report.overallScore,
              technicalScore: i.report.technicalScore,
              communicationScore: i.report.communicationScore,
              strengths: i.report.strengths,
              areasForImprovement: i.report.areasForImprovement,
              reasoning: i.report.reasoning,
            }
          : null,
    })),
  };
}

// Used after auto-advance (P4) and by the recruiter's "Send interview link"
// button: create/refresh the link, then email it.
export async function inviteApplication(applicationId, { rotate = false } = {}) {
  const { interview, link } = await createOrRefreshInstantInterview(applicationId, { rotate });
  const full = await prisma.interview.findUnique({ where: { id: interview.id }, include: INCLUDE });
  const sent = await deliver(full, 'email').catch((err) => ({ sent: false, error: err.message }));
  return { interview: full, link, sent };
}
