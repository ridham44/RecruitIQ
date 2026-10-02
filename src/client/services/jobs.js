import { api } from './api.js';

export const jobsApi = {
  listOpen: (search) => api.get(`/jobs${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  // listMine: () => api.get('/jobs/company/mine'),
  // Build plan P3: optional client filter (id, or "none").
  listMine: (clientId) => api.get(`/jobs/company/mine${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
  getClientLink: (id) => api.get(`/jobs/${id}/client-link`),
  get: (id) => api.get(`/jobs/${id}`),
  create: (payload) => api.post('/jobs', payload),
  update: (id, payload) => api.patch(`/jobs/${id}`, payload),
  close: (id) => api.delete(`/jobs/${id}`),
};
