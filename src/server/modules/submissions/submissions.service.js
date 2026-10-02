import crypto from 'crypto';
import { prisma, TX_OPTIONS } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { APPLICATION_STATUS } from '../../../shared/constants/statuses.js';
import { getOwnedJob } from '../jobs/jobs.service.js';
import { storage } from '../../resume/storage/index.js';
import { sendClientSubmissionEmail } from '../notifications/email.service.js';
import { computeFinalScore } from './finalScore.service.js';
import { inviteHiringPerson } from '../clientPortal/clientPortal.service.js';

// Build plan P7 (§13) — send a candidate package to the right Client →
// Department → HR person. The package is frozen in ClientSubmission.snapshot
// at send time. The HR person opens it with a secure read-only link (only
// the token's hash is stored); P8 adds a logged-in client portal on top.

const SUBMITTABLE = [APPLICATION_STATUS.INTERVIEW_COMPLETED, APPLICATION_STATUS.QUALIFIED, APPLICATION_STATUS.SUBMITTED_TO_CLIENT];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const origin = () => env.clientUrl.split(',')[0].trim();
export const submissionLink = (token) => `${origin()}/submission/${token}`;

const APPLICATION_INCLUDE = {
  candidate: { include: { user: { select: { email: true } } } },
  resume: { select: { id: true, fileName: true, fileType: true, parsedData: true } },
  screeningResult: true,
  job: {
    include: {
      company: { select: { id: true, name: true } },
      clientCompany: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      hiringPerson: { select: { id: true, fullName: true, email: true, isActive: true, departmentId: true } },
    },
  },
  interviews: {
    where: { status: 'COMPLETED' },
    include: { report: true, questions: { include: { answer: true }, orderBy: { askedAt: 'asc' } } },
    orderBy: { endedAt: 'desc' },
    take: 1,
  },
};

async function loadApplication(applicationId) {
  const application = await prisma.application.findUnique({ where: { id: applicationId }, include: APPLICATION_INCLUDE });
  if (!application) throw ApiError.notFound('Application not found');
  return application;
}

// Everything the client receives, frozen. No internal notes, raw monitoring
// events or other candidates.
export function buildSnapshot(application, { note } = {}) {
  const { candidate, resume, screeningResult: s, job } = application;
  const interview = application.interviews[0];
  const report = interview?.report?.status === 'COMPLETED' ? interview.report : null;
  const analysis = Array.isArray(report?.questionAnalysis) ? report.questionAnalysis : [];

  return {
    version: 1,
    candidate: {
      fullName: candidate.fullName,
      email: candidate.user.email,
      phone: candidate.phone,
      location: candidate.location,
      headline: candidate.headline,
    },
    cv: { resumeId: resume.id, fileName: resume.fileName, fileType: resume.fileType, skills: resume.parsedData?.skills || [] },
    job: { id: job.id, title: job.title },
    recruitmentCompany: { name: job.company.name },
    client: job.clientCompany ? { name: job.clientCompany.name, department: job.department?.name || null } : null,
    cvMatch: s?.status === 'COMPLETED'
      ? {
          score: s.overallScore,
          skillMatchScore: s.skillMatchScore,
          experienceMatchScore: s.experienceMatchScore,
          educationMatchScore: s.educationMatchScore,
          matchedSkills: s.matchedSkills,
          missingSkills: s.missingSkills,
          reasoning: s.reasoning,
        }
      : null,
    interview: report
      ? {
          completedAt: interview.endedAt,
          overallScore: report.overallScore,
          technicalScore: report.technicalScore,
          communicationScore: report.communicationScore,
          strengths: report.strengths,
          areasForImprovement: report.areasForImprovement,
          criteriaAssessment: report.criteriaAssessment || null,
          reasoning: report.reasoning,
          questions: interview.questions
            .filter((q) => q.answer)
            .map((q) => {
              const a = analysis.find((x) => x.questionId === q.id) || {};
              return {
                question: q.text,
                stage: q.stage,
                answerSummary: a.answerSummary || null,
                score: a.score ?? null,
                evaluation: a.evaluationReason || null,
              };
            }),
        }
      : null,
    finalScore: application.finalScore,
    weights: { cv: job.cvWeight, interview: job.interviewWeight },
    finalThreshold: job.finalThreshold,
    note: note?.trim() || null,
    generatedAt: new Date().toISOString(),
  };
}

