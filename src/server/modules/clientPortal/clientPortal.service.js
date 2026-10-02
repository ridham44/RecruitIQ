import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, TX_OPTIONS } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { storage } from '../../resume/storage/index.js';
import { getCompanyContext } from '../companies/companyContext.js';
import { issuePasswordToken, hasPendingInvite } from '../auth/passwordToken.service.js';
// import { sendAccountSetupEmail } from '../notifications/email.service.js';
import { sendAccountSetupEmail, sendSecondRoundRequestedEmail } from '../notifications/email.service.js';
import { createSecondRound, roundsForApplication } from '../interviews/instantInterview.service.js';

// Build plan P8 — client HR / hiring person portal. HR people log in and see
// ONLY the candidates submitted to them (their HiringPerson row): the frozen
// P7 snapshot and the CV. Never rejected candidates, other departments'
// submissions, recruiter notes or monitoring events.

export function assertPortalEnabled() {
  if (!env.features.clientPortal) throw ApiError.notFound('The Company HR portal is not enabled', 'FEATURE_DISABLED');
}

// const PERSON_INCLUDE = { department: { include: { clientCompany: { include: { company: { select: { id: true, name: true } } } } } } };
// HR belongs to the client company directly; the department is optional.
const PERSON_INCLUDE = {
  clientCompany: { include: { company: { select: { id: true, name: true } } } },
  department: { select: { name: true } },
};

// ─── Invites (recruitment-company side) ───

// Creates (or re-sends) the portal login for an HR person. Works for any HR
// person of the caller's company; `ctx` is null for the automatic invite on
// a first submission.
export async function inviteHiringPerson(personId, { companyId = null } = {}) {
  assertPortalEnabled();
  const person = await prisma.hiringPerson.findUnique({ where: { id: personId }, include: PERSON_INCLUDE });
  // const client = person?.department.clientCompany;
  const client = person?.clientCompany;
  if (!person || (companyId && client.companyId !== companyId)) throw ApiError.notFound('Company HR not found');
  if (!person.isActive) throw ApiError.badRequest('This Company HR is inactive', 'HR_INACTIVE');

  let userId = person.userId;
  if (userId) {
    if (!(await hasPendingInvite(userId))) {
      throw ApiError.badRequest('This Company HR already has an active portal login', 'INVITE_NOT_PENDING');
    }
  } else {
    const email = person.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, include: { hiringPerson: true } });
    if (existing && (existing.role !== ROLES.CLIENT_HR || existing.hiringPerson)) {
      throw ApiError.conflict('This email already belongs to another RecruitIQ account', 'EMAIL_TAKEN');
    }
    const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    userId = await prisma.$transaction(async (tx) => {
      const user = existing || (await tx.user.create({ data: { email, passwordHash: unusable, role: ROLES.CLIENT_HR, passwordSet: false } }));
      await tx.hiringPerson.update({ where: { id: person.id }, data: { userId: user.id } });
      return user.id;
    }, TX_OPTIONS);
  }

  const { link } = await issuePasswordToken(userId);
  await sendAccountSetupEmail({
    to: person.email,
    companyName: client.name,
    partnerName: client.company.name,
    link,
    asClientHr: true,
  });
  return { setupLink: link, hiringPersonId: person.id };
}

export async function inviteHiringPersonAsCompany(userId, personId) {
  const ctx = await getCompanyContext(userId);
  return inviteHiringPerson(personId, { companyId: ctx.companyId });
}

// Portal status per HR person for the company's client page.
export async function portalStatusFor(persons) {
  const out = {};
  for (const p of persons) {
    if (!p.userId) out[p.id] = 'NONE';
    else out[p.id] = (await hasPendingInvite(p.userId)) ? 'INVITED' : 'ACTIVE';
  }
  return out;
}

// ─── Portal (CLIENT_HR side) ───

async function personFor(userId) {
  const person = await prisma.hiringPerson.findUnique({ where: { userId }, include: PERSON_INCLUDE });
  if (!person) throw ApiError.forbidden('No Company HR profile is linked to this account');
  return person;
}

