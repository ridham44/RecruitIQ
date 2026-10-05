import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/apiResponse.js';
import * as recq from './recq.service.js';

// Build plan P9 — thin controllers over recq.service.js. All public (no
// login); the agency/job slugs come from the path, the resume file from
// multer, the rest from the validated body.

export const getAgency = asyncHandler(async (req, res) => {
  ok(res, await recq.getAgency(req.params.agencySlug));
});

export const getAgencyJob = asyncHandler(async (req, res) => {
  ok(res, await recq.getAgencyJob(req.params.agencySlug, req.params.jobSlug));
});

export const discover = asyncHandler(async (req, res) => {
  ok(res, await recq.discoverJobs(req.params.agencySlug, req.file));
});

export const matchJob = asyncHandler(async (req, res) => {
  ok(res, await recq.matchForJob(req.params.agencySlug, req.params.jobSlug, req.file));
});

export const sendOtp = asyncHandler(async (req, res) => {
  ok(res, await recq.sendOtp(req.params.agencySlug, req.body, req.ip));
});

export const verifyOtp = asyncHandler(async (req, res) => {
  ok(res, await recq.verifyOtp(req.params.agencySlug, req.body));
});

export const apply = asyncHandler(async (req, res) => {
  ok(res, await recq.apply(req.params.agencySlug, req.body));
});
