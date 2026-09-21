import { api } from './api.js';

export const screeningApi = {
  runForJob: (jobId) => api.post(`/screening/job/${jobId}/run`),
  runForApplication: (applicationId) => api.post(`/screening/application/${applicationId}/run`),
  getRanked: (jobId) => api.get(`/screening/job/${jobId}/ranked`),
  getTop10: (jobId) => api.get(`/screening/job/${jobId}/top`),
};
