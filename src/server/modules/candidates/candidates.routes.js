import { Router } from 'express';
import * as candidatesController from './candidates.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../../shared/constants/roles.js';

const router = Router();

router.use(authenticate, authorize(ROLES.CANDIDATE));

router.get('/me', candidatesController.getProfile);
router.patch('/me', candidatesController.updateProfile);

export default router;
