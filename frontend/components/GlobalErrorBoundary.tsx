'use client';

import React, { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

/**
 * Global Error Boundary
 * Wraps the entire application to catch any unhandled errors
 */
export function GlobalErrorBoundary({ children }: Props) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log to console
    console.error('Global error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    // TODO: Send to error tracking service
    // Example with Sentry:
    // Sentry.captureException(error, {
    //   extra: {
    //     componentStack: errorInfo.componentStack,
    //   },
    // });

    // TODO: Send to custom analytics
    // logErrorToAnalytics({
    //   errorMessage: error.message,
    //   errorStack: error.stack,
    //   componentStack: errorInfo.componentStack,
    // });
  };

  return (
    <ErrorBoundary onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}

export default GlobalErrorBoundary;
