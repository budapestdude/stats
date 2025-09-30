'use client';

import { useWebSocket } from '@/contexts/WebSocketContext';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';

interface ConnectionStatusProps {
  showLabel?: boolean;
  className?: string;
}

export function ConnectionStatus({ showLabel = false, className = '' }: ConnectionStatusProps) {
  const { isConnected, connectionState } = useWebSocket();

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: 'Connected',
          description: 'Real-time updates active'
        };
      case 'connecting':
        return {
          icon: Loader2,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: 'Connecting',
          description: 'Establishing connection...',
          animate: 'animate-spin'
        };
      case 'reconnecting':
        return {
          icon: Loader2,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          label: 'Reconnecting',
          description: 'Attempting to reconnect...',
          animate: 'animate-spin'
        };
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Offline',
          description: 'Real-time updates unavailable'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (!showLabel) {
    return (
      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${config.bgColor} ${config.borderColor} border ${className}`}>
        <Icon className={`w-3 h-3 ${config.color} ${config.animate || ''}`} />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md ${config.bgColor} ${config.borderColor} border ${className}`}>
      <Icon className={`w-4 h-4 ${config.color} ${config.animate || ''}`} />
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
        {config.description && (
          <span className="text-xs text-gray-500">
            {config.description}
          </span>
        )}
      </div>
    </div>
  );
}

// Compact version for navigation bars
export function ConnectionStatusCompact({ className = '' }: { className?: string }) {
  return <ConnectionStatus showLabel={false} className={className} />;
}

// Full version with tooltip for detailed status
export function ConnectionStatusDetailed({ className = '' }: { className?: string }) {
  const { isConnected, connectionState } = useWebSocket();
  const config = getStatusConfig();
  
  function getStatusConfig() {
    switch (connectionState) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: 'Live Updates Active',
          description: 'Receiving real-time data from Chess.com and Lichess'
        };
      case 'connecting':
        return {
          icon: Loader2,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: 'Connecting to Live Feed',
          description: 'Establishing connection for real-time updates...',
          animate: 'animate-spin'
        };
      case 'reconnecting':
        return {
          icon: Loader2,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          label: 'Reconnecting',
          description: 'Attempting to restore live updates...',
          animate: 'animate-spin'
        };
      case 'disconnected':
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Offline Mode',
          description: 'Live updates not available. Data may not be current.'
        };
    }
  }

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${config.bgColor} ${config.borderColor} border ${className}`}>
      <div className="flex-shrink-0">
        <Icon className={`w-5 h-5 ${config.color} ${config.animate || ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </p>
        <p className="text-sm text-gray-500">
          {config.description}
        </p>
      </div>
    </div>
  );
}