// hiringPersonId (must belong to this recruitment company) → that person;
// else a hand-typed email; else the job's own HR person.
async function resolveRecipient(companyId, application, { hiringPersonId, recipientEmail, recipientName }) {
  if (hiringPersonId) {
    const person = await prisma.hiringPerson.findUnique({
      where: { id: hiringPersonId },
      // include: { department: { include: { clientCompany: true } } },
      include: { clientCompany: true },
    });
    // if (!person || person.department.clientCompany.companyId !== companyId) throw ApiError.badRequest('HR person not found', 'INVALID_RECIPIENT');
    if (!person || person.clientCompany.companyId !== companyId) throw ApiError.badRequest('Company HR not found', 'INVALID_RECIPIENT');
    if (!person.isActive) throw ApiError.badRequest('That Company HR is inactive', 'INVALID_RECIPIENT');
    return {
      hiringPersonId: person.id,
      // departmentId: person.departmentId,
      // clientCompanyId: person.department.clientCompanyId,
      departmentId: person.departmentId ?? application.job.department?.id ?? null,
      clientCompanyId: person.clientCompanyId,
      recipientName: person.fullName,
      recipientEmail: person.email,
    };
  }
  if (recipientEmail?.trim()) {
    return {
      hiringPersonId: null,
      departmentId: application.job.department?.id || null,
      clientCompanyId: application.job.clientCompany?.id || null,
      recipientName: recipientName?.trim() || recipientEmail.trim(),
      recipientEmail: recipientEmail.trim().toLowerCase(),
    };
  }
  const hp = application.job.hiringPerson;
  if (hp?.isActive) {
    return resolveRecipient(companyId, application, { hiringPersonId: hp.id });
  }
  throw ApiError.badRequest('Choose a Company HR or enter an email to send this candidate to', 'RECIPIENT_REQUIRED');
}

async function createSubmission(application, recipient, { submittedById, note }) {
  if (!SUBMITTABLE.includes(application.status)) {
    throw ApiError.badRequest('Only candidates who finished the interview can be submitted', 'NOT_SUBMITTABLE');
  }
  const duplicate = await prisma.clientSubmission.findFirst({
    where: { applicationId: application.id, recipientEmail: recipient.recipientEmail },
  });
  if (duplicate) throw ApiError.conflict(`Already sent to ${recipient.recipientEmail}`, 'ALREADY_SUBMITTED');

  const token = crypto.randomBytes(32).toString('hex');
  const snapshot = buildSnapshot(application, { note });
  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.clientSubmission.create({
      data: { applicationId: application.id, ...recipient, submittedById, note: note?.trim() || null, snapshot, accessTokenHash: sha256(token) },
    });
    await tx.application.update({ where: { id: application.id }, data: { status: APPLICATION_STATUS.SUBMITTED_TO_CLIENT } });
    return created;
  }, TX_OPTIONS);

  const link = submissionLink(token);
  await sendClientSubmissionEmail({
    to: recipient.recipientEmail,
    recipientName: recipient.recipientName,
    candidateName: snapshot.candidate.fullName,
    jobTitle: snapshot.job.title,
    recruitmentCompany: snapshot.recruitmentCompany.name,
    finalScore: snapshot.finalScore,
    note: snapshot.note,
    link,
    applicationId: application.id,
  });

  // Build plan P8: first submission to an HR person without a portal login
  // → invite them automatically (when the portal is on). Never blocks.
  if (recipient.hiringPersonId && env.features.clientPortal) {
    const person = await prisma.hiringPerson.findUnique({ where: { id: recipient.hiringPersonId } });
    if (person && !person.userId) {
      await inviteHiringPerson(person.id).catch((err) => console.error('[submissions] portal invite failed:', err.message));
    }
  }
  return { submission: serializeSubmission(submission), link };
}

function serializeSubmission(s) {
  return {
    id: s.id,
    recipientName: s.recipientName,
    recipientEmail: s.recipientEmail,
    hiringPersonId: s.hiringPersonId,
    status: s.status,
    viewedAt: s.viewedAt,
    createdAt: s.createdAt,
    submittedBy: s.submittedById === 'SYSTEM' ? 'Automatic' : s.submittedById,
    note: s.note,
    finalScore: s.snapshot?.finalScore ?? null,
  };
}

