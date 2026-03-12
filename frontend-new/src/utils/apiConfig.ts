// apiConfig.ts - API URL configuration
// @input: VITE_API_URL environment variable
// @output: getApiUrl() function that returns the API base URL
// @position: frontend API configuration layer

export function getApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim();
  }
  // Default to same-origin so dev proxy (/api, /ws) works reliably.
  return '';
}
