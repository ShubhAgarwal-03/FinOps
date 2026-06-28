// ─────────────────────────────────────────────────────────────────────────────
// apps/web/services/apiClient.ts
//
// Single Axios instance shared across all frontend service files (both AR
// and AP). Imported as @/services/apiClient throughout the codebase.
//
// Base URL resolution:
//   - In development: NEXT_PUBLIC_API_URL from .env.local (e.g. http://localhost:4300)
//   - In production:  NEXT_PUBLIC_API_URL from Vercel env vars (your Render URL)
//
// Add NEXT_PUBLIC_API_URL=http://localhost:4300 to apps/web/.env.local
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4300',
  headers: {
    'Content-Type': 'application/json',
  },
  // Matches the existing invoice generator timeout behaviour
  timeout: 30_000,
});

// Global response error handler — surfaces API error messages consistently
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Prefer the server's own error message if present
    const message =
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.message ??
      'An unexpected error occurred';
    // Attach the server message so callers can do: catch(e) => toast.error(e.message)
    error.message = message;
    return Promise.reject(error);
  },
);

export default apiClient;