function listItem(s) {
  const snap = s.snapshot || {};
  return {
    id: s.id,
    submittedAt: s.createdAt,
    status: s.status,
    viewedAt: s.viewedAt,
    isNew: s.status !== 'VIEWED',
    candidateName: snap.candidate?.fullName,
    job: snap.job,
    finalScore: snap.finalScore ?? null,
    cvScore: snap.cvMatch?.score ?? null,
    interviewScore: snap.interview?.overallScore ?? null,
  };
}

export async function listSubmissions(userId, { jobId } = {}) {
  assertPortalEnabled();
  const person = await personFor(userId);
  const rows = await prisma.clientSubmission.findMany({
    where: { hiringPersonId: person.id },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const items = rows.map(listItem);
  const jobs = [...new Map(items.filter((i) => i.job?.id).map((i) => [i.job.id, i.job])).values()];
  return {
    me: {
      fullName: person.fullName,
      // department: person.department.name,
      // clientName: person.department.clientCompany.name,
      // recruitmentCompany: person.department.clientCompany.company.name,
      department: person.department?.name || null,
      clientName: person.clientCompany.name,
      recruitmentCompany: person.clientCompany.company.name,
    },
    jobs,
    submissions: jobId ? items.filter((i) => i.job?.id === jobId) : items,
  };
}

async function ownSubmission(userId, submissionId) {
  const person = await personFor(userId);
  const s = await prisma.clientSubmission.findUnique({ where: { id: submissionId }, include: { application: { include: { resume: true } } } });
  // 404 (not 403) so another department can't even tell it exists.
  if (!s || s.hiringPersonId !== person.id) throw ApiError.notFound('Candidate not found');
  return s;
}

export async function getSubmission(userId, submissionId) {
  assertPortalEnabled();
  const s = await ownSubmission(userId, submissionId);
  if (s.status !== 'VIEWED') {
    await prisma.clientSubmission.update({ where: { id: s.id }, data: { status: 'VIEWED', viewedAt: new Date() } });
  }
  // return { id: s.id, submittedAt: s.createdAt, snapshot: s.snapshot };
  // + live round history (second-round interviews happen after the snapshot).
  return { id: s.id, submittedAt: s.createdAt, snapshot: s.snapshot, ...(await roundsForApplication(s.applicationId)) };
}

const REASON_LABELS = {
  TECHNICAL_ISSUE: 'Technical issue in the first interview',
  NOT_READY: 'Candidate was not ready',
  NEED_MORE_DETAIL: 'Need more detail',
  OTHER: 'Other',
};

export async function requestSecondRound(userId, submissionId, { reason, notes }) {
  assertPortalEnabled();
  const s = await ownSubmission(userId, submissionId);
  const person = await personFor(userId);
  await createSecondRound(s.applicationId, { reason, notes, requestedById: userId, requestedByRole: ROLES.CLIENT_HR });

  // Tell the agency (owner email). Never blocks the request.
  const app = await prisma.application.findUnique({
    where: { id: s.applicationId },
    include: { candidate: true, job: { include: { company: { include: { user: { select: { email: true } } } } } } },
  });
  if (app?.job.company.user?.email) {
    await sendSecondRoundRequestedEmail({
      to: app.job.company.user.email,
      hrName: person.fullName,
      companyName: person.clientCompany.name,
      candidateName: app.candidate.fullName,
      jobTitle: app.job.title,
      reason: REASON_LABELS[reason] || reason,
      notes: notes?.trim() || null,
      jobId: app.jobId,
      candidateId: app.candidateId,
      applicationId: app.id,
    }).catch((err) => console.error('[client-portal] second-round email failed:', err.message));
  }
  return getSubmission(userId, submissionId);
}

export async function getSubmissionCv(userId, submissionId) {
  assertPortalEnabled();
  const s = await ownSubmission(userId, submissionId);
  const resume = s.application.resume;
  return { buffer: await storage.read(resume.storageKey), fileName: s.snapshot?.cv?.fileName || resume.fileName, fileType: resume.fileType };
}
