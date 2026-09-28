import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPLICATION_STATUS, CALL_STATUS, INTERVIEW_MODE, INTERVIEW_SLOT_STATUS, INTERVIEW_STATUS } from '../../../shared/constants/statuses.js';
import {
  authorizeCompany,
  beginInterviewIfScheduled,
  finalizeInterview,
  getCurrentStateForWorker,
  loadInterviewContext,
} from './interviewEngine.service.js';

// Telephonic AI interviews. This module only manages the CALL (who to dial,
// when, retries, what happened on the line). The interview itself — stages,
// resume-based questions, follow-ups, the final report — is the exact same
// interviewEngine.service.js state machine the online interview uses; the
// phone-agent/ process just feeds it transcripts via /worker/answer.
//
// phone-agent/ is a long-running process outside this (serverless) app. It
// polls listDuePhoneInterviews, claims one atomically, dials it through
// Twilio, and reports back via updateCallStatus.

const ACTIVE_INTERVIEW_STATUSES = [INTERVIEW_STATUS.SCHEDULED, INTERVIEW_STATUS.IN_PROGRESS];
const TERMINAL_CALL_FAILURES = new Set(['NO_ANSWER', 'FAILED', 'DROPPED']);

const EVENT_FOR_CALL_STATUS = {
  NO_ANSWER: 'CALL_NO_ANSWER',
  FAILED: 'CALL_NO_ANSWER',
  DROPPED: 'CALL_DROPPED',
  COMPLETED: 'CALL_ENDED',
};

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function loadPhoneInterview(interviewId) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId }, include: { slot: true } });
  if (!interview) throw ApiError.notFound('Interview not found');
  if (interview.mode !== INTERVIEW_MODE.PHONE) {
    throw ApiError.badRequest('This is not a telephonic interview', 'NOT_PHONE_INTERVIEW');
  }
  return interview;
}

// Interviews phone-agent/ should dial right now. A booking is due from its
// slot's start time; a retry/redial or a company "Call now" pushes
// nextCallAt instead. Interviews whose slot already ended are skipped
// unless nextCallAt was set AFTER the slot ended (i.e. by a retry or a
// manual "Call now") — so an old, never-called test booking isn't suddenly
// dialed the first time the agent starts up.
export async function listDuePhoneInterviews({ limit = 5 } = {}) {
  const now = new Date();
  const rows = await prisma.interview.findMany({
    where: {
      mode: INTERVIEW_MODE.PHONE,
      status: { in: ACTIVE_INTERVIEW_STATUSES },
      callStatus: CALL_STATUS.PENDING,
      nextCallAt: { lte: now },
    },
    include: { slot: true, application: { include: { candidate: true, job: { include: { company: true } } } } },
    orderBy: { nextCallAt: 'asc' },
    take: limit * 4,
  });

  return rows
    .filter((row) => row.slot.endTime > now || row.nextCallAt > row.slot.endTime)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      phoneNumber: row.phoneNumber,
      callAttempts: row.callAttempts,
      candidateName: row.application.candidate.fullName,
      jobTitle: row.application.job.title,
      companyName: row.application.job.company.name,
      slotStart: row.slot.startTime,
      slotEnd: row.slot.endTime,
    }));
}

