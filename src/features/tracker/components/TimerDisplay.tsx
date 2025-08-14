import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTimer, TaskRef } from "../TimerContext";

function msToHMS(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const getTaskPath = (task: TaskRef | undefined): string => {
  if (!task) return 'No task selected';
  return `${task.client} > ${task.project} > ${task.task}`;
};

export const TimerDisplay: React.FC<{ className?: string }> = ({ className }) => {
  const { status, activeMs, pause, resume, stop, start, task } = useTimer();
  const canStart = !!task && (status === "stopped" || status === "completed");
  const wrapRef = useRef<HTMLDivElement>(null);

  const onMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--x", `${x}%`);
    el.style.setProperty("--y", `${y}%`);
  };

  return (
    <div ref={wrapRef} onMouseMove={onMove} className={cn("hero-surface p-6 sm:p-8", className)}>
      <div className="aurora" aria-hidden="true" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="text-sm text-center text-muted-foreground truncate" title={getTaskPath(task)}>
          {getTaskPath(task)}
        </div>
        <Badge className="bg-secondary text-secondary-foreground" variant="secondary">
          {status?.toUpperCase() || 'STOPPED'}
        </Badge>
        <div className="text-5xl sm:text-6xl font-semibold tracking-tight">
          {msToHMS(activeMs || 0)}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {status === "running" && (
            <Button variant="secondary" onClick={pause} aria-label="Pause timer">
              Pause
            </Button>
          )}
          {status === "paused" && (
            <Button variant="secondary" onClick={resume} aria-label="Resume timer">
              Resume
            </Button>
          )}
          {status === "running" || status === "paused" ? (
            <Button variant="destructive" onClick={() => stop()} aria-label="Stop timer">
              Stop
            </Button>
          ) : (
            <Button variant="hero" onClick={() => task && start(task)} disabled={!canStart} aria-label="Start timer">
              Start Timer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
