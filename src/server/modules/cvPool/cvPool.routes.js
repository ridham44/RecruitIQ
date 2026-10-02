import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/permission.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/apiResponse.js';
import { COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
import { PERMISSIONS } from '../../../shared/constants/permissions.js';
import { cvPoolApplySchema } from '../../../shared/schemas/public.schema.js';
import * as service from './cvPool.service.js';

// Build plan P4 — owners and recruiters with REVIEW_CANDIDATES.
const router = Router();

router.use(authenticate, authorize(...COMPANY_SIDE_ROLES), requirePermission(PERMISSIONS.REVIEW_CANDIDATES));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, { submissions: await service.listPool(req.user.id, { status: req.query.status }) });
  })
);

router.post(
  '/:id/apply',
  validate(cvPoolApplySchema),
  asyncHandler(async (req, res) => {
    created(res, await service.applyToJob(req.user.id, req.params.id, req.body.jobId));
  })
);

export default router;
