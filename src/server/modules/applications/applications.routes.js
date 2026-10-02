import { Router } from 'express';
import * as applicationsController from './applications.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES, COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
// import { PERMISSIONS } from '../../../shared/constants/permissions.js';
// import { requirePermission } from '../../middleware/permission.js';
import { PERMISSIONS, VIEW_CANDIDATE_PERMISSIONS } from '../../../shared/constants/permissions.js';
import { requirePermission, requireAnyPermission } from '../../middleware/permission.js';
import { applyToJobSchema, bulkUpdateApplicationStatusSchema } from '../../../shared/schemas/application.schema.js';

const router = Router();

router.use(authenticate);

// Candidate
router.post('/', authorize(ROLES.CANDIDATE), validate(applyToJobSchema), applicationsController.apply);
router.get('/mine', authorize(ROLES.CANDIDATE), applicationsController.listMine);
router.get('/mine/:id', authorize(ROLES.CANDIDATE), applicationsController.getMine);

// Company
// router.get('/job/:jobId', authorize(ROLES.COMPANY), applicationsController.listForJob);
// router.get('/job/:jobId/candidates/:candidateId', authorize(ROLES.COMPANY), applicationsController.getCandidateDetail);
// router.patch(
//   '/job/:jobId/bulk-status',
//   authorize(ROLES.COMPANY),
//   validate(bulkUpdateApplicationStatusSchema),
//   applicationsController.bulkUpdateStatus
// );
// router.patch('/:applicationId/reject', authorize(ROLES.COMPANY), applicationsController.reject);
// Build plan P2: owners, and recruiters with REVIEW_CANDIDATES on an assigned job.
const reviewCandidates = requirePermission(PERMISSIONS.REVIEW_CANDIDATES);
// router.get('/job/:jobId', authorize(...COMPANY_SIDE_ROLES), reviewCandidates, applicationsController.listForJob);
// router.get('/job/:jobId/candidates/:candidateId', authorize(...COMPANY_SIDE_ROLES), reviewCandidates, applicationsController.getCandidateDetail);
// Reading applicants / a candidate / the CV: VIEW_CANDIDATES or REVIEW_CANDIDATES.
// Every change below still needs REVIEW_CANDIDATES.
const viewCandidates = requireAnyPermission(...VIEW_CANDIDATE_PERMISSIONS);
router.get('/job/:jobId', authorize(...COMPANY_SIDE_ROLES), viewCandidates, applicationsController.listForJob);
router.get('/job/:jobId/candidates/:candidateId', authorize(...COMPANY_SIDE_ROLES), viewCandidates, applicationsController.getCandidateDetail);
router.get('/job/:jobId/candidates/:candidateId/cv', authorize(...COMPANY_SIDE_ROLES), viewCandidates, applicationsController.getCandidateCv);
router.patch(
  '/job/:jobId/bulk-status',
  authorize(...COMPANY_SIDE_ROLES),
  reviewCandidates,
  validate(bulkUpdateApplicationStatusSchema),
  applicationsController.bulkUpdateStatus
);
router.patch('/:applicationId/reject', authorize(...COMPANY_SIDE_ROLES), reviewCandidates, applicationsController.reject);

export default router;
