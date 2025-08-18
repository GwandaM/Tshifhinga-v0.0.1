import * as sqlite3 from 'sqlite3';
import { LoggerService } from './logger-service';
import { ConfigService } from './config-service';

interface PooledConnection {
  db: sqlite3.Database;
  lastUsed: number;
  inUse: boolean;
  id: string;
}

interface ConnectionOptions {
  timeout?: number;
  mode?: number;
}

class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool;
  private connections: Map<string, PooledConnection> = new Map();
  private dbPath: string;
  private maxConnections: number;
  private idleTimeout: number;
  private connectionTimeout: number;
  private logger: LoggerService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    const config = ConfigService.getInstance();
    this.dbPath = config.getDatabasePath();
    
    const dbConfig = config.getDatabaseConfig();
    this.maxConnections = dbConfig.maxConnections;
    this.idleTimeout = dbConfig.idleTimeout;
    this.connectionTimeout = dbConfig.connectionTimeout;
    
    this.logger = LoggerService.getInstance();
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  public static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startCleanupInterval(): void {
    // Clean up idle connections every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000);
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToClose: string[] = [];

    for (const [id, conn] of this.connections.entries()) {
      if (!conn.inUse && (now - conn.lastUsed) > this.idleTimeout) {
        connectionsToClose.push(id);
      }
    }

    for (const id of connectionsToClose) {
      this.closeConnection(id);
    }

    if (connectionsToClose.length > 0) {
      this.logger.debug(
        `Cleaned up ${connectionsToClose.length} idle database connections`,
        'DB_POOL'
      );
    }
  }

  private async createConnection(options: ConnectionOptions = {}): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = options.timeout || this.connectionTimeout;
      const mode = options.mode || (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

      // Set a timeout for connection creation
      const timeoutHandle = setTimeout(() => {
        this.logger.error('Database connection timeout', 'DB_POOL', undefined, {
          timeout,
          dbPath: this.dbPath
        });
        reject(new Error(`Database connection timeout after ${timeout}ms`));
      }, timeout);

      const db = new sqlite3.Database(this.dbPath, mode, (err) => {
        clearTimeout(timeoutHandle);

        if (err) {
          this.logger.error('Failed to create database connection', 'DB_POOL', err, {
            dbPath: this.dbPath,
            mode
          });
          reject(err);
          return;
        }

        const connectionId = this.generateConnectionId();
        const connection: PooledConnection = {
          db,
          lastUsed: Date.now(),
          inUse: true,
          id: connectionId
        };

        // Configure the connection
        this.configureConnection(db);

        this.logger.performanceEvent('DB_CONNECTION_CREATED', Date.now() - startTime, {
          connectionId,
          poolSize: this.connections.size
        });

        resolve(connection);
      });
    });
  }

  private configureConnection(db: sqlite3.Database): void {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
    
    // Set journal mode to WAL for better concurrency
    db.run('PRAGMA journal_mode = WAL');
    
    // Set synchronous mode to NORMAL for better performance
    db.run('PRAGMA synchronous = NORMAL');
    
    // Set page size for better performance
    db.run('PRAGMA page_size = 4096');
    
    // Set cache size (negative value means KB)
    db.run('PRAGMA cache_size = -64000'); // 64MB cache
    
    // Set temp store to memory
    db.run('PRAGMA temp_store = MEMORY');
    
    // Set busy timeout for locked database
    db.run('PRAGMA busy_timeout = 30000'); // 30 seconds
  }

  public async getConnection(options: ConnectionOptions = {}): Promise<PooledConnection> {
    // Try to find an available existing connection
    for (const [id, conn] of this.connections.entries()) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.lastUsed = Date.now();
        
        this.logger.debug('Reused existing database connection', 'DB_POOL', {
          connectionId: id,
          poolSize: this.connections.size
        });
        
        return conn;
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.maxConnections) {
      const newConnection = await this.createConnection(options);
      this.connections.set(newConnection.id, newConnection);
      
      this.logger.debug('Created new database connection', 'DB_POOL', {
        connectionId: newConnection.id,
        poolSize: this.connections.size
      });
      
      return newConnection;
    }

    // Wait for a connection to become available
    return this.waitForAvailableConnection(options.timeout || this.connectionTimeout);
  }

  private async waitForAvailableConnection(timeout: number): Promise<PooledConnection> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.logger.error('Connection pool timeout', 'DB_POOL', undefined, {
          timeout,
          poolSize: this.connections.size,
          maxConnections: this.maxConnections
        });
        reject(new Error(`Connection pool timeout after ${timeout}ms`));
      }, timeout);

      const checkForConnection = () => {
        for (const [id, conn] of this.connections.entries()) {
          if (!conn.inUse) {
            clearTimeout(timeoutHandle);
            conn.inUse = true;
            conn.lastUsed = Date.now();
            
            this.logger.performanceEvent('DB_CONNECTION_WAIT', Date.now() - startTime, {
              connectionId: id
            });
            
            resolve(conn);
            return;
          }
        }

        // Check again in 10ms
        setTimeout(checkForConnection, 10);
      };

      checkForConnection();
    });
  }

  public releaseConnection(connection: PooledConnection): void {
    if (this.connections.has(connection.id)) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      
      this.logger.debug('Released database connection', 'DB_POOL', {
        connectionId: connection.id
      });
    } else {
      this.logger.warn('Attempted to release unknown connection', 'DB_POOL', {
        connectionId: connection.id
      });
    }
  }

  private closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.db.close((err) => {
        if (err) {
          this.logger.error('Error closing database connection', 'DB_POOL', err, {
            connectionId
          });
        } else {
          this.logger.debug('Closed database connection', 'DB_POOL', {
            connectionId
          });
        }
      });
      this.connections.delete(connectionId);
    }
  }

  public async executeQuery<T = any>(
    sql: string, 
    params: any[] = [],
    options: ConnectionOptions = {}
  ): Promise<T[]> {
    const connection = await this.getConnection(options);
    const startTime = Date.now();
    
    try {
      return await new Promise<T[]>((resolve, reject) => {
        const timeout = options.timeout || 10000; // 10 second query timeout
        
        const timeoutHandle = setTimeout(() => {
          this.logger.error('Database query timeout', 'DB_POOL', undefined, {
            sql: sql.substring(0, 100),
            timeout
          });
          reject(new Error(`Query timeout after ${timeout}ms`));
        }, timeout);

        connection.db.all(sql, params, (err, rows) => {
          clearTimeout(timeoutHandle);
          
          if (err) {
            this.logger.databaseEvent('QUERY_ERROR', undefined, Date.now() - startTime, err);
            reject(err);
          } else {
            this.logger.databaseEvent('QUERY_SUCCESS', undefined, Date.now() - startTime);
            resolve(rows as T[]);
          }
        });
      });
    } finally {
      this.releaseConnection(connection);
    }
  }

  public async executeStatement(
    sql: string, 
    params: any[] = [],
    options: ConnectionOptions = {}
  ): Promise<{ lastID?: number; changes: number }> {
    const connection = await this.getConnection(options);
    const startTime = Date.now();
    
    try {
      return await new Promise<{ lastID?: number; changes: number }>((resolve, reject) => {
        const timeout = options.timeout || 10000;
        
        const timeoutHandle = setTimeout(() => {
          this.logger.error('Database statement timeout', 'DB_POOL', undefined, {
            sql: sql.substring(0, 100),
            timeout
          });
          reject(new Error(`Statement timeout after ${timeout}ms`));
        }, timeout);

        const logger = this.logger;
        connection.db.run(sql, params, function(err) {
          clearTimeout(timeoutHandle);
          
          if (err) {
            logger.databaseEvent('STATEMENT_ERROR', undefined, Date.now() - startTime, err);
            reject(err);
          } else {
            logger.databaseEvent('STATEMENT_SUCCESS', undefined, Date.now() - startTime);
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        });
      });
    } finally {
      this.releaseConnection(connection);
    }
  }

  public async executeTransaction(operations: ((db: sqlite3.Database) => Promise<void>)[]): Promise<void> {
    const connection = await this.getConnection();
    const startTime = Date.now();
    
    try {
      await new Promise<void>((resolve, reject) => {
        connection.db.serialize(() => {
          connection.db.run('BEGIN TRANSACTION', (err) => {
            if (err) {
              reject(err);
              return;
            }

            const executeOperations = async () => {
              try {
                for (const operation of operations) {
                  await operation(connection.db);
                }
                
                connection.db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    reject(commitErr);
                  } else {
                    this.logger.databaseEvent('TRANSACTION_SUCCESS', undefined, Date.now() - startTime);
                    resolve();
                  }
                });
              } catch (error) {
                connection.db.run('ROLLBACK', () => {
                  this.logger.databaseEvent('TRANSACTION_ROLLBACK', undefined, Date.now() - startTime, error as Error);
                  reject(error);
                });
              }
            };

            executeOperations();
          });
        });
      });
    } finally {
      this.releaseConnection(connection);
    }
  }

  public getPoolStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
  } {
    let activeCount = 0;
    let idleCount = 0;

    for (const conn of this.connections.values()) {
      if (conn.inUse) {
        activeCount++;
      } else {
        idleCount++;
      }
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: activeCount,
      idleConnections: idleCount,
      maxConnections: this.maxConnections
    };
  }

  public async closeAllConnections(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    const closePromises: Promise<void>[] = [];

    for (const [id, connection] of this.connections.entries()) {
      closePromises.push(
        new Promise<void>((resolve) => {
          connection.db.close((err) => {
            if (err) {
              this.logger.error('Error closing connection during shutdown', 'DB_POOL', err, { connectionId: id });
            }
            resolve();
          });
        })
      );
    }

    await Promise.all(closePromises);
    this.connections.clear();
    
    this.logger.info('All database connections closed', 'DB_POOL');
  }
}

export { DatabaseConnectionPool, PooledConnection, ConnectionOptions };

// CommonJS export for compatibility
module.exports = { DatabaseConnectionPool };