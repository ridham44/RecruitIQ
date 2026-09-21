import { Router } from 'express';
import * as schedulingController from './scheduling.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { createSlotsSchema, generateSlotsSchema, bookSlotSchema } from '../../../shared/schemas/scheduling.schema.js';

const router = Router();

router.use(authenticate);

// Company: manage slots for a job
router.post('/jobs/:jobId/slots', authorize(ROLES.COMPANY), validate(createSlotsSchema), schedulingController.createSlots);
router.post(
  '/jobs/:jobId/slots/generate',
  authorize(ROLES.COMPANY),
  validate(generateSlotsSchema),
  schedulingController.generateSlots
);
router.get('/jobs/:jobId/slots', authorize(ROLES.COMPANY), schedulingController.listSlotsForJob);
router.delete('/jobs/:jobId/slots/:slotId', authorize(ROLES.COMPANY), schedulingController.cancelSlot);
router.patch(
  '/jobs/:jobId/interviews/:interviewId/complete',
  authorize(ROLES.COMPANY),
  schedulingController.markInterviewCompleted
);

// Candidate: browse + book
router.get('/applications/:applicationId/slots', authorize(ROLES.CANDIDATE), schedulingController.listAvailableSlots);
router.post(
  '/applications/:applicationId/book',
  authorize(ROLES.CANDIDATE),
  validate(bookSlotSchema),
  schedulingController.bookSlot
);
router.post('/applications/:applicationId/cancel', authorize(ROLES.CANDIDATE), schedulingController.cancelMyInterview);

// Shared: either the owning candidate or the owning company can read it
router.get(
  '/applications/:applicationId/interview',
  authorize(ROLES.CANDIDATE, ROLES.COMPANY),
  schedulingController.getInterview
);

export default router;
