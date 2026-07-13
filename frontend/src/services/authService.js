const RAW_API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function getApiBaseUrl() {
  if (RAW_API_URL.startsWith('http://') || RAW_API_URL.startsWith('https://')) {
    return trimTrailingSlash(RAW_API_URL);
  }

  const normalizedPath = RAW_API_URL.startsWith('/') ? RAW_API_URL : `/${RAW_API_URL}`;
  return trimTrailingSlash(`${window.location.origin}${normalizedPath}`);
}

const API_BASE_URL = getApiBaseUrl();

export async function getMe() {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Not authenticated');
  }
  return response.json();
}

export async function logout() {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return response.json();
}

export async function register({ name, email, password }) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Registration failed');
  }
  return data;
}

export async function login({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }
  return data;
}

export function getGoogleAuthUrl(redirectPath = '/dashboard') {
  const backendUrl = API_BASE_URL;
  const currentOrigin = window.location.origin;
  const redirectUrl = new URL(redirectPath, currentOrigin).toString();

  const url = `${backendUrl}/auth/google?redirect=${encodeURIComponent(redirectUrl)}`;
  return url;
}

export { API_BASE_URL };
