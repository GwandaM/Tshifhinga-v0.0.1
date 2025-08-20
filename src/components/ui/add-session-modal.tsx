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
import { Plus, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (sessionData: {
    startTime: Date;
    endTime: Date;
    client: string;
    project: string;
    task: string;
    notes?: string;
  }) => Promise<void>;
  prefilledDate?: Date; // Optional prefilled date for the session
  prefilledTime?: { start?: string; end?: string }; // Optional prefilled times (HH:MM format)
}

export const AddSessionModal: React.FC<AddSessionModalProps> = ({
  open,
  onClose,
  onSave,
  prefilledDate,
  prefilledTime,
}) => {
  const [formData, setFormData] = useState({
    startTime: undefined as Date | undefined,
    endTime: undefined as Date | undefined,
    client: "",
    project: "",
    task: "",
    notes: "",
  });

  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    errors: [],
    warnings: []
  });

  const [isLoading, setIsLoading] = useState(false);

  // Initialize form data when modal opens or prefilled data changes
  useEffect(() => {
    if (open) {
      const now = new Date();
      let defaultStart = prefilledDate ? new Date(prefilledDate) : new Date();
      let defaultEnd = new Date(defaultStart);
      
      // If we have prefilled times, use them
      if (prefilledTime?.start) {
        const [hours, minutes] = prefilledTime.start.split(':');
        defaultStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        // Default to current time rounded to nearest 15 minutes
        const minutes = Math.round(now.getMinutes() / 15) * 15;
        defaultStart.setHours(now.getHours(), minutes, 0, 0);
      }
      
      if (prefilledTime?.end) {
        const [hours, minutes] = prefilledTime.end.split(':');
        defaultEnd.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        // Default to 1 hour after start time
        defaultEnd = new Date(defaultStart.getTime() + (60 * 60 * 1000));
      }

      setFormData({
        startTime: defaultStart,
        endTime: defaultEnd,
        client: "",
        project: "",
        task: "",
        notes: "",
      });
    }
  }, [open, prefilledDate, prefilledTime]);

  // Calculate duration and validate
  const calculatedData = useMemo(() => {
    if (!formData.startTime || !formData.endTime) return null;

    const duration = formData.endTime.getTime() - formData.startTime.getTime();

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
      duration,
      validation: combinedValidation,
    };
  }, [formData]);

  // Update validation when calculated data changes
  useEffect(() => {
    if (calculatedData) {
      setValidation(calculatedData.validation);
    }
  }, [calculatedData]);

  const handleSave = async () => {
    if (!calculatedData?.validation.isValid || !formData.startTime || !formData.endTime) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        startTime: formData.startTime,
        endTime: formData.endTime,
        client: formData.client,
        project: formData.project,
        task: formData.task,
        notes: formData.notes,
      });
      onClose();
      // Reset form
      setFormData({
        startTime: undefined,
        endTime: undefined,
        client: "",
        project: "",
        task: "",
        notes: "",
      });
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasValidData = useMemo(() => {
    return (
      formData.startTime &&
      formData.endTime &&
      formData.client.trim() &&
      formData.project.trim() &&
      formData.task.trim()
    );
  }, [formData]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Session
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
                required
                min={formData.startTime}
              />
            </div>
            
            {calculatedData && formData.startTime && formData.endTime && (
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Duration: {SessionValidator.formatDuration(calculatedData.duration)}
                </Badge>
                {calculatedData.duration > 8 * 60 * 60 * 1000 && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    Long session ({SessionValidator.formatDuration(calculatedData.duration)})
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
              !hasValidData ||
              isLoading
            }
          >
            {isLoading ? "Creating..." : "Create Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddSessionModal;