import { api } from './api.js';

// Build plan P4 — public careers portal (no login needed).
export const publicApi = {
  getPortal: (slug) => api.get(`/public/careers/${encodeURIComponent(slug)}`),
  getPortalJob: (slug, jobId) => api.get(`/public/careers/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(jobId)}`),
  sendOtp: (phone) => api.post('/public/otp/send', { phone }),
  verifyOtp: (phone, code) => api.post('/public/otp/verify', { phone, code }),
  parseCv: (file) => {
    const form = new FormData();
    form.append('resume', file);
    return api.upload('/public/cv/parse', form);
  },
  apply: (payload) => api.post('/public/applications', payload),
  processTracked: (token) => api.post('/public/track/process', { token }),
  getTrackStatus: (token) => api.get(`/public/track?token=${encodeURIComponent(token)}`),
  // Slot booking from the status link (no login)
  getTrackBooking: (token) => api.get(`/public/track/booking?token=${encodeURIComponent(token)}`),
  bookFromTrack: (token, slotId) => api.post('/public/track/booking', { token, slotId }),
  cancelFromTrack: (token) => api.post('/public/track/booking/cancel', { token }),
};

// Company side: the careers link and the CV pool.
export const careersAdminApi = {
  getLink: () => api.get('/companies/careers-link'),
  setLink: (slug) => api.patch('/companies/careers-link', { slug }),
  listPool: (status) => api.get(`/cv-pool${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  placeFromPool: (submissionId, jobId) => api.post(`/cv-pool/${submissionId}/apply`, { jobId }),
};
