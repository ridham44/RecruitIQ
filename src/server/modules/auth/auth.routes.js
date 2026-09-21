import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { registerCompanySchema, registerCandidateSchema, loginSchema } from '../../../shared/schemas/auth.schema.js';

const router = Router();

router.post('/register/company', validate(registerCompanySchema), authController.registerCompany);
router.post('/register/candidate', validate(registerCandidateSchema), authController.registerCandidate);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
