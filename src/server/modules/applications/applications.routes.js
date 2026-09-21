import { Router } from 'express';
import * as applicationsController from './applications.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { applyToJobSchema, bulkUpdateApplicationStatusSchema } from '../../../shared/schemas/application.schema.js';

const router = Router();

router.use(authenticate);

// Candidate
router.post('/', authorize(ROLES.CANDIDATE), validate(applyToJobSchema), applicationsController.apply);
router.get('/mine', authorize(ROLES.CANDIDATE), applicationsController.listMine);
router.get('/mine/:id', authorize(ROLES.CANDIDATE), applicationsController.getMine);

// Company
router.get('/job/:jobId', authorize(ROLES.COMPANY), applicationsController.listForJob);
router.get('/job/:jobId/candidates/:candidateId', authorize(ROLES.COMPANY), applicationsController.getCandidateDetail);
router.patch(
  '/job/:jobId/bulk-status',
  authorize(ROLES.COMPANY),
  validate(bulkUpdateApplicationStatusSchema),
  applicationsController.bulkUpdateStatus
);

export default router;
