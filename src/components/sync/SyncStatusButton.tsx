/**
 * Sync Status Button Component
 * Tshifhinga Time Tracker
 *
 * Displays sync status and allows manual sync trigger
 */

import React, { useState } from 'react';
import { RefreshCw, Cloud, CloudOff, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSync, SyncHealthStatus } from '@/hooks/useSync';
import { cn } from '@/lib/utils';

interface SyncStatusButtonProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

/**
 * Get status color based on health status
 */
function getStatusColor(status: SyncHealthStatus['status']): string {
  switch (status) {
    case 'healthy':
      return 'text-green-500';
    case 'warning':
      return 'text-yellow-500';
    case 'critical':
      return 'text-red-500';
    case 'offline':
    default:
      return 'text-gray-400';
  }
}

/**
 * Get status icon based on health status
 */
function getStatusIcon(status: SyncHealthStatus['status'], isLoading: boolean) {
  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  switch (status) {
    case 'healthy':
      return <Cloud className="h-4 w-4" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4" />;
    case 'critical':
      return <AlertTriangle className="h-4 w-4" />;
    case 'offline':
    default:
      return <CloudOff className="h-4 w-4" />;
  }
}

/**
 * Format time since last sync
 */
function formatTimeSince(minutes: number | null): string {
  if (minutes === null) return 'Never synced';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SyncStatusButton({
  className,
  showLabel = false,
  size = 'default',
}: SyncStatusButtonProps) {
  const { state, health, isLoading, error, syncNow } = useSync();
  const [showDetails, setShowDetails] = useState(false);

  const handleSync = async () => {
    await syncNow();
  };

  const statusColor = getStatusColor(health.status);
  const statusIcon = getStatusIcon(health.status, isLoading || state.syncInProgress);

  return (
    <TooltipProvider>
      <Popover open={showDetails} onOpenChange={setShowDetails}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size={size === 'sm' ? 'sm' : 'default'}
                className={cn('gap-2', statusColor, className)}
                disabled={isLoading || state.syncInProgress}
              >
                {statusIcon}
                {showLabel && (
                  <span className="hidden sm:inline">
                    {health.status === 'offline' ? 'Offline' : 'Sync'}
                  </span>
                )}
                {state.pendingCount > 0 && (
                  <span className="ml-1 rounded-full bg-yellow-500 px-1.5 py-0.5 text-xs text-white">
                    {state.pendingCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {health.status === 'offline'
                ? 'Server not connected'
                : `Last sync: ${formatTimeSince(health.minutesSinceLastSync)}`}
            </p>
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Sync Status</h4>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  health.status === 'healthy' && 'bg-green-100 text-green-700',
                  health.status === 'warning' && 'bg-yellow-100 text-yellow-700',
                  health.status === 'critical' && 'bg-red-100 text-red-700',
                  health.status === 'offline' && 'bg-gray-100 text-gray-700'
                )}
              >
                {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </span>
            </div>

            {/* Stats */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last sync</span>
                <span>{formatTimeSince(health.minutesSinceLastSync)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending records</span>
                <span
                  className={cn(
                    state.pendingCount > 0 ? 'text-yellow-600 font-medium' : ''
                  )}
                >
                  {state.pendingCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Server</span>
                <span className="flex items-center gap-1">
                  {health.serverConnected ? (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      Connected
                    </>
                  ) : (
                    <>
                      <CloudOff className="h-3 w-3 text-gray-400" />
                      Disconnected
                    </>
                  )}
                </span>
              </div>
              {health.unresolvedConflicts > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conflicts</span>
                  <span className="text-red-600 font-medium">
                    {health.unresolvedConflicts}
                  </span>
                </div>
              )}
            </div>

            {/* Error message */}
            {(error || state.lastError) && (
              <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">
                {error || state.lastError}
              </div>
            )}

            {/* Sync button */}
            <Button
              onClick={handleSync}
              disabled={isLoading || state.syncInProgress}
              className="w-full"
              size="sm"
            >
              {isLoading || state.syncInProgress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>

            {/* Info text */}
            <p className="text-xs text-muted-foreground text-center">
              {health.status === 'offline'
                ? 'Changes will sync when server is available'
                : 'Auto-sync every 15 minutes'}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

export default SyncStatusButton;
