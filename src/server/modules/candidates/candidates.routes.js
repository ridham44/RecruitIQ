import { Router } from 'express';
import * as candidatesController from './candidates.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { updateCandidateSchema } from '../../../shared/schemas/candidate.schema.js';

const router = Router();

router.use(authenticate, authorize(ROLES.CANDIDATE));

router.get('/me', candidatesController.getProfile);
router.patch('/me', validate(updateCandidateSchema), candidatesController.updateProfile);

export default router;
