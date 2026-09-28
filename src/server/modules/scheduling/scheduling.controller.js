import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as schedulingService from './scheduling.service.js';
import { ROLES } from '../../../shared/constants/roles.js';

export const createSlots = asyncHandler(async (req, res) => {
  const slots = await schedulingService.createSlots(req.user.id, req.params.jobId, req.body.slots);
  created(res, { slots });
});

export const generateSlots = asyncHandler(async (req, res) => {
  const result = await schedulingService.generateSlots(req.user.id, req.params.jobId, req.body);
  created(res, result);
});

export const listSlotsForJob = asyncHandler(async (req, res) => {
  const slots = await schedulingService.listSlotsForJob(req.user.id, req.params.jobId);
  ok(res, { slots });
});

export const cancelSlot = asyncHandler(async (req, res) => {
  await schedulingService.cancelSlot(req.user.id, req.params.jobId, req.params.slotId);
  ok(res, {});
});

export const listAvailableSlots = asyncHandler(async (req, res) => {
  const slots = await schedulingService.listAvailableSlotsForApplication(req.user.id, req.params.applicationId);
  ok(res, { slots });
});

export const bookSlot = asyncHandler(async (req, res) => {
  const interview = await schedulingService.bookSlot(req.user.id, req.params.applicationId, req.body.slotId);
  created(res, { interview });
});

export const cancelMyInterview = asyncHandler(async (req, res) => {
  await schedulingService.cancelMyInterview(req.user.id, req.params.applicationId);
  ok(res, {});
});

export const getInterview = asyncHandler(async (req, res) => {
  const asCompany = req.user.role === ROLES.COMPANY;
  const interview = await schedulingService.getInterviewForApplication(req.user.id, req.params.applicationId, { asCompany });
  ok(res, { interview });
});

export const markInterviewCompleted = asyncHandler(async (req, res) => {
  await schedulingService.markInterviewCompleted(req.user.id, req.params.jobId, req.params.interviewId);
  ok(res, {});
});
