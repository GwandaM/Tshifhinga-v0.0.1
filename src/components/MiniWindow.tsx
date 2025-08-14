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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";

export const MiniWindow: React.FC = () => {
  const { status, task, activeMs, start, pause, resume, stop, sessions, setTask } = useTimer();
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  useEffect(() => {
    console.log('Getting initial always on top state');
    (window as any).electronAPI?.window.getMiniAlwaysOnTopState().then(state => {
      console.log('Initial always on top state:', state);
      setIsAlwaysOnTop(state);
    });
  }, []);

  const handleToggleAlwaysOnTop = async () => {
    console.log('Toggling always on top');
    const newState = await (window as any).electronAPI?.window.toggleMiniAlwaysOnTop();
    console.log('New always on top state:', newState);
    setIsAlwaysOnTop(newState);
  };

  const recentTasks = useMemo(() => {
    const uniqueTasks = sessions.reduce((acc, session) => {
      // Safely handle task data
      if (session.task && session.task.client && session.task.project && session.task.task) {
        const taskKey = `${session.task.client}-${session.task.project}-${session.task.task}`;
        if (!acc.find((t) => `${t.client}-${t.project}-${t.task}` === taskKey)) {
          acc.push(session.task);
        }
      }
      return acc;
    }, [] as TaskRef[]);
    return uniqueTasks.slice(0, 2);
  }, [sessions]);

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

      <Select
        onValueChange={(value) => {
          const selectedTask = recentTasks.find((t) => `${t.client}-${t.project}-${t.task}` === value);
          if (selectedTask) setTask(selectedTask);
        }}
        value={task ? `${task.client}-${task.project}-${task.task}` : undefined}
      >
        <SelectTrigger className="flex-1 w-32 truncate h-7 text-xs border-0 bg-muted/50 px-2">
          <SelectValue placeholder="Select task..." />
        </SelectTrigger>
        <SelectContent>
          {recentTasks.map((t) => (
            <SelectItem
              key={`${t.client}-${t.project}-${t.task}`}
              value={`${t.client}-${t.project}-${t.task}`}
              className="text-xs"
            >
              <span className="truncate">{getTaskDisplay(t)}</span>
            </SelectItem>
          ))}
          <SelectSeparator />
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Expand window for more tasks
          </div>
        </SelectContent>
      </Select>

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