import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as applicationsService from './applications.service.js';

export const apply = asyncHandler(async (req, res) => {
  const application = await applicationsService.applyToJob(req.user.id, req.body);
  created(res, { application });
});

export const listMine = asyncHandler(async (req, res) => {
  const applications = await applicationsService.listMyApplications(req.user.id);
  ok(res, { applications });
});

export const getMine = asyncHandler(async (req, res) => {
  const application = await applicationsService.getMyApplicationById(req.user.id, req.params.id);
  ok(res, { application });
});

export const listForJob = asyncHandler(async (req, res) => {
  const applications = await applicationsService.listApplicationsForJob(req.user.id, req.params.jobId);
  ok(res, { applications });
});

export const getCandidateDetail = asyncHandler(async (req, res) => {
  const application = await applicationsService.getCandidateApplicationDetail(
    req.user.id,
    req.params.jobId,
    req.params.candidateId
  );
  ok(res, { application });
});

export const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const result = await applicationsService.bulkUpdateApplicationStatus(req.user.id, req.params.jobId, req.body);
  ok(res, result);
});

export const reject = asyncHandler(async (req, res) => {
  const application = await applicationsService.rejectApplication(req.user.id, req.params.applicationId);
  ok(res, { application });
});
