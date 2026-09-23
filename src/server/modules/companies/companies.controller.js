import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/apiResponse.js';
import * as companiesService from './companies.service.js';

export const getProfile = asyncHandler(async (req, res) => {
  const company = await companiesService.getCompanyByUserId(req.user.id);
  ok(res, { company });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const company = await companiesService.updateCompanyProfile(req.user.id, req.body);
  ok(res, { company });
});

export const getDashboardOverview = asyncHandler(async (req, res) => {
  const overview = await companiesService.getDashboardOverview(req.user.id);
  ok(res, { overview });
});

