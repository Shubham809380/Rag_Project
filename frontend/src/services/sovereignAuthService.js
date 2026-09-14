import api from './api';

const withJson = (data) => ({ success: true, ...data });

export async function sovereignLogin(email, password) {
  const r = await api.post('/sovereign/auth/login', { email, password });
  return withJson(r.data);
}

export async function sovereignRegister({ fullName, email, employeeId, department, password }) {
  const r = await api.post('/sovereign/auth/register', { fullName, email, employeeId, department, password });
  return withJson(r.data);
}

export async function sovereignLogout() {
  try {
    const r = await api.post('/sovereign/auth/logout');
    return withJson(r.data);
  } catch {
    return { success: true };
  }
}

export async function sovereignMe() {
  const r = await api.get('/sovereign/auth/me');
  return r.data;
}

export async function sovereignChangePassword(currentPassword, newPassword) {
  const r = await api.post('/sovereign/auth/change-password', { currentPassword, newPassword });
  return r.data;
}

export async function sovereignAuthStatus() {
  const r = await api.get('/sovereign/auth/status');
  return r.data;
}

// Admin
export async function sovereignListUsers(params = {}) {
  const r = await api.get('/sovereign/admin/users', { params });
  return r.data;
}

export async function sovereignCreateUser(payload) {
  const r = await api.post('/sovereign/admin/users', payload);
  return r.data;
}

export async function sovereignUpdateUser(id, payload) {
  const r = await api.put(`/sovereign/admin/users/${id}`, payload);
  return r.data;
}

export async function sovereignResetUserPassword(id, payload = {}) {
  const r = await api.post(`/sovereign/admin/users/${id}/reset-password`, payload);
  return r.data;
}