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
}

class DatabaseService {
  private db: any | null = null;
  private dbPath: string;

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
      this.init();
    } catch (error) {
      console.error('Error in database constructor:', error);
      throw error;
    }
  }

  private init(): void {
    this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err: any) => {
      if (err) {
        console.error('Error opening database:', err);
        // Try to fix permissions and retry once
        try {
          if (existsSync(this.dbPath)) {
            chmodSync(this.dbPath, 0o666);
          }
          this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
          console.log('Connected to SQLite database at:', this.dbPath, '(after permission fix)');
          this.createTables();
        } catch (retryErr) {
          console.error('Failed to fix database permissions:', retryErr);
        }
      } else {
        console.log('Connected to SQLite database at:', this.dbPath);
        // Ensure file has proper permissions
        try {
          chmodSync(this.dbPath, 0o666);
        } catch (chmodErr) {
          console.warn('Could not set database file permissions:', chmodErr);
        }
        this.createTables();
      }
    });
  }

  private createTables(): void {
    if (!this.db) return;

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
        is_billable BOOLEAN DEFAULT 1
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

    // Create all tables
    this.db.serialize(() => {
      this.db.run(createSessionsTable, (err) => {
        if (err) {
          console.error('Error creating sessions table:', err);
        } else {
          console.log('Sessions table ready');
          this.addBillableColumnIfMissing();
        }
      });

      this.db.run(createClientsTable, (err) => {
        if (err) {
          console.error('Error creating clients table:', err);
        } else {
          console.log('Clients table ready');
        }
      });

      this.db.run(createProjectsTable, (err) => {
        if (err) {
          console.error('Error creating projects table:', err);
        } else {
          console.log('Projects table ready');
        }
      });

      this.db.run(createTasksTable, (err) => {
        if (err) {
          console.error('Error creating tasks table:', err);
        } else {
          console.log('Tasks table ready');
        }
      });

      this.createIndexes();
      this.seedInitialData();
    });
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

  private createIndexes(): void {
    if (!this.db) return;

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)',
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
          is_billable as isBillable
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
          }));
          resolve(sessions);
        }
      });
    });
  }

  async insertSession(session: SessionRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT INTO sessions (
          id, client, project, task, start_time, end_time,
          active_ms, paused_ms, notes, created_at, is_billable
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async updateSession(id: string, updates: Partial<Omit<SessionRecord, 'id' | 'createdAt'>>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

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
          is_billable as isBillable
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
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

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

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('Database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = { DatabaseService };