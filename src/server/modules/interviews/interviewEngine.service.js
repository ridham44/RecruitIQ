import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { PLANNED_QUESTION_STAGES } from '../../../shared/constants/statuses.js';
import { getOwnedJob } from '../jobs/jobs.service.js';
import { getEffectiveConfig, resolveTtsVoiceId } from './interviewConfig.service.js';
import { createInterviewToken } from './livekit.service.js';
import { generateInterviewQuestion } from '../../ai/interview-question-generator.service.js';
import { evaluateAnswer } from '../../ai/interview-answer-evaluator.service.js';
import { generateInterviewReport, computeResumeAlignment } from '../../ai/interview-report-generator.service.js';
import { normalizeTranscript } from '../../ai/transcript-normalizer.service.js';
import { nextDifficulty, bucketAnswerStrength } from './interviewDifficulty.util.js';

const STAGE_QUESTION_TYPE = {
  RESUME_QUESTIONS: 'RESUME_BASED',
  BASIC_TECHNICAL: 'TECHNICAL',
  JOB_SPECIFIC: 'JOB_SPECIFIC',
  SCENARIO: 'SCENARIO',
  BEHAVIORAL: 'BEHAVIORAL',
  CANDIDATE_QUESTIONS: 'CANDIDATE_QUESTION',
};

// Stages whose questions carry a difficulty level (Section 5) — the
// introduction and the candidate's-own-questions stage aren't part of the
// difficulty ladder.
const STAGES_WITH_DIFFICULTY = new Set(['RESUME_QUESTIONS', 'BASIC_TECHNICAL', 'JOB_SPECIFIC', 'SCENARIO', 'BEHAVIORAL']);

// "Question X of Y" progress (Section 10) — a follow-up shares its parent's
// index, so it reports the same number as the question it follows up on.
function questionProgress(question, stagePlan) {
  if (!question || question.stage === 'INTRODUCTION') return { questionNumber: null, totalPlannedQuestions: stagePlan.length };
  return { questionNumber: question.index + 1, totalPlannedQuestions: stagePlan.length };
}

// Deterministic ceiling on how many follow-ups the whole interview can ever
// ask, independent of what the LLM "wants" (Section 5: "The AI should NOT
// freely control the entire interview"). A follow-up is also only ever
// allowed once per planned question (no follow-ups-of-follow-ups).
function maxFollowUpBudget(config) {
  return Math.max(2, Math.ceil(config.questionCount / 3));
}

// Flattens AiInterviewConfig into an ordered list of stages, one entry per
// PLANNED question (follow-ups aren't in this list — they're inserted
// live). Company custom questions are guaranteed to all be asked (Section
// 1: "must ask") by expanding the JOB_SPECIFIC stage's share; every other
// stage gets an even split of the remaining budget. CANDIDATE_QUESTIONS is
// always exactly one question, always last.
function buildStagePlan(config) {
  // INTRODUCTION is handled separately (createIntroductionQuestion, asked
  // once at start() and never part of the plannedQuestionIndex sequence) —
  // must be excluded here too, or it collides with a real planned stage.
  const coreStages = PLANNED_QUESTION_STAGES.filter((s) => s !== 'CANDIDATE_QUESTIONS' && s !== 'INTRODUCTION');
  const budgetForCore = Math.max(coreStages.length, config.questionCount - 1);
  const perStage = Math.max(1, Math.round(budgetForCore / coreStages.length));

  const plan = [];
  for (const stage of coreStages) {
    const count = stage === 'JOB_SPECIFIC' ? perStage + config.customQuestions.length : perStage;
    for (let i = 0; i < count; i++) plan.push(stage);
  }
  plan.push('CANDIDATE_QUESTIONS');
  return plan;
}

async function loadInterviewContext(interviewId) {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      slot: true,
      application: {
        include: {
          candidate: { include: { user: true } },
          job: { include: { company: true } },
          resume: true,
        },
      },
      questions: { include: { answer: true }, orderBy: { askedAt: 'asc' } },
    },
  });
  if (!interview) throw ApiError.notFound('Interview not found');
  return interview;
}

async function authorizeCandidate(userId, interviewId) {
  const candidate = await prisma.candidate.findUnique({ where: { userId } });
  if (!candidate) throw ApiError.notFound('Candidate profile not found');

  const interview = await loadInterviewContext(interviewId);
  if (interview.application.candidateId !== candidate.id) throw ApiError.notFound('Interview not found');
  return interview;
}

