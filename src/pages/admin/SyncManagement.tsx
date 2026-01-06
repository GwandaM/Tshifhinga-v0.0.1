/**
 * Sync Management Page
 * Admin interface for managing sync conflicts and settings
 */

import React, { useState } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Settings,
  CheckCircle,
  Clock,
  Database,
  Wifi,
  WifiOff,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSync, SyncConflict } from '@/hooks/useSync';
import { ConflictCard } from '@/components/sync/ConflictCard';
import { SyncSettingsPanel } from '@/components/sync/SyncSettingsPanel';
import { SyncStatusButton } from '@/components/sync/SyncStatusButton';
import { cn } from '@/lib/utils';

export default function SyncManagement() {
  const {
    state,
    health,
    conflicts,
    isLoading,
    syncNow,
    resolveConflict,
    refreshState,
  } = useSync();

  const [activeTab, setActiveTab] = useState('overview');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Sort conflicts
  const sortedConflicts = [...conflicts].sort((a, b) => {
    if (sortOrder === 'newest') {
      return b.detected_at - a.detected_at;
    }
    return a.detected_at - b.detected_at;
  });

  // Handle conflict resolution
  const handleResolveConflict = async (
    conflictId: number,
    resolution: 'keep_local' | 'keep_server' | 'manual',
    notes?: string
  ): Promise<boolean> => {
    const success = await resolveConflict(conflictId, resolution, notes);
    if (success) {
      await refreshState();
    }
    return success;
  };

  // Get status badge variant
  const getStatusVariant = () => {
    switch (health.status) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'critical':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Management</h1>
          <p className="text-muted-foreground">
            Monitor synchronization status and resolve conflicts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusButton showLabel />
          <Button
            onClick={() => syncNow()}
            disabled={isLoading || state.syncInProgress}
          >
            {state.syncInProgress ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {health.serverConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <Badge variant={getStatusVariant()} className="text-sm">
              {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {health.serverConnected ? 'Server connected' : 'Server offline'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.minutesSinceLastSync !== null
                ? health.minutesSinceLastSync < 60
                  ? `${health.minutesSinceLastSync}m`
                  : `${Math.floor(health.minutesSinceLastSync / 60)}h`
                : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              {health.lastSync
                ? `ago`
                : 'Never synced'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.pendingCount}</div>
            <p className="text-xs text-muted-foreground">Records to sync</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
            <AlertTriangle
              className={cn(
                'h-4 w-4',
                conflicts.length > 0 ? 'text-yellow-500' : 'text-muted-foreground'
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                conflicts.length > 0 && 'text-yellow-600'
              )}
            >
              {conflicts.length}
            </div>
            <p className="text-xs text-muted-foreground">Need resolution</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Conflicts
            {conflicts.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {conflicts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Sync Health */}
            <Card>
              <CardHeader>
                <CardTitle>Sync Health</CardTitle>
                <CardDescription>Current synchronization status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Connection</span>
                    <span
                      className={cn(
                        'font-medium',
                        health.serverConnected ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {health.serverConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Sync Status</span>
                    <span className="font-medium capitalize">{health.status}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Last Successful Sync</span>
                    <span>
                      {health.lastSync
                        ? new Date(health.lastSync).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                </div>

                {state.lastError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                    <strong>Last Error:</strong> {state.lastError}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common sync operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => syncNow()}
                  disabled={state.syncInProgress}
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4 mr-2',
                      state.syncInProgress && 'animate-spin'
                    )}
                  />
                  Force Sync Now
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveTab('conflicts')}
                  disabled={conflicts.length === 0}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Resolve Conflicts ({conflicts.length})
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setActiveTab('settings')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Sync Settings
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Activity</CardTitle>
              <CardDescription>Recent synchronization events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Sync activity log coming soon</p>
                <p className="text-xs mt-1">
                  This will show recent push/pull operations
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conflicts Tab */}
        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sync Conflicts</CardTitle>
                  <CardDescription>
                    {conflicts.length === 0
                      ? 'No conflicts to resolve'
                      : `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} need resolution`}
                  </CardDescription>
                </div>
                {conflicts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')
                    }
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {conflicts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <h3 className="text-lg font-medium mb-1">All Clear!</h3>
                  <p className="text-muted-foreground">
                    There are no sync conflicts to resolve.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {sortedConflicts.map((conflict) => (
                      <ConflictCard
                        key={conflict.id}
                        conflict={conflict}
                        onResolve={handleResolveConflict}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <SyncSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
