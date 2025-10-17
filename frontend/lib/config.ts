// Central API configuration for Chess Stats

// The environment variable embedded at build time by Next.js
// Default to Railway backend which has the working database
const BUILD_TIME_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://stats-production-10e3.up.railway.app';

/**
 * Get the API base URL - ALWAYS use this function, never a constant!
 * This is evaluated at runtime to detect localhost vs production
 */
export function getApiBaseUrl(): string {
  // Browser runtime check
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // Local development - use localhost:3010
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3010';
    }

    // Production - use environment variable (Railway sets this)
    return BUILD_TIME_API_URL;
  }

  // Server-side rendering
  return BUILD_TIME_API_URL;
}

// Export a constant that calls the function (for backward compatibility)
// NOTE: In string templates, you must use getApiBaseUrl() directly!
export const API_BASE_URL = getApiBaseUrl();

// Debug logging
if (typeof window !== 'undefined') {
  const url = getApiBaseUrl();
  console.log('[Config] API URL Configuration:');
  console.log('  BUILD_TIME_API_URL:', BUILD_TIME_API_URL);
  console.log('  Current hostname:', window.location.hostname);
  console.log('  Selected API URL:', url);
}
