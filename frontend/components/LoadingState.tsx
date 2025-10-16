import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'dots' | 'progress';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

/**
 * Loading State Component
 * Versatile loading component with multiple display modes
 */
export function LoadingState({
  type = 'spinner',
  text,
  fullScreen = false,
  className = ''
}: LoadingStateProps) {
  const containerClass = fullScreen
    ? 'min-h-screen flex items-center justify-center bg-gray-50'
    : 'flex items-center justify-center py-12';

  const renderLoading = () => {
    switch (type) {
      case 'spinner':
        return (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            {text && <p className="text-gray-600">{text}</p>}
          </div>
        );

      case 'skeleton':
        return (
          <div className="w-full max-w-md space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded h-12"></div>
            ))}
          </div>
        );

      case 'dots':
        return (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            {text && <p className="text-gray-600">{text}</p>}
          </div>
        );

      case 'progress':
        return (
          <div className="w-full max-w-md space-y-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
            {text && <p className="text-center text-gray-600 text-sm">{text}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`${containerClass} ${className}`}>
      {renderLoading()}
    </div>
  );
}

export default LoadingState;
