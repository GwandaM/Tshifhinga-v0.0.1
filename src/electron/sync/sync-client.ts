/**
 * HTTP Client for Sync API Communication
 * Tshifhinga Time Tracker
 */

import { net } from 'electron';
import {
  ServerConfig,
  SyncRequest,
  SyncResponse,
  SyncPushData,
  PullData,
  CURRENT_SCHEMA_VERSION,
} from './sync-types';

export interface SyncClientConfig {
  serverConfig: ServerConfig;
  authToken: string | null;
  clientId: string;
  clientVersion: string;
  timeout?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * SyncApiClient - Handles HTTP communication with the central sync server
 */
export class SyncApiClient {
  private config: SyncClientConfig;
  private baseUrl: string;

  constructor(config: SyncClientConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 30000, // 30 second default
    };
    this.baseUrl = this.buildBaseUrl();
  }

  /**
   * Build the base URL from server config
   */
  private buildBaseUrl(): string {
    const { host, port, ssl } = this.config.serverConfig;
    const protocol = ssl ? 'https' : 'http';
    return `${protocol}://${host}:${port}`;
  }

  /**
   * Update server configuration
   */
  updateServerConfig(serverConfig: ServerConfig): void {
    this.config.serverConfig = serverConfig;
    this.baseUrl = this.buildBaseUrl();
  }

  /**
   * Update authentication token
   */
  updateAuthToken(token: string | null): void {
    this.config.authToken = token;
  }

  /**
   * Check server connectivity and get server info
   */
  async checkConnectivity(): Promise<ApiResponse<{
    online: boolean;
    schemaVersion: number;
    minClientVersion: string;
    serverTime: string;
  }>> {
    try {
      const response = await this.makeRequest<{
        online: boolean;
        schema_version: number;
        min_client_version: string;
        server_time: string;
      }>('GET', '/api/sync/info');

      if (response.success && response.data) {
        return {
          success: true,
          data: {
            online: true,
            schemaVersion: response.data.schema_version,
            minClientVersion: response.data.min_client_version,
            serverTime: response.data.server_time,
          },
        };
      }

      return { success: false, error: response.error || 'Unknown error' };
    } catch (err) {
      const error = err as Error;
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform full sync operation
   */
  async sync(
    pushData: SyncPushData,
    lastPullTimestamp: string | null
  ): Promise<ApiResponse<SyncResponse>> {
    const request: SyncRequest = {
      client_id: this.config.clientId,
      client_version: this.config.clientVersion,
      schema_version: CURRENT_SCHEMA_VERSION.current,
      last_pull_timestamp: lastPullTimestamp,
      push_data: pushData,
    };

    return this.makeRequest<SyncResponse>('POST', '/api/sync', request);
  }

  /**
   * Push sessions only (lightweight sync)
   */
  async pushSessions(pushData: SyncPushData): Promise<ApiResponse<{
    accepted: string[];
    conflicts: any[];
    rejected: any[];
  }>> {
    const request = {
      client_id: this.config.clientId,
      client_version: this.config.clientVersion,
      schema_version: CURRENT_SCHEMA_VERSION.current,
      sessions: pushData.sessions,
    };

    return this.makeRequest('POST', '/api/sync/push', request);
  }

  /**
   * Pull updates only
   */
  async pullUpdates(lastPullTimestamp: string | null): Promise<ApiResponse<PullData>> {
    const params = new URLSearchParams();
    if (lastPullTimestamp) {
      params.set('since', lastPullTimestamp);
    }
    params.set('client_id', this.config.clientId);

    return this.makeRequest<PullData>('GET', `/api/sync/pull?${params.toString()}`);
  }

  /**
   * Fetch notifications for the current user
   */
  async fetchNotifications(sinceTimestamp?: string): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (sinceTimestamp) {
      params.set('since', sinceTimestamp);
    }

    return this.makeRequest<any[]>('GET', `/api/sync/notifications?${params.toString()}`);
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsRead(notificationIds: string[]): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('POST', '/api/sync/notifications/read', {
      notification_ids: notificationIds,
    });
  }

  /**
   * Core HTTP request method using Electron's net module
   */
  private makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    return new Promise((resolve) => {
      const url = `${this.baseUrl}${path}`;

      try {
        const request = net.request({
          method,
          url,
        });

        // Set headers
        request.setHeader('Content-Type', 'application/json');
        request.setHeader('Accept', 'application/json');
        request.setHeader('X-Client-ID', this.config.clientId);
        request.setHeader('X-Client-Version', this.config.clientVersion);
        request.setHeader('X-Schema-Version', String(CURRENT_SCHEMA_VERSION.current));

        if (this.config.authToken) {
          request.setHeader('Authorization', `Bearer ${this.config.authToken}`);
        }

        // Set timeout
        let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
          timeoutId = null;
          request.abort();
          resolve({
            success: false,
            error: `Request timeout after ${this.config.timeout}ms`,
          });
        }, this.config.timeout);

        // Handle response
        let responseData = '';

        request.on('response', (response) => {
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            try {
              const statusCode = response.statusCode;

              if (statusCode >= 200 && statusCode < 300) {
                const data = responseData ? JSON.parse(responseData) : null;
                resolve({ success: true, data, statusCode });
              } else {
                let errorMessage = `HTTP ${statusCode}`;
                try {
                  const errorData = JSON.parse(responseData);
                  errorMessage = errorData.error || errorData.message || errorMessage;
                } catch {
                  // Use default error message
                }
                resolve({ success: false, error: errorMessage, statusCode });
              }
            } catch (parseErr) {
              resolve({
                success: false,
                error: `Failed to parse response: ${(parseErr as Error).message}`,
              });
            }
          });

          response.on('error', (err) => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            resolve({ success: false, error: `Response error: ${err.message}` });
          });
        });

        request.on('error', (err) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          resolve({ success: false, error: `Request error: ${err.message}` });
        });

        // Send body for POST/PUT requests
        if (body && (method === 'POST' || method === 'PUT')) {
          request.write(JSON.stringify(body));
        }

        request.end();
      } catch (err) {
        resolve({
          success: false,
          error: `Failed to create request: ${(err as Error).message}`,
        });
      }
    });
  }
}

/**
 * Create a sync client instance
 */
export function createSyncClient(config: SyncClientConfig): SyncApiClient {
  return new SyncApiClient(config);
}
