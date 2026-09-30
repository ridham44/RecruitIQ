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
  // Build plan P4: OTP / tracking tokens (typ claim) are not login sessions.
  // if (payload.typ || !payload.sub) {
  // Build plan P5: except an instant-interview session, which is a candidate
  // session limited to that one interview's /interviews/:id/* routes.
  const isInterviewSession = payload.typ === 'interview' && payload.interviewId && payload.role === 'CANDIDATE';
  if ((payload.typ && !isInterviewSession) || !payload.sub) {
    throw ApiError.unauthorized('Invalid or expired token', 'INVALID_TOKEN');
  }
  if (isInterviewSession) {
    const scope = `/api/v1/interviews/${payload.interviewId}`;
    const path = (req.originalUrl || '').split('?')[0];
    if (path !== scope && !path.startsWith(`${scope}/`)) {
      throw ApiError.unauthorized('This interview link only opens its own interview', 'INTERVIEW_SCOPE');
    }
  }

  // Build plan P1: a still-valid JWT must stop working once the admin
  // deactivates the user or suspends their company. One small indexed
  // lookup per request.
  const account = await prisma.user.findUnique({
    where: { id: payload.sub },
    // select: { isActive: true, role: true, company: { select: { status: true } } },
    select: {
      isActive: true,
      role: true,
      company: { select: { status: true } },
      // Build plan P2: recruiters reach their company through membership.
      membership: { select: { isActive: true, company: { select: { status: true } } } },
      // Build plan P8: client HR reach the recruitment company through their HR person.
      hiringPerson: {
        select: { isActive: true, department: { select: { clientCompany: { select: { company: { select: { status: true } } } } } } },
      },
    },
  });
  if (account?.role === 'CLIENT_HR') {
    if (!account.isActive || !account.hiringPerson?.isActive) {
      throw ApiError.unauthorized('Your account is inactive or no longer exists', 'ACCOUNT_INACTIVE');
    }
    if (account.hiringPerson.department?.clientCompany?.company?.status === 'SUSPENDED') {
      throw ApiError.forbidden('This portal is currently unavailable. Please contact your recruitment partner.', 'COMPANY_SUSPENDED');
    }
  }
  if (!account || !account.isActive) {
    throw ApiError.unauthorized('Your account is inactive or no longer exists', 'ACCOUNT_INACTIVE');
  }
  if (account.role === 'RECRUITER' && !account.membership?.isActive) {
    throw ApiError.unauthorized('Your account is inactive or no longer exists', 'ACCOUNT_INACTIVE');
  }
  // if (account.role === 'COMPANY' && account.company?.status === 'SUSPENDED') {
  const companyStatus = account.role === 'RECRUITER' ? account.membership?.company?.status : account.company?.status;
  if ((account.role === 'COMPANY' || account.role === 'RECRUITER') && companyStatus === 'SUSPENDED') {
    throw ApiError.forbidden(
      'Your company account has been suspended. Please contact the RecruitIQ administrator.',
      'COMPANY_SUSPENDED'
    );
  }

  // req.user = { id: payload.sub, role: payload.role, email: payload.email };
  req.user = {
    id: payload.sub,
    role: payload.role,
    email: payload.email,
    // Build plan P5: set only for instant-interview sessions.
    ...(isInterviewSession ? { interviewId: payload.interviewId } : {}),
  };
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
