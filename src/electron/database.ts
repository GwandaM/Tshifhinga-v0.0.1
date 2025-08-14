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
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: number;
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
      // Use project root directory instead of system app data directory
      // Get the app directory (where the main.js is located)  
      const appPath = electronApp.getAppPath();
      console.log('App path:', appPath);
      
      // Go up to project root (from dist-electron to project root)
      const projectRoot = pathJoin(appPath, '..');
      
      // Create database in project root under 'data' folder
      const dbDir = pathJoin(projectRoot, 'data');
      console.log('Database directory:', dbDir);
      
      // Ensure directory exists with proper permissions
      if (!existsSync(dbDir)) {
        console.log('Creating database directory...');
        mkdirSync(dbDir, { recursive: true, mode: 0o755 });
        console.log('Database directory created successfully');
      } else {
        console.log('Database directory already exists');
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
                  chmodSync(this.dbPath, 0o666);
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
          
          // Ensure file has proper permissions
          try {
            chmodSync(this.dbPath, 0o666);
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

      let completedTables = 0;
      const totalTables = 6;
      let hasError = false;

      const checkCompletion = () => {
        completedTables++;
        if (completedTables === totalTables && !hasError) {
          this.createIndexes();
          this.seedInitialData();
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

  // Hierarchy CRUD operations
  async insertClient(name: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'INSERT INTO clients (name, created_at) VALUES (?, ?)';
      const db = this.db;
      db.run(sql, [name, Date.now()], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            // Client already exists, get its ID
            db.get('SELECT id FROM clients WHERE name = ?', [name], (getErr, row: any) => {
              if (getErr) reject(getErr);
              else resolve(row.id);
            });
          } else {
            reject(err);
          }
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async insertProject(name: string, clientId: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'INSERT INTO projects (name, client_id, created_at) VALUES (?, ?, ?)';
      const db = this.db;
      db.run(sql, [name, clientId, Date.now()], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            // Project already exists, get its ID
            db.get('SELECT id FROM projects WHERE name = ? AND client_id = ?', [name, clientId], (getErr, row: any) => {
              if (getErr) reject(getErr);
              else resolve(row.id);
            });
          } else {
            reject(err);
          }
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async insertTask(name: string, projectId: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = 'INSERT INTO tasks (name, project_id, created_at) VALUES (?, ?, ?)';
      const db = this.db;
      db.run(sql, [name, projectId, Date.now()], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            // Task already exists, get its ID
            db.get('SELECT id FROM tasks WHERE name = ? AND project_id = ?', [name, projectId], (getErr, row: any) => {
              if (getErr) reject(getErr);
              else resolve(row.id);
            });
          } else {
            reject(err);
          }
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

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
      const sql = 'SELECT id, username, email, password_hash as passwordHash, role, is_active as isActive, created_at as createdAt FROM users WHERE id = ? AND is_active = 1';
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
      const sql = 'SELECT id, username, email, role, is_active as isActive, created_at as createdAt FROM users ORDER BY created_at DESC';
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
}

module.exports = { DatabaseService };
