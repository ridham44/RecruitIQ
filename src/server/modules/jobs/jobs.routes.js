import { Router } from 'express';
import * as jobsController from './jobs.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
// import { ROLES } from '../../../shared/constants/roles.js';
import { COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
import { PERMISSIONS } from '../../../shared/constants/permissions.js';
import { requirePermission } from '../../middleware/permission.js';
import {
  createJobSchema,
  updateJobSchema,
  publicJobsQuerySchema,
  companyJobsQuerySchema,
  extractJobDetailsSchema,
} from '../../../shared/schemas/job.schema.js';

const router = Router();

// Public/candidate-visible
router.get('/', validate(publicJobsQuerySchema, 'query'), listOrPublic);

// Company-only (must be registered before the "/:id" catch-all below)
// router.get('/company/mine', authenticate, authorize(ROLES.COMPANY), jobsController.listCompanyJobs);
// router.post('/', authenticate, authorize(ROLES.COMPANY), validate(createJobSchema), jobsController.createJob);
// router.patch('/:id', authenticate, authorize(ROLES.COMPANY), validate(updateJobSchema), jobsController.updateJob);
// router.delete('/:id', authenticate, authorize(ROLES.COMPANY), jobsController.closeJob);
// Build plan P2: owners and recruiters.
router.get('/company/mine', authenticate, authorize(...COMPANY_SIDE_ROLES), validate(companyJobsQuerySchema, 'query'), jobsController.listCompanyJobs);
// Build plan P3
router.get('/:id/client-link', authenticate, authorize(...COMPANY_SIDE_ROLES), jobsController.getJobClientLink);
// router.post('/', authenticate, authorize(...COMPANY_SIDE_ROLES), validate(createJobSchema), jobsController.createJob);
// router.patch('/:id', authenticate, authorize(...COMPANY_SIDE_ROLES), validate(updateJobSchema), jobsController.updateJob);
// router.delete('/:id', authenticate, authorize(...COMPANY_SIDE_ROLES), jobsController.closeJob);
const manageJobs = requirePermission(PERMISSIONS.MANAGE_JOBS);
router.post('/', authenticate, authorize(...COMPANY_SIDE_ROLES), manageJobs, validate(createJobSchema), jobsController.createJob);
router.post('/extract', authenticate, authorize(...COMPANY_SIDE_ROLES), manageJobs, validate(extractJobDetailsSchema), jobsController.extractJobDetails);
router.patch('/:id', authenticate, authorize(...COMPANY_SIDE_ROLES), manageJobs, validate(updateJobSchema), jobsController.updateJob);
router.delete('/:id', authenticate, authorize(...COMPANY_SIDE_ROLES), manageJobs, jobsController.closeJob);

// Agency staff who can access the job get the full record; everyone else
// gets the public view of an open job only.
router.get('/:id', optionalAuth, jobsController.getJob);

// Attaches req.user when a valid login token is sent; a missing or stale
// token just means the public view, never an error.
function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, (err) => {
    if (err) req.user = undefined;
    next();
  });
}

// GET / is public (browse open jobs) — no auth required for candidates browsing.
function listOrPublic(req, res, next) {
  return jobsController.listOpenJobs(req, res, next);
}

export default router;
