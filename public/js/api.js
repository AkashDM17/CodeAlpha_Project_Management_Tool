/**
 * TaskFlow API Service
 * Centralized fetch client with automatic JWT token attachment and error parsing
 */

const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('taskflow_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('taskflow_token', token);
    } else {
      localStorage.removeItem('taskflow_token');
    }
  },

  getCurrentUser() {
    const raw = localStorage.getItem('taskflow_user');
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem('taskflow_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('taskflow_user');
    }
  },

  clearAuth() {
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          this.clearAuth();
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth endpoints
  async login(identifier, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: { identifier, password }
    });
  },

  async register(name, username, email, password, confirmPassword) {
    return this.request('/auth/register', {
      method: 'POST',
      body: { name, username, email, password, confirmPassword }
    });
  },

  async getMe() {
    return this.request('/auth/me');
  },

  // Project endpoints
  async getProjects(search = '') {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/projects${q}`);
  },

  async getProject(id) {
    return this.request(`/projects/${id}`);
  },

  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: projectData
    });
  },

  async updateProject(id, projectData) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: projectData
    });
  },

  async deleteProject(id) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE'
    });
  },

  async addProjectMember(projectId, userId) {
    return this.request(`/projects/${projectId}/members`, {
      method: 'POST',
      body: { userId }
    });
  },

  async removeProjectMember(projectId, userId) {
    return this.request(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE'
    });
  },

  // Task endpoints
  async getProjectTasks(projectId, params = {}) {
    const query = new URLSearchParams(params).toString();
    const q = query ? `?${query}` : '';
    return this.request(`/projects/${projectId}/tasks${q}`);
  },

  async getAllTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    const q = query ? `?${query}` : '';
    return this.request(`/tasks${q}`);
  },

  async getTask(id) {
    return this.request(`/tasks/${id}`);
  },

  async createTask(projectId, taskData) {
    return this.request(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: taskData
    });
  },

  async updateTask(id, taskData) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: taskData
    });
  },

  async deleteTask(id) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  async updateTaskStatus(id, status, position) {
    return this.request(`/tasks/${id}/status`, {
      method: 'PUT',
      body: { status, position }
    });
  },

  async assignTask(id, userId) {
    return this.request(`/tasks/${id}/assign`, {
      method: 'PUT',
      body: { userId }
    });
  },

  // Comment endpoints
  async getTaskComments(taskId) {
    return this.request(`/tasks/${taskId}/comments`);
  },

  async addComment(taskId, text) {
    return this.request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: { text }
    });
  },

  async deleteComment(id) {
    return this.request(`/comments/${id}`, {
      method: 'DELETE'
    });
  },

  // Notification endpoints
  async getNotifications() {
    return this.request('/notifications');
  },

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT'
    });
  },

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'PUT'
    });
  },

  async deleteNotification(id) {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE'
    });
  },

  // User endpoints
  async getUsers(search = '') {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/users${q}`);
  },

  async getUser(id) {
    return this.request(`/users/${id}`);
  },

  async updateProfile(id, data) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: data
    });
  }
};
