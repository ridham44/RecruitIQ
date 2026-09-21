import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPLICATION_STATUS, INTERVIEW_SLOT_STATUS, INTERVIEW_STATUS } from '../../../shared/constants/statuses.js';
import { getOwnedJob } from '../jobs/jobs.service.js';
import { sendInterviewConfirmationEmail } from '../notifications/email.service.js';

async function getCandidateIdForUser(userId) {
  const candidate = await prisma.candidate.findUnique({ where: { userId } });
  if (!candidate) throw ApiError.notFound('Candidate profile not found');
  return candidate.id;
}

async function getOwnApplication(userId, applicationId) {
  const candidateId = await getCandidateIdForUser(userId);
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      candidate: { include: { user: true } },
      job: { include: { company: true } },
    },
  });
  if (!application || application.candidateId !== candidateId) {
    throw ApiError.notFound('Application not found');
  }
  return application;
}

// ─────────────────────────────────────────────────────────────
// Company: create/manage slots
// ─────────────────────────────────────────────────────────────

export async function createSlots(userId, jobId, slots) {
  await getOwnedJob(userId, jobId);
  return prisma.$transaction(
    slots.map(({ startTime, endTime }) => prisma.interviewSlot.create({ data: { jobId, startTime, endTime } }))
  );
}

// "Create AI Interview Slots" (Phase 2.5): splits [rangeStart, rangeEnd)
// into evenly-spaced slots of durationMinutes, separated by bufferMinutes.
// E.g. 10:00-13:00, 15-minute duration, 0 buffer -> 12 slots. Slots that
// would overlap an existing (non-cancelled) slot for this job are silently
// skipped rather than erroring the whole batch, so re-running generation
// over a partially-filled day is safe. Uses the exact same InterviewSlot
// model and createSlots-style transaction as manual creation — nothing
// downstream (booking, cancelling, the candidate's slot list) needs to
// know slots were generated in bulk rather than created one at a time.
export async function generateSlots(userId, jobId, { rangeStart, rangeEnd, durationMinutes, bufferMinutes }) {
  await getOwnedJob(userId, jobId);

  const durationMs = durationMinutes * 60 * 1000;
  const stepMs = durationMs + bufferMinutes * 60 * 1000;
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  const candidateSlots = [];
  for (let cursor = rangeStartMs; cursor + durationMs <= rangeEndMs; cursor += stepMs) {
    candidateSlots.push({ startTime: new Date(cursor), endTime: new Date(cursor + durationMs) });
  }

  if (candidateSlots.length === 0) {
    throw ApiError.badRequest('The selected range is too short for even one interview slot', 'RANGE_TOO_SHORT');
  }

  const existingSlots = await prisma.interviewSlot.findMany({
    where: { jobId, status: { not: INTERVIEW_SLOT_STATUS.CANCELLED } },
    select: { startTime: true, endTime: true },
  });
  const overlaps = (a, b) => a.startTime < b.endTime && a.endTime > b.startTime;
  const newSlots = candidateSlots.filter((slot) => !existingSlots.some((existing) => overlaps(slot, existing)));

  if (newSlots.length === 0) {
    throw ApiError.conflict('Every generated slot overlaps an existing slot for this job', 'ALL_SLOTS_OVERLAP');
  }

  const created = await prisma.$transaction(
    newSlots.map((slot) => prisma.interviewSlot.create({ data: { jobId, startTime: slot.startTime, endTime: slot.endTime } }))
  );

  return { slots: created, skippedCount: candidateSlots.length - newSlots.length };
}

export async function listSlotsForJob(userId, jobId) {
  await getOwnedJob(userId, jobId);
  return prisma.interviewSlot.findMany({
    where: { jobId },
    include: {
      // SCHEDULED, IN_PROGRESS (Phase 3: candidate is actively in the AI
      // interview), and COMPLETED all mean "this slot's current occupant" —
      // only CANCELLED is excluded, since a cancelled interview frees the
      // slot for someone else to book (whose row would then show instead).
      interviews: {
        where: { status: { in: [INTERVIEW_STATUS.SCHEDULED, INTERVIEW_STATUS.IN_PROGRESS, INTERVIEW_STATUS.COMPLETED] } },
        include: { application: { include: { candidate: true } } },
      },
    },
    orderBy: { startTime: 'asc' },
  });
}

// Cancelling a booked slot also cancels its active interview and reverts
// the candidate's application back to SHORTLISTED so they can book a
// different slot. Cancelling an unbooked slot just removes it from the
// available list.
export async function cancelSlot(userId, jobId, slotId) {
  await getOwnedJob(userId, jobId);

  const slot = await prisma.interviewSlot.findUnique({
    where: { id: slotId },
    // Includes IN_PROGRESS so a company can still cancel a slot whose AI
    // interview is actively running (e.g. something went wrong) — this
    // correctly cascades to cancelling that interview too, not just
    // silently leaving it dangling.
    include: { interviews: { where: { status: { in: [INTERVIEW_STATUS.SCHEDULED, INTERVIEW_STATUS.IN_PROGRESS] } } } },
  });
  if (!slot || slot.jobId !== jobId) throw ApiError.notFound('Slot not found');

  const activeInterview = slot.interviews[0];
  const operations = [prisma.interviewSlot.update({ where: { id: slotId }, data: { status: INTERVIEW_SLOT_STATUS.CANCELLED } })];

  if (activeInterview) {
    operations.push(
      prisma.interview.update({ where: { id: activeInterview.id }, data: { status: INTERVIEW_STATUS.CANCELLED } }),
      prisma.application.update({
        where: { id: activeInterview.applicationId },
        data: { status: APPLICATION_STATUS.SHORTLISTED },
      })
    );
  }

  await prisma.$transaction(operations);
}

