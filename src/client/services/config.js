import { api } from './api.js';

// Build plan P1: non-secret, pre-login settings (GET /api/v1/config/public).
export const configApi = {
  getPublic: () => api.get('/config/public'),
};
