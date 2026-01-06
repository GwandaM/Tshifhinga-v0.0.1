/**
 * Sync Module Entry Point
 * Tshifhinga Time Tracker
 */

// Types
export * from './sync-types';

// Migrations
export { SYNC_MIGRATIONS, SyncMigrationRunner } from './sync-migrations';

// Service
export { SyncService, getSyncService, destroySyncService } from './sync-service';

// HTTP Client
export { SyncApiClient, createSyncClient } from './sync-client';

// Server Discovery
export {
  ServerDiscovery,
  getServerDiscovery,
  resetServerDiscovery,
  DEFAULT_DISCOVERY_CONFIG,
} from './server-discovery';

// IPC Handlers
export {
  initializeSyncIPC,
  cleanupSyncIPC,
  updateSyncAuthToken,
  getSyncServiceInstance,
  getSyncClientInstance,
} from './sync-ipc-handlers';
