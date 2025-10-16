interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

/**
 * Skeleton Card Component
 * Provides a loading skeleton for card-based layouts
 */
export function SkeletonCard({ className = '', lines = 3 }: SkeletonCardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 animate-pulse ${className}`}>
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded mb-2" style={{ width: `${100 - i * 10}%` }}></div>
      ))}
    </div>
  );
}

export default SkeletonCard;
