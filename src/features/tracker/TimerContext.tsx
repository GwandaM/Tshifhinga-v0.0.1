import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

interface TimerContextValue {
  status: TimerStatus;
  task?: TaskRef;
  notes: string;
  activeMs: number;
  pausedMs: number;
  idleDialog: { open: boolean; idleMs: number };
  start: (task: TaskRef) => void;
  pause: () => void;
  resume: () => void;
  stop: (notes?: string) => void;
  setTask: (task?: TaskRef) => void;
  setNotes: (v: string) => void;
  handleIdleChoice: (choice: "continue" | "break" | "switch" | "meeting" | "admin", nextTask?: TaskRef) => void;
  sessions: SessionRecord[];
  updateSession: (id: string, updates: { task?: TaskRef; notes?: string }) => void;
  sessionsToday: SessionRecord[];
  totalTodayMs: number;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const SESSIONS_KEY = "tt_sessions_v1"; // Keep for fallback

// localStorage functions (fallback when not in Electron)
function loadSessions(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: SessionRecord[]) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

// Convert database record to UI format
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

// Convert UI format to database record
function sessionRecordToDbRecord(session: SessionRecord): DBSessionRecord {
  return {
    id: session.id,
    client: session.task.client,
    project: session.task.project,
    task: session.task.task,
    start: session.start,
    end: session.end,
    activeMs: session.activeMs,
    pausedMs: session.pausedMs,
    notes: session.notes,
    createdAt: session.createdAt,
    isBillable: session.isBillable,
  };
}

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<TimerStatus>("stopped");
  const [task, setTask] = useState<TaskRef | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [activeMs, setActiveMs] = useState(0);
  const [pausedMs, setPausedMs] = useState(0);
  const [startTs, setStartTs] = useState<number | undefined>(undefined);
  const lastTickRef = useRef<number | undefined>(undefined);
  const [idleDialog, setIdleDialog] = useState<{ open: boolean; idleMs: number }>({ open: false, idleMs: 0 });
  const idleSinceRef = useRef<number>(Date.now());
  const idleFiredRef = useRef<boolean>(false);
  const lastVisibilityChangeRef = useRef<number>(Date.now());
  const wasHiddenRef = useRef<boolean>(false);
  const systemSleepTimeRef = useRef<number | null>(null);

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // Send timer state to main process for synchronization
  const sendStateToMain = (currentStatus: TimerStatus, currentTask?: TaskRef, currentActiveMs?: number) => {
    if ((window as any).electronAPI?.timer) {
      const timerState = {
        status: currentStatus,
        task: currentTask,
        activeMs: currentActiveMs || activeMs,
        pausedMs,
        notes,
        startTs
      };
      (window as any).electronAPI.timer.sendStateChange(timerState);
    }
  };

  // Initialize database and load sessions
  useEffect(() => {
    const initializeDb = async () => {
      // Check if running in Electron
      const electronAvailable = !!(window as any).electronAPI;
      setIsElectron(electronAvailable);

      if (electronAvailable) {
        try {
          console.log('Initializing Electron SQLite database...');
          await electronDB.init();
          console.log('Migrating data from localStorage...');
          await electronDB.migrateFromLocalStorage();
          console.log('Loading sessions from SQLite...');
          const dbSessions = await electronDB.getAllSessions();
          const uiSessions = dbSessions.map(dbRecordToSessionRecord);
          setSessions(uiSessions);
          setDbInitialized(true);
          console.log('Electron database initialization complete');
        } catch (error) {
          console.error('Failed to initialize Electron database:', error);
          // Fallback to localStorage
          console.log('Falling back to localStorage...');
          const localSessions = loadSessions();
          setSessions(localSessions);
          setDbInitialized(false);
        }
      } else {
        // Running in web browser, use localStorage
        console.log('Running in web browser, using localStorage...');
        const localSessions = loadSessions();
        setSessions(localSessions);
        setDbInitialized(false);
      }
    };

    initializeDb();
  }, []);

