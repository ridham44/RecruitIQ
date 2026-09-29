import { api } from './api.js';

function query(params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return qs ? `?${qs}` : '';
}

// Build plan P3 — client companies, departments and HR / hiring persons.
export const clientsApi = {
  list: (params) => api.get(`/clients${query(params)}`),
  get: (id) => api.get(`/clients/${id}`),
  create: (payload) => api.post('/clients', payload),
  update: (id, payload) => api.patch(`/clients/${id}`, payload),
  setStatus: (id, isActive) => api.patch(`/clients/${id}/status`, { isActive }),
  setRecruiters: (id, memberIds) => api.put(`/clients/${id}/recruiters`, { memberIds }),
  addDepartment: (clientId, name) => api.post(`/clients/${clientId}/departments`, { name }),
  renameDepartment: (departmentId, name) => api.patch(`/clients/departments/${departmentId}`, { name }),
  setDepartmentStatus: (departmentId, isActive) => api.patch(`/clients/departments/${departmentId}/status`, { isActive }),
  addHiringPerson: (departmentId, payload) => api.post(`/clients/departments/${departmentId}/hiring-persons`, payload),
  updateHiringPerson: (personId, payload) => api.patch(`/clients/hiring-persons/${personId}`, payload),
  setHiringPersonStatus: (personId, isActive) => api.patch(`/clients/hiring-persons/${personId}/status`, { isActive }),
};
