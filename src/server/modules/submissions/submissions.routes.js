import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/permission.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/apiResponse.js';
import { COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
import { PERMISSIONS } from '../../../shared/constants/permissions.js';
import * as service from './submissions.service.js';
import { contentDisposition } from '../../utils/contentDisposition.js';
import { submitCandidateSchema } from '../../../shared/schemas/submission.schema.js';

// Build plan P7 — company side. Viewing needs REVIEW_CANDIDATES; sending
// needs SUBMIT_CANDIDATES (owners always pass). Job access is checked per
// application by getOwnedJob.
const router = Router();

router.use(authenticate, authorize(...COMPANY_SIDE_ROLES));

router.get(
  '/applications/:applicationId',
  requirePermission(PERMISSIONS.REVIEW_CANDIDATES),
  asyncHandler(async (req, res) => ok(res, await service.getSubmissionOverview(req.user.id, req.params.applicationId)))
);

router.post(
  '/',
  requirePermission(PERMISSIONS.SUBMIT_CANDIDATES),
  validate(submitCandidateSchema),
  asyncHandler(async (req, res) => created(res, await service.submitCandidate(req.user.id, req.body)))
);

router.post(
  '/applications/:applicationId/final-score',
  requirePermission(PERMISSIONS.REVIEW_CANDIDATES),
  asyncHandler(async (req, res) => ok(res, await service.recomputeFinalScore(req.user.id, req.params.applicationId)))
);

router.post(
  '/jobs/:jobId/final-scores',
  requirePermission(PERMISSIONS.REVIEW_CANDIDATES),
  asyncHandler(async (req, res) => ok(res, await service.recomputeJobFinalScores(req.user.id, req.params.jobId)))
);

export default router;

// ─── Public read-only link for the HR person (no login; the token is the key) ───
export const publicSubmissionRoutes = Router();

publicSubmissionRoutes.get(
  '/:token',
  asyncHandler(async (req, res) => ok(res, await service.viewByToken(req.params.token)))
);

publicSubmissionRoutes.get(
  '/:token/cv',
  asyncHandler(async (req, res) => {
    const { buffer, fileName, fileType } = await service.cvByToken(req.params.token);
    res.setHeader('Content-Type', fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(fileName, req.query.download));
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  })
);
