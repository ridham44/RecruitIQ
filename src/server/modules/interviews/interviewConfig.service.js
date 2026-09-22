import { prisma } from '../../config/prisma.js';
import { getOwnedJob } from '../jobs/jobs.service.js';

const DEFAULTS = {
  aiName: 'Priya',
  aiTitle: 'Virtual HR',
  questionCount: 10,
  answerTimeSeconds: 30,
  customQuestions: [],
  voiceGender: 'FEMALE',
  ttsVoiceId: null,
  difficultyStrategy: 'ADAPTIVE',
};

// Section 8: voiceGender -> a concrete Deepgram Aura TTS voice model id.
// Lives only on the backend — the livekit-worker is a separate deployable
// and can't cleanly import from src/shared, so the backend resolves the
// final voice id and hands it to the worker directly (see
// getCurrentStateForWorker in interviewEngine.service.js).
// NOTE: these are placeholder Aura-2 voice ids — confirm the actual choice
// before shipping (see plan's open decisions).
const VOICE_MAP = {
  FEMALE: 'aura-2-thalia-en',
  MALE: 'aura-2-orion-en',
  NEUTRAL: 'aura-2-luna-en',
};

export function resolveTtsVoiceId(config) {
  return config.ttsVoiceId || VOICE_MAP[config.voiceGender] || VOICE_MAP.FEMALE;
}

// Never blocks AI slot generation/booking on a config existing — returns
// sane defaults (not persisted) until the company explicitly saves one via
// upsertConfig (Section 1: "Company should be able to configure/edit these
// settings before interviews start", not "must").
export async function getEffectiveConfig(jobId) {
  const config = await prisma.aiInterviewConfig.findUnique({ where: { jobId } });
  return config || { jobId, ...DEFAULTS };
}

export async function getConfig(userId, jobId) {
  await getOwnedJob(userId, jobId);
  return getEffectiveConfig(jobId);
}

export async function upsertConfig(userId, jobId, data) {
  await getOwnedJob(userId, jobId);
  return prisma.aiInterviewConfig.upsert({
    where: { jobId },
    create: { jobId, ...data },
    update: data,
  });
}
