const TOKEN_KEY = 'recruitiq_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Thin fetch wrapper: every server response follows the { success, data }
// or { success: false, message, error } envelope (Section 23), so callers
// just get back `data` or a thrown Error with a readable message.
async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  const token = getToken();
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
    if (response.status === 401 || response.status === 403) {
      setToken(null);
    }

    throw err;
  }

  return json.data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData, isFormData: true }),
};
