/**
 * Server Discovery Module
 * Tshifhinga Time Tracker
 *
 * Supports multiple discovery methods:
 * 1. Static configuration file
 * 2. DNS lookup
 * 3. Environment variables
 * 4. Network drive config (for enterprise environments)
 */

import { app } from 'electron';
import { promises as fs } from 'fs';
import { resolve as resolvePath, join } from 'path';
import { lookup } from 'dns';
import { promisify } from 'util';
import { ServerConfig, DiscoveryConfig, DiscoveryMethod } from './sync-types';

const dnsLookup = promisify(lookup);

export interface DiscoveryResult {
  success: boolean;
  config?: ServerConfig;
  method?: string;
  error?: string;
}

/**
 * Default discovery configuration
 */
export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  methods: [
    { type: 'config_file', value: 'sync_server.json', priority: 1 },
    { type: 'dns', value: 'timetracker.local', priority: 2 },
    { type: 'static', value: 'localhost:5432', priority: 3 },
  ],
  fallbackStaticIps: ['192.168.1.50', '10.0.0.50'],
};

/**
 * ServerDiscovery - Handles server location discovery
 */
export class ServerDiscovery {
  private config: DiscoveryConfig;
  private cachedConfig: ServerConfig | null = null;
  private cacheTimestamp: number = 0;
  private cacheTtlMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(config?: Partial<DiscoveryConfig>) {
    this.config = { ...DEFAULT_DISCOVERY_CONFIG, ...config };
    // Sort methods by priority
    this.config.methods.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Discover server using configured methods
   */
  async discover(forceRefresh: boolean = false): Promise<DiscoveryResult> {
    // Return cached config if still valid
    if (!forceRefresh && this.cachedConfig && Date.now() - this.cacheTimestamp < this.cacheTtlMs) {
      return {
        success: true,
        config: this.cachedConfig,
        method: 'cache',
      };
    }

    // Try each discovery method in priority order
    for (const method of this.config.methods) {
      const result = await this.tryMethod(method);
      if (result.success && result.config) {
        // Cache the result
        this.cachedConfig = result.config;
        this.cacheTimestamp = Date.now();
        return result;
      }
    }

    // Try fallback static IPs
    if (this.config.fallbackStaticIps) {
      for (const ip of this.config.fallbackStaticIps) {
        const config = this.parseStaticAddress(`${ip}:5432`);
        if (config) {
          return {
            success: true,
            config,
            method: 'fallback_static',
          };
        }
      }
    }

    return {
      success: false,
      error: 'Could not discover server using any configured method',
    };
  }

  /**
   * Try a specific discovery method
   */
  private async tryMethod(method: DiscoveryMethod): Promise<DiscoveryResult> {
    try {
      switch (method.type) {
        case 'config_file':
          return await this.discoverFromConfigFile(method.value);
        case 'dns':
          return await this.discoverFromDns(method.value);
        case 'static':
          return this.discoverFromStatic(method.value);
        default:
          return { success: false, error: `Unknown discovery method: ${method.type}` };
      }
    } catch (err) {
      return {
        success: false,
        error: `${method.type} discovery failed: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Discover from local config file
   */
  private async discoverFromConfigFile(filename: string): Promise<DiscoveryResult> {
    // Check multiple locations for config file
    const searchPaths = [
      // App data directory
      join(app.getPath('userData'), filename),
      // App directory
      join(app.getAppPath(), filename),
      // Home directory
      join(app.getPath('home'), '.tshifhinga', filename),
      // Current working directory
      resolvePath(filename),
    ];

    // Also check network paths on Windows
    if (process.platform === 'win32') {
      searchPaths.push(
        'Z:\\General\\TimeTrackingConfig\\server_config.json',
        'Y:\\Shared\\TimeTracker\\server_config.json',
        '\\\\fileserver\\shared\\timetracker\\server_config.json'
      );
    }

    // On macOS/Linux, check common network mount points
    if (process.platform === 'darwin' || process.platform === 'linux') {
      searchPaths.push(
        '/Volumes/Shared/TimeTracker/server_config.json',
        '/mnt/shared/timetracker/server_config.json',
        '/network/timetracker/server_config.json'
      );
    }

    for (const configPath of searchPaths) {
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(content) as Partial<ServerConfig>;

        if (this.validateServerConfig(config)) {
          console.log(`Server config loaded from: ${configPath}`);
          return {
            success: true,
            config: this.normalizeConfig(config),
            method: `config_file:${configPath}`,
          };
        }
      } catch {
        // File doesn't exist or is invalid, try next path
        continue;
      }
    }

    return { success: false, error: 'No valid config file found' };
  }

  /**
   * Discover from DNS lookup
   */
  private async discoverFromDns(hostname: string): Promise<DiscoveryResult> {
    try {
      const result = await dnsLookup(hostname);
      const address = typeof result === 'string' ? result : result.address;

      if (address) {
        console.log(`Server discovered via DNS: ${hostname} -> ${address}`);
        return {
          success: true,
          config: {
            host: address,
            port: 5432,
            dbName: 'tshifhinga_central',
            ssl: false,
          },
          method: `dns:${hostname}`,
        };
      }
    } catch (err) {
      // DNS lookup failed
    }

    return { success: false, error: `DNS lookup failed for ${hostname}` };
  }

  /**
   * Parse static address configuration
   */
  private discoverFromStatic(address: string): DiscoveryResult {
    const config = this.parseStaticAddress(address);
    if (config) {
      return {
        success: true,
        config,
        method: `static:${address}`,
      };
    }
    return { success: false, error: `Invalid static address: ${address}` };
  }

  /**
   * Parse a static address string (host:port)
   */
  private parseStaticAddress(address: string): ServerConfig | null {
    const parts = address.split(':');
    if (parts.length >= 1) {
      const host = parts[0];
      const port = parts.length > 1 ? parseInt(parts[1], 10) : 5432;

      if (host && !isNaN(port)) {
        return {
          host,
          port,
          dbName: 'tshifhinga_central',
          ssl: false,
        };
      }
    }
    return null;
  }

  /**
   * Validate server config has required fields
   */
  private validateServerConfig(config: Partial<ServerConfig>): boolean {
    return !!(config.host && typeof config.host === 'string');
  }

  /**
   * Normalize config with defaults
   */
  private normalizeConfig(config: Partial<ServerConfig>): ServerConfig {
    return {
      host: config.host!,
      port: config.port || 5432,
      dbName: config.dbName || 'tshifhinga_central',
      ssl: config.ssl ?? false,
      connectionTimeout: config.connectionTimeout || 10000,
    };
  }

  /**
   * Save server config to local file for future use
   */
  async saveConfig(config: ServerConfig): Promise<void> {
    const configPath = join(app.getPath('userData'), 'sync_server.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    this.cachedConfig = config;
    this.cacheTimestamp = Date.now();
    console.log(`Server config saved to: ${configPath}`);
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get current cached config (if any)
   */
  getCachedConfig(): ServerConfig | null {
    return this.cachedConfig;
  }

  /**
   * Update discovery configuration
   */
  updateConfig(config: Partial<DiscoveryConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.methods) {
      this.config.methods.sort((a, b) => a.priority - b.priority);
    }
    this.clearCache();
  }
}

// Singleton instance
let discoveryInstance: ServerDiscovery | null = null;

export function getServerDiscovery(config?: Partial<DiscoveryConfig>): ServerDiscovery {
  if (!discoveryInstance) {
    discoveryInstance = new ServerDiscovery(config);
  }
  return discoveryInstance;
}

export function resetServerDiscovery(): void {
  if (discoveryInstance) {
    discoveryInstance.clearCache();
  }
  discoveryInstance = null;
}
