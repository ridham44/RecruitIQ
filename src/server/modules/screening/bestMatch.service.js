import { prisma } from '../../config/prisma.js';
import { JOB_STATUS } from '../../../shared/constants/statuses.js';
import { computeSkillOverlap } from './deterministic.util.js';
import { computeMatch, screenApplicationById } from './screening.service.js';

// Build plan P4 (§6B): a CV submitted without choosing a job is placed on its
// best-matching OPEN job. Per the confirmed P4 decision this searches every
// ACTIVE company's open jobs, not only the portal company's.
//
//   1. free pre-rank of all open jobs (skill overlap + keyword hits)
//   2. full AI screening on the top AI_CANDIDATES only, to keep cost down
//   3. best score ≥ that job's minAcceptableScore → Application (AUTO_MATCH),
//      screened with the score already computed; otherwise NO_MATCH
// Every scored job is kept in CvSubmission.matchResults.

const AI_CANDIDATES = 3;
const PRERANK_KEEP = 10;

const STOP_WORDS = new Set(['and', 'the', 'with', 'for', 'developer', 'engineer', 'senior', 'junior', 'lead', 'manager']);

function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
  );
}

function preScore(resume, job) {
  const data = resume.parsedData || {};
  const skills = data.skills || [];
  const overlap = computeSkillOverlap(skills, [...job.requiredSkills, ...job.preferredSkills]);
  // A job with no listed skills scores 100 on overlap; don't let that
  // dominate — rely on keywords for those.
  const hasSkills = job.requiredSkills.length + job.preferredSkills.length > 0;

  const jobWords = tokens(`${job.title} ${job.description}`);
  const cvWords = [...tokens(skills.join(' ')), ...tokens((data.experience || []).map((e) => e.role).join(' '))];
  const hits = cvWords.filter((w) => jobWords.has(w)).length;
  const keyword = cvWords.length ? Math.min(100, Math.round((hits / Math.min(cvWords.length, 15)) * 100)) : 0;

  return hasSkills ? Math.round(overlap.score * 0.7 + keyword * 0.3) : keyword;
}

// Idempotent and safe to call twice at once: the PENDING → MATCHING claim
// makes sure only one caller does the (paid) AI work.
export async function matchCvSubmission(submissionId) {
  const claimed = await prisma.cvSubmission.updateMany({
    where: { id: submissionId, status: 'PENDING' },
    data: { status: 'MATCHING' },
  });
  if (claimed.count === 0) return prisma.cvSubmission.findUnique({ where: { id: submissionId } });

  const submission = await prisma.cvSubmission.findUnique({
    where: { id: submissionId },
    include: { resume: true, candidate: { include: { applications: { select: { jobId: true } } } } },
  });
  const appliedJobIds = submission.candidate.applications.map((a) => a.jobId);

  try {
    const jobs = await prisma.job.findMany({
      where: { status: JOB_STATUS.OPEN, company: { status: 'ACTIVE' }, id: { notIn: appliedJobIds } },
      include: { company: { select: { id: true, name: true } } },
    });

    const ranked = jobs
      .map((job) => ({ job, preScore: preScore(submission.resume, job) }))
      .sort((a, b) => b.preScore - a.preScore)
      .slice(0, PRERANK_KEEP);

    const scored = await Promise.all(
      ranked.slice(0, AI_CANDIDATES).map(async ({ job, preScore: pre }) => {
        try {
          const match = await computeMatch(job, submission.resume);
          return { job, preScore: pre, match };
        } catch (err) {
          return { job, preScore: pre, error: err.message };
        }
      })
    );

    const matchResults = ranked.map(({ job, preScore: pre }) => {
      const s = scored.find((x) => x.job.id === job.id);
      return {
        jobId: job.id,
        companyId: job.companyId,
        jobTitle: job.title,
        companyName: job.company.name,
        preScore: pre,
        score: s?.match?.overallScore ?? null,
        threshold: job.minAcceptableScore,
        passes: s?.match ? s.match.overallScore >= job.minAcceptableScore : false,
        ...(s?.error ? { error: s.error } : {}),
      };
    });

    const best = scored
      .filter((s) => s.match && s.match.overallScore >= s.job.minAcceptableScore)
      .sort((a, b) => b.match.overallScore - a.match.overallScore)[0];

    if (!best) {
      const allFailed = scored.length > 0 && scored.every((s) => s.error);
      return prisma.cvSubmission.update({
        where: { id: submissionId },
        data: { status: allFailed ? 'FAILED' : 'NO_MATCH', matchResults },
      });
    }

    const application = await prisma.application.create({
      data: {
        candidateId: submission.candidateId,
        jobId: best.job.id,
        resumeId: submission.resumeId,
        source: 'AUTO_MATCH',
      },
    });
    await screenApplicationById(application.id, { precomputed: best.match });

    return prisma.cvSubmission.update({
      where: { id: submissionId },
      data: { status: 'MATCHED', matchResults, applicationId: application.id },
    });
  } catch (err) {
    console.error('[bestMatch] matching failed:', err.message);
    return prisma.cvSubmission.update({ where: { id: submissionId }, data: { status: 'FAILED' } });
  }
}
