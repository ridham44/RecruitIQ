import { Router } from 'express';
import * as companiesController from './companies.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../../shared/constants/roles.js';

const router = Router();

router.use(authenticate, authorize(ROLES.COMPANY));

router.get('/me', companiesController.getProfile);
router.patch('/me', companiesController.updateProfile);

export default router;
