/**
 * IPC Handlers for Sync Operations
 * Tshifhinga Time Tracker
 *
 * Bridges the renderer process with the sync service in the main process
 */

import { ipcMain, BrowserWindow } from 'electron';
import { SyncService, getSyncService } from './sync-service';
import { getServerDiscovery } from './server-discovery';
import { createSyncClient, SyncApiClient } from './sync-client';
import {
  SYNC_IPC_CHANNELS,
  SyncState,
  SyncHealthStatus,
  SyncResult,
  ServerConfig,
  SyncConfig,
} from './sync-types';

let syncService: SyncService | null = null;
let syncClient: SyncApiClient | null = null;
let mainWindow: BrowserWindow | null = null;

/**
 * Event emitter that sends events to the renderer process
 */
const createEventEmitter = (window: BrowserWindow | null) => ({
  emit: (channel: string, data: unknown) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  },
});

/**
 * Initialize sync IPC handlers
 */
export async function initializeSyncIPC(
  db: any,
  window: BrowserWindow,
  config?: Partial<SyncConfig>
): Promise<SyncService> {
  mainWindow = window;

  // Initialize sync service
  syncService = getSyncService(db, config);
  await syncService.initialize(createEventEmitter(window));

  // Try to discover server and create sync client
  const discovery = getServerDiscovery();
  const discoveryResult = await discovery.discover();

  if (discoveryResult.success && discoveryResult.config) {
    console.log(`Server discovered via ${discoveryResult.method}`);
    syncService.setServerConfig(discoveryResult.config);

    // Create sync client
    syncClient = createSyncClient({
      serverConfig: discoveryResult.config,
      authToken: null, // Will be set when user logs in
      clientId: (syncService as any).clientId || 'unknown',
      clientVersion: process.env.npm_package_version || '1.0.0',
    });
  } else {
    console.log('No server discovered, sync will operate in offline mode');
  }

  // Register IPC handlers
  registerHandlers();

  return syncService;
}

/**
 * Register all IPC handlers for sync operations
 */
function registerHandlers(): void {
  // Remove existing handlers to prevent duplicates
  const channels = Object.values(SYNC_IPC_CHANNELS);
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }

  // Sync Now - Trigger immediate sync
  ipcMain.handle(SYNC_IPC_CHANNELS.SYNC_NOW, async () => {
    if (!syncService) {
      return { success: false, error: 'Sync service not initialized' };
    }

    try {
      const result = await syncService.runSync();
      return result;
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Get Sync State
  ipcMain.handle(SYNC_IPC_CHANNELS.GET_SYNC_STATE, async (): Promise<SyncState> => {
    if (!syncService) {
      return {
        lastSyncTimestamp: null,
        syncInProgress: false,
        lastError: 'Sync service not initialized',
        pendingCount: 0,
        conflictCount: 0,
        serverReachable: false,
      };
    }

    return syncService.getState();
  });

  // Get Sync Health Status
  ipcMain.handle(SYNC_IPC_CHANNELS.GET_SYNC_HEALTH, async (): Promise<SyncHealthStatus> => {
    if (!syncService) {
      return {
        status: 'offline',
        lastSync: null,
        minutesSinceLastSync: null,
        pendingRecords: 0,
        unresolvedConflicts: 0,
        serverConnected: false,
      };
    }

    return syncService.getHealthStatus();
  });

  // Get Conflicts
  ipcMain.handle(SYNC_IPC_CHANNELS.GET_CONFLICTS, async () => {
    if (!syncService) {
      return [];
    }

    try {
      return await syncService.getConflicts();
    } catch (err) {
      console.error('Failed to get conflicts:', err);
      return [];
    }
  });

  // Resolve Conflict
  ipcMain.handle(
    SYNC_IPC_CHANNELS.RESOLVE_CONFLICT,
    async (
      _event,
      conflictId: number,
      resolution: 'keep_local' | 'keep_server' | 'manual',
      notes?: string
    ) => {
      if (!syncService) {
        return { success: false, error: 'Sync service not initialized' };
      }

      try {
        await syncService.resolveConflict(conflictId, resolution, notes);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  // Update Sync Configuration
  ipcMain.handle(
    SYNC_IPC_CHANNELS.UPDATE_CONFIG,
    async (_event, config: Partial<SyncConfig>) => {
      if (!syncService) {
        return { success: false, error: 'Sync service not initialized' };
      }

      try {
        syncService.updateConfig(config);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  );

  // Additional handlers for server configuration
  ipcMain.handle('sync:configure-server', async (_event, config: ServerConfig) => {
    if (!syncService) {
      return { success: false, error: 'Sync service not initialized' };
    }

    try {
      syncService.setServerConfig(config);

      // Update or create sync client
      if (syncClient) {
        syncClient.updateServerConfig(config);
      } else {
        syncClient = createSyncClient({
          serverConfig: config,
          authToken: null,
          clientId: (syncService as any).clientId || 'unknown',
          clientVersion: process.env.npm_package_version || '1.0.0',
        });
      }

      // Save config for future use
      const discovery = getServerDiscovery();
      await discovery.saveConfig(config);

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Check server connectivity
  ipcMain.handle('sync:check-connectivity', async () => {
    if (!syncClient) {
      return { success: false, error: 'No server configured' };
    }

    try {
      const result = await syncClient.checkConnectivity();
      return result;
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Discover server
  ipcMain.handle('sync:discover-server', async (_event, forceRefresh?: boolean) => {
    const discovery = getServerDiscovery();
    const result = await discovery.discover(forceRefresh);
    return result;
  });

  // Set auth token for sync
  ipcMain.handle('sync:set-auth-token', async (_event, token: string | null) => {
    if (syncClient) {
      syncClient.updateAuthToken(token);
    }
    return { success: true };
  });

  console.log('Sync IPC handlers registered');
}

/**
 * Update auth token (called when user logs in/out)
 */
export function updateSyncAuthToken(token: string | null): void {
  if (syncClient) {
    syncClient.updateAuthToken(token);
  }
}

/**
 * Get the sync service instance
 */
export function getSyncServiceInstance(): SyncService | null {
  return syncService;
}

/**
 * Get the sync client instance
 */
export function getSyncClientInstance(): SyncApiClient | null {
  return syncClient;
}

/**
 * Cleanup sync resources
 */
export function cleanupSyncIPC(): void {
  if (syncService) {
    syncService.destroy();
    syncService = null;
  }
  syncClient = null;
  mainWindow = null;

  // Remove all handlers
  const channels = Object.values(SYNC_IPC_CHANNELS);
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
  ipcMain.removeHandler('sync:configure-server');
  ipcMain.removeHandler('sync:check-connectivity');
  ipcMain.removeHandler('sync:discover-server');
  ipcMain.removeHandler('sync:set-auth-token');
}
