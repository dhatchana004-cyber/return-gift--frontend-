import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'https://api.vedhikareturngift.com/api' });
api.interceptors.request.use((config) => {
  const url = config.url || '';
  const isPublicAuth =
    url.includes('/auth/login') ||
    url.includes('/auth/admin/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password');
  const token = localStorage.getItem('vedhika_token');
  if (token && !isPublicAuth) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(undefined, async (error) => {
  const original = error.config;
  const refresh = localStorage.getItem('vedhika_refresh');
  if (error.response?.status !== 401 || !original || original._retried || !refresh
      || original.url?.includes('/auth/login') || original.url?.includes('/auth/admin/login')
      || original.url?.includes('/auth/token/refresh')) {
    return Promise.reject(error);
  }
  original._retried = true;
  try {
    const response = await axios.post(`${api.defaults.baseURL}/auth/token/refresh`, { refresh });
    localStorage.setItem('vedhika_token', response.data.access);
    original.headers.Authorization = `Bearer ${response.data.access}`;
    return api(original);
  } catch (refreshError) {
    localStorage.removeItem('vedhika_token');
    localStorage.removeItem('vedhika_refresh');
    localStorage.removeItem('vedhika_role');
    localStorage.removeItem('vedhika_user');
    localStorage.removeItem('vedhika_admin');
    return Promise.reject(refreshError);
  }
});

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || 'https://api.vedhikareturngift.com').replace(/\/$/, '');

export function resolveMediaUrl(url) {
  if (!url) return '';
  const value = String(url).trim();
  if (!value) return '';
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  if (!import.meta.env.DEV) {
    const localProxyMatch = value.match(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(\/media\/.*)$/i);
    if (localProxyMatch) return `${API_ORIGIN}${localProxyMatch[1]}`;
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && value.startsWith('http://api.vedhikareturngift.com/')) {
    return value.replace(/^http:\/\//i, 'https://');
  }
  return value;
}

export function getErrorMessage(error) {
  const response = error.response?.data;
  if (
    typeof response?.error === 'string' &&
    response.error &&
    response.error !== 'Please check the submitted information.'
  ) {
    return response.error;
  }
  if (response?.details && typeof response.details === 'object') {
    const firstDetail = Object.entries(response.details)
      .flatMap(([key, val]) => {
        const items = Array.isArray(val)
          ? val
          : typeof val === 'object' && val !== null
            ? Object.values(val).flat()
            : [val];
        return items.map((msg) => (key === 'non_field_errors' ? String(msg) : `${key}: ${msg}`));
      })
      .find(Boolean);
    if (firstDetail) return firstDetail;
  }
  return response?.error || (typeof response?.detail === 'string' ? response.detail : null)
    || error.message || 'Something went wrong. Please try again.';
}

export default api;
