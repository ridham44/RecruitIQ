import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/apiResponse.js';
import { ROLES } from '../../../shared/constants/roles.js';
import * as service from './clientPortal.service.js';
import { validate } from '../../middleware/validate.js';
import { secondRoundSchema } from '../../../shared/schemas/scheduling.schema.js';

// Build plan P8 — /api/v1/client-portal, CLIENT_HR only, behind
// FEATURE_CLIENT_PORTAL (checked in the service). No other role can reach
// it, and CLIENT_HR can't reach any company or candidate API (every one of
// those authorizes other roles only).
const router = Router();

router.use(authenticate, authorize(ROLES.CLIENT_HR));

router.get(
  '/submissions',
  asyncHandler(async (req, res) => ok(res, await service.listSubmissions(req.user.id, { jobId: req.query.jobId })))
);

router.get(
  '/submissions/:id',
  asyncHandler(async (req, res) => ok(res, await service.getSubmission(req.user.id, req.params.id)))
);

// Company HR asks for a second-round AI interview: the link goes to the
// candidate straight away and the agency is emailed.
router.post(
  '/submissions/:id/second-round',
  validate(secondRoundSchema),
  asyncHandler(async (req, res) => ok(res, await service.requestSecondRound(req.user.id, req.params.id, req.body)))
);

router.get(
  '/submissions/:id/cv',
  asyncHandler(async (req, res) => {
    const { buffer, fileName, fileType } = await service.getSubmissionCv(req.user.id, req.params.id);
    res.setHeader('Content-Type', fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${String(fileName).replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  })
);

export default router;
