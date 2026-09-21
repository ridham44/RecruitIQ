import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as jobsService from './jobs.service.js';

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
  const jobs = await jobsService.listCompanyJobs(req.user.id);
  ok(res, { jobs });
});

export const getJob = asyncHandler(async (req, res) => {
  const job = await jobsService.getJobById(req.params.id);
  ok(res, { job });
});
