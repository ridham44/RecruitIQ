import { Router } from 'express';
import * as controller from './clients.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/permission.js';
import { COMPANY_SIDE_ROLES } from '../../../shared/constants/roles.js';
import { PERMISSIONS } from '../../../shared/constants/permissions.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/apiResponse.js';
import { inviteHiringPersonAsCompany } from '../clientPortal/clientPortal.service.js';
import {
  createClientSchema,
  updateClientSchema,
  activeStatusSchema,
  departmentSchema,
  createHiringPersonSchema,
  updateHiringPersonSchema,
  clientRecruitersSchema,
} from '../../../shared/schemas/client.schema.js';
import { clientsQuerySchema } from '../../../shared/schemas/query.schema.js';

// Build plan P3 — client companies → departments → HR / hiring persons.
// Reading is open to the company side (a recruiter without MANAGE_CLIENTS
// only sees clients assigned to them — see clientScopeWhere); every change
// needs MANAGE_CLIENTS (the owner always has it).
const router = Router();
const manageClients = requirePermission(PERMISSIONS.MANAGE_CLIENTS);

router.use(authenticate, authorize(...COMPANY_SIDE_ROLES));

router.get('/', validate(clientsQuerySchema, 'query'), controller.list);
router.post('/', manageClients, validate(createClientSchema), controller.create);

router.patch('/departments/:departmentId', manageClients, validate(departmentSchema), controller.updateDepartment);
router.patch('/departments/:departmentId/status', manageClients, validate(activeStatusSchema), controller.setDepartmentStatus);
// router.post('/departments/:departmentId/hiring-persons', manageClients, validate(createHiringPersonSchema), controller.createHiringPerson);
router.post('/departments/:departmentId/hiring-persons', manageClients, validate(createHiringPersonSchema), controller.createHiringPersonInDepartment);
router.patch('/hiring-persons/:personId', manageClients, validate(updateHiringPersonSchema), controller.updateHiringPerson);
router.patch('/hiring-persons/:personId/status', manageClients, validate(activeStatusSchema), controller.setHiringPersonStatus);
// Build plan P8: invite / re-invite an HR person to the client portal.
router.post(
  '/hiring-persons/:personId/invite',
  manageClients,
  asyncHandler(async (req, res) => ok(res, await inviteHiringPersonAsCompany(req.user.id, req.params.personId)))
);

router.get('/:id', controller.get);
router.patch('/:id', manageClients, validate(updateClientSchema), controller.update);
router.patch('/:id/status', manageClients, validate(activeStatusSchema), controller.setStatus);
router.put('/:id/recruiters', requirePermission(PERMISSIONS.MANAGE_RECRUITERS), manageClients, validate(clientRecruitersSchema), controller.setRecruiters);
router.post('/:id/departments', manageClients, validate(departmentSchema), controller.createDepartment);
// HR / hiring persons belong to the company; department optional in the body.
router.post('/:id/hiring-persons', manageClients, validate(createHiringPersonSchema), controller.createHiringPerson);

export default router;
