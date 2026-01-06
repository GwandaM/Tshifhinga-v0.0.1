/**
 * Sync Settings Panel Component
 * Configuration UI for sync settings
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  Check,
  X,
  Loader2,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSync } from '@/hooks/useSync';

interface ServerConfig {
  host: string;
  port: number;
  dbName: string;
  ssl?: boolean;
}

interface SyncConfig {
  enabled: boolean;
  autoSyncIntervalMs: number;
}

export function SyncSettingsPanel() {
  const { toast } = useToast();
  const { health, configureServer, discoverServer, checkConnectivity } = useSync();

  // Server config state
  const [serverHost, setServerHost] = useState('');
  const [serverPort, setServerPort] = useState('5432');
  const [dbName, setDbName] = useState('tshifhinga_central');
  const [useSsl, setUseSsl] = useState(false);

  // Sync config state
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncInterval, setSyncInterval] = useState('15');

  // UI state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'failed'>('unknown');

  // Discover server on mount
  useEffect(() => {
    handleDiscover();
  }, []);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
      const config = await discoverServer();
      if (config) {
        setServerHost(config.host);
        setServerPort(String(config.port));
        setDbName(config.dbName);
        setUseSsl(config.ssl || false);
        toast({
          title: 'Server discovered',
          description: `Found server at ${config.host}:${config.port}`,
        });
      } else {
        toast({
          title: 'No server found',
          description: 'Could not automatically discover a sync server',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Discovery failed:', err);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleTestConnection = async () => {
    if (!serverHost) {
      toast({
        title: 'Missing server host',
        description: 'Please enter a server hostname or IP address',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('unknown');

    try {
      // First save the config
      const config: ServerConfig = {
        host: serverHost,
        port: parseInt(serverPort, 10),
        dbName,
        ssl: useSsl,
      };

      await configureServer(config);

      // Then test connectivity
      const connected = await checkConnectivity();
      setConnectionStatus(connected ? 'success' : 'failed');

      toast({
        title: connected ? 'Connection successful' : 'Connection failed',
        description: connected
          ? `Successfully connected to ${serverHost}`
          : 'Could not connect to the server. Please check settings.',
        variant: connected ? 'default' : 'destructive',
      });
    } catch (err) {
      setConnectionStatus('failed');
      toast({
        title: 'Connection error',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const config: ServerConfig = {
        host: serverHost,
        port: parseInt(serverPort, 10),
        dbName,
        ssl: useSsl,
      };

      const success = await configureServer(config);

      if (success) {
        // Update sync config via IPC
        const syncApi = (window as any).electronAPI?.sync;
        if (syncApi) {
          await syncApi.updateConfig({
            enabled: syncEnabled,
            autoSyncIntervalMs: parseInt(syncInterval, 10) * 60 * 1000,
          });
        }

        toast({
          title: 'Settings saved',
          description: 'Sync settings have been updated',
        });
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (err) {
      toast({
        title: 'Save failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Server Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Server Configuration
          </CardTitle>
          <CardDescription>
            Configure the central sync server connection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Host and Port */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="host">Server Host</Label>
              <div className="flex gap-2">
                <Input
                  id="host"
                  placeholder="192.168.1.50 or timetracker.local"
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDiscover}
                  disabled={isDiscovering}
                  title="Auto-discover server"
                >
                  {isDiscovering ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="5432"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
              />
            </div>
          </div>

          {/* Database Name */}
          <div className="space-y-2">
            <Label htmlFor="dbName">Database Name</Label>
            <Input
              id="dbName"
              placeholder="tshifhinga_central"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
            />
          </div>

          {/* SSL Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use SSL/TLS</Label>
              <p className="text-xs text-muted-foreground">
                Enable encrypted connection to the server
              </p>
            </div>
            <Switch checked={useSsl} onCheckedChange={setUseSsl} />
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <div className="flex items-center gap-2">
              {connectionStatus === 'success' ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : connectionStatus === 'failed' ? (
                <WifiOff className="h-4 w-4 text-red-500" />
              ) : (
                <Wifi className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">
                {connectionStatus === 'success'
                  ? 'Connected'
                  : connectionStatus === 'failed'
                  ? 'Connection failed'
                  : 'Not tested'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTestingConnection || !serverHost}
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sync Settings
          </CardTitle>
          <CardDescription>
            Configure automatic synchronization behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable Sync */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Auto-Sync</Label>
              <p className="text-xs text-muted-foreground">
                Automatically sync data in the background
              </p>
            </div>
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>

          {/* Sync Interval */}
          <div className="space-y-2">
            <Label>Sync Interval</Label>
            <Select value={syncInterval} onValueChange={setSyncInterval} disabled={!syncEnabled}>
              <SelectTrigger>
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Every 5 minutes</SelectItem>
                <SelectItem value="15">Every 15 minutes</SelectItem>
                <SelectItem value="30">Every 30 minutes</SelectItem>
                <SelectItem value="60">Every hour</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often to sync data with the central server
            </p>
          </div>

          {/* Current Status */}
          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Server Status</span>
              <span className="flex items-center gap-1">
                {health.serverConnected ? (
                  <>
                    <Check className="h-3 w-3 text-green-500" />
                    Connected
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 text-red-500" />
                    Disconnected
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pending Records</span>
              <span>{health.pendingRecords}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unresolved Conflicts</span>
              <span className={health.unresolvedConflicts > 0 ? 'text-red-500 font-medium' : ''}>
                {health.unresolvedConflicts}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default SyncSettingsPanel;
