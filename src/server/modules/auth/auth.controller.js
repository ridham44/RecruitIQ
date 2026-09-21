import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';

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

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  ok(res, { user });
});
