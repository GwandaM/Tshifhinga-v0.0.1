import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ConfigService } from './config-service';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  metadata?: any;
  stack?: string;
}

class LoggerService {
  private static instance: LoggerService;
  private logLevel: LogLevel;
  private enableFileLogging: boolean;
  private logDir: string;
  private maxLogFiles: number;
  private maxLogSize: number; // in bytes

  private constructor() {
    const config = ConfigService.getInstance().getLoggingConfig();
    this.logLevel = this.parseLogLevel(config.level);
    this.enableFileLogging = config.enableFileLogging;
    this.maxLogFiles = config.maxLogFiles;
    this.maxLogSize = this.parseLogSize(config.maxLogSize);
    
    // Setup log directory
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.ensureLogDirectory();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private parseLogSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 10 * 1024 * 1024; // 10MB default
    
    const size = parseInt(match[1]);
    const unit = match[2]?.toLowerCase() || '';
    
    switch (unit) {
      case 'k': return size * 1024;
      case 'm': return size * 1024 * 1024;
      case 'g': return size * 1024 * 1024 * 1024;
      default: return size;
    }
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
      this.enableFileLogging = false;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatLogEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
    ];

    if (entry.context) {
      parts.push(`[${entry.context}]`);
    }

    parts.push(entry.message);

    if (entry.metadata) {
      try {
        parts.push('- ' + JSON.stringify(entry.metadata));
      } catch (error) {
        parts.push('- [Circular Reference in Metadata]');
      }
    }

    if (entry.stack) {
      parts.push('\n' + entry.stack);
    }

    return parts.join(' ');
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.enableFileLogging) return;

    try {
      const logFile = path.join(this.logDir, 'app.log');
      const logLine = this.formatLogEntry(entry) + '\n';

      // Check if we need to rotate the log
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size >= this.maxLogSize) {
          this.rotateLogFiles();
        }
      }

      // Append to current log file
      fs.appendFileSync(logFile, logLine, { encoding: 'utf8' });
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private rotateLogFiles(): void {
    try {
      const logFile = path.join(this.logDir, 'app.log');
      
      // Move existing numbered logs
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = path.join(this.logDir, `app.log.${i}`);
        const newFile = path.join(this.logDir, `app.log.${i + 1}`);
        
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current log to .1
      if (fs.existsSync(logFile)) {
        const archivedFile = path.join(this.logDir, 'app.log.1');
        fs.renameSync(logFile, archivedFile);
      }
    } catch (error) {
      console.error('Failed to rotate log files:', error);
    }
  }

  private createLogEntry(level: string, message: string, context?: string, metadata?: any, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata
    };

    if (error && error.stack) {
      entry.stack = error.stack;
    }

    return entry;
  }

  private log(level: LogLevel, levelName: string, message: string, context?: string, metadata?: any, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(levelName, message, context, metadata, error);
    const formattedMessage = this.formatLogEntry(entry);

    // Always log to console in development or for errors
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev || level <= LogLevel.WARN) {
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
      }
    }

    // Write to file if enabled
    this.writeToFile(entry);
  }

  public error(message: string, context?: string, error?: Error, metadata?: any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context, metadata, error);
  }

  public warn(message: string, context?: string, metadata?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, context, metadata);
  }

  public info(message: string, context?: string, metadata?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, context, metadata);
  }

  public debug(message: string, context?: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context, metadata);
  }

  // Security logging methods
  public securityEvent(event: string, details: any, userId?: number): void {
    this.warn(`SECURITY EVENT: ${event}`, 'SECURITY', {
      event,
      userId,
      details,
      timestamp: new Date().toISOString(),
      pid: process.pid
    });
  }

  public authEvent(event: string, username?: string, success?: boolean, details?: any): void {
    this.info(`AUTH: ${event}`, 'AUTH', {
      event,
      username,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  public databaseEvent(operation: string, table?: string, duration?: number, error?: Error): void {
    if (error) {
      this.error(`DB ERROR: ${operation}`, 'DATABASE', error, { table, duration });
    } else {
      this.debug(`DB: ${operation}`, 'DATABASE', { table, duration });
    }
  }

  public performanceEvent(operation: string, duration: number, metadata?: any): void {
    if (duration > 1000) { // Log slow operations (>1s)
      this.warn(`SLOW OPERATION: ${operation} took ${duration}ms`, 'PERFORMANCE', metadata);
    } else {
      this.debug(`PERFORMANCE: ${operation} took ${duration}ms`, 'PERFORMANCE', metadata);
    }
  }

  // Cleanup methods
  public async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        if (file.startsWith('app.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            this.info(`Cleaned up old log file: ${file}`, 'LOG_CLEANUP');
          }
        }
      }
    } catch (error) {
      this.error('Failed to cleanup old logs', 'LOG_CLEANUP', error as Error);
    }
  }

  public getLogFiles(): string[] {
    try {
      const files = fs.readdirSync(this.logDir);
      return files
        .filter(file => file.startsWith('app.log'))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      this.error('Failed to get log files', 'LOG_MANAGEMENT', error as Error);
      return [];
    }
  }

  public async getLogContent(filename: string, lines: number = 100): Promise<string[]> {
    try {
      const filePath = path.join(this.logDir, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error('Log file not found');
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      
      // Return last N lines
      return allLines.slice(-lines);
    } catch (error) {
      this.error('Failed to read log content', 'LOG_MANAGEMENT', error as Error);
      return [];
    }
  }
}

export { LoggerService };

// CommonJS export for compatibility
module.exports = { LoggerService };