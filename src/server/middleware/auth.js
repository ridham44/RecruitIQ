import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { prisma } from '../config/prisma.js';

// Verifies the Bearer JWT and attaches { id, role, email } to req.user.
// No sessions/in-memory state — safe for stateless serverless functions.
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or invalid Authorization header');
  }

  // try {
  //   const payload = jwt.verify(token, env.jwtSecret);
  //   req.user = { id: payload.sub, role: payload.role, email: payload.email };
  //   next();
  // } catch {
  //   throw ApiError.unauthorized('Invalid or expired token', 'INVALID_TOKEN');
  // }
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token', 'INVALID_TOKEN');
  }

  // Build plan P1: a still-valid JWT must stop working once the admin
  // deactivates the user or suspends their company. One small indexed
  // lookup per request.
  const account = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { isActive: true, role: true, company: { select: { status: true } } },
  });
  if (!account || !account.isActive) {
    throw ApiError.unauthorized('Your account is inactive or no longer exists', 'ACCOUNT_INACTIVE');
  }
  if (account.role === 'COMPANY' && account.company?.status === 'SUSPENDED') {
    throw ApiError.forbidden(
      'Your company account has been suspended. Please contact the RecruitIQ administrator.',
      'COMPANY_SUSPENDED'
    );
  }

  req.user = { id: payload.sub, role: payload.role, email: payload.email };
  next();
});

// Role-based authorization (Section 4). Usage: authorize('COMPANY')
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  };
}
