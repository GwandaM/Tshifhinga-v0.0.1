import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface AppConfig {
  jwtSecret: string;
  jwtExpiry: string;
  databasePath: string;
  environment: 'development' | 'production' | 'test';
  security: {
    saltRounds: number;
    tokenExpiry: string;
    maxLoginAttempts: number;
    lockoutDuration: number; // in minutes
  };
  database: {
    connectionTimeout: number;
    queryTimeout: number;
    maxConnections: number;
    idleTimeout: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableFileLogging: boolean;
    maxLogFiles: number;
    maxLogSize: string; // e.g., '10m'
  };
}

class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;
  private configPath: string;

  private constructor() {
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private getConfigPath(): string {
    // Use proper application data directory
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'config');
  }

  private generateSecureJWTSecret(): string {
    // Generate a cryptographically secure random secret
    return crypto.randomBytes(64).toString('hex');
  }

  private getDefaultConfig(): AppConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const userDataPath = app.getPath('userData');
    
    return {
      jwtSecret: this.generateSecureJWTSecret(),
      jwtExpiry: '24h',
      databasePath: path.join(userDataPath, 'data', 'sessions.db'),
      environment: isDevelopment ? 'development' : 'production',
      security: {
        saltRounds: 12,
        tokenExpiry: '24h',
        maxLoginAttempts: 5,
        lockoutDuration: 15, // 15 minutes
      },
      database: {
        connectionTimeout: 30000, // 30 seconds
        queryTimeout: 10000, // 10 seconds
        maxConnections: 5,
        idleTimeout: 300000, // 5 minutes
      },
      logging: {
        level: isDevelopment ? 'debug' : 'info',
        enableFileLogging: true,
        maxLogFiles: 5,
        maxLogSize: '10m',
      },
    };
  }

  private loadConfig(): AppConfig {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
      }

      const configFile = path.join(this.configPath, 'app-config.json');
      
      if (fs.existsSync(configFile)) {
        const configData = fs.readFileSync(configFile, 'utf8');
        const loadedConfig = JSON.parse(configData);
        
        // Merge with defaults to ensure all keys exist
        const defaultConfig = this.getDefaultConfig();
        const mergedConfig = this.mergeConfigObjects(defaultConfig, loadedConfig);
        
        // Validate and regenerate JWT secret if it's the old hardcoded one
        if (mergedConfig.jwtSecret === 'your-secret-key-change-in-production' || 
            mergedConfig.jwtSecret.length < 32) {
          console.warn('Detected insecure JWT secret, generating new one...');
          mergedConfig.jwtSecret = this.generateSecureJWTSecret();
          this.saveConfig(mergedConfig);
        }
        
        return mergedConfig;
      } else {
        // Create new config file
        const defaultConfig = this.getDefaultConfig();
        this.saveConfig(defaultConfig);
        return defaultConfig;
      }
    } catch (error) {
      console.error('Error loading config, using defaults:', error);
      return this.getDefaultConfig();
    }
  }

  private mergeConfigObjects(defaultConfig: AppConfig, loadedConfig: any): AppConfig {
    const merged = { ...defaultConfig };
    
    for (const key in loadedConfig) {
      if (key in defaultConfig) {
        if (typeof defaultConfig[key as keyof AppConfig] === 'object' && 
            typeof loadedConfig[key] === 'object' &&
            !Array.isArray(defaultConfig[key as keyof AppConfig])) {
          // Deep merge objects
          merged[key as keyof AppConfig] = {
            ...defaultConfig[key as keyof AppConfig] as any,
            ...loadedConfig[key]
          };
        } else {
          merged[key as keyof AppConfig] = loadedConfig[key];
        }
      }
    }
    
    return merged;
  }

  private saveConfig(config: AppConfig): void {
    try {
      const configFile = path.join(this.configPath, 'app-config.json');
      
      // Ensure config directory exists with proper permissions
      const configDir = path.dirname(configFile);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
      }
      
      // Write config with restricted permissions
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { 
        mode: 0o600, // Only readable/writable by owner
        encoding: 'utf8' 
      });
      
      console.log('Configuration saved successfully');
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config }; // Return a copy to prevent external modification
  }

  public getJWTSecret(): string {
    return this.config.jwtSecret;
  }

  public getDatabasePath(): string {
    return this.config.databasePath;
  }

  public getSecurityConfig() {
    return { ...this.config.security };
  }

  public getDatabaseConfig() {
    return { ...this.config.database };
  }

  public getLoggingConfig() {
    return { ...this.config.logging };
  }

  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = this.mergeConfigObjects(this.config, updates);
    this.saveConfig(this.config);
  }

  public regenerateJWTSecret(): string {
    const newSecret = this.generateSecureJWTSecret();
    this.config.jwtSecret = newSecret;
    this.saveConfig(this.config);
    console.log('JWT secret regenerated successfully');
    return newSecret;
  }

  public validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate JWT secret
    if (!this.config.jwtSecret || this.config.jwtSecret.length < 32) {
      errors.push('JWT secret is too short or missing');
    }

    // Validate database path
    try {
      const dbDir = path.dirname(this.config.databasePath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 });
      }
    } catch (error) {
      errors.push(`Database path is invalid: ${error}`);
    }

    // Validate security settings
    if (this.config.security.saltRounds < 10) {
      errors.push('Salt rounds should be at least 10 for security');
    }

    if (this.config.security.maxLoginAttempts < 1) {
      errors.push('Max login attempts must be positive');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public isFirstRun(): boolean {
    const configFile = path.join(this.configPath, 'app-config.json');
    const firstRunFile = path.join(this.configPath, '.first-run-complete');
    return !fs.existsSync(firstRunFile);
  }

  public markFirstRunComplete(): void {
    try {
      const firstRunFile = path.join(this.configPath, '.first-run-complete');
      fs.writeFileSync(firstRunFile, new Date().toISOString(), { mode: 0o600 });
    } catch (error) {
      console.error('Error marking first run complete:', error);
    }
  }

  public reset(): void {
    console.warn('Resetting configuration to defaults...');
    this.config = this.getDefaultConfig();
    this.saveConfig(this.config);
    
    // Remove first run marker
    const firstRunFile = path.join(this.configPath, '.first-run-complete');
    if (fs.existsSync(firstRunFile)) {
      fs.unlinkSync(firstRunFile);
    }
  }
}

export { ConfigService, AppConfig };

// CommonJS export for compatibility
module.exports = { ConfigService };