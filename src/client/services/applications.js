// import { api } from './api.js';
import { api, getToken } from './api.js';

export const applicationsApi = {
  apply: (payload) => api.post('/applications', payload),
  listMine: () => api.get('/applications/mine'),
  getMine: (id) => api.get(`/applications/mine/${id}`),
  listForJob: (jobId) => api.get(`/applications/job/${jobId}`),
  getCandidateDetail: (jobId, candidateId) => api.get(`/applications/job/${jobId}/candidates/${candidateId}`),
  bulkUpdateStatus: (jobId, applicationIds, status) =>
    api.patch(`/applications/job/${jobId}/bulk-status`, { applicationIds, status }),
  reject: (applicationId) => api.patch(`/applications/${applicationId}/reject`),
  // The CV file needs the Bearer token, so it can't be a plain link: fetch it
  // and hand the browser a temporary object URL (same as the HR portal).
  openCv: async (jobId, candidateId, { download = false, fileName = 'cv' } = {}) => {
    const tab = download ? null : window.open('', '_blank');
    const res = await fetch(`/api/v1/applications/job/${jobId}/candidates/${candidateId}/cv${download ? '?download=1' : ''}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      tab?.close();
      throw new Error('Could not open the CV');
    }
    const url = URL.createObjectURL(await res.blob());
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (tab) {
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
