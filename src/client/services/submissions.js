import { api } from './api.js';

// Build plan P7 — final score + client submissions.
export const submissionsApi = {
  overview: (applicationId) => api.get(`/submissions/applications/${applicationId}`),
  submit: (payload) => api.post('/submissions', payload),
  recompute: (applicationId) => api.post(`/submissions/applications/${applicationId}/final-score`),
  recomputeJob: (jobId) => api.post(`/submissions/jobs/${jobId}/final-scores`),
  viewPublic: (token) => api.get(`/public/submissions/${token}`),
};
