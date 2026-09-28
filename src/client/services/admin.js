import { api } from './api.js';

function query(params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return qs ? `?${qs}` : '';
}

// Build plan P1 — Platform Admin API.
export const adminApi = {
  listCompanies: (params) => api.get(`/admin/companies${query(params)}`),
  getCompany: (id) => api.get(`/admin/companies/${id}`),
  createCompany: (payload) => api.post('/admin/companies', payload),
  updateCompany: (id, payload) => api.patch(`/admin/companies/${id}`, payload),
  setCompanyStatus: (id, status) => api.patch(`/admin/companies/${id}/status`, { status }),
  resendInvite: (id) => api.post(`/admin/companies/${id}/resend-invite`),
  listUsers: (params) => api.get(`/admin/users${query(params)}`),
  setUserStatus: (id, isActive) => api.patch(`/admin/users/${id}/status`, { isActive }),
};
