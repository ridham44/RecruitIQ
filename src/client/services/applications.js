import { api } from './api.js';

export const applicationsApi = {
  apply: (payload) => api.post('/applications', payload),
  listMine: () => api.get('/applications/mine'),
  getMine: (id) => api.get(`/applications/mine/${id}`),
  listForJob: (jobId) => api.get(`/applications/job/${jobId}`),
  getCandidateDetail: (jobId, candidateId) => api.get(`/applications/job/${jobId}/candidates/${candidateId}`),
};
