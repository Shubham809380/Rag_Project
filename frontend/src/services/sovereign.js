import api from './api';

// ─── Sovereign Workbench API client ─────────────────────────────────────────
// These are the frontend bindings to the network-isolated sovereign backend.
// All calls reuse the shared axios instance (cookie/session aware).
// ─────────────────────────────────────────────────────────────────────────────

export const getSovereignStatus = async () => {
  const r = await api.get('/sovereign/status');
  return r.data;
};

export const getSovereignDashboard = async () => {
  const r = await api.get('/sovereign/dashboard');
  return r.data;
};

export const getSovereignModels = async () => {
  const r = await api.get('/sovereign/models');
  return r.data;
};

export const getSovereignAvailability = async () => {
  const r = await api.get('/sovereign/availability');
  return r.data;
};

// Collections
export const getCollections = async () => {
  const r = await api.get('/sovereign/collections');
  return r.data;
};

export const createCollection = async (data) => {
  const r = await api.post('/sovereign/collections', data);
  return r.data;
};

// Documents
export const getSovereignDocuments = async () => {
  const r = await api.get('/sovereign/documents');
  return r.data;
};

export const getSovereignDocument = async (id) => {
  const r = await api.get(`/sovereign/documents/${id}`);
  return r.data;
};

export const uploadSovereignDocument = async (file, { collectionId, classification, department } = {}) => {
  const fd = new FormData();
  fd.append('file', file);
  if (collectionId) fd.append('collectionId', collectionId);
  if (classification) fd.append('classification', classification);
  if (department) fd.append('department', department);
  const r = await api.post('/sovereign/documents', fd, { headers: { 'Content-Type': undefined } });
  return r.data;
};

export const sovereignSourceUrl = (id) => `/api/sovereign/documents/${id}/source`;

// Agent tasks
export const startSovereignTask = async (question) => {
  const r = await api.post('/sovereign/tasks/start', { question });
  return r.data;
};

export const getSovereignTasks = async () => {
  const r = await api.get('/sovereign/tasks');
  return r.data;
};

export const getSovereignTask = async (id) => {
  const r = await api.get(`/sovereign/tasks/${id}`);
  return r.data;
};

export const approveSovereignTask = async (id, decision, note = '') => {
  const r = await api.post(`/sovereign/tasks/${id}/approve`, { decision, note });
  return r.data;
};

// Artifacts
export const getSovereignArtifacts = async () => {
  const r = await api.get('/sovereign/artifacts');
  return r.data;
};

export const sovereignArtifactUrl = (id) => `/api/sovereign/artifacts/${id}/download`;

// Tools + audit
export const getSovereignTools = async () => {
  const r = await api.get('/sovereign/tools');
  return r.data;
};

export const getSovereignAudit = async (params = {}) => {
  const q = new URLSearchParams(params).toString();
  const r = await api.get(`/sovereign/audit?${q}`);
  return r.data;
};

// Administrative users (admin)
export const getSovereignUsers = async () => {
  const r = await api.get('/sovereign/admin/users');
  return r.data;
};

export const createSovereignUser = async (data) => {
  const r = await api.post('/sovereign/admin/users', data);
  return r.data;
};

export const updateSovereignUser = async (id, data) => {
  const r = await api.put(`/sovereign/admin/users/${id}`, data);
  return r.data;
};

// Vision / dataset / code / system / search (analysis extensions)
export const analyzeImageFile = async (file, prompt) => {
  const fd = new FormData();
  fd.append('file', file);
  if (prompt) fd.append('prompt', prompt);
  const r = await api.post('/sovereign/vision/analyze', fd, { headers: { 'Content-Type': undefined }, timeout: 600000 });
  return r.data;
};

export const getSovereignSystem = async () => {
  const r = await api.get('/sovereign/system');
  return r.data;
};

export const analyzeDatasetFile = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  const r = await api.post('/sovereign/data/analyze', fd, { headers: { 'Content-Type': undefined } });
  return r.data;
};

export const executeSovereignCode = async (code, tests, question) => {
  const r = await api.post('/sovereign/code/execute', { code, tests, question });
  return r.data;
};

export const generateSovereignCode = async (prompt, tests) => {
  const r = await api.post('/sovereign/code/generate', { prompt, tests });
  return r.data;
};

export const globalSovereignSearch = async (q) => {
  const r = await api.get(`/sovereign/search?q=${encodeURIComponent(q)}`);
  return r.data;
};

// System verification panel: run a real capability check against the live core.
export const listSovereignTests = async () => {
  const r = await api.get('/sovereign/tests');
  return r.data;
};

export const runSovereignTest = async (name) => {
  const r = await api.post(`/sovereign/tests/${encodeURIComponent(name)}`, {}, { timeout: 900000 });
  return r.data;
};

export default {
  getSovereignStatus, getSovereignDashboard, getSovereignModels, getSovereignAvailability,
  getCollections, createCollection,
  getSovereignDocuments, getSovereignDocument, uploadSovereignDocument, sovereignSourceUrl,
  startSovereignTask, getSovereignTasks, getSovereignTask, approveSovereignTask,
  getSovereignArtifacts, sovereignArtifactUrl,
  getSovereignTools, getSovereignAudit,
  getSovereignUsers, createSovereignUser, updateSovereignUser,
  analyzeImageFile, getSovereignSystem, analyzeDatasetFile, executeSovereignCode, generateSovereignCode, globalSovereignSearch,
};