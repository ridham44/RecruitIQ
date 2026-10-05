import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as jobsService from './jobs.service.js';
import { isCompanySide } from '../../../shared/constants/roles.js';

export const createJob = asyncHandler(async (req, res) => {
  const job = await jobsService.createJob(req.user.id, req.body);
  created(res, { job });
});

export const updateJob = asyncHandler(async (req, res) => {
  const job = await jobsService.updateJob(req.user.id, req.params.id, req.body);
  ok(res, { job });
});

export const closeJob = asyncHandler(async (req, res) => {
  const job = await jobsService.closeJob(req.user.id, req.params.id);
  ok(res, { job });
});

export const listOpenJobs = asyncHandler(async (req, res) => {
  const jobs = await jobsService.listOpenJobs({ search: req.query.search });
  ok(res, { jobs });
});

export const listCompanyJobs = asyncHandler(async (req, res) => {
  // const jobs = await jobsService.listCompanyJobs(req.user.id);
  // Build plan P3: optional ?clientId= filter ("none" = jobs without a client).
  const jobs = await jobsService.listCompanyJobs(req.user.id, { clientId: req.query.clientId });
  ok(res, { jobs });
});

// Build plan P3: company-side view of a job's Client → Department → HR link
// (kept off the public GET /jobs/:id so candidates never see client names).
export const getJobClientLink = asyncHandler(async (req, res) => {
  const link = await jobsService.getJobClientLink(req.user.id, req.params.id);
  ok(res, { link });
});

export const getJob = asyncHandler(async (req, res) => {
  if (req.user && isCompanySide(req.user.role)) {
    const job = await jobsService.getOwnedJob(req.user.id, req.params.id).catch(() => null);
    if (job) return ok(res, { job });
  }
  const job = await jobsService.getPublicJobById(req.params.id);
  ok(res, { job });
});
