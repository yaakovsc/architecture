import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (creds) => api.post('/auth/login', creds),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const systemsApi = {
  getAll: () => api.get('/systems'),
  getAllAdmin: () => api.get('/systems/admin/all'),
  getOne: (key) => api.get(`/systems/${key}`),
  create: (data) => api.post('/systems', data),
  update: (id, data) => api.put(`/systems/${id}`, data),
  checkData: (id) => api.get(`/systems/${id}/check`),
  delete: (id) => api.delete(`/systems/${id}`),
  updateData: (key, data) => api.put(`/systems/${key}/data`, data),
};

export const navApi = {
  // User-facing: full config (buttons + subjects + fields)
  getConfig: () => api.get('/nav/config'),

  // Admin: buttons
  getButtons: () => api.get('/nav/buttons'),
  createButton: (data) => api.post('/nav/buttons', data),
  updateButton: (id, data) => api.put(`/nav/buttons/${id}`, data),
  deleteButton: (id) => api.delete(`/nav/buttons/${id}`),
  reorderButtons: (ids) => api.put('/nav/buttons/reorder', { ids }),

  // Admin: subjects
  getSubjects: (buttonId) => api.get(`/nav/buttons/${buttonId}/subjects`),
  createSubject: (data) => api.post('/nav/subjects', data),
  updateSubject: (id, data) => api.put(`/nav/subjects/${id}`, data),
  deleteSubject: (id) => api.delete(`/nav/subjects/${id}`),
  reorderSubjects: (ids) => api.put('/nav/subjects/reorder', { ids }),

  // Admin: fields
  createField: (data) => api.post('/nav/fields', data),
  updateField: (id, data) => api.put(`/nav/fields/${id}`, data),
  deleteField: (id) => api.delete(`/nav/fields/${id}`),
  reorderFields: (ids) => api.put('/nav/fields/reorder', { ids }),

  // User: responses
  getResponse: (systemId, buttonId) => api.get(`/nav/response/${systemId}/${buttonId}`),
  saveResponse: (systemId, buttonId, data) => api.put(`/nav/response/${systemId}/${buttonId}`, { data }),
};

export const aiApi = {
  getStatus:    ()          => api.get('/ai/status'),
  getSummary:   (systemKey) => api.get(`/ai/summary/${systemKey}`),
  triggerAnalysis: (systemKey) => api.post(`/ai/analyze/${systemKey}`),
  // chat uses raw fetch for SSE streaming — see AIChatPanel
  chatUrl:      (systemKey) => `/api/ai/chat/${systemKey}`,

  // Enterprise
  getEnterpriseSummary: ()  => api.get('/ai/enterprise/summary'),
  triggerEnterpriseAnalysis: () => api.post('/ai/enterprise/analyze'),
  enterpriseChatUrl: ()     => `/api/ai/enterprise/chat`,

  // Config (admin)
  getConfig:    ()     => api.get('/ai/config'),
  updateConfig: (data) => api.put('/ai/config', data),
};

export const diagramsApi = {
  get: (key, type) => api.get(`/diagrams/${key}/${type}`),
  upload: (key, type, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/diagrams/${key}/${type}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/diagrams/${id}`),
  fileUrl: (id) => `/api/diagrams/${id}/file`,
};

export default api;
