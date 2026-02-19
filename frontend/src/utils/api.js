// API configuration utility
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';

console.log('Current API Base URL:', API_BASE_URL);
if (API_BASE_URL.includes('127.0.0.1') || API_BASE_URL.includes('localhost')) {
  console.warn('Backend is pointing to localhost. This will NOT work on mobile unless the backend is running on the phone.');
}

export const apiEndpoints = {
  upload: `${API_BASE_URL}/upload`,
  health: `${API_BASE_URL}/health`,
  debug: `${API_BASE_URL}/debug`
};

export default API_BASE_URL;