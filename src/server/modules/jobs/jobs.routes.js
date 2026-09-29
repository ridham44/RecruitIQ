import { Router } from 'express';
import * as jobsController from './jobs.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
// import { ROLES } from '../../../shared/constants/roles.js';
import { COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
import { PERMISSIONS } from '../../../shared/constants/permissions.js';
import { requirePermission } from '../../middleware/permission.js';
import { createJobSchema, updateJobSchema } from '../../../shared/schemas/job.schema.js';

const router = Router();

// Public/candidate-visible
router.get('/', listOrPublic);

// Company-only (must be registered before the "/:id" catch-all below)
// router.get('/company/mine', authenticate, authorize(ROLES.COMPANY), jobsController.listCompanyJobs);
// router.post('/', authenticate, authorize(ROLES.COMPANY), validate(createJobSchema), jobsController.createJob);
// router.patch('/:id', authenticate, authorize(ROLES.COMPANY), validate(updateJobSchema), jobsController.updateJob);
// router.delete('/:id', authenticate, authorize(ROLES.COMPANY), jobsController.closeJob);
// Build plan P2: owners and recruiters.
router.get('/company/mine', authenticate, authorize(...COMPANY_SIDE_ROLES), jobsController.listCompanyJobs);
// router.post('/', authenticate, authorize(...COMPANY_SIDE_ROLES), validate(createJobSchema), jobsController.createJob);
// router.patch('/:id', authenticate, authorize(...COMPANY_SIDE_ROLES), validate(updateJobSchema), jobsController.updateJob);
// router.delete('/:id', authenticate, authorize(...COMPANY_SIDE_ROLES), jobsController.closeJob);
const manageJobs = requirePermission(PERMISSIONS.MANAGE_JOBS);
router.post('/', authenticate, authorize(...COMPANY_SIDE_ROLES), manageJobs, validate(createJobSchema), jobsController.createJob);
router.patch('/:id', authenticate, authorize(...COMPANY_SIDE_ROLES), manageJobs, validate(updateJobSchema), jobsController.updateJob);
router.delete('/:id', authenticate, authorize(...COMPANY_SIDE_ROLES), manageJobs, jobsController.closeJob);

router.get('/:id', jobsController.getJob);

// GET / is public (browse open jobs) — no auth required for candidates browsing.
function listOrPublic(req, res, next) {
  return jobsController.listOpenJobs(req, res, next);
}

export default router;