// ─────────────────────────────────────────────────────────────
// Candidate: browse + book
// ─────────────────────────────────────────────────────────────

// Despite the name, this returns every non-cancelled slot for the job, not
// just AVAILABLE ones — the candidate UI shows booked slots too (greyed
// out, unselectable) so the full picture of the day is visible, not just
// the openings. It never includes who booked a slot (candidate.id/name),
// only its own status — that would leak another candidate's booking.
export async function listAvailableSlotsForApplication(userId, applicationId) {
  const application = await getOwnApplication(userId, applicationId);
  return prisma.interviewSlot.findMany({
    where: { jobId: application.jobId, status: { not: INTERVIEW_SLOT_STATUS.CANCELLED } },
    orderBy: { startTime: 'asc' },
  });
}

export async function bookSlot(userId, applicationId, slotId) {
  const application = await getOwnApplication(userId, applicationId);

  if (application.status !== APPLICATION_STATUS.SHORTLISTED) {
    throw ApiError.badRequest('You can only schedule an interview once you have been shortlisted', 'NOT_SHORTLISTED');
  }

  const slot = await prisma.interviewSlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.jobId !== application.jobId) throw ApiError.notFound('Slot not found');

  // Atomic check-and-set: only succeeds if the slot is still AVAILABLE right
  // now, so two candidates racing for the same slot can't both win it.
  const claim = await prisma.interviewSlot.updateMany({
    where: { id: slotId, status: INTERVIEW_SLOT_STATUS.AVAILABLE },
    data: { status: INTERVIEW_SLOT_STATUS.BOOKED },
  });
  if (claim.count === 0) {
    throw ApiError.conflict('This slot was just booked by someone else — please choose another.', 'SLOT_UNAVAILABLE');
  }

  let interview;
  try {
    [interview] = await prisma.$transaction([
      prisma.interview.create({ data: { applicationId, slotId, status: INTERVIEW_STATUS.SCHEDULED } }),
      prisma.application.update({ where: { id: applicationId }, data: { status: APPLICATION_STATUS.INTERVIEW_SCHEDULED } }),
    ]);
  } catch (err) {
    // Roll the slot back if the booking itself failed after the claim succeeded.
    await prisma.interviewSlot.update({ where: { id: slotId }, data: { status: INTERVIEW_SLOT_STATUS.AVAILABLE } });
    throw err;
  }

  await sendInterviewConfirmationEmail({ application, slot }).catch(() => {});

  return getInterviewForApplication(userId, applicationId);
}

// Cancel the candidate's own scheduled interview (Section: "Reschedule
// option") — frees the slot back to AVAILABLE and reverts the application
// to SHORTLISTED so they can book a different one.
export async function cancelMyInterview(userId, applicationId) {
  const application = await getOwnApplication(userId, applicationId);

  const interview = await prisma.interview.findFirst({
    where: { applicationId, status: INTERVIEW_STATUS.SCHEDULED },
  });
  if (!interview) throw ApiError.notFound('No scheduled interview to cancel');

  await prisma.$transaction([
    prisma.interview.update({ where: { id: interview.id }, data: { status: INTERVIEW_STATUS.CANCELLED } }),
    prisma.interviewSlot.update({ where: { id: interview.slotId }, data: { status: INTERVIEW_SLOT_STATUS.AVAILABLE } }),
    prisma.application.update({ where: { id: applicationId }, data: { status: APPLICATION_STATUS.SHORTLISTED } }),
  ]);
}

// ─────────────────────────────────────────────────────────────
// Shared: read the current interview for an application
// (company or the owning candidate — the route layer enforces who's asking)
// ─────────────────────────────────────────────────────────────

export async function getInterviewForApplication(userId, applicationId, { asCompany = false } = {}) {
  if (asCompany) {
    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) throw ApiError.notFound('Application not found');
    await getOwnedJob(userId, application.jobId);
  } else {
    await getOwnApplication(userId, applicationId);
  }

  // IN_PROGRESS (Phase 3: the candidate has joined and the AI interview is
  // actively running) must be included here too, or this stops finding the
  // interview the moment it starts — see interviewEngine.service.js's
  // startInterview, which is the only place that status is ever set.
  return prisma.interview.findFirst({
    where: {
      applicationId,
      status: { in: [INTERVIEW_STATUS.SCHEDULED, INTERVIEW_STATUS.IN_PROGRESS, INTERVIEW_STATUS.COMPLETED] },
    },
    include: { slot: true },
    orderBy: { createdAt: 'desc' },
  });
}

// Company marks an interview as completed once it's taken place.
export async function markInterviewCompleted(userId, jobId, interviewId) {
  await getOwnedJob(userId, jobId);

  const interview = await prisma.interview.findUnique({ where: { id: interviewId }, include: { slot: true } });
  if (!interview || interview.slot.jobId !== jobId) throw ApiError.notFound('Interview not found');

  await prisma.$transaction([
    prisma.interview.update({ where: { id: interviewId }, data: { status: INTERVIEW_STATUS.COMPLETED } }),
    prisma.application.update({
      where: { id: interview.applicationId },
      data: { status: APPLICATION_STATUS.INTERVIEW_COMPLETED },
    }),
  ]);
}
