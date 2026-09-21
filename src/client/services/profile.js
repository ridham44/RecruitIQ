import { api } from './api.js';

export const companyProfileApi = {
  get: () => api.get('/companies/me'),
  update: (payload) => api.patch('/companies/me', payload),
};

export const candidateProfileApi = {
  get: () => api.get('/candidates/me'),
  update: (payload) => api.patch('/candidates/me', payload),
};