// ─── Company side ───

export async function submitCandidate(userId, { applicationId, hiringPersonId, recipientEmail, recipientName, note }) {
  const application = await loadApplication(applicationId);
  const job = await getOwnedJob(userId, application.jobId);
  const recipient = await resolveRecipient(job.companyId, application, { hiringPersonId, recipientEmail, recipientName });
  return createSubmission(application, recipient, { submittedById: userId, note });
}

// Auto-submit (job.autoSubmitToClient) — only to the job's own HR person.
export async function autoSubmit(applicationId) {
  const application = await loadApplication(applicationId);
  if (!application.job.autoSubmitToClient || !application.job.hiringPerson?.isActive) return null;
  const recipient = await resolveRecipient(application.job.companyId, application, { hiringPersonId: application.job.hiringPerson.id });
  return createSubmission(application, recipient, { submittedById: 'SYSTEM' });
}

export async function getSubmissionOverview(userId, applicationId) {
  const application = await loadApplication(applicationId);
  await getOwnedJob(userId, application.jobId);
  const [history, recipients] = await Promise.all([
    prisma.clientSubmission.findMany({ where: { applicationId }, orderBy: { createdAt: 'desc' } }),
    application.job.clientCompany
      ? prisma.hiringPerson.findMany({
          // where: { isActive: true, department: { clientCompanyId: application.job.clientCompany.id, isActive: true } },
          where: { isActive: true, clientCompanyId: application.job.clientCompany.id },
          include: { department: { select: { name: true } } },
          orderBy: { fullName: 'asc' },
        })
      : [],
  ]);
  return {
    applicationId,
    status: application.status,
    canSubmit: SUBMITTABLE.includes(application.status),
    finalScore: application.finalScore,
    finalThreshold: application.job.finalThreshold,
    defaultHiringPersonId: application.job.hiringPerson?.isActive ? application.job.hiringPerson.id : null,
    client: application.job.clientCompany,
    recipients: recipients.map((p) => ({ id: p.id, fullName: p.fullName, email: p.email, designation: p.designation, department: p.department?.name || null })),
    preview: buildSnapshot(application),
    history: history.map(serializeSubmission),
  };
}

export async function recomputeFinalScore(userId, applicationId) {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw ApiError.notFound('Application not found');
  await getOwnedJob(userId, application.jobId);
  return computeFinalScore(applicationId, { onQualified: (app) => autoSubmit(app.id) });
}

// After changing the threshold or weights: re-score every interviewed candidate.
export async function recomputeJobFinalScores(userId, jobId) {
  await getOwnedJob(userId, jobId);
  const apps = await prisma.application.findMany({
    where: { jobId, status: { in: [APPLICATION_STATUS.INTERVIEW_COMPLETED, APPLICATION_STATUS.QUALIFIED, APPLICATION_STATUS.NOT_QUALIFIED, APPLICATION_STATUS.SUBMITTED_TO_CLIENT] } },
    select: { id: true },
  });
  const results = [];
  for (const a of apps) results.push(await computeFinalScore(a.id, { onQualified: (app) => autoSubmit(app.id) }));
  return { rescored: results.filter((r) => r && !r.skipped).length, results };
}

// ─── Public read-only link (for the HR person) ───

async function findByToken(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw ApiError.notFound('This link is invalid', 'SUBMISSION_INVALID');
  const s = await prisma.clientSubmission.findUnique({ where: { accessTokenHash: sha256(token) }, include: { application: { include: { resume: true } } } });
  if (!s) throw ApiError.notFound('This link is invalid', 'SUBMISSION_INVALID');
  return s;
}

export async function viewByToken(token) {
  const s = await findByToken(token);
  if (s.status !== 'VIEWED') {
    await prisma.clientSubmission.update({ where: { id: s.id }, data: { status: 'VIEWED', viewedAt: new Date() } });
  }
  return { submittedAt: s.createdAt, recipientName: s.recipientName, snapshot: s.snapshot };
}

export async function cvByToken(token) {
  const s = await findByToken(token);
  const resume = s.application.resume;
  const buffer = await storage.read(resume.storageKey);
  return { buffer, fileName: s.snapshot?.cv?.fileName || resume.fileName, fileType: resume.fileType };
}
