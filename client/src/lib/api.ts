import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('hippo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('hippo_token');
      sessionStorage.removeItem('hippo_user');
      window.location.href = '/signin';
    }
    return Promise.reject(err);
  },
);

export default api;