async function authorizeCompany(userId, interviewId) {
  const interview = await loadInterviewContext(interviewId);
  await getOwnedJob(userId, interview.application.jobId);
  return interview;
}

function currentUnansweredQuestion(interview) {
  return interview.questions.find((q) => !q.answer) || null;
}

// Single choke point for "the best verified transcript" (Section 2): a
// manual correction wins outright, else the normalized text, falling back
// to the raw transcript for rows written before this migration. Feeds both
// the live follow-up context and the final report transcript.
function exchangesFor(interview) {
  return interview.questions
    .filter((q) => q.answer)
    .map((q) => ({
      questionId: q.id,
      stage: q.stage,
      question: q.text,
      transcript:
        q.answer.manuallyCorrected && q.answer.correctedTranscript
          ? q.answer.correctedTranscript
          : q.answer.normalizedTranscript || q.answer.rawTranscript || q.answer.transcript,
      timedOut: q.answer.timedOut,
    }));
}

async function createIntroductionQuestion(interview) {
  const config = await getEffectiveConfig(interview.application.jobId);
  const candidateName = interview.application.candidate.fullName.split(' ')[0];
  const companyName = interview.application.job.company.name;
  const text = `Hi ${candidateName}, I'm ${config.aiName}, ${config.aiTitle} at ${companyName}. Thanks for joining — let's get started. Could you briefly introduce yourself and walk me through your background?`;

  return prisma.interviewQuestion.create({
    data: {
      interviewId: interview.id,
      index: 0,
      stage: 'INTRODUCTION',
      type: 'INTRODUCTION',
      text,
      answerTimeLimitSeconds: config.answerTimeSeconds,
    },
  });
}

async function createPlannedQuestion(interview, plannedIndex, config, stagePlan, difficulty) {
  const stage = stagePlan[plannedIndex];
  const alreadyAskedCustom = interview.questions.filter((q) => q.type === 'CUSTOM').length;
  const isCustomSlot = stage === 'JOB_SPECIFIC' && alreadyAskedCustom < config.customQuestions.length;

  let text;
  let type;
  if (isCustomSlot) {
    text = config.customQuestions[alreadyAskedCustom];
    type = 'CUSTOM';
  } else if (stage === 'CANDIDATE_QUESTIONS') {
    text = `That covers everything on my side. Do you have any questions for us about the role or ${interview.application.job.company.name}?`;
    type = 'CANDIDATE_QUESTION';
  } else {
    text = await generateInterviewQuestion({
      stage,
      job: interview.application.job,
      resumeData: interview.application.resume.parsedData,
      resumeText: interview.application.resume.rawText,
      previousExchanges: exchangesFor(interview),
      difficulty,
    });
    type = STAGE_QUESTION_TYPE[stage];
  }

  // Custom/candidate-question slots aren't on the difficulty ladder even
  // when the stage otherwise would be (e.g. a custom question padded into
  // JOB_SPECIFIC).
  const finalDifficulty = isCustomSlot || stage === 'CANDIDATE_QUESTIONS' ? null : difficulty || null;

  return prisma.interviewQuestion.create({
    data: {
      interviewId: interview.id,
      index: plannedIndex,
      stage,
      type,
      text,
      difficulty: finalDifficulty,
      answerTimeLimitSeconds: config.answerTimeSeconds,
    },
  });
}

