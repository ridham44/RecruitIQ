import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/apiResponse.js';
import { ROLES } from '../../../shared/constants/roles.js';
import * as configService from './interviewConfig.service.js';
import * as engine from './interviewEngine.service.js';
import * as phoneService from './phoneInterview.service.js';

export const getConfig = asyncHandler(async (req, res) => {
  const config = await configService.getConfig(req.user.id, req.params.jobId);
  ok(res, { config });
});

export const upsertConfig = asyncHandler(async (req, res) => {
  const config = await configService.upsertConfig(req.user.id, req.params.jobId, req.body);
  ok(res, { config });
});

export const listForJob = asyncHandler(async (req, res) => {
  const interviews = await engine.listInterviewsForJob(req.user.id, req.params.jobId);
  ok(res, { interviews });
});

export const getDetail = asyncHandler(async (req, res) => {
  const detail =
    req.user.role === ROLES.COMPANY
      ? await engine.getInterviewDetailForCompany(req.user.id, req.params.interviewId)
      : await engine.getInterviewDetailForCandidate(req.user.id, req.params.interviewId);
  ok(res, { interview: detail });
});

export const start = asyncHandler(async (req, res) => {
  const result = await engine.startInterview(req.user.id, req.params.interviewId);
  ok(res, result);
});

export const getState = asyncHandler(async (req, res) => {
  const state = await engine.getCurrentState(req.user.id, req.params.interviewId, { asCompany: req.user.role === ROLES.COMPANY });
  ok(res, { state });
});

export const submitAnswer = asyncHandler(async (req, res) => {
  const result = await engine.submitAnswerAsCandidate(req.user.id, req.params.interviewId, req.body);
  ok(res, result);
});

export const logEvent = asyncHandler(async (req, res) => {
  await engine.recordEventAsCandidate(req.user.id, req.params.interviewId, req.body);
  ok(res, {});
});

export const end = asyncHandler(async (req, res) => {
  const result = await engine.endInterviewByCandidate(req.user.id, req.params.interviewId);
  ok(res, result);
});

// ─── Worker-secret-authenticated (no candidate/company JWT) ───

export const workerSubmitAnswer = asyncHandler(async (req, res) => {
  const result = await engine.advanceInterview(req.params.interviewId, req.body);
  ok(res, result);
});

export const workerGetContext = asyncHandler(async (req, res) => {
  // Worker isn't a candidate/company user, so it can't go through the
  // owner-checked getCurrentState — it's trusted via the worker secret
  // instead (see workerAuth.js) and may read any interview by id.
  const state = await engine.getCurrentStateForWorker(req.params.interviewId);
  ok(res, { state });
});

export const workerLogEvent = asyncHandler(async (req, res) => {
  await engine.recordEvent(req.params.interviewId, req.body);
  ok(res, {});
});

// ─── Telephonic interviews (phone-agent/, worker secret) ───

export const workerListDuePhoneInterviews = asyncHandler(async (req, res) => {
  const interviews = await phoneService.listDuePhoneInterviews({ limit: Number(req.query.limit) || 5 });
  ok(res, { interviews });
});

export const workerListDialingPhoneInterviews = asyncHandler(async (req, res) => {
  const interviews = await phoneService.listDialingPhoneInterviews();
  ok(res, { interviews });
});

export const workerClaimPhoneInterview = asyncHandler(async (req, res) => {
  const interview = await phoneService.claimPhoneInterview(req.params.interviewId);
  ok(res, { interview });
});

export const workerStartPhoneInterview = asyncHandler(async (req, res) => {
  const state = await phoneService.startPhoneInterview(req.params.interviewId, { roomName: req.body?.roomName });
  ok(res, { state });
});

export const workerUpdateCallStatus = asyncHandler(async (req, res) => {
  const result = await phoneService.updateCallStatus(req.params.interviewId, req.body);
  ok(res, result);
});

// Company: dial a telephonic interview now instead of waiting for slot time.
export const callNow = asyncHandler(async (req, res) => {
  const result = await phoneService.requestCallNow(req.user.id, req.params.interviewId);
  ok(res, result);
});
