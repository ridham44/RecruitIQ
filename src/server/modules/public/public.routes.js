import { Router } from 'express';
import multer from 'multer';
import * as controller from './public.controller.js';
import { validate } from '../../middleware/validate.js';
import { uploadResume } from '../../middleware/upload.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
// import { otpSendSchema, otpVerifySchema, guestApplySchema, trackTokenSchema } from '../../../shared/schemas/public.schema.js';
import { otpSendSchema, otpVerifySchema, guestApplySchema, trackTokenSchema, trackBookingSchema } from '../../../shared/schemas/public.schema.js';

// Build plan P4 — public careers portal API (no login), all behind
// FEATURE_GUEST_APPLY. With the flag off every route answers 404, exactly as
// if the routes didn't exist.
const router = Router();

router.use((req, res, next) => {
  if (!env.features.guestApply) throw ApiError.notFound('The careers portal is not enabled', 'FEATURE_DISABLED');
  next();
});

// Same multer error mapping as resumes.routes.js.
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

router.get('/careers/:slug', controller.getPortal);
router.get('/careers/:slug/jobs/:jobId', controller.getPortalJob);

router.post('/otp/send', validate(otpSendSchema), controller.sendOtp);
router.post('/otp/verify', validate(otpVerifySchema), controller.verifyOtp);

router.post('/cv/parse', handleUpload, controller.parseCv);
router.post('/applications', validate(guestApplySchema), controller.apply);

// Screening / best-job matching runs inside this request (Vercel doesn't
// guarantee work after the response). Idempotent; the page calls it once,
// then polls GET /track until done.
router.post('/track/process', validate(trackTokenSchema), controller.processTracked);
router.get('/track', controller.getTrackStatus);

// Interview slot booking from the status link — no login (the token is the
// credential and only ever reaches its own application).
router.get('/track/booking', controller.getTrackBooking);
router.post('/track/booking', validate(trackBookingSchema), controller.bookFromTrack);
router.post('/track/booking/cancel', validate(trackTokenSchema), controller.cancelFromTrack);

export default router;
