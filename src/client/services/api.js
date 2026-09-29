const TOKEN_KEY = 'recruitiq_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const KEEP_SESSION_CODES = new Set(['PERMISSION_DENIED', 'JOB_NOT_ASSIGNED']);

// Build plan P5: an instant-interview link session (from /interview/:token).
// Kept in sessionStorage and used ONLY for that interview's /interviews/:id
// calls, so it never replaces or evicts the browser's normal login.
const INTERVIEW_SESSION_KEY = 'recruitiq_interview_session';

export function setInterviewSession(session) {
  try {
    if (session) sessionStorage.setItem(INTERVIEW_SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(INTERVIEW_SESSION_KEY);
  } catch {
    /* storage blocked — the room will ask the link page again */
  }
}

function interviewSessionFor(path) {
  try {
    const s = JSON.parse(sessionStorage.getItem(INTERVIEW_SESSION_KEY) || 'null');
    if (!s?.token || !s?.interviewId) return null;
    const scope = `/interviews/${s.interviewId}`;
    return path === scope || path.startsWith(`${scope}/`) ? s.token : null;
  } catch {
    return null;
  }
}

// Thin fetch wrapper: every server response follows the { success, data }
// or { success: false, message, error } envelope (Section 23), so callers
// just get back `data` or a thrown Error with a readable message.
async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  // const token = getToken();
  const scopedToken = interviewSessionFor(path);
  const token = scopedToken || getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.success) {
    const message = json?.message || `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.code = json?.error;
    err.status = response.status;

    // Auto-evict a stale or wrong-role JWT so the user is cleanly redirected
    // to login by ProtectedRoute instead of seeing a looping 403/401 error.
    // if (response.status === 401 || response.status === 403) {
    //   setToken(null);
    // }
    // Build plan P2: a recruiter hitting something outside their permissions
    // or job assignments stays logged in — only that one action is refused.
    const keepSession = response.status === 403 && KEEP_SESSION_CODES.has(json?.error);
    // if ((response.status === 401 || response.status === 403) && !keepSession) {
    //   setToken(null);
    // }
    // Build plan P5: a failed link session only drops itself, never the normal login.
    if ((response.status === 401 || response.status === 403) && !keepSession) {
      if (scopedToken) setInterviewSession(null);
      else setToken(null);
    }

    throw err;
  }

  return json.data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData, isFormData: true }),
};
