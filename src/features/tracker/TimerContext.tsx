import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import { electronDB, type SessionRecord as DBSessionRecord } from "@/lib/electron-database";
import { useAuth } from "@/contexts/AuthContext";

export type TimerStatus = "stopped" | "running" | "paused" | "completed";

export interface TaskRef {
  client: string;
  project: string;
  task: string;
}

export interface SessionRecord {
  id: string;
  task: TaskRef;
  start: number;
  end?: number;
  activeMs: number;
  pausedMs: number;
  notes?: string;
  createdAt: number;
  isBillable?: boolean;
}

interface TimerState {
  status: TimerStatus;
  task?: TaskRef;
  activeMs: number;
  pausedMs: number;
  startTs?: number;
}

interface IdleDialogState {
  open: boolean;
  idleMs: number;
}

export type IdleChoice = "continue" | "break" | "switch" | "meeting" | "admin";

interface TimerContextValue extends TimerState {
  notes: string;
  start: (task: TaskRef) => void;
  pause: () => void;
  resume: () => void;
  stop: (notes?: string) => void;
  setTask: (task?: TaskRef) => void;
  setNotes: (v: string) => void;
  sessions: SessionRecord[];
  updateSession: (id: string, updates: { task?: TaskRef; notes?: string }) => void;
  sessionsToday: SessionRecord[];
  totalTodayMs: number;
  refreshSessions: () => void;
  handleIdleChoice: (choice: IdleChoice, nextTask?: TaskRef) => void;
  idleDialog: IdleDialogState;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

const IDLE_THRESHOLD_MS = 60 * 1000; // 60 seconds

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, hasPermission, token } = useAuth();
  const [timerState, setTimerState] = useState<TimerState>({ status: "stopped", activeMs: 0, pausedMs: 0 });
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [idleDialog, setIdleDialog] = useState<IdleDialogState>({ open: false, idleMs: 0 });
  
  const timerStateRef = useRef(timerState);
  useEffect(() => {
    timerStateRef.current = timerState;
  }, [timerState]);

  const idleStartRef = useRef<number | null>(null);
  const wasRunningBeforeIdleRef = useRef<boolean>(false);

  const refreshSessions = useCallback(async () => {
    if (window.electronAPI && user) {
      const dbSessions = hasPermission('view_all_sessions')
        ? await electronDB.getAllSessions()
        : await electronDB.getUserSessions(user.id);
      setSessions(dbSessions.map(dbRecordToSessionRecord));
    }
  }, [user, hasPermission]);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Get initial state from main process
    window.electronAPI.timer.getState().then(setTimerState);

    // Listen for state sync from main process
    const removeStateSyncListener = window.electronAPI.timer.onStateSync((_event, state) => {
      setTimerState(state);
    });

    const removeRefreshListener = window.electronAPI.timer.onTimerAction('refresh-sessions', refreshSessions);

    // --- Idle Detection Logic ---
    const handleIdle = (timestamp: number) => {
      if (timerStateRef.current.status === 'running') {
        console.log(`[Idle] Idle state detected at ${new Date(timestamp).toLocaleTimeString()}`);
        wasRunningBeforeIdleRef.current = true;
        idleStartRef.current = timestamp;
        window.electronAPI.timer.pause(); // Pause the timer to stop accumulation
      }
    };

    const handleActive = (timestamp: number) => {
      if (wasRunningBeforeIdleRef.current && idleStartRef.current) {
        const idleMs = timestamp - idleStartRef.current;
        console.log(`[Idle] Active state resumed. Idle for ${Math.round(idleMs / 1000)}s`);

        if (idleMs > IDLE_THRESHOLD_MS) {
          setIdleDialog({ open: true, idleMs });
        } else {
          // If idle time is less than threshold, just resume the timer
          window.electronAPI.timer.resume();
          // Reset idle state tracking since we are not showing a dialog
          idleStartRef.current = null;
          wasRunningBeforeIdleRef.current = false;
        }
      }
    };

    const removeSuspendListener = window.electronAPI.powerMonitor.onSystemSuspend((_, ts) => handleIdle(ts));
    const removeLockListener = window.electronAPI.powerMonitor.onScreenLock((_, ts) => handleIdle(ts));
    const removeResumeListener = window.electronAPI.powerMonitor.onSystemResume((_, data) => handleActive(data.wakeTime));
    const removeUnlockListener = window.electronAPI.powerMonitor.onScreenUnlock((_, ts) => handleActive(ts));

    // Initial load of sessions
    refreshSessions();

    return () => {
      // Cleanup all listeners
      removeStateSyncListener();
      removeRefreshListener();
      removeSuspendListener();
      removeLockListener();
      removeResumeListener();
      removeUnlockListener();
    };
  }, [refreshSessions]);

  const start = useCallback((t: TaskRef) => {
    window.electronAPI?.timer.start(t);
  }, []);

  const pause = useCallback(() => {
    window.electronAPI?.timer.pause();
  }, []);

  const resume = useCallback(() => {
    window.electronAPI?.timer.resume();
  }, []);

  const stop = useCallback(async (n?: string) => {
    await window.electronAPI?.timer.stop({ notes: n ?? notes, token });
    setNotes("");
    refreshSessions();
  }, [notes, refreshSessions, token]);

  const setTask = useCallback((t?: TaskRef) => {
    window.electronAPI?.timer.setTask(t);
  }, []);

  const updateSession = useCallback(async (id: string, updates: { task?: TaskRef; notes?: string }) => {
    const dbUpdates: any = {};
    if (updates.task) {
      dbUpdates.client = updates.task.client;
      dbUpdates.project = updates.task.project;
      dbUpdates.task = updates.task.task;
    }
    if (updates.notes !== undefined) {
      dbUpdates.notes = updates.notes;
    }
    await electronDB.updateSession(id, dbUpdates);
    refreshSessions();
  }, [refreshSessions]);

  const handleIdleChoice = useCallback(async (choice: IdleChoice, nextTask?: TaskRef) => {
    const closeDialog = () => setIdleDialog({ open: false, idleMs: 0 });

    if (!idleStartRef.current || !timerState.task) {
      console.error("[Idle] Cannot handle choice, idle start time or task is missing.");
      return closeDialog();
    }

    const idleMs = Date.now() - idleStartRef.current;
    const originalTask = timerState.task;

    // Stop the current timer at the beginning of the idle period
    await window.electronAPI.timer.adjustTime(-idleMs);
    await window.electronAPI.timer.stop({ notes: "Stopped due to user idle." });

    switch (choice) {
      case 'continue':
        // Start a new timer for the original task
        start(originalTask);
        break;

      case 'break':
        // Time is already discarded by stopping at idle start. Do nothing further.
        break;

      case 'meeting':
      case 'admin':
        // Create a new session for the idle period
        const meetingTask: TaskRef = {
          client: "Internal",
          project: "Meetings & Admin",
          task: choice === 'meeting' ? "Meeting" : "Admin / Non-billable",
        };
        await electronDB.insertSession({
          id: `session-${Date.now()}`,
          task: meetingTask,
          start: idleStartRef.current,
          end: Date.now(),
          activeMs: idleMs,
          pausedMs: 0,
          notes: "Logged from idle time.",
          createdAt: Date.now(),
          isBillable: false,
          userId: user?.id,
        });
        // After logging the meeting/admin time, start a new timer for the original task
        start(originalTask);
        break;

      case 'switch':
        if (nextTask) {
          // Start a new timer for the selected task
          start(nextTask);
        }
        break;
    }

    // Reset idle state tracking after handling the choice
    idleStartRef.current = null;
    wasRunningBeforeIdleRef.current = false;

    refreshSessions();
    closeDialog();
  }, [timerState.task, user?.id, refreshSessions, start]);

  const sessionsToday = React.useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return sessions.filter((s) => s.createdAt >= startOfDay.getTime());
  }, [sessions]);

  const totalTodayMs = React.useMemo(
    () => sessionsToday.reduce((sum, s) => sum + s.activeMs, 0),
    [sessionsToday]
  );

  const value: TimerContextValue = {
    ...timerState,
    notes,
    start,
    pause,
    resume,
    stop,
    setTask,
    setNotes,
    sessions,
    updateSession,
    sessionsToday,
    totalTodayMs,
    refreshSessions,
    handleIdleChoice,
    idleDialog,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export const useTimer = () => {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
};

function dbRecordToSessionRecord(dbRecord: DBSessionRecord): SessionRecord {
  return {
    id: dbRecord.id,
    task: {
      client: dbRecord.client,
      project: dbRecord.project,
      task: dbRecord.task,
    },
    start: dbRecord.start,
    end: dbRecord.end,
    activeMs: dbRecord.activeMs,
    pausedMs: dbRecord.pausedMs,
    notes: dbRecord.notes,
    createdAt: dbRecord.createdAt,
    isBillable: dbRecord.isBillable,
  };
}