// Candidate joins (or rejoins) the room (Section 3). Idempotent: calling
// this again mid-interview just returns a fresh token + the current
// unanswered question, so reconnecting after a dropped connection resumes
// cleanly rather than restarting.
export async function startInterview(userId, interviewId) {
  const interview = await authorizeCandidate(userId, interviewId);

  if (interview.status === 'COMPLETED' || interview.status === 'CANCELLED') {
    throw ApiError.badRequest('This interview is no longer active', 'INTERVIEW_NOT_ACTIVE');
  }

  // First join only — a candidate already IN_PROGRESS is reconnecting
  // (dropped connection, refresh) and must always be let back in regardless
  // of the slot window, or a flaky connection would lock them out mid-interview.
  //
  // TEMP (testing): slot-window check disabled so interviews can be joined
  // at any time. Restore before shipping.
  // if (interview.status === 'SCHEDULED' && new Date() < interview.slot.startTime) {
  //   throw ApiError.badRequest('This interview cannot be joined before its scheduled time', 'INTERVIEW_NOT_YET_STARTED');
  // }

  const candidateUser = interview.application.candidate.user;
  const { token, url, roomName } = await createInterviewToken({
    interviewId,
    identity: candidateUser.id,
    name: interview.application.candidate.fullName,
  });

  if (interview.status === 'SCHEDULED') {
    await prisma.interview.update({
      where: { id: interviewId },
      data: { status: 'IN_PROGRESS', stage: 'INTRODUCTION', startedAt: new Date(), liveKitRoomName: roomName },
    });
    await createIntroductionQuestion(interview);
    await prisma.interviewEvent.create({ data: { interviewId, type: 'INTERVIEW_STARTED' } });
  }

  const config = await getEffectiveConfig(interview.application.jobId);
  const fresh = await loadInterviewContext(interviewId);
  const question = currentUnansweredQuestion(fresh);
  const stagePlan = buildStagePlan(config);
  return {
    token,
    url,
    roomName,
    interview: { id: fresh.id, status: fresh.status, stage: fresh.stage },
    question,
    aiName: config.aiName,
    aiTitle: config.aiTitle,
    voiceGender: config.voiceGender,
    ...questionProgress(question, stagePlan),
  };
}

// Worker calls this trusted via the worker secret (workerAuth.js), not a
// candidate/company JWT — no ownership check applies, only existence.
export async function getCurrentStateForWorker(interviewId) {
  const interview = await loadInterviewContext(interviewId);
  const config = await getEffectiveConfig(interview.application.jobId);
  return {
    id: interview.id,
    status: interview.status,
    stage: interview.stage,
    question: currentUnansweredQuestion(interview),
    aiName: config.aiName,
    aiTitle: config.aiTitle,
    ttsVoiceId: resolveTtsVoiceId(config),
  };
}

export async function getCurrentState(userId, interviewId, { asCompany = false } = {}) {
  const interview = asCompany ? await authorizeCompany(userId, interviewId) : await authorizeCandidate(userId, interviewId);
  const config = await getEffectiveConfig(interview.application.jobId);
  const question = currentUnansweredQuestion(interview);
  const stagePlan = buildStagePlan(config);
  return {
    id: interview.id,
    status: interview.status,
    stage: interview.stage,
    startedAt: interview.startedAt,
    endedAt: interview.endedAt,
    slot: interview.slot,
    question,
    aiName: config.aiName,
    aiTitle: config.aiTitle,
    voiceGender: config.voiceGender,
    ...questionProgress(question, stagePlan),
  };
}

