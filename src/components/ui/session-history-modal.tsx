import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, User, Edit, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionEdit {
  id: string;
  edit_type: 'time_adjustment' | 'details_change' | 'split' | 'merge';
  original_start_time: number;
  original_end_time: number;
  new_start_time: number;
  new_end_time: number;
  original_active_ms: number;
  new_active_ms: number;
  changes_json: string;
  edit_reason: string;
  created_at: number;
  username: string;
}

interface SessionHistoryModalProps {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
  getSessionEditHistory: (sessionId: string) => Promise<SessionEdit[]>;
}

export const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  sessionId,
  open,
  onClose,
  getSessionEditHistory,
}) => {
  const [editHistory, setEditHistory] = useState<SessionEdit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && sessionId) {
      loadEditHistory();
    }
  }, [open, sessionId]);

  const loadEditHistory = async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);
    try {
      const history = await getSessionEditHistory(sessionId);
      setEditHistory(history);
    } catch (err) {
      setError("Failed to load edit history");
      console.error("Error loading edit history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(Math.abs(ms) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.abs(ms) % (1000 * 60 * 60)) / (1000 * 60));
    
    const sign = ms < 0 ? '-' : '';
    
    if (hours === 0) {
      return `${sign}${minutes}m`;
    } else if (minutes === 0) {
      return `${sign}${hours}h`;
    } else {
      return `${sign}${hours}h ${minutes}m`;
    }
  };

  const getEditTypeIcon = (type: string) => {
    switch (type) {
      case 'time_adjustment':
        return <Clock className="w-4 h-4" />;
      case 'details_change':
        return <FileText className="w-4 h-4" />;
      case 'split':
      case 'merge':
        return <Edit className="w-4 h-4" />;
      default:
        return <Edit className="w-4 h-4" />;
    }
  };

  const getEditTypeLabel = (type: string) => {
    switch (type) {
      case 'time_adjustment':
        return 'Time Adjustment';
      case 'details_change':
        return 'Details Change';
      case 'split':
        return 'Session Split';
      case 'merge':
        return 'Session Merge';
      default:
        return 'Edit';
    }
  };

  const getEditTypeColor = (type: string) => {
    switch (type) {
      case 'time_adjustment':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'details_change':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'split':
      case 'merge':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const parseChanges = (changesJson: string) => {
    try {
      return JSON.parse(changesJson);
    } catch {
      return {};
    }
  };

  const renderTimeChange = (edit: SessionEdit) => {
    const originalDuration = edit.original_end_time - edit.original_start_time;
    const newDuration = edit.new_end_time - edit.new_start_time;
    const durationChange = newDuration - originalDuration;

    const originalStart = new Date(edit.original_start_time);
    const originalEnd = new Date(edit.original_end_time);
    const newStart = new Date(edit.new_start_time);
    const newEnd = new Date(edit.new_end_time);

    const timeChanged = edit.original_start_time !== edit.new_start_time || 
                      edit.original_end_time !== edit.new_end_time;

    if (!timeChanged) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Time Changes</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Original:</span>
            <div className="font-mono">
              {originalStart.toLocaleString()} - {originalEnd.toLocaleString()}
            </div>
            <div className="text-muted-foreground">
              Duration: {formatDuration(originalDuration)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Updated:</span>
            <div className="font-mono">
              {newStart.toLocaleString()} - {newEnd.toLocaleString()}
            </div>
            <div className="text-muted-foreground">
              Duration: {formatDuration(newDuration)}
            </div>
          </div>
        </div>
        {durationChange !== 0 && (
          <Badge 
            variant="outline"
            className={cn(
              durationChange > 0 
                ? "bg-green-100 text-green-800 border-green-300" 
                : "bg-red-100 text-red-800 border-red-300"
            )}
          >
            {durationChange > 0 ? "+" : ""}{formatDuration(durationChange)}
          </Badge>
        )}
      </div>
    );
  };

  const renderDetailChanges = (edit: SessionEdit) => {
    const changes = parseChanges(edit.changes_json);
    const changedFields = Object.entries(changes)
      .filter(([_, change]: [string, any]) => change.old !== change.new)
      .filter(([_, change]: [string, any]) => change.new !== undefined);

    if (changedFields.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Detail Changes</h4>
        <div className="space-y-2">
          {changedFields.map(([field, change]: [string, any]) => (
            <div key={field} className="flex items-center gap-2 text-sm">
              <span className="capitalize font-medium w-16">{field}:</span>
              <span className="text-muted-foreground line-through">
                {change.old || '(empty)'}
              </span>
              <span>→</span>
              <span className="font-medium">
                {change.new || '(empty)'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Session Edit History
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Clock className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading edit history...</p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && editHistory.length === 0 && (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Edit History</h3>
              <p className="text-muted-foreground">
                This session has not been modified since it was created.
              </p>
            </div>
          )}

          {!isLoading && !error && editHistory.length > 0 && (
            <div className="space-y-4">
              {editHistory.map((edit, index) => (
                <div key={edit.id} className="border rounded-lg p-4 space-y-3">
                  {/* Edit Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={getEditTypeColor(edit.edit_type)}
                      >
                        {getEditTypeIcon(edit.edit_type)}
                        {getEditTypeLabel(edit.edit_type)}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="w-3 h-3" />
                        {edit.username}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(edit.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Edit Reason */}
                  <div className="text-sm">
                    <span className="font-medium">Reason: </span>
                    <span className="text-muted-foreground">{edit.edit_reason}</span>
                  </div>

                  {/* Time Changes */}
                  {renderTimeChange(edit)}

                  {/* Detail Changes */}
                  {renderDetailChanges(edit)}

                  {index < editHistory.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SessionHistoryModal;