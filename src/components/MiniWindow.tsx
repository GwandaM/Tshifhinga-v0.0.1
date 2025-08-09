import React, { useState, useEffect } from "react";
import { Play, Pause, Square, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/features/tracker/TimerContext";

export const MiniWindow: React.FC = () => {
  const { status, task, activeMs, start, pause, resume, stop } = useTimer();
  const [transparency, setTransparency] = useState(0.95);

  // Format time display
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle transparency change
  const handleTransparencyChange = (opacity: number) => {
    setTransparency(opacity);
    if ((window as any).electronAPI?.window) {
      (window as any).electronAPI.window.setTransparency(opacity);
    }
  };

  // Get transparency on load
  useEffect(() => {
    if ((window as any).electronAPI?.window) {
      (window as any).electronAPI.window.getTransparency().then((opacity: number) => {
        setTransparency(opacity);
      });
    }
  }, []);

  const handleStart = () => {
    if (task) {
      start(task);
    }
  };

  const handleToggle = () => {
    if (status === 'running') {
      pause();
    } else if (status === 'paused') {
      resume();
    } else if (task) {
      start(task);
    }
  };

  const handleStop = () => {
    stop();
  };

  const switchToFull = () => {
    if ((window as any).electronAPI?.window) {
      (window as any).electronAPI.window.switchToFull();
    }
  };

  const hideToTray = () => {
    if ((window as any).electronAPI?.window) {
      (window as any).electronAPI.window.hideToTray();
    }
  };

  return (
    <div className="h-full w-full bg-background border rounded-lg shadow-lg p-3 select-none">
      {/* Drag handle */}
      <div 
        className="h-4 w-full cursor-move bg-muted/50 rounded mb-2 flex items-center justify-center"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="w-8 h-0.5 bg-muted-foreground/30 rounded"></div>
      </div>

      {/* Main content */}
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Task info */}
        <div className="mb-2 text-xs">
          <div className="font-medium text-foreground truncate">
            {task ? `${task.client} / ${task.project}` : 'No task selected'}
          </div>
          <div className="text-muted-foreground truncate">
            {task?.task || 'Select a task to start'}
          </div>
        </div>

        {/* Timer display */}
        <div className="text-center mb-3">
          <div className="text-2xl font-mono font-bold text-primary">
            {formatTime(activeMs)}
          </div>
          <div className="text-xs text-muted-foreground">
            {status === 'running' ? 'Running' : status === 'paused' ? 'Paused' : 'Stopped'}
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex justify-center gap-1 mb-2">
          <Button
            size="sm"
            variant={status === 'running' ? 'default' : 'outline'}
            onClick={handleToggle}
            disabled={!task}
            className="h-8 w-8 p-0"
          >
            {status === 'running' ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleStop}
            disabled={status === 'stopped'}
            className="h-8 w-8 p-0"
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>

        {/* Window controls */}
        <div className="flex justify-between items-center">
          {/* Transparency control */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Opacity:</span>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.1"
              value={transparency}
              onChange={(e) => handleTransparencyChange(parseFloat(e.target.value))}
              className="w-12 h-1"
            />
          </div>

          {/* View controls */}
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={switchToFull}
              className="h-6 w-6 p-0"
              title="Expand to Full View"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={hideToTray}
              className="h-6 w-6 p-0"
              title="Hide to Tray"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};