// The core loop (Section 5). Shared by two entry points below: the
// worker-secret route (legacy realtime pipeline) and the candidate-JWT
// route the browser's push-to-talk UI calls directly.
async function advanceInterviewCore(interview, params) {
  const { questionId, transcript, rawTranscript: rawTranscriptInput, correctedTranscript: correctedInput, manuallyCorrected: manuallyCorrectedInput, sttConfidence, durationSeconds, timedOut } = params;
  const interviewId = interview.id;
  if (interview.status !== 'IN_PROGRESS') {
    throw ApiError.badRequest('Interview is not in progress', 'INTERVIEW_NOT_IN_PROGRESS');
  }

  const question = currentUnansweredQuestion(interview);
  if (!question || question.id !== questionId) {
    throw ApiError.conflict('That is not the current active question', 'STALE_QUESTION');
  }

  // Section 2: normalization pipeline. rawTranscript is preferred when the
  // caller sends it (the browser always does); `transcript` is kept only as
  // a fallback for the legacy worker route, which never sends rawTranscript.
  const rawTranscript = (rawTranscriptInput ?? transcript) || '';
  const config = await getEffectiveConfig(interview.application.jobId);
  const normalizedTranscript = rawTranscript.trim()
    ? await normalizeTranscript(rawTranscript, { jobSkills: interview.application.job.requiredSkills })
    : '';
  const manuallyCorrected = Boolean(manuallyCorrectedInput && correctedInput?.trim());
  const correctedTranscript = manuallyCorrected ? correctedInput.trim() : null;

  await prisma.interviewAnswer.create({
    data: {
      questionId: question.id,
      transcript: rawTranscript,
      rawTranscript,
      normalizedTranscript,
      manuallyCorrected,
      correctedTranscript,
      sttConfidence: sttConfidence ?? null,
      durationSeconds,
      timedOut: Boolean(timedOut),
    },
  });

  // "Best verified transcript" (Section 2) — a manual correction is trusted
  // as-is (not re-normalized, so a human fix is never silently undone).
  const evaluationTranscript = manuallyCorrected ? correctedTranscript : normalizedTranscript;

  const stagePlan = buildStagePlan(config);

  // Follow-ups only ever apply to planned questions (never a follow-up of a
  // follow-up), and only while the interview-wide budget allows it.
  const followUpCount = interview.questions.filter((q) => q.type === 'FOLLOW_UP').length;
  const isPlannedQuestion = question.type !== 'FOLLOW_UP';
  const followUpBudgetLeft = followUpCount < maxFollowUpBudget(config);
  const allowFollowUp = isPlannedQuestion && followUpBudgetLeft && question.stage !== 'CANDIDATE_QUESTIONS' && question.stage !== 'INTRODUCTION';

  let evaluation = { needsFollowUp: false, relevance: 0 };
  if (evaluationTranscript?.trim()) {
    evaluation = await evaluateAnswer({
      question: question.text,
      transcript: evaluationTranscript,
      job: interview.application.job,
      allowFollowUp,
    });
    await prisma.interviewAnswer.update({ where: { questionId: question.id }, data: { evaluation } });
  }

  if (evaluation.needsFollowUp) {
    const followUp = await prisma.interviewQuestion.create({
      data: {
        interviewId,
        index: question.index,
        stage: question.stage,
        type: 'FOLLOW_UP',
        text: evaluation.followUpQuestion,
        parentQuestionId: question.id,
        difficulty: question.difficulty, // a follow-up never escalates difficulty on its own
        answerTimeLimitSeconds: config.answerTimeSeconds,
      },
    });
    return {
      done: false,
      isFollowUp: true,
      stage: question.stage,
      question: followUp,
      ...questionProgress(followUp, stagePlan),
    };
  }

  // Introduction doesn't count against plannedQuestionIndex — the plan
  // starts fresh at index 0 for the first REAL planned question.
  const nextPlannedIndex = question.stage === 'INTRODUCTION' ? 0 : interview.plannedQuestionIndex + 1;

  if (nextPlannedIndex >= stagePlan.length) {
    return finalizeInterview(interviewId);
  }

  const nextStage = stagePlan[nextPlannedIndex];
  let nextDiff = null;
  if (STAGES_WITH_DIFFICULTY.has(nextStage)) {
    if (config.difficultyStrategy === 'FIXED' || question.stage === 'INTRODUCTION') {
      // FIXED strategy always asks at MEDIUM; the introduction isn't a
      // technical signal, so the first real question also starts at MEDIUM.
      nextDiff = 'MEDIUM';
    } else {
      nextDiff = nextDifficulty(question.difficulty || 'MEDIUM', bucketAnswerStrength(evaluation.relevance));
    }
  }

  const refreshed = await loadInterviewContext(interviewId);
  const nextQuestion = await createPlannedQuestion(refreshed, nextPlannedIndex, config, stagePlan, nextDiff);
  await prisma.interview.update({
    where: { id: interviewId },
    data: { plannedQuestionIndex: nextPlannedIndex, stage: nextStage },
  });

  return {
    done: false,
    isFollowUp: false,
    stage: nextStage,
    question: nextQuestion,
    ...questionProgress(nextQuestion, stagePlan),
  };
}

// Called by the livekit-worker once STT has a final transcript for the
// current question (legacy realtime pipeline — see interviews.routes.js's
// worker-secret-gated routes). No ownership check: trusted via the shared
// worker secret instead.
export async function advanceInterview(interviewId, params) {
  const interview = await loadInterviewContext(interviewId);
  return advanceInterviewCore(interview, params);
}

// Called directly by the candidate's browser: push-to-talk flow where the
// browser's own speech-to-text fills an editable text box and "Send"
// submits the transcript straight to the interview engine.
export async function submitAnswerAsCandidate(userId, interviewId, params) {
  const interview = await authorizeCandidate(userId, interviewId);
  return advanceInterviewCore(interview, params);
}

