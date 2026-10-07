import { api } from './api.js';

// Build plan P9 — /recq agency-link candidate flow (no login). The candidate's
// email is never sent from the client; the server reads it from the uploaded
// resume and the OTP goes only there.
const enc = encodeURIComponent;

export const recqApi = {
  // Agency page: its OPEN jobs. Specific job by slug.
  getAgency: (agencySlug) => api.get(`/recq/${enc(agencySlug)}`),
  getAgencyJob: (agencySlug, jobSlug) => api.get(`/recq/${enc(agencySlug)}/jobs/${enc(jobSlug)}`),

  // Resume matching (upload + match in one request).
  matchForJob: (agencySlug, jobSlug, file) => {
    const form = new FormData();
    form.append('resume', file);
    return api.upload(`/recq/${enc(agencySlug)}/jobs/${enc(jobSlug)}/match`, form);
  },
  discover: (agencySlug, file) => {
    const form = new FormData();
    form.append('resume', file);
    return api.upload(`/recq/${enc(agencySlug)}/match`, form);
  },

  // Email OTP (code goes only to the resume's email) + apply.
  sendOtp: (agencySlug, payload) => api.post(`/recq/${enc(agencySlug)}/otp/send`, payload),
  verifyOtp: (agencySlug, payload) => api.post(`/recq/${enc(agencySlug)}/otp/verify`, payload),
  apply: (agencySlug, payload) => api.post(`/recq/${enc(agencySlug)}/apply`, payload),
};
