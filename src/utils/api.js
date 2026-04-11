/**
 * Authenticated API utility — replaces PHP session cookies with JWT
 */

export function getToken() {
  return localStorage.getItem('token') ?? null;
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') ?? 'null');
  } catch {
    return null;
  }
}

export function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/**
 * Fetch wrapper that automatically adds Authorization: Bearer <token>
 * Mirrors the native fetch signature.
 */
export async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

/**
 * Convenience wrappers
 */
export const apiGet = (url) => apiFetch(url);

export const apiPost = (url, body) =>
  apiFetch(url, { method: 'POST', body: JSON.stringify(body) });

export const apiPatch = (url, body) =>
  apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) });

export const apiDelete = (url) =>
  apiFetch(url, { method: 'DELETE' });
