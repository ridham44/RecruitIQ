import { api } from './api.js';

export const companyProfileApi = {
  get: () => api.get('/companies/me'),
  update: (payload) => api.patch('/companies/me', payload),
};

export const candidateProfileApi = {
  get: () => api.get('/candidates/me'),
  update: (payload) => api.patch('/candidates/me', payload),
};

export const educationApi = {
  list: () => api.get('/candidates/me/education'),
  add: (payload) => api.post('/candidates/me/education', payload),
  update: (id, payload) => api.patch(`/candidates/me/education/${id}`, payload),
  remove: (id) => api.delete(`/candidates/me/education/${id}`),
};