  // Tick when running
  useEffect(() => {
    if (status !== "running") return;
    const interval = setInterval(() => {
      const now = Date.now();
      const last = lastTickRef.current ?? now;
      const delta = now - last;
      lastTickRef.current = now;
      setActiveMs((v) => v + delta);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Activity listeners for idle detection
  useEffect(() => {
    const onActivity = () => {
      idleSinceRef.current = Date.now();
      idleFiredRef.current = false;
    };
    const events: (keyof DocumentEventMap)[] = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, []);

  // Visibility change detection for screen lock/sleep scenarios
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      
      if (document.hidden) {
        // Screen went dark/hidden - record when it happened
        lastVisibilityChangeRef.current = now;
        wasHiddenRef.current = true;
        console.log('Screen became hidden at:', new Date(now).toLocaleTimeString());
      } else if (wasHiddenRef.current) {
        // Screen came back - check if we were hidden long enough to trigger idle
        const hiddenDuration = now - lastVisibilityChangeRef.current;
        console.log(`Screen visible again after ${Math.round(hiddenDuration / 1000)}s`);
        
        if (status === "running" && hiddenDuration >= IDLE_THRESHOLD_MS && !idleFiredRef.current) {
          console.log('Triggering idle dialog due to screen lock/sleep');
          // Trigger idle detection
          setStatus("paused");
          setIdleDialog({ open: true, idleMs: hiddenDuration });
          idleFiredRef.current = true;
        }
        
        wasHiddenRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status]);

  // Electron power monitor events for system-level sleep/wake detection
  useEffect(() => {
    if (!isElectron || !(window as any).electronAPI?.powerMonitor) return;

    const electronAPI = (window as any).electronAPI;

    const handleSystemSuspend = (_, suspendTime: number) => {
      console.log('System suspend detected');
      systemSleepTimeRef.current = suspendTime;
    };

    const handleSystemResume = (_, data: { wakeTime: number; sleepDuration: number }) => {
      console.log(`System resume detected after ${Math.round(data.sleepDuration / 1000)}s sleep`);
      
      if (status === "running" && data.sleepDuration >= IDLE_THRESHOLD_MS && !idleFiredRef.current) {
        console.log('Triggering idle dialog due to system sleep');
        setStatus("paused");
        setIdleDialog({ open: true, idleMs: data.sleepDuration });
        idleFiredRef.current = true;
      }
      
      systemSleepTimeRef.current = null;
    };

    const handleScreenLock = (_, lockTime: number) => {
      console.log('Screen lock detected');
      lastVisibilityChangeRef.current = lockTime;
      wasHiddenRef.current = true;
    };

    const handleScreenUnlock = (_, unlockTime: number) => {
      console.log('Screen unlock detected');
      if (wasHiddenRef.current) {
        const lockDuration = unlockTime - lastVisibilityChangeRef.current;
        console.log(`Screen was locked for ${Math.round(lockDuration / 1000)}s`);
        
        if (status === "running" && lockDuration >= IDLE_THRESHOLD_MS && !idleFiredRef.current) {
          console.log('Triggering idle dialog due to screen lock');
          setStatus("paused");
          setIdleDialog({ open: true, idleMs: lockDuration });
          idleFiredRef.current = true;
        }
        
        wasHiddenRef.current = false;
      }
    };

    // Set up event listeners
    electronAPI.powerMonitor.onSystemSuspend(handleSystemSuspend);
    electronAPI.powerMonitor.onSystemResume(handleSystemResume);
    electronAPI.powerMonitor.onScreenLock(handleScreenLock);
    electronAPI.powerMonitor.onScreenUnlock(handleScreenUnlock);

    return () => {
      // Clean up listeners
      electronAPI.powerMonitor.removeAllListeners();
    };
  }, [status, isElectron]);

  // Idle check
  useEffect(() => {
    const t = setInterval(() => {
      if (status !== "running") return;
      const idleFor = Date.now() - idleSinceRef.current;
      if (!idleFiredRef.current && idleFor >= IDLE_THRESHOLD_MS) {
        // Auto-pause and show dialog
        setStatus("paused");
        setIdleDialog({ open: true, idleMs: idleFor });
        idleFiredRef.current = true;
      }
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  const start = useCallback((t: TaskRef) => {
    setTask(t);
    setStatus("running");
    const now = Date.now();
    setStartTs(now);
    lastTickRef.current = now;
    setActiveMs(0);
    setPausedMs(0);
    setNotes("");
    idleSinceRef.current = now;
    idleFiredRef.current = false;
    lastVisibilityChangeRef.current = now;
    wasHiddenRef.current = false;
    
    // Send state change to main process
    sendStateToMain("running", t, 0);
  }, [sendStateToMain]);

  const pause = useCallback(() => {
    if (status !== "running") return;
    setStatus("paused");
  }, [status]);

  const resume = useCallback(() => {
    if (status !== "paused") return;
    setStatus("running");
    const now = Date.now();
    lastTickRef.current = now;
    idleSinceRef.current = now;
    lastVisibilityChangeRef.current = now;
    wasHiddenRef.current = false;
  }, [status]);

  const stop = useCallback(async (n?: string) => {
    if (!startTs || !task) {
      setStatus("stopped");
      return;
    }

    const record: SessionRecord = {
      id: `${startTs}-${Math.random().toString(36).slice(2, 8)}`,
      task,
      start: startTs,
      end: Date.now(),
      activeMs,
      pausedMs,
      notes: n ?? notes,
      createdAt: Date.now(),
      isBillable: true,
    };

    // Update local state first
    const next = [record, ...sessions];
    setSessions(next);

    // Set status to completed and reset state immediately to prevent UI glitches
    setStatus("completed");
    // Keep task selected for next session - don't call setTask(undefined)
    setActiveMs(0);
    setPausedMs(0);
    setStartTs(undefined);
    setNotes("");

    // Save to database asynchronously without blocking UI
    try {
      if (isElectron && dbInitialized) {
        // Save to Electron SQLite database
        const dbRecord = sessionRecordToDbRecord(record);
        electronDB.insertSession(dbRecord).then(() => {
          console.log('Session saved to SQLite database');
        }).catch((error) => {
          console.error('Failed to save session to database:', error);
          // Fallback to localStorage
          saveSessions(next);
        });
      } else {
        // Fallback to localStorage
        saveSessions(next);
        console.log('Session saved to localStorage');
      }
    } catch (error) {
      console.error('Failed to save session:', error);
      // Ensure localStorage fallback
      saveSessions(next);
    }
  }, [activeMs, pausedMs, sessions, startTs, task, notes, isElectron, dbInitialized]);

  const updateSession = useCallback(async (id: string, updates: { task?: TaskRef; notes?: string }) => {
    // Update local state first
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, task: updates.task ?? s.task, notes: updates.notes ?? s.notes } : s
      );

      // Save to appropriate storage asynchronously
      try {
        if (isElectron && dbInitialized) {
          // Save to Electron SQLite database
          const dbUpdates: { client?: string; project?: string; task?: string; notes?: string } = {};
          if (updates.task) {
            dbUpdates.client = updates.task.client;
            dbUpdates.project = updates.task.project;
            dbUpdates.task = updates.task.task;
          }
          if (updates.notes !== undefined) {
            dbUpdates.notes = updates.notes;
          }

          electronDB.updateSession(id, dbUpdates).catch((error) => {
            console.error('Failed to update session in SQLite, using localStorage fallback:', error);
            saveSessions(next);
          });
        } else {
          // Fallback to localStorage
          saveSessions(next);
        }
      } catch (error) {
        console.error('Failed to update session:', error);
        saveSessions(next);
      }

      return next;
    });
  }, [isElectron, dbInitialized]);

  // Admin task reference for non-billable time
  const ADMIN_TASK: TaskRef = {
    client: "Company",
    project: "Non-Billable", 
    task: "Admin"
  };

  const handleIdleChoice = useCallback(
    (choice: "continue" | "break" | "switch" | "meeting" | "admin", nextTask?: TaskRef) => {
      if (choice === "continue") {
        // Count idle time as active
        setActiveMs((v) => v + idleDialog.idleMs);
        setIdleDialog({ open: false, idleMs: 0 });
        resume();
      } else if (choice === "break") {
        // Do not count idle time; add to paused time
        setPausedMs((v) => v + idleDialog.idleMs);
        setIdleDialog({ open: false, idleMs: 0 });
        resume();
      } else if (choice === "switch" && nextTask) {
        // Stop current as completed, start a new with nextTask
        stop();
        start(nextTask);
        setIdleDialog({ open: false, idleMs: 0 });
      } else if (choice === "meeting") {
        // Treat idle time as meeting within same project: add note
        setNotes((n) => `${n ? n + " | " : ""}Meeting (${Math.round(idleDialog.idleMs / 60000)} min)`);
        setIdleDialog({ open: false, idleMs: 0 });
        resume();
      } else if (choice === "admin") {
        // Record idle time as non-billable admin time
        const adminRecord: SessionRecord = {
          id: `${Date.now()}-admin-${Math.random().toString(36).slice(2, 8)}`,
          task: ADMIN_TASK,
          start: Date.now() - idleDialog.idleMs,
          end: Date.now(),
          activeMs: idleDialog.idleMs,
          pausedMs: 0,
          notes: `Admin/Non-billable time (${Math.round(idleDialog.idleMs / 60000)} min)`,
          createdAt: Date.now(),
          isBillable: false,
        };

        // Save admin session
        const nextSessions = [adminRecord, ...sessions];
        setSessions(nextSessions);

        // Save to database asynchronously
        try {
          if (isElectron && dbInitialized) {
            const dbRecord = sessionRecordToDbRecord(adminRecord);
            electronDB.insertSession(dbRecord).catch((error) => {
              console.error('Failed to save admin session to database:', error);
              saveSessions(nextSessions);
            });
          } else {
            saveSessions(nextSessions);
          }
        } catch (error) {
          console.error('Failed to save admin session:', error);
          saveSessions(nextSessions);
        }

        setIdleDialog({ open: false, idleMs: 0 });
        resume();
      } else {
        setIdleDialog({ open: false, idleMs: 0 });
      }
    },
    [idleDialog.idleMs, resume, start, stop, sessions, isElectron, dbInitialized]
  );

  const sessionsToday = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return sessions.filter((s) => s.createdAt >= startOfDay.getTime());
  }, [sessions]);

  const totalTodayMs = useMemo(
    () => sessionsToday.reduce((sum, s) => sum + s.activeMs, 0),
    [sessionsToday]
  );

  const value: TimerContextValue = {
    status,
    task,
    notes,
    activeMs,
    pausedMs,
    idleDialog,
    start,
    pause,
    resume,
    stop,
    setTask,
    setNotes,
    handleIdleChoice,
    sessions,
    updateSession,
    sessionsToday,
    totalTodayMs,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export const useTimer = () => {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
};
