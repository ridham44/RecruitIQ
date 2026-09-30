import { Router } from 'express';
import * as controller from './recruiters.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/permission.js';
import { COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
import { PERMISSIONS } from '../../../shared/constants/permissions.js';
import {
  inviteRecruiterSchema,
  updateRecruiterSchema,
  recruiterStatusSchema,
  recruiterPermissionsSchema,
  recruiterJobsSchema,
  jobRecruitersSchema,
} from '../../../shared/schemas/recruiter.schema.js';

// Build plan P2 — recruiters inside a recruitment company. The owner always
// has access; a recruiter needs MANAGE_RECRUITERS.
const router = Router();

router.use(authenticate, authorize(...COMPANY_SIDE_ROLES), requirePermission(PERMISSIONS.MANAGE_RECRUITERS));

router.get('/', controller.list);
router.post('/', validate(inviteRecruiterSchema), controller.invite);
router.get('/job/:jobId', controller.listForJob);
router.put('/job/:jobId', validate(jobRecruitersSchema), controller.setForJob);
router.patch('/:id', validate(updateRecruiterSchema), controller.update);
router.patch('/:id/status', validate(recruiterStatusSchema), controller.setStatus);
router.put('/:id/permissions', validate(recruiterPermissionsSchema), controller.setPermissions);
router.put('/:id/jobs', validate(recruiterJobsSchema), controller.setJobs);
router.post('/:id/resend-invite', controller.resendInvite);

export default router;
