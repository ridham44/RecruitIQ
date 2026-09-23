import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/apiResponse.js';
import { getCandidateByUserId } from '../candidates/candidates.service.js';
import * as educationService from './education.service.js';

export const listEducations = asyncHandler(async (req, res) => {
  const candidate = await getCandidateByUserId(req.user.id);
  const educations = await educationService.listEducations(candidate.id);
  ok(res, { educations });
});

export const addEducation = asyncHandler(async (req, res) => {
  const candidate = await getCandidateByUserId(req.user.id);
  const education = await educationService.addEducation(candidate.id, req.body);
  ok(res, { education });
});

export const updateEducation = asyncHandler(async (req, res) => {
  const candidate = await getCandidateByUserId(req.user.id);
  const education = await educationService.updateEducation(req.params.id, candidate.id, req.body);
  ok(res, { education });
});

export const deleteEducation = asyncHandler(async (req, res) => {
  const candidate = await getCandidateByUserId(req.user.id);
  await educationService.deleteEducation(req.params.id, candidate.id);
  ok(res, { message: 'Education record deleted' });
});
