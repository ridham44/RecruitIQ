import { Router } from 'express';
import multer from 'multer';
import * as resumesController from './resumes.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { uploadResume } from '../../middleware/upload.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { ApiError } from '../../utils/ApiError.js';

const router = Router();

router.use(authenticate, authorize(ROLES.CANDIDATE));

// Wraps multer so its errors (invalid type, file too large) flow through the
// centralized error handler as consistent ApiError responses (Section 23)
// instead of multer's raw error shape.
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

router.post('/', handleUpload, resumesController.uploadResume);
router.get('/', resumesController.listMyResumes);

export default router;
