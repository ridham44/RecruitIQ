import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/apiResponse.js';
import * as screeningService from './screening.service.js';

export const runForJob = asyncHandler(async (req, res) => {
  const force = req.body?.force === true;
  const result = await screeningService.runScreeningForJob(req.user.id, req.params.jobId, { force });
  ok(res, result);
});

export const runForApplication = asyncHandler(async (req, res) => {
  const result = await screeningService.runScreeningForApplication(req.user.id, req.params.applicationId);
  ok(res, { screeningResult: result });
});

export const getRanked = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const result = await screeningService.getRankedCandidates(req.user.id, req.params.jobId, { limit });
  ok(res, result);
});

export const getTop10 = asyncHandler(async (req, res) => {
  const result = await screeningService.getRankedCandidates(req.user.id, req.params.jobId, { limit: 10 });
  ok(res, result);
});
