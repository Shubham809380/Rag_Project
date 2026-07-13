const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

import axios from 'axios';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const data = error.response.data;
      if (typeof data === 'string' && data.includes('<!DOCTYPE')) {
        error.response.data = { message: 'Server error - the request may have timed out. Please try again.' };
      }
    } else if (error.code === 'ECONNABORTED') {
      error.message = 'Request timed out. Please try again.';
    } else if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }
    return Promise.reject(error);
  }
);

// Document
export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('files', file);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': undefined },
    onUploadProgress: (e) => {
      if (e.total) {
        const percent = Math.round((e.loaded * 100) / e.total);
        window.__uploadProgress?.(percent);
      }
    },
  });
  return response.data;
};

export const analyzeDocument = async ({ question, fileId, conversationId }) => {
  const response = await api.post('/analyze', { question, fileId, conversationId });
  return response.data;
};

export const getDocuments = async () => {
  const response = await api.get('/documents');
  return response.data;
};

export const deleteDocument = async (id) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};

// Conversation
export const getConversations = async () => {
  const response = await api.get('/conversations');
  return response.data;
};

export const createConversation = async (title) => {
  const response = await api.post('/conversations', { title });
  return response.data;
};

export const updateConversation = async (id, title) => {
  const response = await api.put(`/conversations/${id}`, { title });
  return response.data;
};

export const deleteConversation = async (id) => {
  const response = await api.delete(`/conversations/${id}`);
  return response.data;
};

export const getConversationMessages = async (id) => {
  const response = await api.get(`/conversations/${id}/messages`);
  return response.data;
};

// User
export const getProfile = async () => {
  const response = await api.get('/user/profile');
  return response.data;
};

export const updateProfile = async (full_name) => {
  const response = await api.put('/user/profile', { full_name });
  return response.data;
};

export const getStats = async () => {
  const response = await api.get('/user/stats');
  return response.data;
};

export const deleteAccount = async () => {
  const response = await api.delete('/user/account');
  return response.data;
};

// Admin
export const getAdminStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data;
};

export const getAdminUsers = async () => {
  const response = await api.get('/admin/users');
  return response.data;
};

export const getAdminVisits = async (limit = 100) => {
  const response = await api.get(`/admin/visits?limit=${limit}`);
  return response.data;
};

export const getAdminVisitStats = async () => {
  const response = await api.get('/admin/visits/stats');
  return response.data;
};

export const updateAdminUserRole = async (userId, role) => {
  const response = await api.put(`/admin/users/${userId}/role`, { role });
  return response.data;
};

export const trackVisit = async (page) => {
  try {
    await api.post('/track-visit', { page });
  } catch {}
};

export default api;
