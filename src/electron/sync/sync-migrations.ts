/**
 * SQLite migrations for distributed sync support
 * Tshifhinga Time Tracker
 */

import { CURRENT_SCHEMA_VERSION } from './sync-types';

export interface Migration {
  version: number;
  description: string;
  up: string[];
  down: string[];
}

/**
 * All migrations for sync support
 * Migrations are applied in order based on version number
 */
export const SYNC_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Add sync metadata columns and schema versioning',
    up: [
      // Schema version tracking table
      `CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        description TEXT,
        applied_at INTEGER NOT NULL,
        applied_by TEXT
      )`,

      // Sync configuration table
      `CREATE TABLE IF NOT EXISTS sync_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,

      // Client identification table
      `CREATE TABLE IF NOT EXISTS client_identity (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        client_uuid TEXT NOT NULL,
        machine_id TEXT,
        install_date INTEGER NOT NULL,
        app_version TEXT
      )`,

      // Add sync columns to sessions table
      `ALTER TABLE sessions ADD COLUMN sync_status TEXT DEFAULT 'pending'`,
      `ALTER TABLE sessions ADD COLUMN server_id TEXT`,
      `ALTER TABLE sessions ADD COLUMN last_synced_at INTEGER`,
      `ALTER TABLE sessions ADD COLUMN version INTEGER DEFAULT 1`,
      `ALTER TABLE sessions ADD COLUMN deleted_at INTEGER`,
      `ALTER TABLE sessions ADD COLUMN origin_client_id TEXT`,
      `ALTER TABLE sessions ADD COLUMN client_timestamp INTEGER`,

      // Add sync columns to clients table
      `ALTER TABLE clients ADD COLUMN uuid TEXT`,
      `ALTER TABLE clients ADD COLUMN sync_status TEXT DEFAULT 'pending'`,
      `ALTER TABLE clients ADD COLUMN server_id INTEGER`,
      `ALTER TABLE clients ADD COLUMN last_synced_at INTEGER`,
      `ALTER TABLE clients ADD COLUMN version INTEGER DEFAULT 1`,
      `ALTER TABLE clients ADD COLUMN deleted_at INTEGER`,

      // Add sync columns to projects table
      `ALTER TABLE projects ADD COLUMN uuid TEXT`,
      `ALTER TABLE projects ADD COLUMN sync_status TEXT DEFAULT 'pending'`,
      `ALTER TABLE projects ADD COLUMN server_id INTEGER`,
      `ALTER TABLE projects ADD COLUMN last_synced_at INTEGER`,
      `ALTER TABLE projects ADD COLUMN version INTEGER DEFAULT 1`,
      `ALTER TABLE projects ADD COLUMN deleted_at INTEGER`,

      // Add sync columns to tasks table
      `ALTER TABLE tasks ADD COLUMN uuid TEXT`,
      `ALTER TABLE tasks ADD COLUMN sync_status TEXT DEFAULT 'pending'`,
      `ALTER TABLE tasks ADD COLUMN server_id INTEGER`,
      `ALTER TABLE tasks ADD COLUMN last_synced_at INTEGER`,
      `ALTER TABLE tasks ADD COLUMN version INTEGER DEFAULT 1`,
      `ALTER TABLE tasks ADD COLUMN deleted_at INTEGER`,

      // Add sync columns to users table
      `ALTER TABLE users ADD COLUMN uuid TEXT`,
      `ALTER TABLE users ADD COLUMN server_id INTEGER`,
      `ALTER TABLE users ADD COLUMN last_synced_at INTEGER`,
      `ALTER TABLE users ADD COLUMN version INTEGER DEFAULT 1`,
      `ALTER TABLE users ADD COLUMN deleted_at INTEGER`,

      // Add sync columns to user_project_permissions table
      `ALTER TABLE user_project_permissions ADD COLUMN uuid TEXT`,
      `ALTER TABLE user_project_permissions ADD COLUMN sync_status TEXT DEFAULT 'pending'`,
      `ALTER TABLE user_project_permissions ADD COLUMN server_id INTEGER`,
      `ALTER TABLE user_project_permissions ADD COLUMN last_synced_at INTEGER`,
      `ALTER TABLE user_project_permissions ADD COLUMN version INTEGER DEFAULT 1`,
      `ALTER TABLE user_project_permissions ADD COLUMN deleted_at INTEGER`,

      // Create sync queue table for pending operations
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        data TEXT,
        created_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        priority INTEGER DEFAULT 0
      )`,

      // Create sync log table
      `CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL CHECK (sync_type IN ('push', 'pull', 'full')),
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        status TEXT NOT NULL CHECK (status IN ('started', 'success', 'partial', 'failed')),
        records_pushed INTEGER DEFAULT 0,
        records_pulled INTEGER DEFAULT 0,
        conflicts_detected INTEGER DEFAULT 0,
        error_message TEXT
      )`,

      // Create conflicts table
      `CREATE TABLE IF NOT EXISTS sync_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        local_data TEXT NOT NULL,
        server_data TEXT NOT NULL,
        conflict_type TEXT NOT NULL,
        detected_at INTEGER NOT NULL,
        resolved_at INTEGER,
        resolution TEXT,
        resolution_notes TEXT
      )`,

      // Create notifications table
      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL,
        read_at INTEGER,
        is_dismissed INTEGER DEFAULT 0
      )`,

      // Create indexes for sync queries
      `CREATE INDEX IF NOT EXISTS idx_sessions_sync_status ON sessions(sync_status)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON sessions(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name, record_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority DESC, created_at ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved ON sync_conflicts(resolved_at) WHERE resolved_at IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(read_at) WHERE read_at IS NULL`,
    ],
    down: [
      // Note: SQLite doesn't support DROP COLUMN directly
      // These would require table recreation in a real rollback scenario
      `DROP TABLE IF EXISTS sync_config`,
      `DROP TABLE IF EXISTS client_identity`,
      `DROP TABLE IF EXISTS sync_queue`,
      `DROP TABLE IF EXISTS sync_log`,
      `DROP TABLE IF EXISTS sync_conflicts`,
      `DROP TABLE IF EXISTS notifications`,
      `DROP TABLE IF EXISTS schema_versions`,
      `DROP INDEX IF EXISTS idx_sessions_sync_status`,
      `DROP INDEX IF EXISTS idx_sessions_deleted_at`,
      `DROP INDEX IF EXISTS idx_sync_queue_table`,
      `DROP INDEX IF EXISTS idx_sync_queue_priority`,
      `DROP INDEX IF EXISTS idx_sync_conflicts_unresolved`,
      `DROP INDEX IF EXISTS idx_notifications_unread`,
    ],
  },
];

/**
 * Migration runner class
 */
export class SyncMigrationRunner {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Get current schema version from database
   */
  async getCurrentVersion(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT MAX(version) as version FROM schema_versions',
        (err: Error | null, row: { version: number } | undefined) => {
          if (err) {
            // Table might not exist yet
            if (err.message.includes('no such table')) {
              resolve(0);
            } else {
              reject(err);
            }
          } else {
            resolve(row?.version || 0);
          }
        }
      );
    });
  }

  /**
   * Run a single SQL statement
   */
  private runStatement(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, (err: Error | null) => {
        if (err) {
          // Ignore "column already exists" errors for ALTER TABLE
          if (err.message.includes('duplicate column name')) {
            console.log(`Column already exists, skipping: ${sql.substring(0, 60)}...`);
            resolve();
          } else if (err.message.includes('already exists')) {
            console.log(`Object already exists, skipping: ${sql.substring(0, 60)}...`);
            resolve();
          } else {
            reject(err);
          }
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Record that a migration was applied
   */
  private async recordMigration(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO schema_versions (version, description, applied_at, applied_by) VALUES (?, ?, ?, ?)',
        [migration.version, migration.description, Date.now(), 'sync_migration_runner'],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<{ applied: number; errors: string[] }> {
    const currentVersion = await this.getCurrentVersion();
    const pendingMigrations = SYNC_MIGRATIONS.filter(m => m.version > currentVersion);

    console.log(`Current schema version: ${currentVersion}`);
    console.log(`Pending migrations: ${pendingMigrations.length}`);

    const errors: string[] = [];
    let applied = 0;

    for (const migration of pendingMigrations) {
      console.log(`Applying migration ${migration.version}: ${migration.description}`);

      try {
        for (const sql of migration.up) {
          await this.runStatement(sql);
        }
        await this.recordMigration(migration);
        applied++;
        console.log(`Migration ${migration.version} applied successfully`);
      } catch (err) {
        const error = err as Error;
        errors.push(`Migration ${migration.version} failed: ${error.message}`);
        console.error(`Migration ${migration.version} failed:`, error);
        // Stop on first error
        break;
      }
    }

    return { applied, errors };
  }

  /**
   * Check if sync tables are ready
   */
  async isSyncReady(): Promise<boolean> {
    const currentVersion = await this.getCurrentVersion();
    return currentVersion >= CURRENT_SCHEMA_VERSION.minimum;
  }

  /**
   * Generate UUIDs for existing records that don't have them
   */
  async generateMissingUUIDs(): Promise<void> {
    const tables = ['clients', 'projects', 'tasks', 'users', 'user_project_permissions'];

    for (const table of tables) {
      await new Promise<void>((resolve, reject) => {
        // Use SQLite's randomblob to generate UUID-like strings
        this.db.run(
          `UPDATE ${table} SET uuid = lower(hex(randomblob(4))) || '-' ||
           lower(hex(randomblob(2))) || '-4' ||
           substr(lower(hex(randomblob(2))),2) || '-' ||
           substr('89ab', abs(random()) % 4 + 1, 1) ||
           substr(lower(hex(randomblob(2))),2) || '-' ||
           lower(hex(randomblob(6)))
           WHERE uuid IS NULL`,
          (err: Error | null) => {
            if (err) {
              console.error(`Failed to generate UUIDs for ${table}:`, err);
              reject(err);
            } else {
              console.log(`Generated UUIDs for ${table}`);
              resolve();
            }
          }
        );
      });
    }
  }
}
