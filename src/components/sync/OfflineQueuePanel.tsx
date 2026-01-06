/**
 * Offline Queue Panel Component
 * Displays pending sync items and allows priority management
 */

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Upload,
  Clock,
  AlertCircle,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Users,
  Folder,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSync } from '@/hooks/useSync';
import { cn } from '@/lib/utils';

interface QueueItem {
  id: number;
  table_name: string;
  record_id: string;
  operation: 'create' | 'update' | 'delete';
  data?: string;
  created_at: number;
  retry_count: number;
  last_error?: string;
  priority: number;
}

interface OfflineQueuePanelProps {
  className?: string;
}

/**
 * Get icon for table type
 */
function getTableIcon(tableName: string) {
  switch (tableName) {
    case 'sessions':
      return Clock;
    case 'clients':
      return Users;
    case 'projects':
      return Folder;
    case 'tasks':
      return CheckSquare;
    default:
      return FileText;
  }
}

/**
 * Get badge variant for operation type
 */
function getOperationVariant(operation: string): 'default' | 'secondary' | 'destructive' {
  switch (operation) {
    case 'create':
      return 'default';
    case 'update':
      return 'secondary';
    case 'delete':
      return 'destructive';
    default:
      return 'default';
  }
}

/**
 * Queue Item Row Component
 */
function QueueItemRow({ item }: { item: QueueItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = getTableIcon(item.table_name);

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium capitalize">{item.table_name}</span>
          <Badge variant={getOperationVariant(item.operation)} className="text-xs">
            {item.operation}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.retry_count > 0 && (
            <Badge variant="outline" className="text-xs">
              {item.retry_count} retries
            </Badge>
          )}
          <span>{format(new Date(item.created_at), 'HH:mm')}</span>
        </div>
      </div>

      {item.last_error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded p-2">
          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{item.last_error}</span>
        </div>
      )}

      {item.data && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between h-6 text-xs">
              <span>{isExpanded ? 'Hide data' : 'Show data'}</span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
              {JSON.stringify(JSON.parse(item.data), null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function OfflineQueuePanel({ className }: OfflineQueuePanelProps) {
  const { state, syncNow, isLoading } = useSync();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // Load queue items
  const loadQueueItems = async () => {
    const api = (window as any).electronAPI;
    if (!api?.database) return;

    setIsLoadingQueue(true);
    try {
      // This would need a new IPC handler to fetch queue items
      // For now, we'll show a placeholder based on pending count
      setQueueItems([]);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadQueueItems();
  }, [state.pendingCount]);

  const handleSyncNow = async () => {
    await syncNow();
    await loadQueueItems();
  };

  const handleClearQueue = async () => {
    // This would need a new IPC handler to clear the queue
    console.log('Clear queue requested');
  };

  // Group items by table
  const groupedItems = queueItems.reduce((acc, item) => {
    if (!acc[item.table_name]) {
      acc[item.table_name] = [];
    }
    acc[item.table_name].push(item);
    return acc;
  }, {} as Record<string, QueueItem[]>);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Offline Queue
            </CardTitle>
            <CardDescription>
              {state.pendingCount === 0
                ? 'All data synced'
                : `${state.pendingCount} item${state.pendingCount === 1 ? '' : 's'} pending sync`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncNow}
              disabled={isLoading || state.syncInProgress || state.pendingCount === 0}
            >
              {state.syncInProgress ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {state.pendingCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Offline Queue?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {state.pendingCount} pending item
                      {state.pendingCount === 1 ? '' : 's'} from the sync queue. This data
                      will not be synced to the server.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearQueue}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Clear Queue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {state.pendingCount === 0 ? (
          <div className="text-center py-8">
            <Database className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
            <h3 className="text-lg font-medium mb-1">Queue Empty</h3>
            <p className="text-muted-foreground text-sm">
              All local changes have been synchronized.
            </p>
          </div>
        ) : isLoadingQueue ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading queue...</p>
          </div>
        ) : queueItems.length === 0 ? (
          // Show summary when detailed queue not available
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-medium">Sessions</p>
                  <p className="text-sm text-muted-foreground">
                    {state.pendingCount} pending record{state.pendingCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{state.pendingCount}</Badge>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Changes will sync automatically when server is available,
              or click the sync button to try now.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([tableName, items]) => (
                <div key={tableName} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{tableName}</span>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <QueueItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default OfflineQueuePanel;
