/**
 * Conflict Card Component
 * Displays a single sync conflict with resolution options
 */

import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Clock,
  Database,
  Laptop,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ConflictData {
  id: number;
  table_name: string;
  record_id: string;
  local_data: string;
  server_data: string;
  conflict_type: string;
  detected_at: number;
  resolved_at?: number;
  resolution?: string;
  resolution_notes?: string;
}

interface ConflictCardProps {
  conflict: ConflictData;
  onResolve: (
    conflictId: number,
    resolution: 'keep_local' | 'keep_server' | 'manual',
    notes?: string
  ) => Promise<boolean>;
}

/**
 * Format conflict type for display
 */
function formatConflictType(type: string): string {
  switch (type) {
    case 'version_mismatch':
      return 'Version Mismatch';
    case 'deleted_modified':
      return 'Deleted/Modified';
    case 'duplicate':
      return 'Duplicate Record';
    default:
      return type;
  }
}

/**
 * Get badge variant for conflict type
 */
function getConflictBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'version_mismatch':
      return 'default';
    case 'deleted_modified':
      return 'destructive';
    case 'duplicate':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Parse and format JSON data for display
 */
function formatJsonData(jsonString: string): Record<string, any> | null {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * Render a data comparison row
 */
function DataRow({
  label,
  localValue,
  serverValue,
}: {
  label: string;
  localValue: any;
  serverValue: any;
}) {
  const isDifferent = JSON.stringify(localValue) !== JSON.stringify(serverValue);

  return (
    <div className="grid grid-cols-3 gap-2 py-1 text-sm border-b last:border-0">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className={cn(isDifferent && 'text-blue-600 font-medium')}>
        {formatValue(localValue)}
      </span>
      <span className={cn(isDifferent && 'text-orange-600 font-medium')}>
        {formatValue(serverValue)}
      </span>
    </div>
  );
}

/**
 * Format a value for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    // Check if it's a timestamp (roughly after year 2000 in ms)
    if (value > 946684800000) {
      return format(new Date(value), 'MMM d, yyyy HH:mm');
    }
    return value.toLocaleString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ConflictCard({ conflict, onResolve }: ConflictCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const localData = formatJsonData(conflict.local_data);
  const serverData = formatJsonData(conflict.server_data);

  const handleResolve = async (resolution: 'keep_local' | 'keep_server' | 'manual') => {
    setIsResolving(true);
    try {
      await onResolve(conflict.id, resolution, notes || undefined);
    } finally {
      setIsResolving(false);
    }
  };

  // Get all unique keys from both datasets
  const allKeys = new Set([
    ...(localData ? Object.keys(localData) : []),
    ...(serverData ? Object.keys(serverData) : []),
  ]);

  // Filter out internal/system fields
  const displayKeys = Array.from(allKeys).filter(
    (key) => !['sync_status', 'last_synced_at', 'server_id', 'origin_client_id'].includes(key)
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="font-medium capitalize">{conflict.table_name}</span>
              <Badge variant={getConflictBadgeVariant(conflict.conflict_type)}>
                {formatConflictType(conflict.conflict_type)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(conflict.detected_at), 'MMM d, yyyy HH:mm')}
              </span>
              <span className="font-mono text-xs">{conflict.record_id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {isExpanded ? 'Hide details' : 'Show details'}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Data comparison header */}
            <div className="grid grid-cols-3 gap-2 py-2 text-xs font-medium text-muted-foreground border-b mb-2">
              <span>Field</span>
              <span className="flex items-center gap-1">
                <Laptop className="h-3 w-3" />
                Local
              </span>
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                Server
              </span>
            </div>

            {/* Data rows */}
            {localData && serverData ? (
              <div className="max-h-64 overflow-y-auto">
                {displayKeys.map((key) => (
                  <DataRow
                    key={key}
                    label={key.replace(/_/g, ' ')}
                    localValue={localData[key]}
                    serverValue={serverData[key]}
                  />
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Unable to parse conflict data
              </div>
            )}

            {/* Resolution notes */}
            {showNotes && (
              <div className="mt-4">
                <Textarea
                  placeholder="Add notes about this resolution (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <CardFooter className="flex flex-wrap gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResolve('keep_local')}
          disabled={isResolving}
          className="flex-1"
        >
          {isResolving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Laptop className="h-4 w-4 mr-1" />
              Keep Local
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleResolve('keep_server')}
          disabled={isResolving}
          className="flex-1"
        >
          {isResolving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Database className="h-4 w-4 mr-1" />
              Keep Server
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNotes(!showNotes)}
          className="px-2"
        >
          {showNotes ? <X className="h-4 w-4" /> : <span className="text-xs">+ Notes</span>}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ConflictCard;
