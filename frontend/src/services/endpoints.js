import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  register: async (name, email, password, role) => {
    const response = await api.post('/api/auth/register', {
      name,
      email,
      password,
      role,
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/api/auth/profile', profileData);
    return response.data;
  },
};

export const darService = {
  create: async (date, activities) => {
    const response = await api.post('/api/dar', { date, activities });
    return response.data;
  },

  getMyDars: async (params = {}) => {
    const response = await api.get('/api/dar', { params });
    return response.data;
  },

  // Admin: get all employees' DARs, with optional user_id filter
  getAllDars: async (userId) => {
    const params = userId ? { user_id: userId } : {};
    const response = await api.get('/api/dar/all', { params });
    return response.data;
  },

  // Admin: get employee list for dropdown
  getEmployees: async () => {
    const response = await api.get('/api/dar/employees');
    return response.data;
  },

  // Edit a single activity
  updateActivity: async (activityId, activity) => {
    const response = await api.put(`/api/dar/activities/${activityId}`, activity);
    return response.data;
  },

  // Delete a single activity
  deleteActivity: async (activityId) => {
    const response = await api.delete(`/api/dar/activities/${activityId}`);
    return response.data;
  },
};

export const activityTypeService = {
  getAll: async () => {
    const response = await api.get('/api/activity-types');
    return response.data;
  },
};

export const leaveService = {
  apply: async (from_date, to_date, reason) => {
    const response = await api.post('/api/leaves', {
      from_date,
      to_date,
      reason,
    });
    return response.data;
  },

  getMyLeaves: async (status) => {
    const params = status ? { status } : {};
    const response = await api.get('/api/leaves', { params });
    return response.data;
  },

  // Admin: get latest 10 leaves across all employees, or filter by user_id
  getAllLeaves: async (user_id) => {
    const params = user_id ? { user_id } : {};
    const response = await api.get('/api/leaves/all', { params });
    return response.data;
  },

  // Admin: get all employees for dropdown
  getEmployees: async () => {
    const response = await api.get('/api/leaves/employees');
    return response.data;
  },

  // Admin: update leave status
  updateStatus: async (leaveId, status) => {
    const response = await api.patch(`/api/leaves/${leaveId}/status`, { status });
    return response.data;
  },
};
