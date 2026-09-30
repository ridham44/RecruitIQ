import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as adminService from './admin.service.js';

export const listCompanies = asyncHandler(async (req, res) => {
  const companies = await adminService.listCompanies({ q: req.query.q, status: req.query.status });
  ok(res, { companies });
});

export const getCompany = asyncHandler(async (req, res) => {
  const company = await adminService.getCompany(req.params.id);
  ok(res, { company });
});

export const createCompany = asyncHandler(async (req, res) => {
  const result = await adminService.createCompany(req.user.id, req.body);
  created(res, result);
});

export const updateCompany = asyncHandler(async (req, res) => {
  const company = await adminService.updateCompany(req.params.id, req.body);
  ok(res, { company });
});

export const setCompanyStatus = asyncHandler(async (req, res) => {
  const company = await adminService.setCompanyStatus(req.params.id, req.body.status);
  ok(res, { company });
});

export const resendInvite = asyncHandler(async (req, res) => {
  const result = await adminService.resendInvite(req.params.id);
  ok(res, result);
});

export const listUsers = asyncHandler(async (req, res) => {
  const users = await adminService.listUsers({ q: req.query.q, role: req.query.role, status: req.query.status });
  ok(res, { users });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const user = await adminService.setUserStatus(req.user.id, req.params.id, req.body.isActive);
  ok(res, { user });
});
