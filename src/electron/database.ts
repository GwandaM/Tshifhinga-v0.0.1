const sqlite3 = require('sqlite3');
const { app: electronApp } = require('electron');
const { join: pathJoin } = require('path');
const { existsSync, mkdirSync, chmodSync } = require('fs');

interface SessionRecord {
  id: string;
  client: string;
  project: string;
  task: string;
  start: number;
  end?: number;
  activeMs: number;
  pausedMs: number;
  notes?: string;
  createdAt: number;
  isBillable?: boolean;
  userId?: number;
}

interface UserRecord {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user' | 'director';
  isActive: boolean;
  createdAt: number;
  // Enhanced user fields
  name?: string;
  surname?: string;
  team?: string;
  region?: string;
  jobLevel?: string;
  billableRate?: number; // ZAR per hour
  discountPercentage?: number; // default 0%
  targetUtilization?: number; // percentage
}

interface ProjectPermissionRecord {
  id: number;
  userId: number;
  projectId: number;
  canTrackTime: boolean;
  createdAt: number;
}

class DatabaseService {
  private db: any | null = null;
  private dbPath: string;
  private isClosing: boolean = false;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    try {
      // Use secure application data directory
      const userDataPath = electronApp.getPath('userData');
      console.log('User data path:', userDataPath);
      
      // Create database in secure user data directory
      const dbDir = pathJoin(userDataPath, 'data');
      console.log('Database directory:', dbDir);
      
      // Ensure directory exists with secure permissions
      if (!existsSync(dbDir)) {
        console.log('Creating database directory...');
        mkdirSync(dbDir, { recursive: true, mode: 0o700 }); // Secure permissions - owner only
        console.log('Database directory created successfully');
      } else {
        console.log('Database directory already exists');
        // Ensure existing directory has secure permissions
        chmodSync(dbDir, 0o700);
      }
      
      this.dbPath = pathJoin(dbDir, 'sessions.db');
      console.log('Database path:', this.dbPath);
      // Don't auto-initialize, let it be called explicitly
    } catch (error) {
      console.error('Error in database constructor:', error);
      throw error;
    }
  }

  async init(): Promise<void> {
    // If already initialized or initializing, return the existing promise
    if (this.isInitialized) {
      return Promise.resolve();
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeDatabaseConnection();

    return this.initializationPromise;
  }

  private async initializeDatabaseConnection(): Promise<void> {
    if (this.isClosing) {
      throw new Error('Database is closing');
    }

    return new Promise((resolve, reject) => {
      const connectWithRetry = (isRetry: boolean = false) => {
        const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err: any) => {
          if (err) {
            console.error(`Error ${isRetry ? 'retrying' : 'opening'} database:`, err);
            
            if (!isRetry) {
              // Try to fix permissions and retry once
              try {
                if (existsSync(this.dbPath)) {
                  chmodSync(this.dbPath, 0o600);
                }
                console.log('Attempting to retry database connection with fixed permissions...');
                connectWithRetry(true);
                return;
              } catch (retryErr) {
                console.error('Failed to fix database permissions:', retryErr);
                this.cleanup();
                reject(err); // Reject with original error
                return;
              }
            } else {
              // Second attempt failed
              this.cleanup();
              reject(err);
              return;
            }
          }

          // Connection successful
          this.db = db;
          console.log(`Connected to SQLite database at: ${this.dbPath}${isRetry ? ' (after permission fix)' : ''}`);
          
          // Ensure file has secure permissions (owner read/write only)
          try {
            chmodSync(this.dbPath, 0o600);
          } catch (chmodErr) {
            console.warn('Could not set database file permissions:', chmodErr);
          }
          
          try {
            await this.createTables();
            this.isInitialized = true;
            resolve();
          } catch (createErr) {
            console.error('Error creating tables:', createErr);
            this.cleanup();
            reject(createErr);
          }
        });
      };

      connectWithRetry(false);
    });
  }

  private cleanup(): void {
    this.isInitialized = false;
    this.initializationPromise = null;
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
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
      )
    `;

    const createClientsTable = `
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createProjectsTable = `
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        client_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        UNIQUE(name, client_id)
      )
    `;

    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(name, project_id)
      )
    `;

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        is_active BOOLEAN DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        -- Enhanced user fields
        name TEXT,
        surname TEXT,
        team TEXT,
        region TEXT,
        job_level TEXT,
        billable_rate REAL DEFAULT 0,
        discount_percentage REAL DEFAULT 0,
        target_utilization REAL DEFAULT 80
      )
    `;

    const createProjectPermissionsTable = `
      CREATE TABLE IF NOT EXISTS user_project_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        can_track_time BOOLEAN DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(user_id, project_id)
      )
    `;

    // Configuration tables
    const createTeamsTable = `
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at INTEGER NOT NULL
      )
    `;

    const createRegionsTable = `
      CREATE TABLE IF NOT EXISTS regions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at INTEGER NOT NULL
      )
    `;

    const createJobLevelsTable = `
      CREATE TABLE IF NOT EXISTS job_levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        level_order INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at INTEGER NOT NULL
      )
    `;

    const createBillableRatesTable = `
      CREATE TABLE IF NOT EXISTS billable_rates_by_job_level (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_level_code TEXT NOT NULL,
        rate_zar_per_hour REAL NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE,
        is_active BOOLEAN DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (job_level_code) REFERENCES job_levels(code) ON DELETE CASCADE
      )
    `;

      let completedTables = 0;
      const totalTables = 10; // Updated to include new tables
      let hasError = false;

      const checkCompletion = () => {
        completedTables++;
        if (completedTables === totalTables && !hasError) {
          this.createIndexes();
          this.seedInitialData();
          this.seedConfigurationData();
          resolve();
        }
      };

      const handleError = (err: Error) => {
        if (!hasError) {
          hasError = true;
          reject(err);
        }
      };

      // Create all tables
      this.db.serialize(() => {
        this.db.run(createSessionsTable, (err: any) => {
          if (err) {
            console.error('Error creating sessions table:', err);
            handleError(err);
          } else {
            console.log('Sessions table ready');
            this.addBillableColumnIfMissing();
            this.addSessionEditingFeatures();
            checkCompletion();
          }
        });

        this.db.run(createClientsTable, (err: any) => {
          if (err) {
            console.error('Error creating clients table:', err);
            handleError(err);
          } else {
            console.log('Clients table ready');
            checkCompletion();
          }
        });

        this.db.run(createProjectsTable, (err: any) => {
          if (err) {
            console.error('Error creating projects table:', err);
            handleError(err);
          } else {
            console.log('Projects table ready');
            checkCompletion();
          }
        });

        this.db.run(createTasksTable, (err: any) => {
          if (err) {
            console.error('Error creating tasks table:', err);
            handleError(err);
          } else {
            console.log('Tasks table ready');
            checkCompletion();
          }
        });

        this.db.run(createUsersTable, (err: any) => {
          if (err) {
            console.error('Error creating users table:', err);
            handleError(err);
          } else {
            console.log('Users table ready');
            this.addUserIdColumnIfMissing();
            checkCompletion();
          }
        });

        this.db.run(createProjectPermissionsTable, (err: any) => {
          if (err) {
            console.error('Error creating project permissions table:', err);
            handleError(err);
          } else {
            console.log('Project permissions table ready');
            checkCompletion();
          }
        });

        // Create configuration tables
        this.db.run(createTeamsTable, (err: any) => {
          if (err) {
            console.error('Error creating teams table:', err);
            handleError(err);
          } else {
            console.log('Teams table ready');
            this.addCodeColumnToTeamsTableIfMissing(() => {
              checkCompletion();
            });
          }
        });

        this.db.run(createRegionsTable, (err: any) => {
          if (err) {
            console.error('Error creating regions table:', err);
            handleError(err);
          } else {
            console.log('Regions table ready');
            checkCompletion();
          }
        });

        this.db.run(createJobLevelsTable, (err: any) => {
          if (err) {
            console.error('Error creating job levels table:', err);
            handleError(err);
          } else {
            console.log('Job levels table ready');
            checkCompletion();
          }
        });

        this.db.run(createBillableRatesTable, (err: any) => {
          if (err) {
            console.error('Error creating billable rates table:', err);
            handleError(err);
          } else {
            console.log('Billable rates table ready');
            checkCompletion();
          }
        });
      });
    });
  }

  private async ensureReady(): Promise<void> {
    if (this.isClosing) {
      throw new Error('Database is closed or closing');
    }
    
    if (!this.isInitialized) {
      await this.init();
    }
    
    if (!this.db) {
      throw new Error('Database connection not available');
    }
  }

  private addBillableColumnIfMissing(): void {
    if (!this.db) return;

    // Check if is_billable column exists
    this.db.all("PRAGMA table_info(sessions)", (err, columns: any[]) => {
      if (err) {
        console.error('Error checking table structure:', err);
        return;
      }

      const hasIsBillableColumn = columns.some(col => col.name === 'is_billable');
      
      if (!hasIsBillableColumn) {
        console.log('Adding is_billable column to existing sessions table...');
        this.db.run("ALTER TABLE sessions ADD COLUMN is_billable BOOLEAN DEFAULT 1", (alterErr) => {
          if (alterErr) {
            console.error('Error adding is_billable column:', alterErr);
          } else {
            console.log('Successfully added is_billable column');
          }
        });
      } else {
        console.log('is_billable column already exists');
      }
    });
  }

  private addUserIdColumnIfMissing(): void {
    if (!this.db) return;

    // Check if user_id column exists
    this.db.all("PRAGMA table_info(sessions)", (err, columns: any[]) => {
      if (err) {
        console.error('Error checking table structure for user_id:', err);
        return;
      }

      const hasUserIdColumn = columns.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('Adding user_id column to existing sessions table...');
        this.db.run("ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id)", (alterErr) => {
          if (alterErr) {
            console.error('Error adding user_id column:', alterErr);
          } else {
            console.log('Successfully added user_id column');
          }
        });
      } else {
        console.log('user_id column already exists');
      }
    });
  }

  private addCodeColumnToTeamsTableIfMissing(callback?: () => void): void {
    if (!this.db) {
      if (callback) callback();
      return;
    }

    console.log('Checking if code column exists in teams table...');
    // Check if code column exists
    this.db.all("PRAGMA table_info(teams)", (err, columns: any[]) => {
      if (err) {
        console.error('Error checking table structure for code:', err);
        if (callback) callback();
        return;
      }

      const hasCodeColumn = columns.some(col => col.name === 'code');
      console.log('hasCodeColumn:', hasCodeColumn);
      
      if (!hasCodeColumn) {
        console.log('Adding code column to existing teams table...');
        this.db.run("ALTER TABLE teams ADD COLUMN code TEXT DEFAULT ''", (alterErr) => {
          if (alterErr) {
            console.error('Error adding code column:', alterErr);
            if (callback) callback();
          } else {
            console.log('Successfully added code column');
            // Now add the unique constraint after column is added
            this.db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_code ON teams(code)", (indexErr) => {
              if (indexErr) {
                console.error('Error creating unique index on code column:', indexErr);
              } else {
                console.log('Successfully created unique index on code column');
              }
              if (callback) callback();
            });
          }
        });
      } else {
        console.log('code column already exists');
        if (callback) callback();
      }
    });
  }

  private addSessionEditingFeatures(): void {
    if (!this.db) return;

    // Add missing columns to sessions table
    this.db.all("PRAGMA table_info(sessions)", (err, columns: any[]) => {
      if (err) {
        console.error('Error checking sessions table structure:', err);
        return;
      }

      const columnNames = columns.map(col => col.name);
      
      // Add edited_at column
      if (!columnNames.includes('edited_at')) {
        this.db.run("ALTER TABLE sessions ADD COLUMN edited_at INTEGER", (alterErr) => {
          if (alterErr) {
            console.error('Error adding edited_at column:', alterErr);
          } else {
            console.log('Successfully added edited_at column');
          }
        });
      }

      // Add edit_count column
      if (!columnNames.includes('edit_count')) {
        this.db.run("ALTER TABLE sessions ADD COLUMN edit_count INTEGER DEFAULT 0", (alterErr) => {
          if (alterErr) {
            console.error('Error adding edit_count column:', alterErr);
          } else {
            console.log('Successfully added edit_count column');
          }
        });
      }

      // Add original_active_ms column
      if (!columnNames.includes('original_active_ms')) {
        this.db.run("ALTER TABLE sessions ADD COLUMN original_active_ms INTEGER", (alterErr) => {
          if (alterErr) {
            console.error('Error adding original_active_ms column:', alterErr);
          } else {
            console.log('Successfully added original_active_ms column');
          }
        });
      }

      // Add is_manually_created column
      if (!columnNames.includes('is_manually_created')) {
        this.db.run("ALTER TABLE sessions ADD COLUMN is_manually_created BOOLEAN DEFAULT 0", (alterErr) => {
          if (alterErr) {
            console.error('Error adding is_manually_created column:', alterErr);
          } else {
            console.log('Successfully added is_manually_created column');
          }
        });
      }
    });

    // Create session_edits table
    const createSessionEditsTable = `
      CREATE TABLE IF NOT EXISTS session_edits (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        edit_type TEXT NOT NULL CHECK (edit_type IN ('time_adjustment', 'details_change', 'split', 'merge')),
        original_start_time INTEGER,
        original_end_time INTEGER,
        new_start_time INTEGER,
        new_end_time INTEGER,
        original_active_ms INTEGER,
        new_active_ms INTEGER,
        changes_json TEXT,
        edit_reason TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    this.db.run(createSessionEditsTable, (err: any) => {
      if (err) {
        console.error('Error creating session_edits table:', err);
      } else {
        console.log('Session edits table ready');
      }
    });

    // Create user_reliability_metrics table
    const createUserReliabilityTable = `
      CREATE TABLE IF NOT EXISTS user_reliability_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        week_start_date TEXT NOT NULL,
        tracked_time_ms INTEGER NOT NULL DEFAULT 0,
        edited_time_ms INTEGER NOT NULL DEFAULT 0,
        total_time_ms INTEGER NOT NULL DEFAULT 0,
        reliability_rate REAL NOT NULL DEFAULT 100.0,
        sessions_count INTEGER NOT NULL DEFAULT 0,
        edits_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, week_start_date)
      )
    `;

    this.db.run(createUserReliabilityTable, (err: any) => {
      if (err) {
        console.error('Error creating user_reliability_metrics table:', err);
      } else {
        console.log('User reliability metrics table ready');
      }
    });

    console.log('Session editing features migration completed');
  }

  private createIndexes(): void {
    if (!this.db) return;

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_project_permissions_user_id ON user_project_permissions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_project_permissions_project_id ON user_project_permissions(project_id)',
    ];

    indexes.forEach((indexSql) => {
      this.db!.run(indexSql, (err) => {
        if (err) {
          console.error('Error creating index:', err);
        }
      });
    });
  }

  private seedInitialData(): void {
    if (!this.db) return;

    // Check if we already have data
    this.db.get('SELECT COUNT(*) as count FROM clients', (err, row: any) => {
      if (err) {
        console.error('Error checking existing data:', err);
        return;
      }

      if (row.count > 0) {
        console.log('Hierarchy data already exists, skipping seed');
        return;
      }

      console.log('Seeding initial hierarchy data...');
      
      const initialData = [
        {
          client: 'Acme Corp',
          projects: [
            { name: 'Website Redesign', tasks: ['Development', 'Testing', 'Client Meetings', 'Documentation'] },
            { name: 'Mobile App', tasks: ['Planning', 'Development', 'QA', 'Launch'] },
          ],
        },
        {
          client: 'Globex Inc',
          projects: [
            { name: 'Internal Tools', tasks: ['UX', 'Implementation', 'Review'] },
            { name: 'Marketing Site', tasks: ['Content', 'Design', 'Build'] },
          ],
        },
        {
          client: 'Company',
          projects: [
            { name: 'Non-Billable', tasks: ['Admin'] },
          ],
        },
      ];

      this.seedHierarchyData(initialData);
    });
  }

  private async seedHierarchyData(data: any[]): Promise<void> {
    for (const clientData of data) {
      try {
        const clientId = await this.insertClient(clientData.client);
        
        for (const projectData of clientData.projects) {
          const projectId = await this.insertProject(projectData.name, clientId);
          
          for (const taskName of projectData.tasks) {
            await this.insertTask(taskName, projectId);
          }
        }
      } catch (error) {
        console.error('Error seeding hierarchy data:', error);
      }
    }
    console.log('Initial hierarchy data seeded successfully');
  }

  private seedConfigurationData(): void {
    if (!this.db) return;

    // Seed teams
    const teams = [
      { code: 'LIFE', name: 'Life', description: 'Life Insurance' },
      { code: 'NON_LIFE', name: 'Non-Life', description: 'Non-Life Insurance' },
      { code: 'ACCOUNTING', name: 'Accounting', description: 'Accounting and Finance' },
      { code: 'ADVISORY', name: 'Advisory', description: 'Advisory Services' },
      { code: 'OPERATIONS', name: 'Operations', description: 'Operations Support' },
      { code: 'IT', name: 'IT', description: 'Information Technology' }
    ];

    teams.forEach(team => {
      this.db.run('INSERT OR IGNORE INTO teams (code, name, description, created_at) VALUES (?, ?, ?, ?)', 
        [team.code, team.name, team.description, Date.now()]);
    });

    // Seed regions  
    const regions = [
      { name: 'Cape Town', code: 'CPT', description: 'Cape Town Office' },
      { name: 'Johannesburg', code: 'JHB', description: 'Johannesburg Office' },
      { name: 'Kenya', code: 'KEN', description: 'Kenya Office' },
      { name: 'United Kingdom', code: 'UK', description: 'UK Office' },
      { name: 'Namibia', code: 'NAM', description: 'Namibia Office' }
    ];

    regions.forEach(region => {
      this.db.run('INSERT OR IGNORE INTO regions (name, code, description, created_at) VALUES (?, ?, ?, ?)', 
        [region.name, region.code, region.description, Date.now()]);
    });

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

    jobLevels.forEach(level => {
      this.db.run('INSERT OR IGNORE INTO job_levels (code, name, level_order, created_at) VALUES (?, ?, ?, ?)', 
        [level.code, level.name, level.level_order, Date.now()]);
    });

    // Seed billable rates (dummy data in ZAR per hour)
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
    billableRates.forEach(rate => {
      this.db.run('INSERT OR IGNORE INTO billable_rates_by_job_level (job_level_code, rate_zar_per_hour, effective_from, created_at) VALUES (?, ?, ?, ?)', 
        [rate.job_level_code, rate.rate_zar_per_hour, today, Date.now()]);
    });

    console.log('Configuration data seeded successfully');
  }

  async getAllSessions(): Promise<SessionRecord[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {

      const sql = `
        SELECT 
          id, client, project, task,
          start_time as start, end_time as end,
          active_ms as activeMs, paused_ms as pausedMs,
          notes, created_at as createdAt,
          is_billable as isBillable, user_id as userId
        FROM sessions 
        ORDER BY created_at DESC
      `;

      this.db.all(sql, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const sessions: SessionRecord[] = rows.map(row => ({
            id: row.id,
            client: row.client,
            project: row.project,
            task: row.task,
            start: row.start,
            end: row.end,
            activeMs: row.activeMs,
            pausedMs: row.pausedMs,
            notes: row.notes,
            createdAt: row.createdAt,
            isBillable: row.isBillable !== 0,
            userId: row.userId,
          }));
          resolve(sessions);
        }
      });
    });
  }

  async getUserSessions(userId: number): Promise<SessionRecord[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id, client, project, task,
          start_time as start, end_time as end,
          active_ms as activeMs, paused_ms as pausedMs,
          notes, created_at as createdAt,
          is_billable as isBillable, user_id as userId
        FROM sessions 
        WHERE user_id = ? AND user_id IS NOT NULL
        ORDER BY created_at DESC
      `;

      console.log('Executing getUserSessions query for userId:', userId);
      console.log('SQL:', sql);
      
      this.db.all(sql, [userId], (err, rows: any[]) => {
        if (err) {
          console.error('Error executing getUserSessions query:', err);
          reject(err);
        } else {
          console.log(`Found ${rows.length} sessions for user ${userId}:`, rows);
          const sessions: SessionRecord[] = rows.map(row => ({
            id: row.id,
            client: row.client,
            project: row.project,
            task: row.task,
            start: row.start,
            end: row.end,
            activeMs: row.activeMs,
            pausedMs: row.pausedMs,
            notes: row.notes,
            createdAt: row.createdAt,
            isBillable: row.isBillable !== 0,
            userId: row.userId,
          }));
          resolve(sessions);
        }
      });
    });
  }

  async insertSession(session: SessionRecord): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      console.log('Inserting session:', session);

      const sql = `
        INSERT INTO sessions (
          id, client, project, task, start_time, end_time,
          active_ms, paused_ms, notes, created_at, is_billable, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        session.id,
        session.client,
        session.project,
        session.task,
        session.start,
        session.end || null,
        session.activeMs,
        session.pausedMs,
        session.notes || null,
        session.createdAt,
        session.isBillable !== false ? 1 : 0,
        session.userId || null,
      ], function(err: any) {
        if (err) {
          console.error('Error inserting session:', err);
          reject(err);
        } else {
          console.log('Session inserted successfully');
          resolve();
        }
      });
    });
  }

  async addSession(session: SessionRecord): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      console.log('Adding manually created session:', session);

      const sql = `
        INSERT INTO sessions (
          id, client, project, task, start_time, end_time,
          active_ms, paused_ms, notes, created_at, is_billable, user_id,
          original_active_ms, is_manually_created
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        session.id,
        session.client || session.task?.client,
        session.project || session.task?.project,
        (typeof session.task === 'string' ? session.task : session.task?.task) || session.project,
        session.start,
        session.end || null,
        session.activeMs,
        session.pausedMs,
        session.notes || null,
        session.createdAt,
        session.isBillable !== false ? 1 : 0,
        session.userId || null,
        session.activeMs, // original_active_ms same as activeMs for new sessions
        session.isManuallyCreated ? 1 : 0,
      ], function(err: any) {
        if (err) {
          console.error('Error adding session:', err);
          reject(err);
        } else {
          console.log('Session added successfully');
          resolve();
        }
      });
    });
  }

  async updateSession(id: string, updates: Partial<Omit<SessionRecord, 'id' | 'createdAt'>>): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {

      const setParts: string[] = [];
      const values: any[] = [];

      if (updates.client !== undefined) {
        setParts.push('client = ?');
        values.push(updates.client);
      }
      if (updates.project !== undefined) {
        setParts.push('project = ?');
        values.push(updates.project);
      }
      if (updates.task !== undefined) {
        setParts.push('task = ?');
        values.push(updates.task);
      }
      if (updates.notes !== undefined) {
        setParts.push('notes = ?');
        values.push(updates.notes);
      }
      if (updates.activeMs !== undefined) {
        setParts.push('active_ms = ?');
        values.push(updates.activeMs);
      }
      if (updates.pausedMs !== undefined) {
        setParts.push('paused_ms = ?');
        values.push(updates.pausedMs);
      }
      if (updates.end !== undefined) {
        setParts.push('end_time = ?');
        values.push(updates.end);
      }
      if (updates.isBillable !== undefined) {
        setParts.push('is_billable = ?');
        values.push(updates.isBillable ? 1 : 0);
      }
      if (updates.userId !== undefined) {
        setParts.push('user_id = ?');
        values.push(updates.userId);
      }

      if (setParts.length === 0) {
        resolve();
        return;
      }

      setParts.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const sql = `UPDATE sessions SET ${setParts.join(', ')} WHERE id = ?`;

      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async deleteSession(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run('DELETE FROM sessions WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Session Editing Methods
  async editSession(sessionId: string, userId: number, updates: {
    startTime?: number;
    endTime?: number;
    client?: string;
    project?: string;
    task?: string;
    notes?: string;
  }, editReason: string): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // First, get the original session data
        this.db.get(
          'SELECT * FROM sessions WHERE id = ?',
          [sessionId],
          (err, originalSession: any) => {
            if (err) {
              reject(err);
              return;
            }
            if (!originalSession) {
              reject(new Error('Session not found'));
              return;
            }

            // Calculate new active time if times are being changed
            let newActiveMs = originalSession.active_ms;
            if (updates.startTime !== undefined || updates.endTime !== undefined) {
              const newStart = updates.startTime || originalSession.start_time;
              const newEnd = updates.endTime || originalSession.end_time;
              if (newEnd) {
                newActiveMs = newEnd - newStart;
              }
            }

            // Prepare session update
            const sessionUpdates: any = {};
            if (updates.startTime !== undefined) sessionUpdates.start_time = updates.startTime;
            if (updates.endTime !== undefined) sessionUpdates.end_time = updates.endTime;
            if (updates.client !== undefined) sessionUpdates.client = updates.client;
            if (updates.project !== undefined) sessionUpdates.project = updates.project;
            if (updates.task !== undefined) sessionUpdates.task = updates.task;
            if (updates.notes !== undefined) sessionUpdates.notes = updates.notes;
            if (newActiveMs !== originalSession.active_ms) sessionUpdates.active_ms = newActiveMs;
            
            sessionUpdates.edited_at = Date.now();
            sessionUpdates.edit_count = (originalSession.edit_count || 0) + 1;
            
            // Set original_active_ms if not already set
            if (!originalSession.original_active_ms) {
              sessionUpdates.original_active_ms = originalSession.active_ms;
            }

            // Update session
            const setParts = Object.keys(sessionUpdates).map(key => `${key} = ?`);
            const values = Object.values(sessionUpdates);
            values.push(sessionId);

            this.db.run(
              `UPDATE sessions SET ${setParts.join(', ')} WHERE id = ?`,
              values,
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                // Create audit record
                const editId = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const editType = (updates.startTime !== undefined || updates.endTime !== undefined) 
                  ? 'time_adjustment' : 'details_change';

                const changesJson = JSON.stringify({
                  client: { old: originalSession.client, new: updates.client },
                  project: { old: originalSession.project, new: updates.project },
                  task: { old: originalSession.task, new: updates.task },
                  notes: { old: originalSession.notes, new: updates.notes }
                });

                this.db.run(
                  `INSERT INTO session_edits (
                    id, session_id, user_id, edit_type, 
                    original_start_time, original_end_time, 
                    new_start_time, new_end_time,
                    original_active_ms, new_active_ms,
                    changes_json, edit_reason, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    editId, sessionId, userId, editType,
                    originalSession.start_time, originalSession.end_time,
                    updates.startTime || originalSession.start_time,
                    updates.endTime || originalSession.end_time,
                    originalSession.active_ms, newActiveMs,
                    changesJson, editReason, Date.now()
                  ],
                  (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }

                    // Update reliability metrics
                    this.updateUserReliabilityMetrics(userId)
                      .then(() => resolve())
                      .catch(reject);
                  }
                );
              }
            );
          }
        );
      });
    });
  }

  async getSessionEditHistory(sessionId: string): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          se.*, 
          u.username
        FROM session_edits se
        LEFT JOIN users u ON se.user_id = u.id
        WHERE se.session_id = ?
        ORDER BY se.created_at DESC
      `;
      this.db.all(sql, [sessionId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async validateSessionEdit(sessionId: string, updates: {
    startTime?: number;
    endTime?: number;
  }, userId: number): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    const errors: string[] = [];

    return new Promise((resolve, reject) => {
      // Get the session being edited
      this.db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, session: any) => {
        if (err) {
          reject(err);
          return;
        }
        if (!session) {
          errors.push('Session not found');
          resolve({ isValid: false, errors });
          return;
        }

        const newStart = updates.startTime || session.start_time;
        const newEnd = updates.endTime || session.end_time;

        // Validate time logic
        if (newEnd && newStart >= newEnd) {
          errors.push('Start time must be before end time');
        }

        if (newEnd && newEnd > Date.now()) {
          errors.push('End time cannot be in the future');
        }

        const duration = newEnd ? newEnd - newStart : 0;
        if (duration > 24 * 60 * 60 * 1000) {
          errors.push('Session duration cannot exceed 24 hours');
        }

        if (duration < 60 * 1000) {
          errors.push('Session duration must be at least 1 minute');
        }

        // Check for overlapping sessions
        if (updates.startTime !== undefined || updates.endTime !== undefined) {
          const sql = `
            SELECT COUNT(*) as count 
            FROM sessions 
            WHERE user_id = ? 
              AND id != ? 
              AND start_time < ? 
              AND (end_time IS NULL OR end_time > ?)
          `;
          this.db.get(sql, [userId, sessionId, newEnd || newStart + 1000, newStart], (err, result: any) => {
            if (err) {
              reject(err);
              return;
            }
            if (result.count > 0) {
              errors.push('Session times overlap with existing sessions');
            }
            resolve({ isValid: errors.length === 0, errors });
          });
        } else {
          resolve({ isValid: errors.length === 0, errors });
        }
      });
    });
  }

  async updateUserReliabilityMetrics(userId: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      // Get the start of the current week (Monday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const weekStartString = weekStart.toISOString().split('T')[0];

      // Calculate metrics for the current week
      const weekStartMs = weekStart.getTime();
      const weekEndMs = weekStartMs + (7 * 24 * 60 * 60 * 1000);

      this.db.get(`
        SELECT 
          COUNT(*) as session_count,
          COUNT(CASE WHEN edit_count > 0 THEN 1 END) as edited_session_count,
          SUM(original_active_ms) as total_tracked_ms,
          SUM(active_ms) as total_current_ms
        FROM sessions 
        WHERE user_id = ? 
          AND start_time >= ? 
          AND start_time < ?
      `, [userId, weekStartMs, weekEndMs], (err, result: any) => {
        if (err) {
          reject(err);
          return;
        }

        const totalTrackedMs = result.total_tracked_ms || 0;
        const totalCurrentMs = result.total_current_ms || 0;
        const totalEditedMs = totalCurrentMs - totalTrackedMs;
        const reliabilityRate = totalCurrentMs > 0 ? totalTrackedMs / totalCurrentMs : 1.0;

        // Insert or update reliability metrics
        this.db.run(`
          INSERT OR REPLACE INTO user_reliability_metrics (
            user_id, week_start_date, tracked_time_ms, edited_time_ms, total_time_ms,
            reliability_rate, sessions_count, edits_count,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId, weekStartString, totalTrackedMs, totalEditedMs, totalCurrentMs,
          reliabilityRate, result.session_count, result.edited_session_count,
          Date.now(), Date.now()
        ], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  async getUserReliabilityRate(userId: number, weekStart: Date): Promise<number> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    const weekStartString = weekStart.toISOString().split('T')[0];
    
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT reliability_rate FROM user_reliability_metrics WHERE user_id = ? AND week_start_date = ?',
        [userId, weekStartString],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(row ? row.reliability_rate : 1.0);
          }
        }
      );
    });
  }

  async getAllUserReliabilityMetrics(): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          urm.*,
          u.username,
          u.name,
          u.surname,
          u.team,
          u.region
        FROM user_reliability_metrics urm
        LEFT JOIN users u ON urm.user_id = u.id
        ORDER BY urm.week_start_date DESC, u.username
      `;
      this.db.all(sql, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getSessionsByDateRange(startDate: number, endDate: number): Promise<SessionRecord[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT 
          id, client, project, task,
          start_time as start, end_time as end,
          active_ms as activeMs, paused_ms as pausedMs,
          notes, created_at as createdAt,
          is_billable as isBillable, user_id as userId
        FROM sessions 
        WHERE start_time >= ? AND start_time <= ?
        ORDER BY start_time DESC
      `;

      this.db.all(sql, [startDate, endDate], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const sessions: SessionRecord[] = rows.map(row => ({
            id: row.id,
            client: row.client,
            project: row.project,
            task: row.task,
            start: row.start,
            end: row.end,
            activeMs: row.activeMs,
            pausedMs: row.pausedMs,
            notes: row.notes,
            createdAt: row.createdAt,
            isBillable: row.isBillable !== 0,
            userId: row.userId,
          }));
          resolve(sessions);
        }
      });
    });
  }

  async getClientSummary(): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT client, SUM(active_ms) as total_ms
        FROM sessions
        GROUP BY client
        ORDER BY total_ms DESC
      `;

      this.db.all(sql, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const summary: Record<string, number> = {};
          rows.forEach(row => {
            summary[row.client] = row.total_ms;
          });
          resolve(summary);
        }
      });
    });
  }

  async migrateFromLocalStorage(localStorageData: any[]): Promise<void> {
    if (!Array.isArray(localStorageData) || localStorageData.length === 0) {
      return;
    }

    console.log(`Migrating ${localStorageData.length} sessions from localStorage...`);

    for (const session of localStorageData) {
      try {
        // Convert old format to new format
        const newSession: SessionRecord = {
          id: session.id,
          client: session.task.client,
          project: session.task.project,
          task: session.task.task,
          start: session.start,
          end: session.end,
          activeMs: session.activeMs,
          pausedMs: session.pausedMs,
          notes: session.notes,
          createdAt: session.createdAt,
        };

        await this.insertSession(newSession);
      } catch (error) {
        console.error('Error migrating session:', error);
      }
    }

    console.log('Migration completed');
  }

  async exportToCSV(): Promise<string> {
    const sessions = await this.getAllSessions();
    
    const headers = ['ID', 'Client', 'Project', 'Task', 'Start Time', 'End Time', 'Active Time (hours)', 'Paused Time (hours)', 'Billable', 'Notes', 'Created At'];
    const csvRows = [headers.join(',')];
    
    sessions.forEach(session => {
      const startTime = new Date(session.start).toISOString();
      const endTime = session.end ? new Date(session.end).toISOString() : '';
      const activeHours = (session.activeMs / (1000 * 60 * 60)).toFixed(2);
      const pausedHours = (session.pausedMs / (1000 * 60 * 60)).toFixed(2);
      const createdAt = new Date(session.createdAt).toISOString();
      
      const row = [
        `"${session.id}"`,
        `"${session.client}"`,
        `"${session.project}"`,
        `"${session.task}"`,
        `"${startTime}"`,
        `"${endTime}"`,
        activeHours,
        pausedHours,
        `"${session.isBillable !== false ? 'Yes' : 'No'}"`,
        `"${session.notes || ''}"`,
        `"${createdAt}"`
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  }

  async exportToJSON(): Promise<string> {
    const sessions = await this.getAllSessions();
    return JSON.stringify(sessions, null, 2);
  }

  // XLSX Export functionality
  async exportToXLSX(): Promise<any> {
    try {
      // Get all data for export
      const [clients, sessions, users, hierarchy] = await Promise.all([
        this.getAllClients(),
        this.getAllSessions(),
        this.getAllUsers(),
        this.getHierarchy()
      ]);

      // Prepare data for different sheets
      const clientsData = clients.map(client => ({
        id: client.id,
        name: client.name,
        created_at: new Date(client.created_at).toISOString(),
        project_count: client.project_count,
        task_count: client.task_count
      }));

      // Flatten hierarchy for projects sheet
      const projectsData: any[] = [];
      const tasksData: any[] = [];
      
      hierarchy.forEach((client: any) => {
        client.projects.forEach((project: any) => {
          projectsData.push({
            id: Math.random(), // Will be replaced with proper ID in real implementation
            name: project.name,
            client_name: client.name,
            created_at: new Date().toISOString(),
            task_count: project.tasks.length
          });
          
          project.tasks.forEach((taskName: string) => {
            tasksData.push({
              id: Math.random(), // Will be replaced with proper ID in real implementation
              name: taskName,
              project_name: project.name,
              client_name: client.name,
              created_at: new Date().toISOString()
            });
          });
        });
      });

      // Get user permissions data
      const permissionsData: any[] = [];
      for (const user of users) {
        try {
          const projectPermissions = await this.getUserProjectPermissions(user.id);
          projectPermissions.forEach(projectId => {
            // Find project and client names
            const project = projectsData.find(p => p.id === projectId);
            if (project) {
              permissionsData.push({
                username: user.username,
                client_name: project.client_name,
                project_name: project.name,
                can_track_time: true
              });
            }
          });
        } catch (error) {
          console.error(`Error getting permissions for user ${user.username}:`, error);
        }
      }

      return {
        Clients: clientsData,
        Projects: projectsData,
        Tasks: tasksData,
        User_Permissions: permissionsData,
        Sessions: sessions.map(session => ({
          id: session.id,
          client: session.client,
          project: session.project,
          task: session.task,
          start_time: new Date(session.start).toISOString(),
          end_time: session.end ? new Date(session.end).toISOString() : '',
          active_hours: (session.activeMs / (1000 * 60 * 60)).toFixed(2),
          paused_hours: (session.pausedMs / (1000 * 60 * 60)).toFixed(2),
          is_billable: session.isBillable ? 'Yes' : 'No',
          notes: session.notes || '',
          username: session.userId ? users.find(u => u.id === session.userId)?.username || '' : '',
          created_at: new Date(session.createdAt).toISOString()
        }))
      };
    } catch (error) {
      console.error('Error preparing XLSX export data:', error);
      throw error;
    }
  }

  // Hierarchy CRUD operations - moved to enhanced versions below

  async migrateHierarchyFromLocalStorage(localStorageData: any[]): Promise<void> {
    if (!Array.isArray(localStorageData) || localStorageData.length === 0) {
      return;
    }

    console.log(`Migrating ${localStorageData.length} hierarchy items from localStorage...`);

    for (const clientData of localStorageData) {
      try {
        if (!clientData.name || !Array.isArray(clientData.projects)) continue;

        // Insert client
        const clientId = await this.insertClient(clientData.name);
        
        // Insert projects and tasks
        for (const projectData of clientData.projects) {
          if (!projectData.name || !Array.isArray(projectData.tasks)) continue;

          const projectId = await this.insertProject(projectData.name, clientId);
          
          // Insert tasks
          for (const taskName of projectData.tasks) {
            if (typeof taskName === 'string' && taskName.trim()) {
              await this.insertTask(taskName, projectId);
            }
          }
        }
      } catch (error) {
        console.error('Error migrating hierarchy item:', error);
      }
    }

    console.log('Hierarchy migration completed');
  }

  async getHierarchy(): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {

      const sql = `
        SELECT 
          c.id as client_id, c.name as client_name,
          p.id as project_id, p.name as project_name,
          t.id as task_id, t.name as task_name
        FROM clients c
        LEFT JOIN projects p ON c.id = p.client_id
        LEFT JOIN tasks t ON p.id = t.project_id
        ORDER BY c.name, p.name, t.name
      `;

      this.db.all(sql, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          // Transform flat results into hierarchical structure
          const clientsMap = new Map();
          
          rows.forEach(row => {
            if (!clientsMap.has(row.client_id)) {
              clientsMap.set(row.client_id, {
                name: row.client_name,
                projects: new Map()
              });
            }
            
            const client = clientsMap.get(row.client_id);
            
            if (row.project_id && !client.projects.has(row.project_id)) {
              client.projects.set(row.project_id, {
                name: row.project_name,
                tasks: []
              });
            }
            
            if (row.task_id && row.project_id) {
              const project = client.projects.get(row.project_id);
              if (project && !project.tasks.includes(row.task_name)) {
                project.tasks.push(row.task_name);
              }
            }
          });

          // Convert Maps to arrays
          const hierarchy = Array.from(clientsMap.values()).map(client => ({
            name: client.name,
            projects: Array.from(client.projects.values())
          }));

          resolve(hierarchy);
        }
      });
    });
  }

  // Auth methods
  async createUser(username: string, email: string, passwordHash: string, role: 'admin' | 'user' = 'user'): Promise<number> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)';
      this.db.run(sql, [username, email, passwordHash, role, Date.now()], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Enhanced user update with new fields
  async updateUserEnhanced(userId: number, userData: {
    username?: string;
    email?: string;
    role?: 'admin' | 'user' | 'director';
    name?: string;
    surname?: string;
    team?: string;
    region?: string;
    jobLevel?: string;
    billableRate?: number;
    discountPercentage?: number;
    targetUtilization?: number;
  }): Promise<boolean> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    // Auto-populate billable rate if job level is provided but rate is not
    let finalBillableRate = userData.billableRate;
    if (userData.jobLevel && finalBillableRate === undefined) {
      finalBillableRate = await this.getBillableRateByJobLevel(userData.jobLevel);
    }

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE users SET 
          username = COALESCE(?, username),
          email = COALESCE(?, email),
          role = COALESCE(?, role),
          name = COALESCE(?, name),
          surname = COALESCE(?, surname),
          team = COALESCE(?, team),
          region = COALESCE(?, region),
          job_level = COALESCE(?, job_level),
          billable_rate = COALESCE(?, billable_rate),
          discount_percentage = COALESCE(?, discount_percentage),
          target_utilization = COALESCE(?, target_utilization)
        WHERE id = ?
      `;

      this.db.run(sql, [
        userData.username || null,
        userData.email || null,
        userData.role || null,
        userData.name || null,
        userData.surname || null,
        userData.team || null,
        userData.region || null,
        userData.jobLevel || null,
        finalBillableRate !== undefined ? finalBillableRate : null,
        userData.discountPercentage !== undefined ? userData.discountPercentage : null,
        userData.targetUtilization !== undefined ? userData.targetUtilization : null,
        userId
      ], function(err: any) {
        if (err) {
          console.error('Error updating user in database:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  async getUserByUsername(username: string): Promise<UserRecord | null> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = 'SELECT id, username, email, password_hash as passwordHash, role, is_active as isActive, created_at as createdAt FROM users WHERE username = ? AND is_active = 1';
      this.db.get(sql, [username], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  async getUserById(id: number): Promise<UserRecord | null> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id, username, email, password_hash as passwordHash, role, is_active as isActive, created_at as createdAt,
          name, surname, team, region, job_level as jobLevel, 
          billable_rate as billableRate, discount_percentage as discountPercentage, 
          target_utilization as targetUtilization
        FROM users 
        WHERE id = ? AND is_active = 1
      `;
      this.db.get(sql, [id], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  async getUserProjectPermissions(userId: number): Promise<number[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = 'SELECT project_id FROM user_project_permissions WHERE user_id = ? AND can_track_time = 1';
      this.db.all(sql, [userId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => row.project_id));
        }
      });
    });
  }

  async addUserProjectPermission(userId: number, projectId: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = 'INSERT OR REPLACE INTO user_project_permissions (user_id, project_id, can_track_time, created_at) VALUES (?, ?, 1, ?)';
      this.db.run(sql, [userId, projectId, Date.now()], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async removeUserProjectPermission(userId: number, projectId: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM user_project_permissions WHERE user_id = ? AND project_id = ?';
      this.db.run(sql, [userId, projectId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getAllUsers(): Promise<Omit<UserRecord, 'passwordHash'>[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          id, username, email, role, is_active as isActive, created_at as createdAt,
          name, surname, team, region, job_level as jobLevel, 
          billable_rate as billableRate, discount_percentage as discountPercentage, 
          target_utilization as targetUtilization
        FROM users 
        ORDER BY created_at DESC
      `;
      this.db.all(sql, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async updateUserRole(userId: number, role: 'admin' | 'user'): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = 'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [role, userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async deactivateUser(userId: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = 'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Project Management CRUD Operations
  
  // Duplicate validation helpers
  async checkClientExists(name: string, excludeId?: number): Promise<boolean> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = excludeId 
        ? 'SELECT COUNT(*) as count FROM clients WHERE LOWER(name) = LOWER(?) AND id != ?'
        : 'SELECT COUNT(*) as count FROM clients WHERE LOWER(name) = LOWER(?)';
      const params = excludeId ? [name, excludeId] : [name];
      
      this.db.get(sql, params, (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count > 0);
        }
      });
    });
  }

  async checkProjectExists(name: string, clientId: number, excludeId?: number): Promise<boolean> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = excludeId 
        ? 'SELECT COUNT(*) as count FROM projects WHERE LOWER(name) = LOWER(?) AND client_id = ? AND id != ?'
        : 'SELECT COUNT(*) as count FROM projects WHERE LOWER(name) = LOWER(?) AND client_id = ?';
      const params = excludeId ? [name, clientId, excludeId] : [name, clientId];
      
      this.db.get(sql, params, (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count > 0);
        }
      });
    });
  }

  async checkTaskExists(name: string, projectId: number, excludeId?: number): Promise<boolean> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = excludeId 
        ? 'SELECT COUNT(*) as count FROM tasks WHERE LOWER(name) = LOWER(?) AND project_id = ? AND id != ?'
        : 'SELECT COUNT(*) as count FROM tasks WHERE LOWER(name) = LOWER(?) AND project_id = ?';
      const params = excludeId ? [name, projectId, excludeId] : [name, projectId];
      
      this.db.get(sql, params, (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count > 0);
        }
      });
    });
  }

  // Update operations
  async updateClient(id: number, name: string): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    const exists = await this.checkClientExists(name, id);
    if (exists) {
      throw new Error('A client with this name already exists');
    }

    return new Promise((resolve, reject) => {
      const sql = 'UPDATE clients SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [name, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updateProject(id: number, name: string, clientId: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    const exists = await this.checkProjectExists(name, clientId, id);
    if (exists) {
      throw new Error('A project with this name already exists for this client');
    }

    return new Promise((resolve, reject) => {
      const sql = 'UPDATE projects SET name = ?, client_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [name, clientId, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updateTask(id: number, name: string, projectId: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    const exists = await this.checkTaskExists(name, projectId, id);
    if (exists) {
      throw new Error('A task with this name already exists for this project');
    }

    return new Promise((resolve, reject) => {
      const sql = 'UPDATE tasks SET name = ?, project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(sql, [name, projectId, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Delete operations with cascade handling
  async deleteClient(id: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Delete all user permissions for projects under this client
        this.db.run(`
          DELETE FROM user_project_permissions 
          WHERE project_id IN (SELECT id FROM projects WHERE client_id = ?)
        `, [id], (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          // Delete all tasks for projects under this client
          this.db.run(`
            DELETE FROM tasks 
            WHERE project_id IN (SELECT id FROM projects WHERE client_id = ?)
          `, [id], (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            // Delete all projects under this client
            this.db.run('DELETE FROM projects WHERE client_id = ?', [id], (err) => {
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              // Finally delete the client
              this.db.run('DELETE FROM clients WHERE id = ?', [id], (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  reject(err);
                } else {
                  this.db.run('COMMIT');
                  resolve();
                }
              });
            });
          });
        });
      });
    });
  }

  async deleteProject(id: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Delete all user permissions for this project
        this.db.run('DELETE FROM user_project_permissions WHERE project_id = ?', [id], (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          // Delete all tasks for this project
          this.db.run('DELETE FROM tasks WHERE project_id = ?', [id], (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            // Finally delete the project
            this.db.run('DELETE FROM projects WHERE id = ?', [id], (err) => {
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
              } else {
                this.db.run('COMMIT');
                resolve();
              }
            });
          });
        });
      });
    });
  }

  async deleteTask(id: number): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM tasks WHERE id = ?';
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Enhanced hierarchy operations
  async getAllClients(): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          c.id, c.name, c.created_at,
          COUNT(DISTINCT p.id) as project_count,
          COUNT(DISTINCT t.id) as task_count
        FROM clients c
        LEFT JOIN projects p ON c.id = p.client_id
        LEFT JOIN tasks t ON p.id = t.project_id
        GROUP BY c.id, c.name, c.created_at
        ORDER BY c.name
      `;

      this.db.all(sql, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getProjectsByClient(clientId: number): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          p.id, p.name, p.client_id, p.created_at,
          c.name as client_name,
          COUNT(DISTINCT t.id) as task_count,
          COUNT(DISTINCT upp.user_id) as user_count
        FROM projects p
        JOIN clients c ON p.client_id = c.id
        LEFT JOIN tasks t ON p.id = t.project_id
        LEFT JOIN user_project_permissions upp ON p.id = upp.project_id
        WHERE p.client_id = ?
        GROUP BY p.id, p.name, p.client_id, p.created_at, c.name
        ORDER BY p.name
      `;

      this.db.all(sql, [clientId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getTasksByProject(projectId: number): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          t.id, t.name, t.project_id, t.created_at,
          p.name as project_name,
          c.name as client_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN clients c ON p.client_id = c.id
        WHERE t.project_id = ?
        ORDER BY t.name
      `;

      this.db.all(sql, [projectId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Task copying functionality
  async copyTask(sourceTaskId: number, targetProjectId: number): Promise<number> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      // First get the source task
      this.db.get('SELECT name FROM tasks WHERE id = ?', [sourceTaskId], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          reject(new Error('Source task not found'));
          return;
        }

        // Check if task already exists in target project
        this.checkTaskExists(row.name, targetProjectId).then(exists => {
          if (exists) {
            reject(new Error('Task already exists in target project'));
            return;
          }

          // Insert the copied task
          const sql = 'INSERT INTO tasks (name, project_id, created_at) VALUES (?, ?, ?)';
          this.db.run(sql, [row.name, targetProjectId, Date.now()], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          });
        }).catch(reject);
      });
    });
  }

  // Default project structure for new users
  async createDefaultProjectStructure(): Promise<void> {
    try {
      const companyClientId = await this.insertClient('Company');
      
      const defaultProjects = ['Admin', 'Meetings', 'Training', 'Events'];
      
      for (const projectName of defaultProjects) {
        try {
          const projectId = await this.insertProject(projectName, companyClientId);
          // Add a default task for each project
          await this.insertTask('General', projectId);
        } catch (error) {
          // Project might already exist, continue
          console.log(`Project ${projectName} might already exist:`, error);
        }
      }
    } catch (error) {
      console.error('Error creating default project structure:', error);
      throw error;
    }
  }

  // Enhanced insertClient with duplicate validation
  async insertClient(name: string): Promise<number> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      // First check if client already exists (case-insensitive)
      this.checkClientExists(name).then(exists => {
        if (exists) {
          // Get existing client ID
          this.db.get('SELECT id FROM clients WHERE LOWER(name) = LOWER(?)', [name], (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row.id);
          });
        } else {
          // Insert new client
          const sql = 'INSERT INTO clients (name, created_at) VALUES (?, ?)';
          this.db.run(sql, [name, Date.now()], function(err: any) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          });
        }
      }).catch(reject);
    });
  }

  // Enhanced insertProject with duplicate validation
  async insertProject(name: string, clientId: number): Promise<number> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.checkProjectExists(name, clientId).then(exists => {
        if (exists) {
          // Get existing project ID
          this.db.get('SELECT id FROM projects WHERE LOWER(name) = LOWER(?) AND client_id = ?', [name, clientId], (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row.id);
          });
        } else {
          // Insert new project
          const sql = 'INSERT INTO projects (name, client_id, created_at) VALUES (?, ?, ?)';
          this.db.run(sql, [name, clientId, Date.now()], function(err: any) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          });
        }
      }).catch(reject);
    });
  }

  // Enhanced insertTask with duplicate validation
  async insertTask(name: string, projectId: number): Promise<number> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.checkTaskExists(name, projectId).then(exists => {
        if (exists) {
          // Get existing task ID
          this.db.get('SELECT id FROM tasks WHERE LOWER(name) = LOWER(?) AND project_id = ?', [name, projectId], (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row.id);
          });
        } else {
          // Insert new task
          const sql = 'INSERT INTO tasks (name, project_id, created_at) VALUES (?, ?, ?)';
          this.db.run(sql, [name, projectId, Date.now()], function(err: any) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          });
        }
      }).catch(reject);
    });
  }

  // Configuration data methods
  async getTeams(): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM teams WHERE is_active = 1 ORDER BY name', (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getRegions(): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM regions WHERE is_active = 1 ORDER BY name', (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getJobLevels(): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM job_levels WHERE is_active = 1 ORDER BY level_order', (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getBillableRateByJobLevel(jobLevelCode: string): Promise<number> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT rate_zar_per_hour 
        FROM billable_rates_by_job_level 
        WHERE job_level_code = ? AND is_active = 1 
        AND (effective_to IS NULL OR effective_to >= date('now'))
        ORDER BY effective_from DESC 
        LIMIT 1
      `;
      
      this.db.get(sql, [jobLevelCode], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row?.rate_zar_per_hour || 0);
      });
    });
  }

  // Configuration data CRUD methods
  async createTeam(name: string, description?: string): Promise<string> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      // Generate code from name (uppercase, replace spaces with underscores)
      const code = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      
      // Check if team with this code already exists
      this.db.get('SELECT code FROM teams WHERE code = ?', [code], (err: any, row: any) => {
        if (err) return reject(err);
        if (row) return reject(new Error('Team with this name already exists'));
        
        // Insert new team
        const sql = 'INSERT INTO teams (code, name, description, created_at, is_active) VALUES (?, ?, ?, ?, 1)';
        this.db.run(sql, [code, name, description, Date.now()], function(err: any) {
          if (err) reject(err);
          else resolve(code);
        });
      });
    });
  }

  async createRegion(name: string): Promise<string> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      // Generate code from name (uppercase, replace spaces with underscores)
      const code = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      
      // Check if region with this code already exists
      this.db.get('SELECT code FROM regions WHERE code = ?', [code], (err: any, row: any) => {
        if (err) return reject(err);
        if (row) return reject(new Error('Region with this name already exists'));
        
        // Insert new region
        const sql = 'INSERT INTO regions (code, name, is_active) VALUES (?, ?, 1)';
        this.db.run(sql, [code, name], function(err: any) {
          if (err) reject(err);
          else resolve(code);
        });
      });
    });
  }

  async createJobLevel(name: string, defaultRate?: number): Promise<string> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      // Generate code from name (uppercase, replace spaces with underscores)
      const code = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      
      // Check if job level with this code already exists
      this.db.get('SELECT code FROM job_levels WHERE code = ?', [code], (err: any, row: any) => {
        if (err) return reject(err);
        if (row) return reject(new Error('Job level with this name already exists'));
        
        // Get the next level order
        this.db.get('SELECT MAX(level_order) as max_order FROM job_levels', [], (err: any, orderRow: any) => {
          if (err) return reject(err);
          
          const nextOrder = (orderRow?.max_order || 0) + 1;
          
          // Insert new job level
          const sql = 'INSERT INTO job_levels (code, name, level_order, is_active) VALUES (?, ?, ?, 1)';
          this.db.run(sql, [code, name, nextOrder], function(err: any) {
            if (err) return reject(err);
            
            // If default rate is provided, create a billable rate entry
            if (defaultRate && defaultRate > 0) {
              const rateSql = `
                INSERT INTO billable_rates_by_job_level 
                (job_level_code, rate_zar_per_hour, effective_from, is_active) 
                VALUES (?, ?, date('now'), 1)
              `;
              
              this.db.run(rateSql, [code, defaultRate], (rateErr: any) => {
                if (rateErr) console.error('Failed to create default rate:', rateErr);
                resolve(code);
              });
            } else {
              resolve(code);
            }
          });
        });
      });
    });
  }

  // Enhanced user creation with new fields
  async createUserEnhanced(userData: {
    username: string;
    email: string;
    passwordHash: string;
    role?: 'admin' | 'user' | 'director';
    name?: string;
    surname?: string;
    team?: string;
    region?: string;
    jobLevel?: string;
    billableRate?: number;
    discountPercentage?: number;
    targetUtilization?: number;
  }): Promise<number> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    // Auto-populate billable rate if job level is provided but rate is not
    let finalBillableRate = userData.billableRate;
    if (userData.jobLevel && !finalBillableRate) {
      finalBillableRate = await this.getBillableRateByJobLevel(userData.jobLevel);
    }

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO users (
          username, email, password_hash, role, name, surname, team, region, 
          job_level, billable_rate, discount_percentage, target_utilization, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        userData.username,
        userData.email,
        userData.passwordHash,
        userData.role || 'user',
        userData.name || null,
        userData.surname || null,
        userData.team || null,
        userData.region || null,
        userData.jobLevel || null,
        finalBillableRate || 0,
        userData.discountPercentage || 0,
        userData.targetUtilization || 80,
        Date.now()
      ], function(err: any) {
        if (err) {
          console.error('Error creating user in database:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Analytics aggregation methods using materialized views
  async getUserDailyMetrics(userId?: number, dateFrom?: Date, dateTo?: Date): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM view_user_daily_metrics WHERE 1=1';
      const params: any[] = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      if (dateFrom) {
        sql += ' AND date >= ?';
        params.push(dateFrom.toISOString().split('T')[0]);
      }

      if (dateTo) {
        sql += ' AND date <= ?';
        params.push(dateTo.toISOString().split('T')[0]);
      }

      sql += ' ORDER BY date DESC, client';

      this.db.all(sql, params, (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getClientProfitability(userId?: number): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM view_client_profitability WHERE 1=1';
      const params: any[] = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      sql += ' ORDER BY revenue DESC';

      this.db.all(sql, params, (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getTeamPerformance(dateFrom?: Date, dateTo?: Date, team?: string, region?: string): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM view_team_performance WHERE 1=1';
      const params: any[] = [];

      if (dateFrom) {
        sql += ' AND date >= ?';
        params.push(dateFrom.toISOString().split('T')[0]);
      }

      if (dateTo) {
        sql += ' AND date <= ?';
        params.push(dateTo.toISOString().split('T')[0]);
      }

      if (team) {
        sql += ' AND team = ?';
        params.push(team);
      }

      if (region) {
        sql += ' AND region = ?';
        params.push(region);
      }

      sql += ' ORDER BY date DESC, team, region';

      this.db.all(sql, params, (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getMonthlyTrends(userId?: number, monthsBack: number = 6): Promise<any[]> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    return new Promise((resolve, reject) => {
      const now = new Date();
      const fromDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
      
      let sql = `
        SELECT 
          year, month, user_id, client,
          SUM(session_count) as session_count,
          SUM(total_hours) as total_hours,
          SUM(billable_hours) as billable_hours,
          SUM(revenue) as revenue,
          AVG(avg_hourly_rate) as avg_hourly_rate
        FROM view_monthly_trends 
        WHERE year >= ? AND month >= ?
      `;
      const params: any[] = [fromDate.getFullYear(), fromDate.getMonth() + 1];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      sql += ' GROUP BY year, month, user_id, client ORDER BY year DESC, month DESC';

      this.db.all(sql, params, (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Analytics summary table population methods
  async populateAnalyticsSummaries(): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    console.log('Populating analytics summary tables...');

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Populate daily summary from view
        const populateDailySql = `
          INSERT OR REPLACE INTO analytics_daily_summary 
          (user_id, date, session_count, total_active_ms, billable_ms, unique_clients, revenue)
          SELECT 
            user_id,
            date,
            session_count,
            total_active_ms,
            billable_ms,
            unique_clients,
            ROUND((billable_ms / 3600000.0) * COALESCE(billableRate, 0), 2) as revenue
          FROM user_daily_metrics_view
          WHERE date >= DATE('now', '-30 days')
        `;

        this.db.run(populateDailySql, (err: any) => {
          if (err) {
            console.error('Error populating daily summary:', err);
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }

          // Populate monthly summary from view
          const populateMonthlySql = `
            INSERT OR REPLACE INTO analytics_monthly_summary 
            (user_id, month, session_count, total_active_ms, billable_ms, unique_clients, revenue)
            SELECT 
              user_id,
              month,
              session_count,
              total_active_ms,
              billable_ms,
              unique_clients,
              monthly_revenue as revenue
            FROM monthly_trends_view
            WHERE month >= strftime('%Y-%m', DATE('now', '-12 months'))
          `;

          this.db.run(populateMonthlySql, (err: any) => {
            if (err) {
              console.error('Error populating monthly summary:', err);
              this.db.run('ROLLBACK');
              reject(err);
            } else {
              // Populate team summary from view
              const populateTeamSql = `
                INSERT OR REPLACE INTO analytics_team_summary 
                (team, region, date, team_size, total_sessions, total_active_ms, team_revenue)
                SELECT 
                  team,
                  region,
                  date,
                  team_size,
                  total_sessions,
                  total_active_ms,
                  team_revenue
                FROM team_performance_view
                WHERE date >= DATE('now', '-30 days')
              `;

              this.db.run(populateTeamSql, (err: any) => {
                if (err) {
                  console.error('Error populating team summary:', err);
                  this.db.run('ROLLBACK');
                  reject(err);
                } else {
                  this.db.run('COMMIT');
                  console.log('Analytics summary tables populated successfully');
                  resolve();
                }
              });
            }
          });
        });
      });
    });
  }

  // Keep the old version commented for reference
  /*
  async populateAnalyticsSummariesOld(): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      throw error;
    }

    console.log('Populating analytics summary tables...');

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Populate daily summary
        const populateDailySql = `
          INSERT OR REPLACE INTO analytics_daily_summary 
          (date, user_id, client, project, task, total_hours, billable_hours, session_count, revenue, created_at, updated_at)
          SELECT 
            DATE(start_time / 1000, 'unixepoch') as date,
            user_id,
            client,
            project,
            task,
            SUM(active_ms) / (1000.0 * 60 * 60) as total_hours,
            SUM(CASE WHEN is_billable = 1 THEN active_ms ELSE 0 END) / (1000.0 * 60 * 60) as billable_hours,
            COUNT(*) as session_count,
            SUM(CASE WHEN is_billable = 1 THEN 
              (active_ms / (1000.0 * 60 * 60)) * COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0)
              ELSE 0 END) as revenue,
            ${Date.now()},
            ${Date.now()}
          FROM sessions s
          LEFT JOIN users u ON s.user_id = u.id
          WHERE s.start_time >= ${Date.now() - (30 * 24 * 60 * 60 * 1000)} -- Last 30 days
          GROUP BY DATE(start_time / 1000, 'unixepoch'), user_id, client, project, task
        `;

        this.db.run(populateDailySql, (err: any) => {
          if (err) {
            console.error('Error populating daily summary:', err);
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }

          // Populate monthly summary
          const populateMonthlySql = `
            INSERT OR REPLACE INTO analytics_monthly_summary 
            (year, month, user_id, client, total_hours, billable_hours, session_count, revenue, avg_session_length, utilization_rate, created_at, updated_at)
            SELECT 
              strftime('%Y', datetime(start_time / 1000, 'unixepoch')) as year,
              strftime('%m', datetime(start_time / 1000, 'unixepoch')) as month,
              user_id,
              client,
              SUM(active_ms) / (1000.0 * 60 * 60) as total_hours,
              SUM(CASE WHEN is_billable = 1 THEN active_ms ELSE 0 END) / (1000.0 * 60 * 60) as billable_hours,
              COUNT(*) as session_count,
              SUM(CASE WHEN is_billable = 1 THEN 
                (active_ms / (1000.0 * 60 * 60)) * COALESCE(u.billable_rate, 650) * (1 - COALESCE(u.discount_percentage, 0) / 100.0)
                ELSE 0 END) as revenue,
              AVG(active_ms) / (1000.0 * 60 * 60) as avg_session_length,
              LEAST((SUM(active_ms) / (1000.0 * 60 * 60)) / 160.0 * 100, 100) as utilization_rate,
              ${Date.now()},
              ${Date.now()}
            FROM sessions s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.start_time >= ${Date.now() - (365 * 24 * 60 * 60 * 1000)} -- Last year
            GROUP BY strftime('%Y', datetime(start_time / 1000, 'unixepoch')), 
                     strftime('%m', datetime(start_time / 1000, 'unixepoch')), 
                     user_id, client
          `;

          this.db.run(populateMonthlySql, (err: any) => {
            if (err) {
              console.error('Error populating monthly summary:', err);
              this.db.run('ROLLBACK');
              reject(err);
            } else {
              this.db.run('COMMIT');
              console.log('Analytics summary tables populated successfully');
              resolve();
            }
          });
        });
      });
    });
  }
  */

  async close(): Promise<void> {
    this.isClosing = true;
    this.isInitialized = false;
    this.initializationPromise = null;

    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err: any) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          this.db = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Analytics table creation for performance optimization
  async createAnalyticsTables(): Promise<void> {
    await this.ensureReady();
    
    const queries = [
      // Drop existing views first to ensure they're recreated with correct schema
      'DROP VIEW IF EXISTS user_daily_metrics_view',
      'DROP VIEW IF EXISTS client_profitability_view', 
      'DROP VIEW IF EXISTS team_performance_view',
      'DROP VIEW IF EXISTS monthly_trends_view',
      
      // Analytics views for aggregated data
      `CREATE VIEW IF NOT EXISTS user_daily_metrics_view AS
       SELECT 
         s.user_id,
         u.username,
         u.team,
         u.region,
         u.job_level as jobLevel,
         u.billable_rate as billableRate,
         DATE(s.start_time/1000, 'unixepoch') as date,
         COUNT(*) as session_count,
         SUM(s.active_ms) as total_active_ms,
         SUM(s.paused_ms) as total_paused_ms,
         AVG(s.active_ms) as avg_session_ms,
         SUM(CASE WHEN s.is_billable = 1 THEN s.active_ms ELSE 0 END) as billable_ms,
         COUNT(DISTINCT s.client) as unique_clients,
         COUNT(DISTINCT s.project) as unique_projects
       FROM sessions s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.user_id IS NOT NULL
       GROUP BY s.user_id, DATE(s.start_time/1000, 'unixepoch')`,

      `CREATE VIEW IF NOT EXISTS client_profitability_view AS
       SELECT 
         s.client,
         s.user_id,
         u.username,
         u.billable_rate as billableRate,
         COUNT(*) as session_count,
         SUM(s.active_ms) as total_active_ms,
         SUM(CASE WHEN s.is_billable = 1 THEN s.active_ms ELSE 0 END) as billable_ms,
         ROUND(SUM(CASE WHEN s.is_billable = 1 THEN (s.active_ms / 3600000.0) * COALESCE(u.billable_rate, 0) ELSE 0 END), 2) as revenue
       FROM sessions s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.user_id IS NOT NULL
       GROUP BY s.client, s.user_id`,

      `CREATE VIEW IF NOT EXISTS team_performance_view AS
       SELECT 
         u.team,
         u.region,
         DATE(s.start_time/1000, 'unixepoch') as date,
         COUNT(DISTINCT s.user_id) as team_size,
         COUNT(*) as total_sessions,
         SUM(s.active_ms) as total_active_ms,
         AVG(s.active_ms) as avg_session_ms,
         SUM(CASE WHEN s.is_billable = 1 THEN s.active_ms ELSE 0 END) as billable_ms,
         ROUND(SUM(CASE WHEN s.is_billable = 1 THEN (s.active_ms / 3600000.0) * COALESCE(u.billable_rate, 0) ELSE 0 END), 2) as team_revenue
       FROM sessions s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.user_id IS NOT NULL AND u.team IS NOT NULL
       GROUP BY u.team, u.region, DATE(s.start_time/1000, 'unixepoch')`,

      `CREATE VIEW IF NOT EXISTS monthly_trends_view AS
       SELECT 
         s.user_id,
         u.username,
         u.team,
         strftime('%Y-%m', datetime(s.start_time/1000, 'unixepoch')) as month,
         COUNT(*) as session_count,
         SUM(s.active_ms) as total_active_ms,
         AVG(s.active_ms) as avg_session_ms,
         SUM(CASE WHEN s.is_billable = 1 THEN s.active_ms ELSE 0 END) as billable_ms,
         ROUND(SUM(CASE WHEN s.is_billable = 1 THEN (s.active_ms / 3600000.0) * COALESCE(u.billable_rate, 0) ELSE 0 END), 2) as monthly_revenue,
         COUNT(DISTINCT s.client) as unique_clients
       FROM sessions s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.user_id IS NOT NULL
       GROUP BY s.user_id, strftime('%Y-%m', datetime(s.start_time/1000, 'unixepoch'))`,

      // Summary tables for pre-calculated metrics
      `CREATE TABLE IF NOT EXISTS analytics_daily_summary (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER,
         date TEXT,
         session_count INTEGER,
         total_active_ms INTEGER,
         billable_ms INTEGER,
         unique_clients INTEGER,
         revenue DECIMAL(10,2),
         created_at INTEGER DEFAULT (strftime('%s', 'now')),
         FOREIGN KEY (user_id) REFERENCES users(id),
         UNIQUE(user_id, date)
       )`,

      `CREATE TABLE IF NOT EXISTS analytics_monthly_summary (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         user_id INTEGER,
         month TEXT,
         session_count INTEGER,
         total_active_ms INTEGER,
         billable_ms INTEGER,
         unique_clients INTEGER,
         revenue DECIMAL(10,2),
         created_at INTEGER DEFAULT (strftime('%s', 'now')),
         FOREIGN KEY (user_id) REFERENCES users(id),
         UNIQUE(user_id, month)
       )`,

      `CREATE TABLE IF NOT EXISTS analytics_team_summary (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         team TEXT,
         region TEXT,
         date TEXT,
         team_size INTEGER,
         total_sessions INTEGER,
         total_active_ms INTEGER,
         team_revenue DECIMAL(10,2),
         created_at INTEGER DEFAULT (strftime('%s', 'now')),
         UNIQUE(team, region, date)
       )`
    ];

    for (const query of queries) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.db.run(query, (err: any) => {
            if (err) {
              console.error('Error creating analytics table/view:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error('Failed to create analytics table/view:', error);
        throw error;
      }
    }
    
    console.log('Analytics tables and views created successfully');
  }
}

module.exports = { DatabaseService };
