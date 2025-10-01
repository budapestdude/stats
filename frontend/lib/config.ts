// Central API configuration for Chess Stats
// This file provides a consistent API URL across the entire application

/**
 * Get the API base URL based on the environment
 * - Server-side: Uses NEXT_PUBLIC_API_URL or defaults to Hetzner
 * - Client-side localhost: Uses localhost:3010
 * - Client-side production: Uses NEXT_PUBLIC_API_URL or defaults to Hetzner
 */
export function getApiBaseUrl(): string {
  // Server-side rendering (build time)
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://195.201.6.244';
  }

  // Client-side: check if on localhost
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3010';
  }

  // Production: use environment variable or default to Hetzner
  return process.env.NEXT_PUBLIC_API_URL || 'http://195.201.6.244';
}

// Export the API base URL as a constant
export const API_BASE_URL = getApiBaseUrl();

// Debug logging (only in development)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  console.log('[Config] API_BASE_URL:', API_BASE_URL);
  console.log('[Config] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
  console.log('[Config] hostname:', window.location.hostname);
}
