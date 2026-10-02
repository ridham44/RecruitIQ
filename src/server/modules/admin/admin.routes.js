import { Router } from 'express';
import * as controller from './admin.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../../shared/constants/roles.js';
import {
  adminCreateCompanySchema,
  adminUpdateCompanySchema,
  adminCompanyStatusSchema,
  adminUserStatusSchema,
} from '../../../shared/schemas/admin.schema.js';

// Build plan P1 — Platform Admin only. There is no public admin signup; the
// first admin is created with scripts/create-admin.mjs.
const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/companies', controller.listCompanies);
router.post('/companies', validate(adminCreateCompanySchema), controller.createCompany);
router.get('/companies/:id', controller.getCompany);
router.patch('/companies/:id', validate(adminUpdateCompanySchema), controller.updateCompany);
router.patch('/companies/:id/status', validate(adminCompanyStatusSchema), controller.setCompanyStatus);
router.post('/companies/:id/resend-invite', controller.resendInvite);

router.get('/users', controller.listUsers);
router.patch('/users/:id/status', validate(adminUserStatusSchema), controller.setUserStatus);

export default router;
