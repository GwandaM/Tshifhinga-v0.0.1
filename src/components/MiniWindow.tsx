import React, { useMemo, useState, useEffect } from "react";
import {
  Play,
  Pause,
  Square,
  Maximize2,
  Minimize2,
  GripVertical,
  Clock,
  Pin,
  PinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimer, TaskRef } from "@/features/tracker/TimerContext";
import { useAuth } from "@/contexts/AuthContext";
// Remove Select imports - using task selector window instead

export const MiniWindow: React.FC = () => {
  const { status, task, activeMs, start, pause, resume, stop, sessions, setTask } = useTimer();
  const { user } = useAuth();
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  // Debug logs removed - task selector working

  useEffect(() => {
    console.log('Getting initial always on top state');
    (window as any).electronAPI?.window.getMiniAlwaysOnTopState().then(state => {
      console.log('Initial always on top state:', state);
      setIsAlwaysOnTop(state);
    });

    // Listen for task selection from task selector window
    const handleTaskSelected = (_event: any, selectedTask: TaskRef) => {
      console.log('Task selected in mini window:', selectedTask);
      setTask(selectedTask);
    };

    (window as any).electronAPI?.timer.onTaskSelected(handleTaskSelected);

    // Cleanup
    return () => {
      (window as any).electronAPI?.timer.removeAllListeners('task:selected');
    };
  }, [setTask]);

  const handleToggleAlwaysOnTop = async () => {
    console.log('Toggling always on top');
    const newState = await (window as any).electronAPI?.window.toggleMiniAlwaysOnTop();
    console.log('New always on top state:', newState);
    setIsAlwaysOnTop(newState);
  };

  const openTaskSelector = async () => {
    console.log('Opening task selector');
    await (window as any).electronAPI?.window.openTaskSelector();
  };

  // Remove recent tasks logic - using task selector window instead

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleToggle = () => {
    if (status === "running") pause();
    else if (status === "paused") resume();
    else if (task) start(task);
  };

  const switchToFull = () => (window as any).electronAPI?.window.switchToFull();
  const hideToTray = () => (window as any).electronAPI?.window.hideToTray();

  const getTaskDisplay = (t: TaskRef | undefined) => {
    if (!t) return "Select a task";
    return `${t.client} > ${t.project} > ${t.task}`;
  };

  return (
    <div
      className="h-full w-full bg-background border rounded-md shadow-lg p-1.5 select-none flex items-center gap-1.5"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <div
        className="cursor-move h-full flex items-center pr-0.5"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/70" />
      </div>

      <Button
        variant="ghost"
        onClick={openTaskSelector}
        className="flex-1 min-w-32 max-w-48 h-7 text-xs border-0 bg-muted/50 px-2 justify-start truncate"
      >
        {task ? (
          <span className="truncate" title={getTaskDisplay(task)}>
            {getTaskDisplay(task)}
          </span>
        ) : (
          <span className="text-muted-foreground">Select task...</span>
        )}
      </Button>

      <div className="flex items-center gap-0.5 font-mono text-sm font-semibold text-primary min-w-[60px]">
        <Clock className="h-3 w-3" />
        <span>{formatTime(activeMs)}</span>
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          size="icon"
          variant={status === "running" ? "default" : "outline"}
          onClick={handleToggle}
          disabled={!task}
          className="h-7 w-7 flex-shrink-0"
        >
          {status === "running" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>

        <Button
          size="icon"
          variant="outline"
          onClick={() => stop()}
          disabled={status === "stopped"}
          className="h-7 w-7 flex-shrink-0"
        >
          <Square className="h-3 w-3" />
        </Button>
      </div>

      <div className="h-4 w-px bg-border mx-0.5" />

      <div className="flex items-center gap-0.5">
        <Button size="icon" variant="ghost" onClick={handleToggleAlwaysOnTop} className="h-7 w-7 flex-shrink-0">
          {isAlwaysOnTop ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
        </Button>

        <Button size="icon" variant="ghost" onClick={switchToFull} className="h-7 w-7 flex-shrink-0">
          <Maximize2 className="h-3 w-3" />
        </Button>

        <Button size="icon" variant="ghost" onClick={hideToTray} className="h-7 w-7 flex-shrink-0">
          <Minimize2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};