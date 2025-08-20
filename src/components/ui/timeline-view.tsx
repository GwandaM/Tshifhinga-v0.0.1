import React, { useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Edit, Grip, AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionRecord } from "@/features/tracker/TimerContext";

interface TimelineViewProps {
  date: Date;
  sessions: SessionRecord[];
  onSessionEdit: (session: SessionRecord) => void;
  onTimeAdjustment: (sessionId: string, updates: { startTime: Date; endTime: Date }) => Promise<void>;
  onAddSession?: (date: Date, time?: { start: string; end: string }) => void;
  className?: string;
}

interface DragState {
  sessionId: string | null;
  dragType: 'start' | 'end' | 'move' | null;
  startX: number;
  startTime: number;
  originalStart: number;
  originalEnd: number;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  date,
  sessions,
  onSessionEdit,
  onTimeAdjustment,
  onAddSession,
  className,
}) => {
  const [dragState, setDragState] = useState<DragState>({
    sessionId: null,
    dragType: null,
    startX: 0,
    startTime: 0,
    originalStart: 0,
    originalEnd: 0,
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Timeline configuration
  const TIMELINE_START = 0; // 00:00
  const TIMELINE_END = 24 * 60; // 24:00 in minutes
  const TIMELINE_WIDTH = 800;
  const SESSION_HEIGHT = 32;
  const GRID_INTERVAL = 60; // 1 hour in minutes
  const SNAP_INTERVAL = 15; // 15 minutes

  // Convert time to timeline position
  const timeToPosition = useCallback((timeMs: number) => {
    const date_start = new Date(date);
    date_start.setHours(0, 0, 0, 0);
    
    const minutesFromStart = (timeMs - date_start.getTime()) / (1000 * 60);
    const clampedMinutes = Math.max(TIMELINE_START, Math.min(TIMELINE_END, minutesFromStart));
    
    return (clampedMinutes / TIMELINE_END) * TIMELINE_WIDTH;
  }, [date]);

  // Convert position to time
  const positionToTime = useCallback((x: number) => {
    const minutes = (x / TIMELINE_WIDTH) * TIMELINE_END;
    const snappedMinutes = Math.round(minutes / SNAP_INTERVAL) * SNAP_INTERVAL;
    
    const date_start = new Date(date);
    date_start.setHours(0, 0, 0, 0);
    
    return date_start.getTime() + (snappedMinutes * 60 * 1000);
  }, [date]);

  // Get sessions for the current date
  const daySessions = useMemo(() => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return sessions
      .filter(session => {
        const sessionStart = new Date(session.start);
        return sessionStart >= dayStart && sessionStart <= dayEnd;
      })
      .sort((a, b) => a.start - b.start);
  }, [sessions, date]);

  // Detect overlapping sessions
  const overlaps = useMemo(() => {
    const overlapPairs: Array<[string, string]> = [];
    
    for (let i = 0; i < daySessions.length; i++) {
      for (let j = i + 1; j < daySessions.length; j++) {
        const sessionA = daySessions[i];
        const sessionB = daySessions[j];
        
        const endA = sessionA.end || Date.now();
        const endB = sessionB.end || Date.now();
        
        if (sessionA.start < endB && sessionB.start < endA) {
          overlapPairs.push([sessionA.id, sessionB.id]);
        }
      }
    }
    
    return overlapPairs;
  }, [daySessions]);

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent, session: SessionRecord, dragType: 'start' | 'end' | 'move') => {
    e.preventDefault();
    
    setDragState({
      sessionId: session.id,
      dragType,
      startX: e.clientX,
      startTime: Date.now(),
      originalStart: session.start,
      originalEnd: session.end || Date.now(),
    });

    setValidationErrors([]);
  }, []);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.sessionId || !dragState.dragType) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaTime = positionToTime(deltaX) - positionToTime(0);

    // Calculate new times based on drag type
    let newStart = dragState.originalStart;
    let newEnd = dragState.originalEnd;

    switch (dragState.dragType) {
      case 'start':
        newStart = dragState.originalStart + deltaTime;
        break;
      case 'end':
        newEnd = dragState.originalEnd + deltaTime;
        break;
      case 'move':
        newStart = dragState.originalStart + deltaTime;
        newEnd = dragState.originalEnd + deltaTime;
        break;
    }

    // Validate the new times
    const errors: string[] = [];
    
    if (newStart >= newEnd) {
      errors.push('Start time must be before end time');
    }
    
    if (newEnd - newStart < 60 * 1000) {
      errors.push('Session must be at least 1 minute long');
    }
    
    if (newEnd - newStart > 24 * 60 * 60 * 1000) {
      errors.push('Session cannot exceed 24 hours');
    }

    setValidationErrors(errors);
  }, [dragState, positionToTime]);

  // Handle mouse up to complete drag
  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!dragState.sessionId || !dragState.dragType || validationErrors.length > 0) {
      setDragState({
        sessionId: null,
        dragType: null,
        startX: 0,
        startTime: 0,
        originalStart: 0,
        originalEnd: 0,
      });
      return;
    }

    const deltaX = e.clientX - dragState.startX;
    const deltaTime = positionToTime(deltaX) - positionToTime(0);

    let newStart = dragState.originalStart;
    let newEnd = dragState.originalEnd;

    switch (dragState.dragType) {
      case 'start':
        newStart = dragState.originalStart + deltaTime;
        break;
      case 'end':
        newEnd = dragState.originalEnd + deltaTime;
        break;
      case 'move':
        newStart = dragState.originalStart + deltaTime;
        newEnd = dragState.originalEnd + deltaTime;
        break;
    }

    try {
      await onTimeAdjustment(dragState.sessionId, {
        startTime: new Date(newStart),
        endTime: new Date(newEnd),
      });
    } catch (error) {
      console.error('Failed to update session times:', error);
      setValidationErrors(['Failed to save changes']);
    }

    setDragState({
      sessionId: null,
      dragType: null,
      startX: 0,
      startTime: 0,
      originalStart: 0,
      originalEnd: 0,
    });
  }, [dragState, validationErrors, positionToTime, onTimeAdjustment]);

  // Format time for display
  const formatTime = (timeMs: number) => {
    return new Date(timeMs).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Format duration
  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  };

  // Get client color
  const getClientColor = (client: string) => {
    let hash = 0;
    for (let i = 0; i < client.length; i++) {
      hash = client.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500',
      'bg-teal-500', 'bg-cyan-500'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {/* Timeline Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Timeline - {date.toLocaleDateString()}
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {daySessions.length} sessions • {formatDuration(daySessions.reduce((sum, s) => sum + s.activeMs, 0))} total
            </div>
            {onAddSession && (
              <Button
                size="sm"
                onClick={() => onAddSession(date)}
                className="flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Session
              </Button>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Overlap Warnings */}
        {overlaps.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {overlaps.length} overlapping session(s) detected. Please adjust times to resolve conflicts.
            </AlertDescription>
          </Alert>
        )}

        {/* Timeline Container */}
        <div className="relative">
          {/* Time Grid */}
          <div className="relative h-12 bg-muted/20 rounded-lg border">
            {/* Click overlay for creating sessions */}
            {onAddSession && (
              <div 
                className="absolute inset-0 w-full h-full cursor-pointer z-10"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const clickedTime = positionToTime(x);
                  
                  // Create a 1-hour session starting at clicked time
                  const startDate = new Date(clickedTime);
                  const endDate = new Date(clickedTime + 60 * 60 * 1000);
                  
                  const startTime = startDate.toTimeString().substring(0, 5);
                  const endTime = endDate.toTimeString().substring(0, 5);
                  
                  onAddSession(date, { start: startTime, end: endTime });
                }}
                title="Click to add session at this time"
              />
            )}
            <svg className="absolute inset-0 w-full h-full">
              {/* Hour markers */}
              {Array.from({ length: 25 }, (_, i) => {
                const hour = i;
                const x = (hour / 24) * TIMELINE_WIDTH;
                return (
                  <g key={hour}>
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={48}
                      stroke="currentColor"
                      strokeWidth={hour % 6 === 0 ? 2 : 1}
                      className="text-muted-foreground/30"
                    />
                    <text
                      x={x}
                      y={40}
                      textAnchor="middle"
                      className="text-xs fill-muted-foreground"
                    >
                      {hour.toString().padStart(2, '0')}:00
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Sessions */}
          <div 
            className="relative mt-2 space-y-1"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {daySessions.map((session, index) => {
              const startPos = timeToPosition(session.start);
              const endPos = timeToPosition(session.end || Date.now());
              const width = Math.max(endPos - startPos, 20); // Minimum width
              
              const isOverlapping = overlaps.some(([a, b]) => a === session.id || b === session.id);
              const isDragging = dragState.sessionId === session.id;
              
              return (
                <Tooltip key={session.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "absolute h-8 rounded-md border-2 transition-all cursor-move",
                        "hover:shadow-md hover:z-10",
                        isDragging && "shadow-lg z-20 opacity-80",
                        isOverlapping && "border-red-400 bg-red-100",
                        !isOverlapping && "border-white/50",
                        getClientColor(session.client || session.task?.client || 'Unknown')
                      )}
                      style={{
                        left: startPos,
                        width: width,
                        top: index * (SESSION_HEIGHT + 4),
                      }}
                      onMouseDown={(e) => handleMouseDown(e, session, 'move')}
                    >
                      {/* Session Content */}
                      <div className="flex items-center justify-between h-full px-2 text-white text-xs font-medium">
                        <div className="truncate flex-1">
                          {session.task?.project || session.project} - {session.task?.task || 'Unknown Task'}
                        </div>
                        <div className="ml-1 text-xs opacity-80">
                          {formatDuration(session.activeMs)}
                        </div>
                      </div>

                      {/* Resize Handles */}
                      <div
                        className="absolute left-0 top-0 w-2 h-full cursor-ew-resize bg-white/20 opacity-0 hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, session, 'start');
                        }}
                      />
                      <div
                        className="absolute right-0 top-0 w-2 h-full cursor-ew-resize bg-white/20 opacity-0 hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleMouseDown(e, session, 'end');
                        }}
                      />

                      {/* Edit Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute -right-8 top-0 h-8 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSessionEdit(session);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {session.client || session.task?.client} - {session.task?.project || session.project}
                      </div>
                      <div className="text-sm">
                        {formatTime(session.start)} - {formatTime(session.end || Date.now())}
                      </div>
                      <div className="text-sm">
                        Duration: {formatDuration(session.activeMs)}
                      </div>
                      {session.notes && (
                        <div className="text-sm text-muted-foreground">
                          {session.notes}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Grip className="w-3 h-3" />
              Drag to move
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-3 bg-muted rounded-sm" />
              Resize handles
            </div>
            <div className="flex items-center gap-1">
              <Edit className="w-3 h-3" />
              Click to edit details
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default TimelineView;