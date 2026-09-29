import { Router } from 'express';
import * as companiesController from './companies.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
// import { ROLES } from '../../../shared/constants/roles.js';
import { COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
import { requireOwner } from '../../middleware/permission.js';

const router = Router();

// router.use(authenticate, authorize(ROLES.COMPANY));
// Build plan P2: owners and recruiters.
router.use(authenticate, authorize(...COMPANY_SIDE_ROLES));

router.get('/me', companiesController.getProfile);
// router.patch('/me', companiesController.updateProfile);
// Build plan P2: recruiters can view but not edit the company profile.
router.patch('/me', requireOwner, companiesController.updateProfile);
router.get('/dashboard-overview', companiesController.getDashboardOverview);

export default router;

