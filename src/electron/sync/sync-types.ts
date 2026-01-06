/**
 * Type definitions for distributed sync system
 * Tshifhinga Time Tracker
 */

// ============================================
// SYNC STATUS ENUM
// ============================================

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';

// ============================================
// SERVER CONFIGURATION
// ============================================

export interface ServerConfig {
  host: string;
  port: number;
  dbName: string;
  ssl?: boolean;
  connectionTimeout?: number;
}

export interface DiscoveryConfig {
  methods: DiscoveryMethod[];
  fallbackStaticIps?: string[];
}

export interface DiscoveryMethod {
  type: 'dns' | 'mdns' | 'static' | 'config_file';
  value: string; // hostname, service name, IP, or file path
  priority: number;
}

// ============================================
// SYNC METADATA
// ============================================

export interface SyncMetadata {
  sync_status: SyncStatus;
  server_id?: string;
  last_synced_at?: number;
  version: number;
  deleted_at?: number;
  origin_client_id?: string;
  client_timestamp?: number;
}

// ============================================
// SYNC REQUEST/RESPONSE
// ============================================

export interface SyncRequest {
  client_id: string;
  client_version: string;
  schema_version: number;
  last_pull_timestamp: string | null;
  push_data: SyncPushData;
}

export interface SyncPushData {
  sessions: SyncableSession[];
  // Future: clients, projects, tasks for admin users
}

export interface SyncResponse {
  status: 'success' | 'partial' | 'error';
  server_timestamp: string;
  schema_version: number;
  min_client_version: string;
  push_results: PushResults;
  pull_data: PullData;
  notifications: SyncNotification[];
}

export interface PushResults {
  accepted: string[]; // UUIDs of accepted records
  conflicts: SyncConflict[];
  rejected: RejectedRecord[];
}

export interface SyncConflict {
  record_id: string;
  table_name: string;
  conflict_type: 'version_mismatch' | 'deleted_modified' | 'duplicate';
  local_version: number;
  server_version: number;
  server_data?: Record<string, unknown>;
}

export interface RejectedRecord {
  record_id: string;
  reason: string;
  code: 'validation_error' | 'unauthorized' | 'rate_limited' | 'server_error';
}

export interface PullData {
  clients: SyncableClient[];
  projects: SyncableProject[];
  tasks: SyncableTask[];
  permissions: SyncablePermission[];
}

export interface SyncNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  created_at: string;
}

// ============================================
// SYNCABLE RECORD TYPES
// ============================================

export interface BaseSyncable {
  uuid: string;
  version: number;
  deleted_at?: number | null;
  updated_at?: number;
}

export interface SyncableSession extends BaseSyncable {
  id: string; // Same as uuid for sessions
  client: string;
  project: string;
  task: string;
  start_time: number;
  end_time?: number;
  active_ms: number;
  paused_ms: number;
  notes?: string;
  created_at: number;
  is_billable: boolean;
  user_id: number;
  is_manually_created?: boolean;
  // Reliability tracking
  actual_end_time?: number;
  end_reason?: string;
  reliability_score?: number;
  // Sync metadata
  sync_status: SyncStatus;
  origin_client_id?: string;
  client_timestamp?: number;
}

export interface SyncableClient extends BaseSyncable {
  id: number;
  name: string;
  created_at: number;
}

export interface SyncableProject extends BaseSyncable {
  id: number;
  name: string;
  client_id: number;
  client_name?: string;
  created_at: number;
}

export interface SyncableTask extends BaseSyncable {
  id: number;
  name: string;
  project_id: number;
  project_name?: string;
  created_at: number;
}

export interface SyncablePermission extends BaseSyncable {
  id: number;
  user_id: number;
  project_id: number;
  permission_level: 'view' | 'track_time' | 'edit' | 'admin';
  can_track_time: boolean;
  granted_by?: number;
  created_at: number;
  revoked_at?: number;
  is_active: boolean;
}

// ============================================
// SYNC SERVICE TYPES
// ============================================

export interface SyncResult {
  success: boolean;
  timestamp: string;
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

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

// ============================================
// SCHEMA VERSION
// ============================================

export interface SchemaVersion {
  current: number;
  minimum: number;
}

export const CURRENT_SCHEMA_VERSION: SchemaVersion = {
  current: 1,
  minimum: 1,
};

// ============================================
// CLIENT IDENTIFICATION
// ============================================

export interface ClientIdentifier {
  id: string; // UUID generated per installation
  machineId: string; // Hardware identifier
  installDate: string;
  appVersion: string;
}

// ============================================
// SYNC CONFIGURATION
// ============================================

export interface SyncConfig {
  enabled: boolean;
  autoSyncIntervalMs: number; // Default: 15 minutes
  retryBackoffMs: number[]; // Exponential backoff intervals
  maxRetries: number;
  batchSize: number; // Max records per sync
  conflictResolution: 'last_write_wins' | 'server_wins' | 'manual';
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: true,
  autoSyncIntervalMs: 15 * 60 * 1000, // 15 minutes
  retryBackoffMs: [30000, 60000, 120000, 300000, 900000], // 30s, 1m, 2m, 5m, 15m
  maxRetries: 5,
  batchSize: 1000,
  conflictResolution: 'last_write_wins',
};

// ============================================
// IPC CHANNEL NAMES
// ============================================

export const SYNC_IPC_CHANNELS = {
  // Renderer -> Main
  SYNC_NOW: 'sync:now',
  GET_SYNC_STATE: 'sync:get-state',
  GET_SYNC_HEALTH: 'sync:get-health',
  RESOLVE_CONFLICT: 'sync:resolve-conflict',
  GET_CONFLICTS: 'sync:get-conflicts',
  UPDATE_CONFIG: 'sync:update-config',

  // Main -> Renderer
  SYNC_STARTED: 'sync:started',
  SYNC_PROGRESS: 'sync:progress',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_ERROR: 'sync:error',
  SYNC_STATE_CHANGED: 'sync:state-changed',
  NEW_NOTIFICATION: 'sync:new-notification',
} as const;
