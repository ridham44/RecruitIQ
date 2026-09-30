import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { getCompanyContext, clientScopeWhere } from '../companies/companyContext.js';
import { portalStatusFor } from '../clientPortal/clientPortal.service.js';

// Build plan P3 — a recruitment company's clients (§4), their departments
// (§4.1) and HR / hiring persons (§4.2). Everything is scoped to the caller's
// own recruitment company and is deactivated rather than deleted, so old
// jobs (and P7 submissions) keep their links.

const blankToNull = (v) => (v === undefined ? undefined : v?.trim?.() ? v.trim() : null);

function clientData(data) {
  return {
    name: data.name?.trim() || undefined,
    description: blankToNull(data.description),
    website: blankToNull(data.website),
    industry: blankToNull(data.industry),
    contactName: blankToNull(data.contactName),
    contactEmail: blankToNull(data.contactEmail)?.toLowerCase?.() ?? blankToNull(data.contactEmail),
    contactPhone: blankToNull(data.contactPhone),
    address: blankToNull(data.address),
  };
}

const CLIENT_DETAIL_INCLUDE = {
  departments: {
    orderBy: { name: 'asc' },
    include: {
      hiringPersons: { orderBy: { fullName: 'asc' } },
      _count: { select: { jobs: true } },
    },
  },
  recruiters: {
    include: { member: { include: { user: { select: { email: true, isActive: true } } } } },
  },
  _count: { select: { jobs: true } },
};

function serializeClient(client) {
  const { recruiters, _count, ...rest } = client;
  return {
    ...rest,
    jobCount: _count?.jobs ?? 0,
    ...(recruiters
      ? {
          recruiters: recruiters.map(({ member }) => ({
            id: member.id,
            fullName: member.fullName,
            email: member.user.email,
            isActive: member.isActive && member.user.isActive,
          })),
        }
      : {}),
    ...(rest.departments
      ? {
          departments: rest.departments.map(({ _count: dc, ...d }) => ({ ...d, jobCount: dc?.jobs ?? 0 })),
        }
      : {}),
  };
}

async function loadClient(ctx, clientId, { write = false } = {}) {
  const client = await prisma.clientCompany.findFirst({
    where: { id: clientId, ...(write ? { companyId: ctx.companyId } : clientScopeWhere(ctx)) },
  });
  if (!client) throw ApiError.notFound('Client not found');
  return client;
}

async function loadDepartment(ctx, departmentId) {
  const department = await prisma.department.findUnique({ where: { id: departmentId }, include: { clientCompany: true } });
  if (!department || department.clientCompany.companyId !== ctx.companyId) throw ApiError.notFound('Department not found');
  return department;
}

async function loadHiringPerson(ctx, hiringPersonId) {
  const person = await prisma.hiringPerson.findUnique({
    where: { id: hiringPersonId },
    include: { department: { include: { clientCompany: true } } },
  });
  if (!person || person.department.clientCompany.companyId !== ctx.companyId) throw ApiError.notFound('HR person not found');
  return person;
}

// ─── Clients ───

