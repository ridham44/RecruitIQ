import { prisma } from '../../config/prisma.js';
import { getOwnedJob } from '../jobs/jobs.service.js';

const DEFAULTS = {
  aiName: 'Priya',
  aiTitle: 'Virtual HR',
  questionCount: 10,
  answerTimeSeconds: 30,
  customQuestions: [],
};

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
