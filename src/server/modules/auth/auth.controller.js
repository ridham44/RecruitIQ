import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

export const registerCompany = asyncHandler(async (req, res) => {
  const result = await authService.registerCompany(req.body);
  created(res, result);
});

export const registerCandidate = asyncHandler(async (req, res) => {
  const result = await authService.registerCandidate(req.body);
  created(res, result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  ok(res, result);
});

// JWTs are stateless, so there is no server-side session to destroy — this
// endpoint exists for a consistent client-side auth flow and future-proofs
// the API in case a revocation strategy (e.g. token blocklist) is added.
export const logout = asyncHandler(async (req, res) => {
  ok(res, { message: 'Logged out' });
});

// Build plan P1: companies can only register themselves while
// ALLOW_COMPANY_SELF_REGISTER is on (default). The route stays in place.
export function requireCompanySelfRegister(req, res, next) {
  if (!env.features.allowCompanySelfRegister) {
    throw ApiError.forbidden(
      'Company accounts are created by the RecruitIQ administrator. Please contact us to get started.',
      'SELF_REGISTER_DISABLED'
    );
  }
  next();
}

export const getPasswordToken = asyncHandler(async (req, res) => {
  const info = await authService.getPasswordTokenInfo(req.params.token);
  ok(res, info);
});

export const setPassword = asyncHandler(async (req, res) => {
  const result = await authService.setPasswordWithToken(req.body);
  ok(res, result);
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  ok(res, { user });
});
