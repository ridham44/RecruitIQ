import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import * as resumesService from './resumes.service.js';

export const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No resume file provided', 'FILE_REQUIRED');
  const resume = await resumesService.uploadResume(req.user.id, req.file);
  created(res, { resume });
});

export const listMyResumes = asyncHandler(async (req, res) => {
  const resumes = await resumesService.listMyResumes(req.user.id);
  ok(res, { resumes });
});
