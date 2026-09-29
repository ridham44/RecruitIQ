import { api } from './api.js';

// Build plan P2 — recruiters inside the logged-in recruitment company.
export const recruitersApi = {
  list: () => api.get('/recruiters'),
  invite: (payload) => api.post('/recruiters', payload),
  update: (id, payload) => api.patch(`/recruiters/${id}`, payload),
  setStatus: (id, isActive) => api.patch(`/recruiters/${id}/status`, { isActive }),
  setPermissions: (id, permissions) => api.put(`/recruiters/${id}/permissions`, { permissions }),
  setJobs: (id, jobIds) => api.put(`/recruiters/${id}/jobs`, { jobIds }),
  resendInvite: (id) => api.post(`/recruiters/${id}/resend-invite`),
  listForJob: (jobId) => api.get(`/recruiters/job/${jobId}`),
  setForJob: (jobId, memberIds) => api.put(`/recruiters/job/${jobId}`, { memberIds }),
};