// Interviews currently being dialed. phone-agent/ normally learns which
// interview a call belongs to from the X-Interview-Id SIP header; this is
// its fallback when the header didn't come through (only safe to use when
// exactly one call is ringing).
export async function listDialingPhoneInterviews() {
  const rows = await prisma.interview.findMany({
    where: { mode: INTERVIEW_MODE.PHONE, callStatus: CALL_STATUS.DIALING, status: { in: ACTIVE_INTERVIEW_STATUSES } },
    select: { id: true, phoneNumber: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  return rows;
}

// Atomic PENDING -> DIALING (same conditional-update pattern as slot
// booking), so two phone-agent instances — or one agent's poll loop
// overlapping itself — can never dial the same candidate twice.
export async function claimPhoneInterview(interviewId) {
  const claim = await prisma.interview.updateMany({
    where: {
      id: interviewId,
      mode: INTERVIEW_MODE.PHONE,
      status: { in: ACTIVE_INTERVIEW_STATUSES },
      callStatus: CALL_STATUS.PENDING,
    },
    data: { callStatus: CALL_STATUS.DIALING, callAttempts: { increment: 1 } },
  });
  if (claim.count === 0) {
    throw ApiError.conflict('This call was already claimed or is no longer due', 'CALL_ALREADY_CLAIMED');
  }

  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  await prisma.interviewEvent.create({
    data: { interviewId, type: 'CALL_DIALING', metadata: { attempt: interview.callAttempts } },
  });
  return { id: interview.id, phoneNumber: interview.phoneNumber, callAttempts: interview.callAttempts };
}

// The candidate picked up and the agent joined the call. Starts the
// interview (first call) or resumes it at the current unanswered question
// (redial after a dropped line) — never restarts it.
export async function startPhoneInterview(interviewId, { roomName } = {}) {
  const interview = await loadInterviewContext(interviewId);
  if (interview.mode !== INTERVIEW_MODE.PHONE) {
    throw ApiError.badRequest('This is not a telephonic interview', 'NOT_PHONE_INTERVIEW');
  }
  if (interview.status === INTERVIEW_STATUS.COMPLETED || interview.status === INTERVIEW_STATUS.CANCELLED) {
    throw ApiError.badRequest('This interview is no longer active', 'INTERVIEW_NOT_ACTIVE');
  }

  const resumed = !(await beginInterviewIfScheduled(interview, { roomName: roomName || `phone-${interviewId}` }));

  await prisma.interview.update({
    where: { id: interviewId },
    data: { callStatus: CALL_STATUS.IN_CALL, callStartedAt: interview.callStartedAt ?? new Date() },
  });
  await prisma.interviewEvent.create({ data: { interviewId, type: 'CALL_ANSWERED', metadata: { resumed } } });

  const state = await getCurrentStateForWorker(interviewId);
  return {
    ...state,
    resumed,
    candidateFirstName: interview.application.candidate.fullName.split(' ')[0],
    companyName: interview.application.job.company.name,
    jobTitle: interview.application.job.title,
  };
}

// No answer / failed / dropped: retry while attempts remain, otherwise wrap
// up — a started interview is finalized with what was answered (so the
// company still gets a report); one that never started is cancelled and
// the candidate is sent back to SHORTLISTED so they can book again.
async function handleCallFailure(interview, status) {
  if (interview.status === INTERVIEW_STATUS.COMPLETED) {
    return { callStatus: CALL_STATUS.COMPLETED, callEndedAt: new Date() };
  }
  if (interview.status === INTERVIEW_STATUS.CANCELLED) {
    return { callStatus: CALL_STATUS.FAILED, callEndedAt: new Date() };
  }

  if (interview.callAttempts < env.phoneInterview.maxCallAttempts) {
    // A dropped line mid-interview is redialed quickly; an unanswered call
    // waits a few minutes before ringing again.
    const delay = status === 'DROPPED' ? 1 : env.phoneInterview.retryDelayMinutes;
    return { callStatus: CALL_STATUS.PENDING, nextCallAt: minutesFromNow(delay) };
  }

  if (interview.status === INTERVIEW_STATUS.IN_PROGRESS) {
    await finalizeInterview(interview.id);
    return { callStatus: CALL_STATUS.COMPLETED, callEndedAt: new Date() };
  }

  // Never answered at all.
  const operations = [
    prisma.interview.update({ where: { id: interview.id }, data: { status: INTERVIEW_STATUS.CANCELLED } }),
    prisma.application.update({ where: { id: interview.applicationId }, data: { status: APPLICATION_STATUS.SHORTLISTED } }),
  ];
  if (interview.slot.endTime > new Date()) {
    operations.push(prisma.interviewSlot.update({ where: { id: interview.slotId }, data: { status: INTERVIEW_SLOT_STATUS.AVAILABLE } }));
  }
  await prisma.$transaction(operations);
  return { callStatus: status === 'FAILED' ? CALL_STATUS.FAILED : CALL_STATUS.NO_ANSWER, callEndedAt: new Date() };
}

export async function updateCallStatus(interviewId, { status, twilioCallSid, reason }) {
  const interview = await loadPhoneInterview(interviewId);
  let data = {};

  if (status === 'DIALING') {
    data = { twilioCallSid: twilioCallSid ?? interview.twilioCallSid };
  } else if (status === 'IN_CALL') {
    data = { callStatus: CALL_STATUS.IN_CALL, callStartedAt: interview.callStartedAt ?? new Date() };
  } else if (TERMINAL_CALL_FAILURES.has(status)) {
    data = await handleCallFailure(interview, status);
  } else if (status === 'COMPLETED') {
    // The agent hangs up after the engine reports done — but if the line
    // ends while the interview is somehow still running, finalize it so it
    // never gets stuck IN_PROGRESS.
    if (interview.status === INTERVIEW_STATUS.IN_PROGRESS) await finalizeInterview(interviewId);
    data = { callStatus: CALL_STATUS.COMPLETED, callEndedAt: new Date() };
  }

  if (twilioCallSid) data.twilioCallSid = twilioCallSid;
  const updated = await prisma.interview.update({ where: { id: interviewId }, data });

  const eventType = EVENT_FOR_CALL_STATUS[status];
  if (eventType) {
    await prisma.interviewEvent.create({
      data: { interviewId, type: eventType, metadata: { status, reason: reason || null, attempt: interview.callAttempts } },
    });
  }

  return {
    id: updated.id,
    status: updated.status,
    callStatus: updated.callStatus,
    callAttempts: updated.callAttempts,
    nextCallAt: updated.nextCallAt,
  };
}

// Company: "Call now" — makes the interview due immediately with a fresh
// retry budget, instead of waiting for the slot time. Primarily for testing
// the telephone flow end to end; also useful to re-trigger after NO_ANSWER
// while the interview is still active.
export async function requestCallNow(userId, interviewId) {
  const interview = await authorizeCompany(userId, interviewId);
  if (interview.mode !== INTERVIEW_MODE.PHONE) {
    throw ApiError.badRequest('This is not a telephonic interview', 'NOT_PHONE_INTERVIEW');
  }
  if (!ACTIVE_INTERVIEW_STATUSES.includes(interview.status)) {
    throw ApiError.badRequest('This interview is no longer active', 'INTERVIEW_NOT_ACTIVE');
  }
  if (interview.callStatus === CALL_STATUS.DIALING || interview.callStatus === CALL_STATUS.IN_CALL) {
    throw ApiError.conflict('The candidate is already being called', 'CALL_IN_PROGRESS');
  }

  const updated = await prisma.interview.update({
    where: { id: interviewId },
    data: { callStatus: CALL_STATUS.PENDING, nextCallAt: new Date(), callAttempts: 0 },
  });
  return { id: updated.id, callStatus: updated.callStatus, nextCallAt: updated.nextCallAt };
}
