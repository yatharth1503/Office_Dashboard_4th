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
};
