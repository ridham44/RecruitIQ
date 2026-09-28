import { Router } from 'express';
import * as controller from './interviews.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { authenticateWorker } from '../../middleware/workerAuth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../../shared/constants/roles.js';
import {
  upsertInterviewConfigSchema,
  logInterviewEventSchema,
  submitAnswerSchema,
} from '../../../shared/schemas/interview.schema.js';

const router = Router();

// ─── Worker routes (shared secret, no user JWT) — mounted first and kept
// entirely separate from the authenticate() middleware below, since the
// livekit-worker process has no candidate/company credentials. ───
router.post('/:interviewId/worker/answer', authenticateWorker, validate(submitAnswerSchema), controller.workerSubmitAnswer);
router.get('/:interviewId/worker/context', authenticateWorker, controller.workerGetContext);
router.post('/:interviewId/worker/events', authenticateWorker, validate(logInterviewEventSchema), controller.workerLogEvent);

// ─── Browser routes (candidate/company JWT) ───
router.use(authenticate);

// Company: AI interviewer configuration
router.get('/config/:jobId', authorize(ROLES.COMPANY), controller.getConfig);
router.patch('/config/:jobId', authorize(ROLES.COMPANY), validate(upsertInterviewConfigSchema), controller.upsertConfig);

// Company: recruiter view of interviews for a job
router.get('/job/:jobId', authorize(ROLES.COMPANY), controller.listForJob);

// Shared: either the owning candidate or the owning company can read
router.get('/:interviewId', authorize(ROLES.CANDIDATE, ROLES.COMPANY), controller.getDetail);
router.get('/:interviewId/state', authorize(ROLES.CANDIDATE, ROLES.COMPANY), controller.getState);

// Candidate: join/run/end their own interview
router.post('/:interviewId/start', authorize(ROLES.CANDIDATE), controller.start);
router.post('/:interviewId/answer', authorize(ROLES.CANDIDATE), validate(submitAnswerSchema), controller.submitAnswer);
router.post('/:interviewId/events', authorize(ROLES.CANDIDATE), validate(logInterviewEventSchema), controller.logEvent);
router.post('/:interviewId/end', authorize(ROLES.CANDIDATE), controller.end);

export default router;
