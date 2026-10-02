import { Router } from 'express';
import * as screeningController from './screening.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
// import { ROLES } from '../../../shared/constants/roles.js';
import { COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
import { PERMISSIONS } from '../../../shared/constants/permissions.js';
import { requirePermission } from '../../middleware/permission.js';

const router = Router();

// router.use(authenticate, authorize(ROLES.COMPANY));
// Build plan P2: owners and recruiters (job access is checked by getOwnedJob).
router.use(authenticate, authorize(...COMPANY_SIDE_ROLES), requirePermission(PERMISSIONS.REVIEW_CANDIDATES));

router.post('/job/:jobId/run', screeningController.runForJob);
router.post('/application/:applicationId/run', screeningController.runForApplication);
router.get('/job/:jobId/ranked', screeningController.getRanked);
router.get('/job/:jobId/top', screeningController.getTop10);

export default router;
