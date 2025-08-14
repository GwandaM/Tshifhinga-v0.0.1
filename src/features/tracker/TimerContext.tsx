import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { electronDB, type SessionRecord as DBSessionRecord } from "@/lib/electron-database";

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

interface IdleDialog {
  open: boolean;
  idleMs: number;
}

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
  handleIdleChoice: (choice: 'discard' | 'keep') => void;
  idleDialog: IdleDialog;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timerState, setTimerState] = useState<TimerState>({ status: "stopped", activeMs: 0, pausedMs: 0 });
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [isElectron, setIsElectron] = useState(false);
  const [idleDialog, setIdleDialog] = useState<IdleDialog>({ open: false, idleMs: 0 });
  const listenersRef = React.useRef<{
    stateSync?: () => void;
    refreshSessions?: () => void;
    powerMonitor?: {
      suspend?: () => void;
      resume?: () => void;
      screenLock?: () => void;
      screenUnlock?: () => void;
    };
  }>({});
  const lastActivityRef = React.useRef<number>(Date.now());

  const refreshSessions = useCallback(async () => {
    if ((window as any).electronAPI) {
      const dbSessions = await electronDB.getAllSessions();
      setSessions(dbSessions.map(dbRecordToSessionRecord));
    }
  }, []);

  useEffect(() => {
    const electronAvailable = !!(window as any).electronAPI;
    setIsElectron(electronAvailable);

    if (electronAvailable) {
      // Get initial state from main process
      (window as any).electronAPI.timer.getState().then(setTimerState);

      // Listen for state sync from main process
      const handleStateSync = (_event: any, state: TimerState) => {
        setTimerState(state);
      };
      listenersRef.current.stateSync = handleStateSync;
      (window as any).electronAPI.timer.onStateSync(handleStateSync);

      // Listen for session refresh requests
      const handleRefresh = () => refreshSessions();
      listenersRef.current.refreshSessions = handleRefresh;
      (window as any).electronAPI.timer.onTimerAction('refresh-sessions', handleRefresh);

      // Initial load of sessions
      refreshSessions();

      // Set up power monitor listeners for idle detection
      const handleSystemSuspend = (_event: any, suspendTime: number) => {
        if (timerState.status === 'running') {
          lastActivityRef.current = suspendTime;
          console.log('System suspended while timer running');
        }
      };

      const handleSystemResume = (_event: any, { wakeTime, sleepDuration }: { wakeTime: number; sleepDuration: number }) => {
        if (timerState.status === 'running' && sleepDuration > 30000) { // Only show dialog if idle for more than 30 seconds
          console.log('System resumed, showing idle dialog for', sleepDuration, 'ms');
          setIdleDialog({
            open: true,
            idleMs: sleepDuration
          });
        }
      };

      const handleScreenLock = (_event: any, lockTime: number) => {
        if (timerState.status === 'running') {
          lastActivityRef.current = lockTime;
          console.log('Screen locked while timer running');
        }
      };

      const handleScreenUnlock = (_event: any, unlockTime: number) => {
        if (timerState.status === 'running' && lastActivityRef.current) {
          const idleTime = unlockTime - lastActivityRef.current;
          if (idleTime > 30000) { // Only show dialog if idle for more than 30 seconds
            console.log('Screen unlocked, showing idle dialog for', idleTime, 'ms');
            setIdleDialog({
              open: true,
              idleMs: idleTime
            });
          }
        }
        lastActivityRef.current = unlockTime;
      };

      // Store power monitor listeners
      listenersRef.current.powerMonitor = {
        suspend: handleSystemSuspend,
        resume: handleSystemResume,
        screenLock: handleScreenLock,
        screenUnlock: handleScreenUnlock
      };

      // Set up power monitor listeners
      (window as any).electronAPI.powerMonitor.onSystemSuspend(handleSystemSuspend);
      (window as any).electronAPI.powerMonitor.onSystemResume(handleSystemResume);
      (window as any).electronAPI.powerMonitor.onScreenLock(handleScreenLock);
      (window as any).electronAPI.powerMonitor.onScreenUnlock(handleScreenUnlock);

      return () => {
        // Remove specific listeners we added
        if ((window as any).electronAPI) {
          try {
            // Use the specific listener references if available
            const { ipcRenderer } = require('electron');
            if (listenersRef.current.stateSync) {
              ipcRenderer.removeListener('timer:state-sync', listenersRef.current.stateSync);
            }
            if (listenersRef.current.refreshSessions) {
              ipcRenderer.removeListener('timer-action-refresh-sessions', listenersRef.current.refreshSessions);
            }
            // Fallback to removeAllListeners
            (window as any).electronAPI.timer.removeAllListeners('timer:state-sync');
            (window as any).electronAPI.timer.removeAllListeners('timer-action-refresh-sessions');
            
            // Remove power monitor listeners
            (window as any).electronAPI.powerMonitor.removeAllListeners();
          } catch (error) {
            console.warn('Error removing listeners:', error);
            // Clear references
            listenersRef.current = {};
          }
        }
      };
    }
  }, [refreshSessions]);

  const start = useCallback((t: TaskRef) => {
    lastActivityRef.current = Date.now();
    (window as any).electronAPI?.timer.start(t);
  }, []);

  const pause = useCallback(() => {
    (window as any).electronAPI?.timer.pause();
  }, []);

  const resume = useCallback(() => {
    lastActivityRef.current = Date.now();
    (window as any).electronAPI?.timer.resume();
  }, []);

  const stop = useCallback(async (n?: string) => {
    await (window as any).electronAPI?.timer.stop(n ?? notes);
    setNotes("");
    refreshSessions();
  }, [notes, refreshSessions]);

  const setTask = useCallback((t?: TaskRef) => {
    (window as any).electronAPI?.timer.setTask(t);
  }, []);

  const updateSession = useCallback(async (id: string, updates: { task?: TaskRef; notes?: string }) => {
    // Transform TaskRef to individual fields for the database
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

  const handleIdleChoice = useCallback((choice: 'discard' | 'keep') => {
    if (choice === 'discard') {
      // Reset timer to previous state before idle period
      const newActiveMs = Math.max(0, timerState.activeMs - idleDialog.idleMs);
      setTimerState(prev => ({ ...prev, activeMs: newActiveMs }));
      (window as any).electronAPI?.timer.adjustTime(-idleDialog.idleMs);
    }
    // If 'keep', do nothing - the time is already included
    setIdleDialog({ open: false, idleMs: 0 });
  }, [timerState.activeMs, idleDialog.idleMs]);

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
