import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { SessionValidator, ValidationResult } from "@/lib/session-validation";
import { ReliabilityCalculator } from "@/lib/reliability-calculator";
import { AlertTriangle, Clock, History, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface EditSessionModalProps {
  session: SessionRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: {
    startTime?: Date;
    endTime?: Date;
    client?: string;
    project?: string;
    task?: string;
    notes?: string;
  }, editReason: string) => Promise<void>;
  onViewHistory?: (sessionId: string) => void;
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({
  session,
  open,
  onClose,
  onSave,
  onViewHistory,
}) => {
  const [formData, setFormData] = useState({
    startTime: undefined as Date | undefined,
    endTime: undefined as Date | undefined,
    client: "",
    project: "",
    task: "",
    notes: "",
    editReason: "",
  });

  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: []
  });

  const [isLoading, setIsLoading] = useState(false);

  // Initialize form data when session changes
  useEffect(() => {
    if (session) {
      setFormData({
        startTime: new Date(session.start),
        endTime: session.end ? new Date(session.end) : undefined,
        client: session.client || session.task?.client || "",
        project: session.project || session.task?.project || "",
        task: session.task?.task || "",
        notes: session.notes || "",
        editReason: "",
      });
    }
  }, [session]);

  // Calculate duration and validate changes
  const calculatedData = useMemo(() => {
    if (!formData.startTime) return null;

    const originalStart = session ? new Date(session.start) : new Date();
    const originalEnd = session?.end ? new Date(session.end) : undefined;
    const originalDuration = originalEnd ? originalEnd.getTime() - originalStart.getTime() : 0;
    
    const newDuration = formData.endTime 
      ? formData.endTime.getTime() - formData.startTime.getTime()
      : 0;

    const durationChange = newDuration - originalDuration;

    // Validate time range
    const timeValidation = SessionValidator.validateTimeRange(
      formData.startTime,
      formData.endTime
    );

    // Validate session details
    const detailsValidation = SessionValidator.validateSessionDetails({
      client: formData.client,
      project: formData.project,
      task: formData.task,
      notes: formData.notes,
    });

    // Combine validations
    const combinedValidation: ValidationResult = {
      isValid: timeValidation.isValid && detailsValidation.isValid,
      errors: [...timeValidation.errors, ...detailsValidation.errors],
      warnings: [...timeValidation.warnings, ...detailsValidation.warnings]
    };

    return {
      originalDuration,
      newDuration,
      durationChange,
      validation: combinedValidation,
    };
  }, [formData, session]);

  // Update validation when calculated data changes
  useEffect(() => {
    if (calculatedData) {
      setValidation(calculatedData.validation);
    }
  }, [calculatedData]);

  const handleSave = async () => {
    if (!session || !calculatedData?.validation.isValid || !formData.editReason.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const updates: any = {};
      
      // Only include changed fields
      const originalStart = new Date(session.start);
      const originalEnd = session.end ? new Date(session.end) : undefined;
      
      if (formData.startTime && formData.startTime.getTime() !== originalStart.getTime()) {
        updates.startTime = formData.startTime;
      }
      
      if (formData.endTime?.getTime() !== originalEnd?.getTime()) {
        updates.endTime = formData.endTime;
      }
      
      if (formData.client !== (session.client || session.task?.client)) {
        updates.client = formData.client;
      }
      
      if (formData.project !== (session.project || session.task?.project)) {
        updates.project = formData.project;
      }
      
      if (formData.task !== session.task?.task) {
        updates.task = formData.task;
      }
      
      if (formData.notes !== (session.notes || "")) {
        updates.notes = formData.notes;
      }

      await onSave(updates, formData.editReason);
      onClose();
    } catch (error) {
      console.error("Failed to save session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = useMemo(() => {
    if (!session) return false;
    
    const originalStart = new Date(session.start);
    const originalEnd = session.end ? new Date(session.end) : undefined;
    
    return (
      formData.startTime?.getTime() !== originalStart.getTime() ||
      formData.endTime?.getTime() !== originalEnd?.getTime() ||
      formData.client !== (session.client || session.task?.client) ||
      formData.project !== (session.project || session.task?.project) ||
      formData.task !== session.task?.task ||
      formData.notes !== (session.notes || "")
    );
  }, [formData, session]);

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Edit Session
            {onViewHistory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewHistory(session.id)}
                className="ml-auto"
              >
                <History className="w-4 h-4 mr-1" />
                History
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Session Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Original Session
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Duration:</span>{" "}
                {SessionValidator.formatDuration(session.activeMs)}
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                {new Date(session.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Time Settings */}
          <div className="space-y-4">
            <h4 className="font-medium">Time Range</h4>
            <div className="grid grid-cols-2 gap-4">
              <DateTimePicker
                label="Start Time"
                value={formData.startTime}
                onChange={(date) => setFormData(prev => ({ ...prev, startTime: date }))}
                required
                max={formData.endTime}
              />
              <DateTimePicker
                label="End Time"
                value={formData.endTime}
                onChange={(date) => setFormData(prev => ({ ...prev, endTime: date }))}
                min={formData.startTime}
              />
            </div>
            
            {calculatedData && formData.startTime && formData.endTime && (
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline">
                  Duration: {SessionValidator.formatDuration(calculatedData.newDuration)}
                </Badge>
                {calculatedData.durationChange !== 0 && (
                  <Badge 
                    variant={calculatedData.durationChange > 0 ? "default" : "secondary"}
                    className={cn(
                      calculatedData.durationChange > 0 
                        ? "bg-green-100 text-green-800 border-green-300" 
                        : "bg-red-100 text-red-800 border-red-300"
                    )}
                  >
                    {calculatedData.durationChange > 0 ? "+" : ""}
                    {SessionValidator.formatDuration(calculatedData.durationChange)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Session Details */}
          <div className="space-y-4">
            <h4 className="font-medium">Session Details</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="client">Client *</Label>
                <Input
                  id="client"
                  value={formData.client}
                  onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                  placeholder="Client name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="project">Project *</Label>
                <Input
                  id="project"
                  value={formData.project}
                  onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                  placeholder="Project name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="task">Task *</Label>
                <Input
                  id="task"
                  value={formData.task}
                  onChange={(e) => setFormData(prev => ({ ...prev, task: e.target.value }))}
                  placeholder="Task name"
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add notes about this session..."
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Edit Reason */}
          <div className="space-y-2">
            <Label htmlFor="editReason">Edit Reason *</Label>
            <Textarea
              id="editReason"
              value={formData.editReason}
              onChange={(e) => setFormData(prev => ({ ...prev, editReason: e.target.value }))}
              placeholder="Please explain why you are editing this session..."
              required
              rows={2}
            />
          </div>

          {/* Validation Messages */}
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !validation.isValid || 
              !formData.editReason.trim() || 
              !hasChanges ||
              isLoading
            }
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditSessionModal;