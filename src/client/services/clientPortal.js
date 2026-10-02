import { api, getToken } from './api.js';

// Build plan P8 — client HR portal API.
export const clientPortalApi = {
  list: (jobId) => api.get(`/client-portal/submissions${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`),
  get: (id) => api.get(`/client-portal/submissions/${id}`),
  // Ask for a second-round AI interview (link goes to the candidate at once).
  requestSecondRound: (id, payload) => api.post(`/client-portal/submissions/${id}/second-round`, payload),
  // The CV endpoint needs the Bearer token, so it can't be a plain link:
  // fetch it and hand the browser a temporary object URL instead.
  openCv: async (id, { download = false, fileName = 'cv' } = {}) => {
    // Open the tab synchronously (inside the click) so pop-up blockers allow it.
    const tab = download ? null : window.open('', '_blank');
    const res = await fetch(`/api/v1/client-portal/submissions/${id}/cv${download ? '?download=1' : ''}`, {
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
