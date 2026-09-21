import { api } from './api.js';

export const jobsApi = {
  listOpen: (search) => api.get(`/jobs${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  listMine: () => api.get('/jobs/company/mine'),
  get: (id) => api.get(`/jobs/${id}`),
  create: (payload) => api.post('/jobs', payload),
  update: (id, payload) => api.patch(`/jobs/${id}`, payload),
  close: (id) => api.delete(`/jobs/${id}`),
};
