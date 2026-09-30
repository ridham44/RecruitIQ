import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as careers from './careers.service.js';
import * as otp from './otp.service.js';
import * as guest from './guestApply.service.js';

export const getPortal = asyncHandler(async (req, res) => {
  ok(res, await careers.getPortal(req.params.slug));
});

export const getPortalJob = asyncHandler(async (req, res) => {
  ok(res, await careers.getPortalJob(req.params.slug, req.params.jobId));
});

export const sendOtp = asyncHandler(async (req, res) => {
  ok(res, await otp.sendOtp({ phone: req.body.phone, ip: req.ip }));
});

export const verifyOtp = asyncHandler(async (req, res) => {
  ok(res, await otp.verifyOtp(req.body));
});

export const parseCv = asyncHandler(async (req, res) => {
  created(res, await guest.parseGuestCv(req.file));
});

export const apply = asyncHandler(async (req, res) => {
  created(res, await guest.submitGuestApplication(req.body));
});

export const processTracked = asyncHandler(async (req, res) => {
  ok(res, await guest.processTracked(req.body.token));
});

export const getTrackStatus = asyncHandler(async (req, res) => {
  ok(res, await guest.getTrackStatus(String(req.query.token || '')));
});
