import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as service from './recruiters.service.js';

export const list = asyncHandler(async (req, res) => {
  const members = await service.listMembers(req.user.id);
  ok(res, { members });
});

export const invite = asyncHandler(async (req, res) => {
  const result = await service.inviteRecruiter(req.user.id, req.body);
  created(res, result);
});

export const update = asyncHandler(async (req, res) => {
  const recruiter = await service.updateRecruiter(req.user.id, req.params.id, req.body);
  ok(res, { recruiter });
});

export const setStatus = asyncHandler(async (req, res) => {
  const recruiter = await service.setRecruiterStatus(req.user.id, req.params.id, req.body.isActive);
  ok(res, { recruiter });
});

export const setPermissions = asyncHandler(async (req, res) => {
  const recruiter = await service.setRecruiterPermissions(req.user.id, req.params.id, req.body.permissions);
  ok(res, { recruiter });
});

export const setJobs = asyncHandler(async (req, res) => {
  const recruiter = await service.setRecruiterJobs(req.user.id, req.params.id, req.body.jobIds);
  ok(res, { recruiter });
});

export const resendInvite = asyncHandler(async (req, res) => {
  const result = await service.resendRecruiterInvite(req.user.id, req.params.id);
  ok(res, result);
});

export const listForJob = asyncHandler(async (req, res) => {
  const recruiters = await service.listJobRecruiters(req.user.id, req.params.jobId);
  ok(res, { recruiters });
});

export const setForJob = asyncHandler(async (req, res) => {
  const recruiters = await service.setJobRecruiters(req.user.id, req.params.jobId, req.body.memberIds);
  ok(res, { recruiters });
});
