import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnectionPool } from './database-connection-pool';
import { LoggerService } from './logger-service';
import { ConfigService } from './config-service';

interface Migration {
  version: number;
  name: string;
  up: string[];
  down: string[];
  description?: string;
}

interface MigrationRecord {
  version: number;
  name: string;
  executed_at: number;
  checksum: string;
}

class MigrationService {
  private static instance: MigrationService;
  private pool: DatabaseConnectionPool;
  private logger: LoggerService;
  private config: ConfigService;
  private migrations: Migration[] = [];

  private constructor() {
    this.pool = DatabaseConnectionPool.getInstance();
    this.logger = LoggerService.getInstance();
    this.config = ConfigService.getInstance();
    this.initializeMigrations();
  }

  public static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  private initializeMigrations(): void {
    // Define all migrations in order
    this.migrations = [
      {
        version: 1,
        name: 'initial_schema',
        description: 'Create initial database schema',
        up: [
          `CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            executed_at INTEGER NOT NULL,
            checksum TEXT NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            client_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            UNIQUE(name, client_id)
          )`,
          `CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            project_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(name, project_id)
          )`,
          `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            is_active BOOLEAN DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`,
          `CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            client TEXT NOT NULL,
            project TEXT NOT NULL,
            task TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            active_ms INTEGER NOT NULL DEFAULT 0,
            paused_ms INTEGER NOT NULL DEFAULT 0,
            notes TEXT,
            created_at INTEGER NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_billable BOOLEAN DEFAULT 1,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
          )`
        ],
        down: [
          'DROP TABLE IF EXISTS sessions',
          'DROP TABLE IF EXISTS users',
          'DROP TABLE IF EXISTS tasks',
          'DROP TABLE IF EXISTS projects',
          'DROP TABLE IF EXISTS clients'
        ]
      },
      {
        version: 2,
        name: 'add_user_project_permissions',
        description: 'Add user project permissions table',
        up: [
          `CREATE TABLE IF NOT EXISTS user_project_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL,
            can_track_time BOOLEAN DEFAULT 1,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(user_id, project_id)
          )`
        ],
        down: [
          'DROP TABLE IF EXISTS user_project_permissions'
        ]
      },
      {
        version: 3,
        name: 'add_enhanced_user_fields',
        description: 'Add enhanced user profile fields',
        up: [
          `ALTER TABLE users ADD COLUMN name TEXT`,
          `ALTER TABLE users ADD COLUMN surname TEXT`,
          `ALTER TABLE users ADD COLUMN team TEXT`,
          `ALTER TABLE users ADD COLUMN region TEXT`,
          `ALTER TABLE users ADD COLUMN job_level TEXT`,
          `ALTER TABLE users ADD COLUMN billable_rate REAL DEFAULT 0`,
          `ALTER TABLE users ADD COLUMN discount_percentage REAL DEFAULT 0`,
          `ALTER TABLE users ADD COLUMN target_utilization REAL DEFAULT 80`
        ],
        down: [
          // SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
          // For now, we'll leave the columns as they don't hurt
        ]
      },
      {
        version: 4,
        name: 'add_configuration_tables',
        description: 'Add configuration tables for teams, regions, and job levels',
        up: [
          `CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at INTEGER NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS regions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            code TEXT NOT NULL UNIQUE,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at INTEGER NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS job_levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            level_order INTEGER,
            is_active BOOLEAN DEFAULT 1,
            created_at INTEGER NOT NULL
          )`,
          `CREATE TABLE IF NOT EXISTS billable_rates_by_job_level (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_level_code TEXT NOT NULL,
            rate_zar_per_hour REAL NOT NULL,
            effective_from DATE NOT NULL,
            effective_to DATE,
            is_active BOOLEAN DEFAULT 1,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (job_level_code) REFERENCES job_levels(code) ON DELETE CASCADE
          )`
        ],
        down: [
          'DROP TABLE IF EXISTS billable_rates_by_job_level',
          'DROP TABLE IF EXISTS job_levels',
          'DROP TABLE IF EXISTS regions',
          'DROP TABLE IF EXISTS teams'
        ]
      },
      {
        version: 5,
        name: 'add_database_indexes',
        description: 'Add performance indexes',
        up: [
          'CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client)',
          'CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project)',
          'CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)',
          'CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)',
          'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)',
          'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)',
          'CREATE INDEX IF NOT EXISTS idx_user_project_permissions_user_id ON user_project_permissions(user_id)',
          'CREATE INDEX IF NOT EXISTS idx_user_project_permissions_project_id ON user_project_permissions(project_id)',
          'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
          'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
          'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
          'CREATE INDEX IF NOT EXISTS idx_billable_rates_job_level ON billable_rates_by_job_level(job_level_code)',
          'CREATE INDEX IF NOT EXISTS idx_billable_rates_effective ON billable_rates_by_job_level(effective_from, effective_to)'
        ],
        down: [
          'DROP INDEX IF EXISTS idx_sessions_client',
          'DROP INDEX IF EXISTS idx_sessions_project',
          'DROP INDEX IF EXISTS idx_sessions_start_time',
          'DROP INDEX IF EXISTS idx_sessions_created_at',
          'DROP INDEX IF EXISTS idx_sessions_user_id',
          'DROP INDEX IF EXISTS idx_projects_client_id',
          'DROP INDEX IF EXISTS idx_tasks_project_id',
          'DROP INDEX IF EXISTS idx_user_project_permissions_user_id',
          'DROP INDEX IF EXISTS idx_user_project_permissions_project_id',
          'DROP INDEX IF EXISTS idx_users_email',
          'DROP INDEX IF EXISTS idx_users_username',
          'DROP INDEX IF EXISTS idx_users_role',
          'DROP INDEX IF EXISTS idx_billable_rates_job_level',
          'DROP INDEX IF EXISTS idx_billable_rates_effective'
        ]
      },
      {
        version: 6,
        name: 'add_analytics_summary_tables',
        description: 'Add analytics summary tables for pre-calculated metrics',
        up: [
          `CREATE TABLE IF NOT EXISTS analytics_daily_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE NOT NULL,
            user_id INTEGER,
            client TEXT NOT NULL,
            project TEXT NOT NULL,
            task TEXT NOT NULL,
            total_hours REAL NOT NULL DEFAULT 0,
            billable_hours REAL NOT NULL DEFAULT 0,
            session_count INTEGER NOT NULL DEFAULT 0,
            revenue REAL NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE(date, user_id, client, project, task)
          )`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily_summary(date)`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_daily_user ON analytics_daily_summary(user_id)`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_daily_client ON analytics_daily_summary(client)`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_daily_composite ON analytics_daily_summary(date, user_id, client)`
        ],
        down: [
          `DROP INDEX IF EXISTS idx_analytics_daily_composite`,
          `DROP INDEX IF EXISTS idx_analytics_daily_client`,
          `DROP INDEX IF EXISTS idx_analytics_daily_user`,
          `DROP INDEX IF EXISTS idx_analytics_daily_date`,
          `DROP TABLE IF EXISTS analytics_daily_summary`
        ]
      },
      {
        version: 7,
        name: 'add_analytics_monthly_summary',
        description: 'Add monthly analytics summary tables',
        up: [
          `CREATE TABLE IF NOT EXISTS analytics_monthly_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            user_id INTEGER,
            client TEXT NOT NULL,
            total_hours REAL NOT NULL DEFAULT 0,
            billable_hours REAL NOT NULL DEFAULT 0,
            session_count INTEGER NOT NULL DEFAULT 0,
            revenue REAL NOT NULL DEFAULT 0,
            avg_session_length REAL NOT NULL DEFAULT 0,
            utilization_rate REAL NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE(year, month, user_id, client)
          )`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_monthly_date ON analytics_monthly_summary(year, month)`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_monthly_user ON analytics_monthly_summary(user_id)`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_monthly_client ON analytics_monthly_summary(client)`
        ],
        down: [
          `DROP INDEX IF EXISTS idx_analytics_monthly_client`,
          `DROP INDEX IF EXISTS idx_analytics_monthly_user`,
          `DROP INDEX IF EXISTS idx_analytics_monthly_date`,
          `DROP TABLE IF EXISTS analytics_monthly_summary`
        ]
      },
      {
        version: 8,
        name: 'add_analytics_team_summary',
        description: 'Add team analytics summary tables',
        up: [
          `CREATE TABLE IF NOT EXISTS analytics_team_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE NOT NULL,
            team TEXT NOT NULL,
            region TEXT,
            total_members INTEGER NOT NULL DEFAULT 0,
            active_members INTEGER NOT NULL DEFAULT 0,
            total_hours REAL NOT NULL DEFAULT 0,
            billable_hours REAL NOT NULL DEFAULT 0,
            total_revenue REAL NOT NULL DEFAULT 0,
            avg_utilization REAL NOT NULL DEFAULT 0,
            avg_productivity_score REAL NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(date, team, region)
          )`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_team_date ON analytics_team_summary(date)`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_team_team ON analytics_team_summary(team)`,
          `CREATE INDEX IF NOT EXISTS idx_analytics_team_region ON analytics_team_summary(region)`
        ],
        down: [
          `DROP INDEX IF EXISTS idx_analytics_team_region`,
          `DROP INDEX IF EXISTS idx_analytics_team_team`,
          `DROP INDEX IF EXISTS idx_analytics_team_date`,
          `DROP TABLE IF EXISTS analytics_team_summary`
        ]
      },
      {
        version: 9,
        name: 'add_analytics_materialized_views',
        description: 'Add materialized views for common analytics queries',
        up: [
          // User daily metrics view
          `CREATE VIEW IF NOT EXISTS view_user_daily_metrics AS
          SELECT 
            s.user_id,
            DATE(s.start_time / 1000, 'unixepoch') as date,
            s.client,
            s.project,
            COUNT(*) as session_count,
            SUM(s.active_ms) / (1000.0 * 60 * 60) as total_hours,
            SUM(CASE WHEN s.is_billable = 1 THEN s.active_ms ELSE 0 END) / (1000.0 * 60 * 60) as billable_hours,
            AVG(s.active_ms) / (1000.0 * 60 * 60) as avg_session_length_hours,
            SUM(CASE WHEN s.is_billable = 1 THEN 
              (s.active_ms / (1000.0 * 60 * 60)) * COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0)
              ELSE 0 END) as revenue
          FROM sessions s
          LEFT JOIN users u ON s.user_id = u.id
          WHERE s.user_id IS NOT NULL
          GROUP BY s.user_id, DATE(s.start_time / 1000, 'unixepoch'), s.client, s.project`,

          // Client profitability view
          `CREATE VIEW IF NOT EXISTS view_client_profitability AS
          SELECT 
            s.client,
            s.user_id,
            COUNT(*) as session_count,
            SUM(s.active_ms) / (1000.0 * 60 * 60) as total_hours,
            SUM(CASE WHEN s.is_billable = 1 THEN s.active_ms ELSE 0 END) / (1000.0 * 60 * 60) as billable_hours,
            SUM(CASE WHEN s.is_billable = 1 THEN 
              (s.active_ms / (1000.0 * 60 * 60)) * COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0)
              ELSE 0 END) as revenue,
            SUM(CASE WHEN s.is_billable = 1 THEN 
              (s.active_ms / (1000.0 * 60 * 60)) * COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0) * 0.7
              ELSE 0 END) as estimated_cost
          FROM sessions s
          LEFT JOIN users u ON s.user_id = u.id
          GROUP BY s.client, s.user_id`,

          // Team performance aggregated view
          `CREATE VIEW IF NOT EXISTS view_team_performance AS
          SELECT 
            u.team,
            u.region,
            DATE(s.start_time / 1000, 'unixepoch') as date,
            COUNT(DISTINCT u.id) as team_members,
            COUNT(DISTINCT CASE WHEN s.active_ms > 0 THEN u.id END) as active_members,
            SUM(s.active_ms) / (1000.0 * 60 * 60) as total_hours,
            SUM(CASE WHEN s.is_billable = 1 THEN s.active_ms ELSE 0 END) / (1000.0 * 60 * 60) as billable_hours,
            SUM(CASE WHEN s.is_billable = 1 THEN 
              (s.active_ms / (1000.0 * 60 * 60)) * COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0)
              ELSE 0 END) as total_revenue
          FROM users u
          LEFT JOIN sessions s ON u.id = s.user_id
          WHERE u.is_active = 1 AND u.team IS NOT NULL
          GROUP BY u.team, u.region, DATE(s.start_time / 1000, 'unixepoch')`,

          // Monthly trend aggregation view
          `CREATE VIEW IF NOT EXISTS view_monthly_trends AS
          SELECT 
            strftime('%Y', datetime(s.start_time / 1000, 'unixepoch')) as year,
            strftime('%m', datetime(s.start_time / 1000, 'unixepoch')) as month,
            s.user_id,
            s.client,
            COUNT(*) as session_count,
            SUM(s.active_ms) / (1000.0 * 60 * 60) as total_hours,
            SUM(CASE WHEN s.is_billable = 1 THEN s.active_ms ELSE 0 END) / (1000.0 * 60 * 60) as billable_hours,
            SUM(CASE WHEN s.is_billable = 1 THEN 
              (s.active_ms / (1000.0 * 60 * 60)) * COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0)
              ELSE 0 END) as revenue,
            AVG(CASE WHEN s.is_billable = 1 AND s.active_ms > 0 THEN 
              (s.active_ms / (1000.0 * 60 * 60)) * COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0) / (s.active_ms / (1000.0 * 60 * 60))
              ELSE COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0) END) as avg_hourly_rate
          FROM sessions s
          LEFT JOIN users u ON s.user_id = u.id
          WHERE s.start_time IS NOT NULL
          GROUP BY strftime('%Y', datetime(s.start_time / 1000, 'unixepoch')), 
                   strftime('%m', datetime(s.start_time / 1000, 'unixepoch')), 
                   s.user_id, s.client`
        ],
        down: [
          `DROP VIEW IF EXISTS view_monthly_trends`,
          `DROP VIEW IF EXISTS view_team_performance`,
          `DROP VIEW IF EXISTS view_client_profitability`,
          `DROP VIEW IF EXISTS view_user_daily_metrics`
        ]
      }
    ];
  }

  private calculateChecksum(migration: Migration): string {
    const crypto = require('crypto');
    const content = JSON.stringify({
      version: migration.version,
      name: migration.name,
      up: migration.up,
      down: migration.down
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async ensureMigrationsTable(): Promise<void> {
    try {
      await this.pool.executeStatement(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          executed_at INTEGER NOT NULL,
          checksum TEXT NOT NULL
        )
      `);
    } catch (error) {
      this.logger.error('Failed to create migrations table', 'MIGRATION', error as Error);
      throw error;
    }
  }

  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    try {
      const migrations = await this.pool.executeQuery<MigrationRecord>(
        'SELECT version, name, executed_at, checksum FROM schema_migrations ORDER BY version'
      );
      return migrations;
    } catch (error) {
      this.logger.error('Failed to get executed migrations', 'MIGRATION', error as Error);
      throw error;
    }
  }

  private async recordMigration(migration: Migration): Promise<void> {
    const checksum = this.calculateChecksum(migration);
    
    try {
      await this.pool.executeStatement(
        'INSERT INTO schema_migrations (version, name, executed_at, checksum) VALUES (?, ?, ?, ?)',
        [migration.version, migration.name, Date.now(), checksum]
      );
    } catch (error) {
      this.logger.error('Failed to record migration', 'MIGRATION', error as Error, {
        migrationVersion: migration.version,
        migrationName: migration.name
      });
      throw error;
    }
  }

  private async removeMigrationRecord(version: number): Promise<void> {
    try {
      await this.pool.executeStatement(
        'DELETE FROM schema_migrations WHERE version = ?',
        [version]
      );
    } catch (error) {
      this.logger.error('Failed to remove migration record', 'MIGRATION', error as Error, {
        migrationVersion: version
      });
      throw error;
    }
  }

  private async executeMigrationStatements(statements: string[], description: string): Promise<void> {
    await this.pool.executeTransaction(
      statements.map(sql => async (db) => {
        return new Promise<void>((resolve, reject) => {
          db.run(sql, (err) => {
            if (err) {
              this.logger.error(`Migration statement failed: ${description}`, 'MIGRATION', err, { sql });
              reject(err);
            } else {
              this.logger.debug(`Migration statement executed: ${description}`, 'MIGRATION', { sql });
              resolve();
            }
          });
        });
      })
    );
  }

  public async migrate(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting database migration', 'MIGRATION');
      
      // Ensure migrations table exists
      await this.ensureMigrationsTable();
      
      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations();
      const executedVersions = new Set(executedMigrations.map(m => m.version));
      
      // Validate executed migrations haven't been tampered with
      for (const executed of executedMigrations) {
        const migration = this.migrations.find(m => m.version === executed.version);
        if (migration) {
          const expectedChecksum = this.calculateChecksum(migration);
          if (expectedChecksum !== executed.checksum) {
            throw new Error(
              `Migration ${executed.version} (${executed.name}) has been modified. ` +
              `Expected checksum: ${expectedChecksum}, got: ${executed.checksum}`
            );
          }
        }
      }
      
      // Find migrations to execute
      const migrationsToRun = this.migrations.filter(m => !executedVersions.has(m.version));
      
      if (migrationsToRun.length === 0) {
        this.logger.info('Database is up to date', 'MIGRATION');
        return;
      }
      
      this.logger.info(`Running ${migrationsToRun.length} migrations`, 'MIGRATION', {
        migrations: migrationsToRun.map(m => `${m.version}: ${m.name}`)
      });
      
      // Execute migrations in order
      for (const migration of migrationsToRun) {
        const migrationStartTime = Date.now();
        
        try {
          this.logger.info(`Executing migration ${migration.version}: ${migration.name}`, 'MIGRATION');
          
          // Execute migration statements
          await this.executeMigrationStatements(
            migration.up,
            `Migration ${migration.version}: ${migration.name}`
          );
          
          // Record successful migration
          await this.recordMigration(migration);
          
          this.logger.info(
            `Migration ${migration.version} completed successfully`,
            'MIGRATION',
            { duration: Date.now() - migrationStartTime }
          );
          
        } catch (error) {
          this.logger.error(
            `Migration ${migration.version} failed`,
            'MIGRATION',
            error as Error,
            { duration: Date.now() - migrationStartTime }
          );
          throw error;
        }
      }
      
      this.logger.info(
        'Database migration completed successfully',
        'MIGRATION',
        { 
          totalMigrations: migrationsToRun.length,
          duration: Date.now() - startTime
        }
      );
      
    } catch (error) {
      this.logger.error('Database migration failed', 'MIGRATION', error as Error);
      throw error;
    }
  }

  public async rollback(targetVersion?: number): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.warn('Starting database rollback', 'MIGRATION', { targetVersion });
      
      await this.ensureMigrationsTable();
      const executedMigrations = await this.getExecutedMigrations();
      
      if (executedMigrations.length === 0) {
        this.logger.info('No migrations to rollback', 'MIGRATION');
        return;
      }
      
      // Determine which migrations to rollback
      const migrationsToRollback = targetVersion 
        ? executedMigrations.filter(m => m.version > targetVersion).reverse()
        : [executedMigrations[executedMigrations.length - 1]]; // Just the latest
      
      this.logger.warn(`Rolling back ${migrationsToRollback.length} migrations`, 'MIGRATION', {
        migrations: migrationsToRollback.map(m => `${m.version}: ${m.name}`)
      });
      
      for (const executedMigration of migrationsToRollback) {
        const migration = this.migrations.find(m => m.version === executedMigration.version);
        
        if (!migration) {
          this.logger.error(`Migration definition not found for version ${executedMigration.version}`, 'MIGRATION');
          continue;
        }
        
        const rollbackStartTime = Date.now();
        
        try {
          this.logger.warn(`Rolling back migration ${migration.version}: ${migration.name}`, 'MIGRATION');
          
          // Execute rollback statements
          await this.executeMigrationStatements(
            migration.down,
            `Rollback ${migration.version}: ${migration.name}`
          );
          
          // Remove migration record
          await this.removeMigrationRecord(migration.version);
          
          this.logger.warn(
            `Migration ${migration.version} rolled back successfully`,
            'MIGRATION',
            { duration: Date.now() - rollbackStartTime }
          );
          
        } catch (error) {
          this.logger.error(
            `Rollback of migration ${migration.version} failed`,
            'MIGRATION',
            error as Error
          );
          throw error;
        }
      }
      
      this.logger.warn(
        'Database rollback completed',
        'MIGRATION',
        { 
          rolledBackCount: migrationsToRollback.length,
          duration: Date.now() - startTime
        }
      );
      
    } catch (error) {
      this.logger.error('Database rollback failed', 'MIGRATION', error as Error);
      throw error;
    }
  }

  public async getMigrationStatus(): Promise<{
    currentVersion: number;
    availableVersion: number;
    pendingMigrations: Migration[];
    executedMigrations: MigrationRecord[];
  }> {
    try {
      await this.ensureMigrationsTable();
      const executedMigrations = await this.getExecutedMigrations();
      
      const currentVersion = executedMigrations.length > 0 
        ? Math.max(...executedMigrations.map(m => m.version))
        : 0;
      
      const availableVersion = this.migrations.length > 0
        ? Math.max(...this.migrations.map(m => m.version))
        : 0;
      
      const executedVersions = new Set(executedMigrations.map(m => m.version));
      const pendingMigrations = this.migrations.filter(m => !executedVersions.has(m.version));
      
      return {
        currentVersion,
        availableVersion,
        pendingMigrations,
        executedMigrations
      };
    } catch (error) {
      this.logger.error('Failed to get migration status', 'MIGRATION', error as Error);
      throw error;
    }
  }

  public async seedInitialData(): Promise<void> {
    try {
      this.logger.info('Seeding initial data', 'MIGRATION');
      
      // Check if we already have data
      const clients = await this.pool.executeQuery('SELECT COUNT(*) as count FROM clients');
      if (clients[0]?.count > 0) {
        this.logger.info('Initial data already exists, skipping seed', 'MIGRATION');
        return;
      }
      
      const initialData = [
        {
          client: 'Company',
          projects: [
            { name: 'Admin', tasks: ['General', 'Meetings', 'Planning'] },
            { name: 'Training', tasks: ['Courses', 'Workshops', 'Self-Study'] },
            { name: 'Events', tasks: ['Conferences', 'Team Building', 'Social'] }
          ]
        },
        {
          client: 'Sample Client',
          projects: [
            { name: 'Website Project', tasks: ['Development', 'Testing', 'Documentation'] },
            { name: 'Consulting', tasks: ['Analysis', 'Meetings', 'Reports'] }
          ]
        }
      ];
      
      await this.pool.executeTransaction([
        async (db) => {
          for (const clientData of initialData) {
            // Insert client
            const clientResult = await new Promise<{ lastID: number }>((resolve, reject) => {
              db.run(
                'INSERT INTO clients (name, created_at) VALUES (?, ?)',
                [clientData.client, Date.now()],
                function(err) {
                  if (err) reject(err);
                  else resolve({ lastID: this.lastID });
                }
              );
            });
            
            // Insert projects and tasks
            for (const projectData of clientData.projects) {
              const projectResult = await new Promise<{ lastID: number }>((resolve, reject) => {
                db.run(
                  'INSERT INTO projects (name, client_id, created_at) VALUES (?, ?, ?)',
                  [projectData.name, clientResult.lastID, Date.now()],
                  function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this.lastID });
                  }
                );
              });
              
              // Insert tasks
              for (const taskName of projectData.tasks) {
                await new Promise<void>((resolve, reject) => {
                  db.run(
                    'INSERT INTO tasks (name, project_id, created_at) VALUES (?, ?, ?)',
                    [taskName, projectResult.lastID, Date.now()],
                    (err) => {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                });
              }
            }
          }
        }
      ]);
      
      // Seed configuration data
      await this.seedConfigurationData();
      
      this.logger.info('Initial data seeded successfully', 'MIGRATION');
      
    } catch (error) {
      this.logger.error('Failed to seed initial data', 'MIGRATION', error as Error);
      throw error;
    }
  }

  private async seedConfigurationData(): Promise<void> {
    // Seed teams
    const teams = [
      { code: 'LIFE', name: 'Life', description: 'Life Insurance' },
      { code: 'NON_LIFE', name: 'Non-Life', description: 'Non-Life Insurance' },
      { code: 'ACCOUNTING', name: 'Accounting', description: 'Accounting and Finance' },
      { code: 'ADVISORY', name: 'Advisory', description: 'Advisory Services' },
      { code: 'OPERATIONS', name: 'Operations', description: 'Operations Support' },
      { code: 'IT', name: 'IT', description: 'Information Technology' }
    ];

    for (const team of teams) {
      await this.pool.executeStatement(
        'INSERT OR IGNORE INTO teams (code, name, description, created_at) VALUES (?, ?, ?, ?)',
        [team.code, team.name, team.description, Date.now()]
      );
    }

    // Seed regions  
    const regions = [
      { name: 'Cape Town', code: 'CPT', description: 'Cape Town Office' },
      { name: 'Johannesburg', code: 'JHB', description: 'Johannesburg Office' },
      { name: 'Kenya', code: 'KEN', description: 'Kenya Office' },
      { name: 'United Kingdom', code: 'UK', description: 'UK Office' },
      { name: 'Namibia', code: 'NAM', description: 'Namibia Office' }
    ];

    for (const region of regions) {
      await this.pool.executeStatement(
        'INSERT OR IGNORE INTO regions (name, code, description, created_at) VALUES (?, ?, ?, ?)',
        [region.name, region.code, region.description, Date.now()]
      );
    }

    // Seed job levels
    const jobLevels = [
      { code: 'JA', name: 'Junior Analyst', level_order: 1 },
      { code: 'A', name: 'Analyst', level_order: 2 },
      { code: 'SA', name: 'Senior Analyst', level_order: 3 },
      { code: 'AM', name: 'Assistant Manager', level_order: 4 },
      { code: 'M', name: 'Manager', level_order: 5 },
      { code: 'SM', name: 'Senior Manager', level_order: 6 },
      { code: 'AD', name: 'Analyst Director', level_order: 7 },
      { code: 'SAD', name: 'Senior Analyst Director', level_order: 8 },
      { code: 'D', name: 'Director', level_order: 9 },
      { code: 'P', name: 'Partner', level_order: 10 }
    ];

    for (const level of jobLevels) {
      await this.pool.executeStatement(
        'INSERT OR IGNORE INTO job_levels (code, name, level_order, created_at) VALUES (?, ?, ?, ?)',
        [level.code, level.name, level.level_order, Date.now()]
      );
    }

    // Seed billable rates
    const billableRates = [
      { job_level_code: 'JA', rate_zar_per_hour: 450 },
      { job_level_code: 'A', rate_zar_per_hour: 650 },
      { job_level_code: 'SA', rate_zar_per_hour: 850 },
      { job_level_code: 'AM', rate_zar_per_hour: 1100 },
      { job_level_code: 'M', rate_zar_per_hour: 1400 },
      { job_level_code: 'SM', rate_zar_per_hour: 1750 },
      { job_level_code: 'AD', rate_zar_per_hour: 2200 },
      { job_level_code: 'SAD', rate_zar_per_hour: 2800 },
      { job_level_code: 'D', rate_zar_per_hour: 3500 },
      { job_level_code: 'P', rate_zar_per_hour: 4500 }
    ];

    const today = new Date().toISOString().split('T')[0];
    for (const rate of billableRates) {
      await this.pool.executeStatement(
        'INSERT OR IGNORE INTO billable_rates_by_job_level (job_level_code, rate_zar_per_hour, effective_from, created_at) VALUES (?, ?, ?, ?)',
        [rate.job_level_code, rate.rate_zar_per_hour, today, Date.now()]
      );
    }
  }
}

export { MigrationService };
export type { Migration, MigrationRecord };

// CommonJS export for compatibility
module.exports = { MigrationService };