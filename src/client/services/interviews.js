import { api } from './api.js';

export const interviewsApi = {
  // Company
  getConfig: (jobId) => api.get(`/interviews/config/${jobId}`),
  upsertConfig: (jobId, payload) => api.patch(`/interviews/config/${jobId}`, payload),
  listForJob: (jobId) => api.get(`/interviews/job/${jobId}`),

  // Shared (company or the owning candidate)
  getDetail: (interviewId) => api.get(`/interviews/${interviewId}`),
  getState: (interviewId) => api.get(`/interviews/${interviewId}/state`),

  // Candidate
  start: (interviewId) => api.post(`/interviews/${interviewId}/start`),
  submitAnswer: (interviewId, payload) => api.post(`/interviews/${interviewId}/answer`, payload),
  logEvent: (interviewId, type, metadata) => api.post(`/interviews/${interviewId}/events`, { type, metadata }),
  end: (interviewId) => api.post(`/interviews/${interviewId}/end`),
};
