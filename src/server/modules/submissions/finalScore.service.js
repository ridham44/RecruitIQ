import { prisma } from '../../config/prisma.js';
import { APPLICATION_STATUS } from '../../../shared/constants/statuses.js';

// Build plan P7 (§12): final score = CV match × cvWeight + interview ×
// interviewWeight, weights normalized to add up to 1. Only when the job has
// a finalThreshold does the result move the application to QUALIFIED /
// NOT_QUALIFIED; otherwise the score is just recorded and the status stays
// INTERVIEW_COMPLETED exactly as before P7.

const DEFAULT_WEIGHTS = { cv: 0.3, interview: 0.7 };

export function combineScores({ cvScore, interviewScore, cvWeight, interviewWeight }) {
  if (interviewScore == null) return null;
  // No CV score (e.g. shortlisted by hand without screening) → the interview alone.
  if (cvScore == null) return Math.round(interviewScore * 10) / 10;
  let cw = Number.isFinite(cvWeight) && cvWeight >= 0 ? cvWeight : DEFAULT_WEIGHTS.cv;
  let iw = Number.isFinite(interviewWeight) && interviewWeight >= 0 ? interviewWeight : DEFAULT_WEIGHTS.interview;
  if (cw + iw <= 0) ({ cv: cw, interview: iw } = DEFAULT_WEIGHTS);
  return Math.round(((cvScore * cw + interviewScore * iw) / (cw + iw)) * 10) / 10;
}

// Statuses the threshold may (re)decide. SUBMITTED_TO_CLIENT and REJECTED
// are never touched.
const DECIDABLE = [APPLICATION_STATUS.INTERVIEW_COMPLETED, APPLICATION_STATUS.QUALIFIED, APPLICATION_STATUS.NOT_QUALIFIED];

export async function computeFinalScore(applicationId, { onQualified } = {}) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: true,
      screeningResult: true,
      interviews: {
        where: { status: 'COMPLETED', report: { status: 'COMPLETED' } },
        include: { report: true },
        orderBy: { endedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!application) return null;

  const report = application.interviews[0]?.report;
  const cvScore = application.screeningResult?.status === 'COMPLETED' ? application.screeningResult.overallScore : null;
  const finalScore = combineScores({
    cvScore,
    interviewScore: report?.overallScore ?? null,
    cvWeight: application.job.cvWeight,
    interviewWeight: application.job.interviewWeight,
  });
  if (finalScore == null) return { applicationId, skipped: 'NO_INTERVIEW_REPORT' };

  const { finalThreshold } = application.job;
  const decide = finalThreshold != null && DECIDABLE.includes(application.status);
  const status = decide ? (finalScore >= finalThreshold ? APPLICATION_STATUS.QUALIFIED : APPLICATION_STATUS.NOT_QUALIFIED) : application.status;

  await prisma.application.update({
    where: { id: applicationId },
    data: { finalScore, finalScoredAt: new Date(), ...(decide ? { status } : {}) },
  });

  if (status === APPLICATION_STATUS.QUALIFIED && application.status !== APPLICATION_STATUS.QUALIFIED && onQualified) {
    await onQualified(application).catch((err) => console.error('[final-score] auto-submit failed:', err.message));
  }
  return { applicationId, finalScore, status, cvScore, interviewScore: report.overallScore };
}
