/**
 * Core Sync Service for Tshifhinga Time Tracker
 * Handles local-first data synchronization with central PostgreSQL server
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SyncConfig,
  SyncState,
  SyncResult,
  SyncHealthStatus,
  SyncRequest,
  SyncResponse,
  SyncableSession,
  SyncStatus,
  ServerConfig,
  DEFAULT_SYNC_CONFIG,
  CURRENT_SCHEMA_VERSION,
  SYNC_IPC_CHANNELS,
} from './sync-types';
import { SyncMigrationRunner } from './sync-migrations';

// Placeholder for actual database instance - will be injected
type DatabaseInstance = any;

/**
 * SyncService - Main synchronization orchestrator
 */
export class SyncService {
  private db: DatabaseInstance;
  private config: SyncConfig;
  private state: SyncState;
  private syncTimer: NodeJS.Timeout | null = null;
  private retryCount: number = 0;
  private clientId: string | null = null;
  private serverConfig: ServerConfig | null = null;
  private migrationRunner: SyncMigrationRunner | null = null;

  // Event emitter for IPC communication
  private eventEmitter: {
    emit: (channel: string, data: unknown) => void;
  } | null = null;

  constructor(db: DatabaseInstance, config?: Partial<SyncConfig>) {
    this.db = db;
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.state = {
      lastSyncTimestamp: null,
      syncInProgress: false,
      lastError: null,
      pendingCount: 0,
      conflictCount: 0,
      serverReachable: false,
    };
  }

  /**
   * Initialize the sync service
   */
  async initialize(eventEmitter?: { emit: (channel: string, data: unknown) => void }): Promise<void> {
    this.eventEmitter = eventEmitter || null;

    // Run migrations to ensure sync tables exist
    this.migrationRunner = new SyncMigrationRunner(this.db);
    const migrationResult = await this.migrationRunner.runMigrations();

    if (migrationResult.errors.length > 0) {
      console.error('Sync migration errors:', migrationResult.errors);
      throw new Error(`Failed to initialize sync: ${migrationResult.errors[0]}`);
    }

    console.log(`Applied ${migrationResult.applied} sync migrations`);

    // Generate UUIDs for existing records
    await this.migrationRunner.generateMissingUUIDs();

    // Get or create client identity
    this.clientId = await this.getOrCreateClientId();

    // Load sync state from database
    await this.loadSyncState();

    // Start auto-sync timer if enabled
    if (this.config.enabled && this.config.autoSyncIntervalMs > 0) {
      this.startAutoSync();
    }

    console.log('SyncService initialized with client ID:', this.clientId);
  }

