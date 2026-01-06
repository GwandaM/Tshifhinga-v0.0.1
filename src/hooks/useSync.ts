/**
 * React Hook for Sync Operations
 * Tshifhinga Time Tracker
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Types matching the sync service
export interface SyncState {
  lastSyncTimestamp: string | null;
  syncInProgress: boolean;
  lastError: string | null;
  pendingCount: number;
  conflictCount: number;
  serverReachable: boolean;
}

export interface SyncHealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  lastSync: string | null;
  minutesSinceLastSync: number | null;
  pendingRecords: number;
  unresolvedConflicts: number;
  serverConnected: boolean;
}

export interface SyncResult {
  success: boolean;
  timestamp: string;
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

export interface SyncConflict {
  id: number;
  table_name: string;
  record_id: string;
  local_data: string;
  server_data: string;
  conflict_type: string;
  detected_at: number;
}

export interface ServerConfig {
  host: string;
  port: number;
  dbName: string;
  ssl?: boolean;
}

interface UseSyncReturn {
  // State
  state: SyncState;
  health: SyncHealthStatus;
  conflicts: SyncConflict[];
  isLoading: boolean;
  error: string | null;

  // Actions
  syncNow: () => Promise<SyncResult | null>;
  refreshState: () => Promise<void>;
  resolveConflict: (
    conflictId: number,
    resolution: 'keep_local' | 'keep_server' | 'manual',
    notes?: string
  ) => Promise<boolean>;
  configureServer: (config: ServerConfig) => Promise<boolean>;
  discoverServer: () => Promise<ServerConfig | null>;
  checkConnectivity: () => Promise<boolean>;
}

const defaultState: SyncState = {
  lastSyncTimestamp: null,
  syncInProgress: false,
  lastError: null,
  pendingCount: 0,
  conflictCount: 0,
  serverReachable: false,
};

const defaultHealth: SyncHealthStatus = {
  status: 'offline',
  lastSync: null,
  minutesSinceLastSync: null,
  pendingRecords: 0,
  unresolvedConflicts: 0,
  serverConnected: false,
};

/**
 * Hook for managing sync state and operations
 */
export function useSync(): UseSyncReturn {
  const [state, setState] = useState<SyncState>(defaultState);
  const [health, setHealth] = useState<SyncHealthStatus>(defaultHealth);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);

  // Get the sync API from window
  const getSyncApi = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.sync) {
      return (window as any).electronAPI.sync;
    }
    return null;
  }, []);

  // Refresh state from main process
  const refreshState = useCallback(async () => {
    const api = getSyncApi();
    if (!api) return;

    try {
      const [newState, newHealth, newConflicts] = await Promise.all([
        api.getState(),
        api.getHealth(),
        api.getConflicts(),
      ]);

      if (mountedRef.current) {
        setState(newState || defaultState);
        setHealth(newHealth || defaultHealth);
        setConflicts(newConflicts || []);
      }
    } catch (err) {
      console.error('Failed to refresh sync state:', err);
    }
  }, [getSyncApi]);

  // Trigger immediate sync
  const syncNow = useCallback(async (): Promise<SyncResult | null> => {
    const api = getSyncApi();
    if (!api) {
      setError('Sync API not available');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.syncNow();
      await refreshState();
      return result;
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [getSyncApi, refreshState]);

  // Resolve a conflict
  const resolveConflict = useCallback(
    async (
      conflictId: number,
      resolution: 'keep_local' | 'keep_server' | 'manual',
      notes?: string
    ): Promise<boolean> => {
      const api = getSyncApi();
      if (!api) return false;

      try {
        const result = await api.resolveConflict(conflictId, resolution, notes);
        if (result.success) {
          await refreshState();
        }
        return result.success;
      } catch (err) {
        console.error('Failed to resolve conflict:', err);
        return false;
      }
    },
    [getSyncApi, refreshState]
  );

  // Configure server connection
  const configureServer = useCallback(
    async (config: ServerConfig): Promise<boolean> => {
      const api = getSyncApi();
      if (!api) return false;

      try {
        const result = await api.configureServer(config);
        if (result.success) {
          await refreshState();
        }
        return result.success;
      } catch (err) {
        console.error('Failed to configure server:', err);
        return false;
      }
    },
    [getSyncApi, refreshState]
  );

  // Discover server automatically
  const discoverServer = useCallback(async (): Promise<ServerConfig | null> => {
    const api = getSyncApi();
    if (!api) return null;

    try {
      const result = await api.discoverServer(true);
      if (result.success && result.config) {
        return result.config;
      }
      return null;
    } catch (err) {
      console.error('Failed to discover server:', err);
      return null;
    }
  }, [getSyncApi]);

  // Check server connectivity
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    const api = getSyncApi();
    if (!api) return false;

    try {
      const result = await api.checkConnectivity();
      return result.success && result.data?.online;
    } catch (err) {
      return false;
    }
  }, [getSyncApi]);

  // Set up event listeners
  useEffect(() => {
    const api = getSyncApi();
    if (!api) return;

    const cleanupFns: Array<() => void> = [];

    // Listen for sync state changes
    cleanupFns.push(
      api.onSyncStateChanged((_event: any, newState: SyncState) => {
        if (mountedRef.current) {
          setState(newState);
        }
      })
    );

    // Listen for sync completion
    cleanupFns.push(
      api.onSyncCompleted((_event: any, result: SyncResult) => {
        if (mountedRef.current) {
          refreshState();
        }
      })
    );

    // Listen for sync errors
    cleanupFns.push(
      api.onSyncError((_event: any, err: { message: string }) => {
        if (mountedRef.current) {
          setError(err.message);
        }
      })
    );

    // Initial state load
    refreshState();

    // Cleanup
    return () => {
      mountedRef.current = false;
      cleanupFns.forEach((fn) => fn());
    };
  }, [getSyncApi, refreshState]);

  // Periodic health check
  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) {
        refreshState();
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [refreshState]);

  return {
    state,
    health,
    conflicts,
    isLoading,
    error,
    syncNow,
    refreshState,
    resolveConflict,
    configureServer,
    discoverServer,
    checkConnectivity,
  };
}

export default useSync;
