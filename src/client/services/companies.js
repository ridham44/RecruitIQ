import { api } from './api.js';

export const companiesApi = {
  getProfile: () => api.get('/companies/me'),
  updateProfile: (payload) => api.patch('/companies/me', payload),
  getDashboardOverview: () => api.get('/companies/dashboard-overview'),
};
