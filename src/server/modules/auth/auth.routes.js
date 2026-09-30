import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
// import { registerCompanySchema, registerCandidateSchema, loginSchema } from '../../../shared/schemas/auth.schema.js';
import {
  registerCompanySchema,
  registerCandidateSchema,
  loginSchema,
  setPasswordSchema,
  forgotPasswordSchema,
} from '../../../shared/schemas/auth.schema.js';

const router = Router();

// router.post('/register/company', validate(registerCompanySchema), authController.registerCompany);
router.post(
  '/register/company',
  authController.requireCompanySelfRegister,
  validate(registerCompanySchema),
  authController.registerCompany
);
router.post('/register/candidate', validate(registerCandidateSchema), authController.registerCandidate);
router.post('/login', validate(loginSchema), authController.login);
// Build plan P1: invite links (admin-onboarded company owners)
router.get('/password-token/:token', authController.getPasswordToken);
router.post('/set-password', validate(setPasswordSchema), authController.setPassword);
// Forgot password (uses the same set-password page with a RESET token)
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
