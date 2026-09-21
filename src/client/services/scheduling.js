import { api } from './api.js';

export const schedulingApi = {
  // Company
  createSlots: (jobId, slots) => api.post(`/scheduling/jobs/${jobId}/slots`, { slots }),
  generateSlots: (jobId, payload) => api.post(`/scheduling/jobs/${jobId}/slots/generate`, payload),
  listSlotsForJob: (jobId) => api.get(`/scheduling/jobs/${jobId}/slots`),
  cancelSlot: (jobId, slotId) => api.delete(`/scheduling/jobs/${jobId}/slots/${slotId}`),
  markInterviewCompleted: (jobId, interviewId) => api.patch(`/scheduling/jobs/${jobId}/interviews/${interviewId}/complete`),

  // Candidate
  listAvailableSlots: (applicationId) => api.get(`/scheduling/applications/${applicationId}/slots`),
  bookSlot: (applicationId, slotId) => api.post(`/scheduling/applications/${applicationId}/book`, { slotId }),
  cancelMyInterview: (applicationId) => api.post(`/scheduling/applications/${applicationId}/cancel`),

  // Shared
  getInterview: (applicationId) => api.get(`/scheduling/applications/${applicationId}/interview`),
};
