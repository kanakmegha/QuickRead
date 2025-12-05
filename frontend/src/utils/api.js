// API configuration utility
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

export const apiEndpoints = {
  upload: `${API_BASE_URL}/upload`,
  health: `${API_BASE_URL}/health`,
  debug: `${API_BASE_URL}/debug`
};

export default API_BASE_URL;