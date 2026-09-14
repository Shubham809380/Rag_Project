import axios from 'axios';
import { API_BASE_URL } from './authService';

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
      const status = error.response.status;
      const data = error.response.data;

      if (typeof data === 'string' && data.includes('<!DOCTYPE')) {
        error.response.data = { message: 'Server error - the request may have timed out. Please try again.' };
      } else if (status === 504) {
        error.response.data = {
          success: false,
          code: 'GATEWAY_TIMEOUT',
          message: 'The server took too long to respond. Please try a shorter question or try again later.',
        };
      } else if (status === 400 && data?.code === 'DOCUMENT_NOT_PROCESSED') {
        error.response.data = {
          success: false,
          code: 'DOCUMENT_NOT_PROCESSED',
          message: data.message || 'This document has not been processed successfully. Please upload it again.',
        };
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
let _uploadProgressCallback = null;
export const setUploadProgressCallback = (cb) => { _uploadProgressCallback = cb; };

export const uploadDocument = async (file, knowledgeBaseId = null) => {
  const formData = new FormData();
  formData.append('files', file);
  if (knowledgeBaseId) formData.append('knowledge_base_id', knowledgeBaseId);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': undefined },
    onUploadProgress: (e) => {
      if (e.total) {
        const percent = Math.round((e.loaded * 100) / e.total);
        _uploadProgressCallback?.(percent);
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

export const getHistory = async () => {
  const response = await api.get('/conversations');
  return response.data;
};

export const trackVisit = async (page) => {
  try {
    await api.post('/track-visit', { page });
  } catch {}
};

// ─── Knowledge Bases ───
export const getKnowledgeBases = async () => {
  const response = await api.get('/knowledge-bases');
  return response.data;
};

export const createKnowledgeBase = async (data) => {
  const response = await api.post('/knowledge-bases', data);
  return response.data;
};

export const updateKnowledgeBase = async (id, data) => {
  const response = await api.put(`/knowledge-bases/${id}`, data);
  return response.data;
};

export const deleteKnowledgeBase = async (id) => {
  const response = await api.delete(`/knowledge-bases/${id}`);
  return response.data;
};

export const getKbStats = async (id) => {
  const response = await api.get(`/knowledge-bases/${id}/stats`);
  return response.data;
};

// ─── Summary ───
export const getSummaryTypes = async () => {
  const response = await api.get('/ai/summary/types');
  return response.data;
};

export const summarizeDocument = async (documentId, type = 'quick') => {
  const response = await api.post('/ai/summary', { documentId, type });
  return response.data;
};

// ─── Research ───
export const runResearch = async (payload) => {
  const response = await api.post('/ai/research', payload);
  return response.data;
};

export const getResearchHistory = async () => {
  const response = await api.get('/ai/research');
  return response.data;
};

export const getResearch = async (id) => {
  const response = await api.get(`/ai/research/${id}`);
  return response.data;
};

export const deleteResearch = async (id) => {
  const response = await api.delete(`/ai/research/${id}`);
  return response.data;
};

// ─── Agent ───
export const runAgent = async (payload) => {
  const response = await api.post('/ai/agent', payload);
  return response.data;
};

// ─── Compare ───
export const compareDocuments = async (documentIds, question) => {
  const response = await api.post('/ai/compare', { documentIds, question });
  return response.data;
};

// ─── Study Mode ───
export const generateStudyMaterial = async (payload) => {
  const response = await api.post('/ai/study', payload);
  return response.data;
};

export const submitQuiz = async (quizId, answers) => {
  const response = await api.post('/ai/study/quiz/submit', { quizId, answers });
  return response.data;
};

export const getQuizResults = async () => {
  const response = await api.get('/ai/study/quiz/results');
  return response.data;
};

// ─── Voice ───
export const getVoiceCapabilities = async () => {
  const response = await api.get('/ai/voice/capabilities');
  return response.data;
};

// ─── Export ───
export const exportContent = async (payload) => {
  const response = await api.post('/ai/export', payload);
  return response.data;
};

// ─── Feedback ───
export const rateMessage = async (messageId, rating) => {
  const response = await api.post('/ai/feedback/rate', { messageId, rating });
  return response.data;
};

export const clearRating = async (messageId) => {
  const response = await api.post('/ai/feedback/clear', { messageId });
  return response.data;
};

// ─── Settings ───
export const getSettings = async () => {
  const response = await api.get('/settings');
  return response.data;
};

export const updateSettings = async (settings) => {
  const response = await api.put('/settings', settings);
  return response.data;
};

// ─── Analytics ───
export const getUserAnalytics = async () => {
  const response = await api.get('/analytics');
  return response.data;
};

export const getSessionAnalytics = async () => {
  const response = await api.get('/analytics/sessions');
  return response.data;
};

// ─── Eval ───
export const runEvaluation = async (payload) => {
  const response = await api.post('/eval/run', payload);
  return response.data;
};

export const getEvalHistory = async (scope = 'all') => {
  const response = await api.get(`/eval/history/${scope}`);
  return response.data;
};

export default api;