export async function listClients(userId, { q, status } = {}) {
  const ctx = await getCompanyContext(userId);
  const search = q?.trim();
  const clients = await prisma.clientCompany.findMany({
    where: {
      ...clientScopeWhere(ctx),
      ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { industry: { contains: search, mode: 'insensitive' } },
              { contactName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { jobs: true, departments: true } } },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  return clients.map(({ _count, ...c }) => ({ ...c, jobCount: _count.jobs, departmentCount: _count.departments }));
}

export async function getClient(userId, clientId) {
  const ctx = await getCompanyContext(userId);
  await loadClient(ctx, clientId);
  const client = await prisma.clientCompany.findUnique({ where: { id: clientId }, include: CLIENT_DETAIL_INCLUDE });
  // return serializeClient(client);
  // Build plan P8: portal login status per HR person (NONE / INVITED / ACTIVE).
  const serialized = serializeClient(client);
  const status = await portalStatusFor(serialized.departments.flatMap((d) => d.hiringPersons));
  serialized.departments = serialized.departments.map((d) => ({
    ...d,
    hiringPersons: d.hiringPersons.map(({ userId: _u, ...p }) => ({ ...p, portalStatus: status[p.id] })),
  }));
  return serialized;
}

export async function createClient(userId, data) {
  const ctx = await getCompanyContext(userId);
  const client = await prisma.clientCompany.create({
    data: { ...clientData(data), name: data.name.trim(), companyId: ctx.companyId },
  });
  return getClient(userId, client.id);
}

export async function updateClient(userId, clientId, data) {
  const ctx = await getCompanyContext(userId);
  await loadClient(ctx, clientId, { write: true });
  await prisma.clientCompany.update({ where: { id: clientId }, data: clientData(data) });
  return getClient(userId, clientId);
}

export async function setClientStatus(userId, clientId, isActive) {
  const ctx = await getCompanyContext(userId);
  await loadClient(ctx, clientId, { write: true });
  await prisma.clientCompany.update({ where: { id: clientId }, data: { isActive } });
  return getClient(userId, clientId);
}

export async function setClientRecruiters(userId, clientId, memberIds) {
  const ctx = await getCompanyContext(userId);
  await loadClient(ctx, clientId, { write: true });
  const unique = [...new Set(memberIds)];
  if (unique.length) {
    const count = await prisma.companyMember.count({
      where: { id: { in: unique }, companyId: ctx.companyId, role: 'RECRUITER' },
    });
    if (count !== unique.length) throw ApiError.badRequest('One or more recruiters were not found', 'INVALID_RECRUITER');
  }
  await prisma.$transaction([
    prisma.clientRecruiter.deleteMany({ where: { clientCompanyId: clientId, memberId: { notIn: unique } } }),
    prisma.clientRecruiter.createMany({
      data: unique.map((memberId) => ({ clientCompanyId: clientId, memberId })),
      skipDuplicates: true,
    }),
  ]);
  return getClient(userId, clientId);
}

// ─── Departments ───

export async function createDepartment(userId, clientId, { name }) {
  const ctx = await getCompanyContext(userId);
  await loadClient(ctx, clientId, { write: true });
  try {
    await prisma.department.create({ data: { clientCompanyId: clientId, name: name.trim() } });
  } catch (err) {
    if (err.code === 'P2002') throw ApiError.conflict('This client already has a department with that name', 'DEPARTMENT_EXISTS');
    throw err;
  }
  return getClient(userId, clientId);
}

export async function updateDepartment(userId, departmentId, { name }) {
  const ctx = await getCompanyContext(userId);
  const department = await loadDepartment(ctx, departmentId);
  try {
    await prisma.department.update({ where: { id: departmentId }, data: { name: name.trim() } });
  } catch (err) {
    if (err.code === 'P2002') throw ApiError.conflict('This client already has a department with that name', 'DEPARTMENT_EXISTS');
    throw err;
  }
  return getClient(userId, department.clientCompanyId);
}

export async function setDepartmentStatus(userId, departmentId, isActive) {
  const ctx = await getCompanyContext(userId);
  const department = await loadDepartment(ctx, departmentId);
  await prisma.department.update({ where: { id: departmentId }, data: { isActive } });
  return getClient(userId, department.clientCompanyId);
}

// ─── HR / hiring persons ───

export async function createHiringPerson(userId, departmentId, data) {
  const ctx = await getCompanyContext(userId);
  const department = await loadDepartment(ctx, departmentId);
  await prisma.hiringPerson.create({
    data: {
      departmentId,
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: blankToNull(data.phone) ?? null,
      designation: blankToNull(data.designation) ?? null,
    },
  });
  return getClient(userId, department.clientCompanyId);
}

export async function updateHiringPerson(userId, hiringPersonId, data) {
  const ctx = await getCompanyContext(userId);
  const person = await loadHiringPerson(ctx, hiringPersonId);
  await prisma.hiringPerson.update({
    where: { id: hiringPersonId },
    data: {
      fullName: data.fullName?.trim() || undefined,
      email: data.email?.trim() ? data.email.trim().toLowerCase() : undefined,
      phone: blankToNull(data.phone),
      designation: blankToNull(data.designation),
    },
  });
  return getClient(userId, person.department.clientCompanyId);
}

export async function setHiringPersonStatus(userId, hiringPersonId, isActive) {
  const ctx = await getCompanyContext(userId);
  const person = await loadHiringPerson(ctx, hiringPersonId);
  await prisma.hiringPerson.update({ where: { id: hiringPersonId }, data: { isActive } });
  return getClient(userId, person.department.clientCompanyId);
}

// ─── Job link validation (§5) ───

// Checks that HR person ∈ department ∈ client ∈ the caller's company.
// `existing` is the job being updated: an unchanged link may point at a
// since-deactivated record, but a newly chosen one must be active.
// Returns the normalized { clientCompanyId, departmentId, hiringPersonId }
// to save, or {} when the request doesn't touch the link at all.
export async function resolveJobClientLink(companyId, input, existing = null) {
  const touched = ['clientCompanyId', 'departmentId', 'hiringPersonId'].some((k) => input[k] !== undefined);
  if (!touched) return {};

  const invalid = (msg) => ApiError.badRequest(msg, 'INVALID_CLIENT_CHAIN');
  const pick = (k) => (input[k] !== undefined ? input[k] : existing?.[k] ?? null);
  const link = { clientCompanyId: pick('clientCompanyId'), departmentId: pick('departmentId'), hiringPersonId: pick('hiringPersonId') };
  const changed = (k) => link[k] !== (existing?.[k] ?? null);

  // A child sent explicitly without its parent is a mistake, not a clear.
  if (input.departmentId && !link.clientCompanyId) throw invalid('Choose a client before choosing a department');
  if (input.hiringPersonId && !link.departmentId) throw invalid('Choose a department before choosing an HR person');

  // Changing or clearing a parent drops the children the request didn't resend.
  if (changed('clientCompanyId') && input.departmentId === undefined) link.departmentId = null;
  if (!link.clientCompanyId) link.departmentId = null;
  if (changed('departmentId') && input.hiringPersonId === undefined) link.hiringPersonId = null;
  if (!link.departmentId) link.hiringPersonId = null;

  if (link.clientCompanyId) {
    const client = await prisma.clientCompany.findUnique({ where: { id: link.clientCompanyId } });
    if (!client || client.companyId !== companyId) throw invalid('Client not found');
    if (changed('clientCompanyId') && !client.isActive) throw invalid('That client is inactive');
  }
  if (link.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: link.departmentId } });
    if (!department || department.clientCompanyId !== link.clientCompanyId) throw invalid('Department does not belong to the selected client');
    if (changed('departmentId') && !department.isActive) throw invalid('That department is inactive');
  }
  if (link.hiringPersonId) {
    const person = await prisma.hiringPerson.findUnique({ where: { id: link.hiringPersonId } });
    if (!person || person.departmentId !== link.departmentId) throw invalid('HR person does not belong to the selected department');
    if (changed('hiringPersonId') && !person.isActive) throw invalid('That HR person is inactive');
  }
  return link;
}
