import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, ok } from '../../utils/apiResponse.js';
import * as service from './clients.service.js';

export const list = asyncHandler(async (req, res) => {
  const clients = await service.listClients(req.user.id, { q: req.query.q, status: req.query.status });
  ok(res, { clients });
});

export const get = asyncHandler(async (req, res) => {
  ok(res, { client: await service.getClient(req.user.id, req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  created(res, { client: await service.createClient(req.user.id, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  ok(res, { client: await service.updateClient(req.user.id, req.params.id, req.body) });
});

export const setStatus = asyncHandler(async (req, res) => {
  ok(res, { client: await service.setClientStatus(req.user.id, req.params.id, req.body.isActive) });
});

export const setRecruiters = asyncHandler(async (req, res) => {
  ok(res, { client: await service.setClientRecruiters(req.user.id, req.params.id, req.body.memberIds) });
});

export const createDepartment = asyncHandler(async (req, res) => {
  created(res, { client: await service.createDepartment(req.user.id, req.params.id, req.body) });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  ok(res, { client: await service.updateDepartment(req.user.id, req.params.departmentId, req.body) });
});

export const setDepartmentStatus = asyncHandler(async (req, res) => {
  ok(res, { client: await service.setDepartmentStatus(req.user.id, req.params.departmentId, req.body.isActive) });
});

export const createHiringPerson = asyncHandler(async (req, res) => {
  created(res, { client: await service.createHiringPerson(req.user.id, req.params.departmentId, req.body) });
});

export const updateHiringPerson = asyncHandler(async (req, res) => {
  ok(res, { client: await service.updateHiringPerson(req.user.id, req.params.personId, req.body) });
});

export const setHiringPersonStatus = asyncHandler(async (req, res) => {
  ok(res, { client: await service.setHiringPersonStatus(req.user.id, req.params.personId, req.body.isActive) });
});
