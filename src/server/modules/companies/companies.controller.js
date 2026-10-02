import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/apiResponse.js';
import * as companiesService from './companies.service.js';
import { getCompanyContext } from './companyContext.js';
import { ensureCompanySlug, setCompanySlug, careersUrl } from '../public/careers.service.js';
import { env } from '../../config/env.js';

export const getProfile = asyncHandler(async (req, res) => {
  const company = await companiesService.getCompanyByUserId(req.user.id);
  ok(res, { company });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const company = await companiesService.updateCompanyProfile(req.user.id, req.body);
  ok(res, { company });
});

// Build plan P4: the company's public careers portal link.
export const getCareersLink = asyncHandler(async (req, res) => {
  const ctx = await getCompanyContext(req.user.id);
  const slug = await ensureCompanySlug(ctx.companyId);
  ok(res, { slug, url: careersUrl(slug), enabled: env.features.guestApply });
});

export const setCareersLink = asyncHandler(async (req, res) => {
  const ctx = await getCompanyContext(req.user.id);
  const slug = await setCompanySlug(ctx.companyId, req.body.slug);
  ok(res, { slug, url: careersUrl(slug), enabled: env.features.guestApply });
});

export const getDashboardOverview = asyncHandler(async (req, res) => {
  const overview = await companiesService.getDashboardOverview(req.user.id);
  ok(res, { overview });
});

