import { Router } from 'express';
import multer from 'multer';
import * as controller from './recq.controller.js';
import { validate } from '../../middleware/validate.js';
import { uploadResume } from '../../middleware/upload.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { recqOtpSendSchema, recqOtpVerifySchema, recqApplySchema } from '../../../shared/schemas/recq.schema.js';

// Build plan P9 — the /recq agency-link candidate API (no login), all behind
// FEATURE_RECQ. With the flag off every route answers 404, exactly as if the
// routes didn't exist.
const router = Router();

router.use((req, res, next) => {
  if (!env.features.recq) throw ApiError.notFound('This recruitment page is not available', 'FEATURE_DISABLED');
  next();
});

// Same multer error mapping as resumes.routes.js / public.routes.js.
function handleUpload(req, res, next) {
  uploadResume(req, res, (err) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('Resume file exceeds the maximum allowed size', 'FILE_TOO_LARGE'));
    }
    return next(ApiError.badRequest(err.message, 'UPLOAD_FAILED'));
  });
}

// Read: agency page (OPEN jobs) and a single job.
router.get('/:agencySlug', controller.getAgency);
router.get('/:agencySlug/jobs/:jobSlug', controller.getAgencyJob);

// Resume matching (upload happens in-request; the match runs synchronously).
router.post('/:agencySlug/match', handleUpload, controller.discover); // Option B — across the agency
router.post('/:agencySlug/jobs/:jobSlug/match', handleUpload, controller.matchJob); // Option A / Part 2 — one job

// Email OTP (code goes only to the resume's email) + apply.
router.post('/:agencySlug/otp/send', validate(recqOtpSendSchema), controller.sendOtp);
router.post('/:agencySlug/otp/verify', validate(recqOtpVerifySchema), controller.verifyOtp);
router.post('/:agencySlug/apply', validate(recqApplySchema), controller.apply);

export default router;
