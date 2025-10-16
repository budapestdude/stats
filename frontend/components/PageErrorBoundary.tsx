'use client';

import React, { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  pageName?: string;
}

/**
 * Page-level Error Boundary
 * Shows a friendlier error page with navigation options
 */
export function PageErrorBoundary({ children, pageName }: Props) {
  const fallback = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-12 h-12 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Page Error
          </h1>
          <p className="text-gray-600">
            {pageName ? `The ${pageName} page` : 'This page'} encountered an error
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Go to Home
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="block w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition"
          >
            Reload Page
          </button>
          <Link
            href="/players"
            className="block w-full bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            Browse Players
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          If this problem persists, please try clearing your browser cache
        </p>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}

export default PageErrorBoundary;
