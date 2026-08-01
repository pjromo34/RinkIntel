const DEFAULT_API_BASE = 'https://api.rinkintel.net';

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL)
    ? process.env.REACT_APP_API_BASE_URL
    : DEFAULT_API_BASE;

export function apiUrl(path) {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