  /**
   * Get or create a unique client identifier
   */
  private async getOrCreateClientId(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT client_uuid FROM client_identity WHERE id = 1',
        async (err: Error | null, row: { client_uuid: string } | undefined) => {
          if (err && !err.message.includes('no such table')) {
            reject(err);
            return;
          }

          if (row?.client_uuid) {
            resolve(row.client_uuid);
            return;
          }

          // Generate new client ID
          const clientUuid = uuidv4();
          const appVersion = process.env.npm_package_version || '1.0.0';

          this.db.run(
            `INSERT OR REPLACE INTO client_identity (id, client_uuid, install_date, app_version)
             VALUES (1, ?, ?, ?)`,
            [clientUuid, Date.now(), appVersion],
            (insertErr: Error | null) => {
              if (insertErr) {
                console.error('Failed to create client identity:', insertErr);
                // Return a temporary UUID if we can't persist
                resolve(uuidv4());
              } else {
                resolve(clientUuid);
              }
            }
          );
        }
      );
    });
  }

  /**
   * Load sync state from database
   */
  private async loadSyncState(): Promise<void> {
    // Get last sync timestamp
    const lastSync = await this.getSyncConfig('last_sync_timestamp');
    this.state.lastSyncTimestamp = lastSync;

    // Count pending records
    this.state.pendingCount = await this.countPendingRecords();

    // Count unresolved conflicts
    this.state.conflictCount = await this.countUnresolvedConflicts();
  }

  /**
   * Get a sync configuration value
   */
  private async getSyncConfig(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT value FROM sync_config WHERE key = ?',
        [key],
        (err: Error | null, row: { value: string } | undefined) => {
          if (err) {
            if (err.message.includes('no such table')) {
              resolve(null);
            } else {
              reject(err);
            }
          } else {
            resolve(row?.value || null);
          }
        }
      );
    });
  }

  /**
   * Set a sync configuration value
   */
  private async setSyncConfig(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO sync_config (key, value, updated_at)
         VALUES (?, ?, ?)`,
        [key, value, Date.now()],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Count records pending sync
   */
  private async countPendingRecords(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT COUNT(*) as count FROM sessions
         WHERE sync_status = 'pending' AND deleted_at IS NULL`,
        (err: Error | null, row: { count: number } | undefined) => {
          if (err) {
            console.error('Error counting pending records:', err);
            resolve(0);
          } else {
            resolve(row?.count || 0);
          }
        }
      );
    });
  }

  /**
   * Count unresolved conflicts
   */
  private async countUnresolvedConflicts(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM sync_conflicts WHERE resolved_at IS NULL',
        (err: Error | null, row: { count: number } | undefined) => {
          if (err) {
            console.error('Error counting conflicts:', err);
            resolve(0);
          } else {
            resolve(row?.count || 0);
          }
        }
      );
    });
  }

  /**
   * Start automatic sync timer
   */
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      if (!this.state.syncInProgress) {
        try {
          await this.runSync();
        } catch (err) {
          console.error('Auto-sync failed:', err);
        }
      }
    }, this.config.autoSyncIntervalMs);

    console.log(`Auto-sync started with interval: ${this.config.autoSyncIntervalMs}ms`);
  }

  /**
   * Stop automatic sync timer
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Main sync method - orchestrates push and pull
   */
  async runSync(): Promise<SyncResult> {
    if (this.state.syncInProgress) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        pushed: 0,
        pulled: 0,
        conflicts: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.state.syncInProgress = true;
    this.emitEvent(SYNC_IPC_CHANNELS.SYNC_STARTED, { timestamp: new Date().toISOString() });

    const result: SyncResult = {
      success: false,
      timestamp: new Date().toISOString(),
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: [],
    };

    const syncLogId = await this.startSyncLog('full');

    try {
      // Check server connectivity
      const serverReachable = await this.checkServerConnectivity();
      this.state.serverReachable = serverReachable;

      if (!serverReachable) {
        throw new Error('Server not reachable');
      }

      // Push pending changes
      const pushResult = await this.pushPendingSessions();
      result.pushed = pushResult.pushed;
      result.conflicts += pushResult.conflicts;
      result.errors.push(...pushResult.errors);

      // Pull updates from server
      const pullResult = await this.pullUpdates();
      result.pulled = pullResult.pulled;
      result.errors.push(...pullResult.errors);

      // Update sync state
      result.success = result.errors.length === 0;
      result.timestamp = new Date().toISOString();
      this.state.lastSyncTimestamp = result.timestamp;
      this.state.lastError = result.errors.length > 0 ? result.errors[0] : null;

      // Persist last sync timestamp
      await this.setSyncConfig('last_sync_timestamp', result.timestamp);

      // Reset retry count on success
      this.retryCount = 0;

      // Update sync log
      await this.completeSyncLog(syncLogId, result.success ? 'success' : 'partial', result);

    } catch (err) {
      const error = err as Error;
      result.errors.push(error.message);
      this.state.lastError = error.message;

      // Update sync log with failure
      await this.completeSyncLog(syncLogId, 'failed', result, error.message);

      // Schedule retry with exponential backoff
      this.scheduleRetry();

    } finally {
      this.state.syncInProgress = false;
      this.state.pendingCount = await this.countPendingRecords();
      this.state.conflictCount = await this.countUnresolvedConflicts();

      this.emitEvent(SYNC_IPC_CHANNELS.SYNC_COMPLETED, result);
      this.emitEvent(SYNC_IPC_CHANNELS.SYNC_STATE_CHANGED, this.state);
    }

    return result;
  }

  /**
   * Push pending sessions to server
   */
  private async pushPendingSessions(): Promise<{ pushed: number; conflicts: number; errors: string[] }> {
    const result = { pushed: 0, conflicts: 0, errors: [] as string[] };

    // Get pending sessions
    const pendingSessions = await this.getPendingSessions();

    if (pendingSessions.length === 0) {
      return result;
    }

    console.log(`Pushing ${pendingSessions.length} pending sessions`);

    // In Phase 1, we just simulate the push - actual HTTP calls come in Phase 2
    // For now, mark as "ready to sync" and log the operation
    for (const session of pendingSessions) {
      try {
        // Simulate successful push (Phase 2 will have actual HTTP)
        await this.markSessionSynced(session.id);
        result.pushed++;
      } catch (err) {
        const error = err as Error;
        result.errors.push(`Failed to sync session ${session.id}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Get sessions pending sync
   */
  private async getPendingSessions(): Promise<SyncableSession[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT
          id, client, project, task, start_time, end_time,
          active_ms, paused_ms, notes, created_at, is_billable,
          user_id, is_manually_created, sync_status, version,
          origin_client_id, client_timestamp, deleted_at
         FROM sessions
         WHERE sync_status = 'pending' AND deleted_at IS NULL
         LIMIT ?`,
        [this.config.batchSize],
        (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const sessions: SyncableSession[] = (rows || []).map(row => ({
              id: row.id,
              uuid: row.id, // Sessions already use UUID as id
              client: row.client,
              project: row.project,
              task: row.task,
              start_time: row.start_time,
              end_time: row.end_time,
              active_ms: row.active_ms,
              paused_ms: row.paused_ms,
              notes: row.notes,
              created_at: row.created_at,
              is_billable: Boolean(row.is_billable),
              user_id: row.user_id,
              is_manually_created: Boolean(row.is_manually_created),
              sync_status: row.sync_status as SyncStatus,
              version: row.version || 1,
              origin_client_id: row.origin_client_id || this.clientId,
              client_timestamp: row.client_timestamp,
              deleted_at: row.deleted_at,
            }));
            resolve(sessions);
          }
        }
      );
    });
  }

  /**
   * Mark a session as synced
   */
  private async markSessionSynced(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE sessions
         SET sync_status = 'synced', last_synced_at = ?
         WHERE id = ?`,
        [Date.now(), sessionId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Pull updates from server
   */
  private async pullUpdates(): Promise<{ pulled: number; errors: string[] }> {
    // Phase 1: Stub implementation
    // Phase 2 will implement actual HTTP pull from PostgreSQL
    return { pulled: 0, errors: [] };
  }

  /**
   * Check server connectivity
   */
  private async checkServerConnectivity(): Promise<boolean> {
    // Phase 1: Always return false (no server configured yet)
    // Phase 2 will implement actual connectivity check
    if (!this.serverConfig) {
      console.log('No server configured - sync will queue locally');
      return false;
    }
    return false;
  }

  /**
   * Schedule a retry with exponential backoff
   */
  private scheduleRetry(): void {
    if (this.retryCount >= this.config.maxRetries) {
      console.log('Max retries reached, waiting for next auto-sync');
      return;
    }

    const backoffMs = this.config.retryBackoffMs[
      Math.min(this.retryCount, this.config.retryBackoffMs.length - 1)
    ];

    console.log(`Scheduling retry in ${backoffMs}ms (attempt ${this.retryCount + 1})`);

    setTimeout(async () => {
      this.retryCount++;
      try {
        await this.runSync();
      } catch (err) {
        console.error('Retry failed:', err);
      }
    }, backoffMs);
  }

  /**
   * Start a sync log entry
   */
  private async startSyncLog(syncType: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO sync_log (sync_type, started_at, status)
         VALUES (?, ?, 'started')`,
        [syncType, Date.now()],
        function(this: { lastID: number }, err: Error | null) {
          if (err) {
            console.error('Failed to start sync log:', err);
            resolve(0);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Complete a sync log entry
   */
  private async completeSyncLog(
    logId: number,
    status: string,
    result: SyncResult,
    errorMessage?: string
  ): Promise<void> {
    if (logId === 0) return;

    return new Promise((resolve) => {
      this.db.run(
        `UPDATE sync_log
         SET completed_at = ?, status = ?, records_pushed = ?,
             records_pulled = ?, conflicts_detected = ?, error_message = ?
         WHERE id = ?`,
        [
          Date.now(),
          status,
          result.pushed,
          result.pulled,
          result.conflicts,
          errorMessage || null,
          logId,
        ],
        (err: Error | null) => {
          if (err) {
            console.error('Failed to complete sync log:', err);
          }
          resolve();
        }
      );
    });
  }

  /**
   * Emit an event to the renderer process
   */
  private emitEvent(channel: string, data: unknown): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit(channel, data);
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Get sync health status
   */
  getHealthStatus(): SyncHealthStatus {
    let minutesSinceLastSync: number | null = null;
    let status: SyncHealthStatus['status'] = 'offline';

    if (this.state.lastSyncTimestamp) {
      const lastSync = new Date(this.state.lastSyncTimestamp);
      minutesSinceLastSync = Math.floor((Date.now() - lastSync.getTime()) / 60000);

      if (this.state.serverReachable) {
        if (minutesSinceLastSync < 30) {
          status = 'healthy';
        } else if (minutesSinceLastSync < 120) {
          status = 'warning';
        } else {
          status = 'critical';
        }
      }
    }

    return {
      status,
      lastSync: this.state.lastSyncTimestamp,
      minutesSinceLastSync,
      pendingRecords: this.state.pendingCount,
      unresolvedConflicts: this.state.conflictCount,
      serverConnected: this.state.serverReachable,
    };
  }

  /**
   * Update sync configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart auto-sync with new interval if changed
    if (config.autoSyncIntervalMs !== undefined) {
      this.stopAutoSync();
      if (this.config.enabled && this.config.autoSyncIntervalMs > 0) {
        this.startAutoSync();
      }
    }
  }

  /**
   * Configure server connection
   */
  setServerConfig(config: ServerConfig): void {
    this.serverConfig = config;
    console.log('Server configured:', config.host);
  }

  /**
   * Soft delete a session (marks for sync deletion)
   */
  async softDeleteSession(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE sessions
         SET deleted_at = ?, sync_status = 'pending', version = version + 1
         WHERE id = ?`,
        [Date.now(), sessionId],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get unresolved conflicts
   */
  async getConflicts(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY detected_at DESC`,
        (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    conflictId: number,
    resolution: 'keep_local' | 'keep_server' | 'manual',
    notes?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE sync_conflicts
         SET resolved_at = ?, resolution = ?, resolution_notes = ?
         WHERE id = ?`,
        [Date.now(), resolution, notes || null, conflictId],
        (err: Error | null) => {
          if (err) reject(err);
          else {
            this.state.conflictCount = Math.max(0, this.state.conflictCount - 1);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoSync();
    this.eventEmitter = null;
  }
}

// Export singleton factory
let syncServiceInstance: SyncService | null = null;

export function getSyncService(db?: DatabaseInstance, config?: Partial<SyncConfig>): SyncService {
  if (!syncServiceInstance && db) {
    syncServiceInstance = new SyncService(db, config);
  }
  if (!syncServiceInstance) {
    throw new Error('SyncService not initialized. Call getSyncService(db) first.');
  }
  return syncServiceInstance;
}

export function destroySyncService(): void {
  if (syncServiceInstance) {
    syncServiceInstance.destroy();
    syncServiceInstance = null;
  }
}