// Ends the interview — reachable both from the natural end of the question
// plan (advanceInterview above) and from the candidate explicitly clicking
// "End Interview" early. Idempotent.
export async function finalizeInterview(interviewId) {
  const interview = await loadInterviewContext(interviewId);
  if (interview.status === 'COMPLETED') return { done: true, stage: 'END' };

  await prisma.interview.update({
    where: { id: interviewId },
    data: { status: 'COMPLETED', stage: 'END', endedAt: new Date() },
  });
  await prisma.interviewEvent.create({ data: { interviewId, type: 'INTERVIEW_ENDED' } });
  await prisma.application.update({
    where: { id: interview.applicationId },
    data: { status: 'INTERVIEW_COMPLETED' },
  });

  // Awaited (not fire-and-forget): Vercel functions don't guarantee
  // execution continues after the response is sent, so the report is
  // generated synchronously here — same pattern screening.service.js uses.
  await generateFinalReport(interviewId).catch((err) => console.error('[interviews] report generation failed:', err.message));

  return { done: true, stage: 'END' };
}

export async function endInterviewByCandidate(userId, interviewId) {
  await authorizeCandidate(userId, interviewId);
  return finalizeInterview(interviewId);
}

async function generateFinalReport(interviewId) {
  const interview = await loadInterviewContext(interviewId);
  const { job, resume } = interview.application;
  const exchanges = exchangesFor(interview);

  try {
    const [report, resumeAlignment] = await Promise.all([
      generateInterviewReport({ job, resumeData: resume.parsedData, resumeText: resume.rawText, exchanges }),
      Promise.resolve(computeResumeAlignment(resume.parsedData, job)),
    ]);

    await prisma.interviewReport.upsert({
      where: { interviewId },
      create: {
        interviewId,
        status: 'COMPLETED',
        overallScore: report.overallScore,
        technicalScore: report.technicalScore,
        communicationScore: report.communicationScore,
        strengths: report.strengths,
        areasForImprovement: report.areasForImprovement,
        questionAnalysis: report.questionAnalysis,
        resumeAlignment,
        reasoning: report.reasoning,
        generatedAt: new Date(),
      },
      update: {
        status: 'COMPLETED',
        overallScore: report.overallScore,
        technicalScore: report.technicalScore,
        communicationScore: report.communicationScore,
        strengths: report.strengths,
        areasForImprovement: report.areasForImprovement,
        questionAnalysis: report.questionAnalysis,
        resumeAlignment,
        reasoning: report.reasoning,
        errorMessage: null,
        generatedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.interviewReport.upsert({
      where: { interviewId },
      create: { interviewId, status: 'FAILED', errorMessage: err.message },
      update: { status: 'FAILED', errorMessage: err.message },
    });
  }
}

export async function recordEvent(interviewId, { type, metadata }) {
  return prisma.interviewEvent.create({ data: { interviewId, type, metadata } });
}

export async function recordEventAsCandidate(userId, interviewId, payload) {
  await authorizeCandidate(userId, interviewId);
  return recordEvent(interviewId, payload);
}

export async function listInterviewsForJob(userId, jobId) {
  await getOwnedJob(userId, jobId);
  return prisma.interview.findMany({
    where: { application: { jobId } },
    include: {
      application: { include: { candidate: true } },
      slot: true,
      report: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getInterviewDetailForCompany(userId, interviewId) {
  const interview = await authorizeCompany(userId, interviewId);
  return getFullDetail(interview);
}

export async function getInterviewDetailForCandidate(userId, interviewId) {
  const interview = await authorizeCandidate(userId, interviewId);
  return getFullDetail(interview);
}

async function getFullDetail(interview) {
  const [events, report, config] = await Promise.all([
    prisma.interviewEvent.findMany({ where: { interviewId: interview.id }, orderBy: { occurredAt: 'asc' } }),
    prisma.interviewReport.findUnique({ where: { interviewId: interview.id } }),
    getEffectiveConfig(interview.application.jobId),
  ]);
  return {
    id: interview.id,
    status: interview.status,
    stage: interview.stage,
    startedAt: interview.startedAt,
    endedAt: interview.endedAt,
    slot: interview.slot,
    candidate: interview.application.candidate,
    job: { id: interview.application.job.id, title: interview.application.job.title },
    questions: interview.questions,
    events,
    report,
    aiName: config.aiName,
    aiTitle: config.aiTitle,
    voiceGender: config.voiceGender,
    questionCount: config.questionCount,
    answerTimeSeconds: config.answerTimeSeconds,
    difficultyStrategy: config.difficultyStrategy,
  };
}
