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
  task?: TaskRef;
  client?: string;
  project?: string;
  start: number;
  end?: number;
  activeMs: number;
  pausedMs: number;
  notes?: string;
  createdAt: number;
  isBillable?: boolean;
  userId?: number;
  isManuallyCreated?: boolean;
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
  // Session editing methods
  editSession: (sessionId: string, updates: {
    startTime?: Date;
    endTime?: Date;
    client?: string;
    project?: string;
    task?: string;
    notes?: string;
  }, editReason: string) => Promise<void>;
  validateSessionEdit: (sessionId: string, updates: {
    startTime?: Date;
    endTime?: Date;
  }) => Promise<{ isValid: boolean; errors: string[] }>;
  getSessionEditHistory: (sessionId: string) => Promise<any[]>;
  getUserReliabilityRate: (weekStart: Date) => Promise<number>;
  // Session creation method
  addSession: (sessionData: {
    startTime: Date;
    endTime: Date;
    client: string;
    project: string;
    task: string;
    notes?: string;
  }) => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

const IDLE_THRESHOLD_MS = 15 * 1000; // 15 seconds

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
      console.log(`[Idle] handleIdle called - timestamp: ${timestamp}, timer status: ${timerStateRef.current.status}`);
      if (timerStateRef.current.status === 'running') {
        console.log(`[Idle] Idle state detected at ${new Date(timestamp).toLocaleTimeString()}`);
        wasRunningBeforeIdleRef.current = true;
        idleStartRef.current = timestamp;
        window.electronAPI.timer.pause(); // Pause the timer to stop accumulation
      } else {
        console.log(`[Idle] Timer not running, ignoring idle event`);
      }
    };

    const handleActive = (timestamp: number) => {
      console.log(`[Idle] handleActive called - timestamp: ${timestamp}, wasRunningBefore: ${wasRunningBeforeIdleRef.current}, idleStart: ${idleStartRef.current}`);
      if (wasRunningBeforeIdleRef.current && idleStartRef.current) {
        const idleMs = timestamp - idleStartRef.current;
        console.log(`[Idle] Active state resumed. Idle for ${Math.round(idleMs / 1000)}s, threshold: ${IDLE_THRESHOLD_MS}ms`);

        if (idleMs > IDLE_THRESHOLD_MS) {
          console.log(`[Idle] Showing idle dialog - idle time exceeded threshold`);
          setIdleDialog({ open: true, idleMs });
        } else {
          console.log(`[Idle] Idle time under threshold, resuming timer`);
          // If idle time is less than threshold, just resume the timer
          window.electronAPI.timer.resume();
          // Reset idle state tracking since we are not showing a dialog
          idleStartRef.current = null;
          wasRunningBeforeIdleRef.current = false;
        }
      } else {
        console.log(`[Idle] No active idle state to handle`);
      }
    };

    console.log('[Idle] Setting up power monitor event listeners');
    const removeSuspendListener = window.electronAPI.powerMonitor.onSystemSuspend((_, ts) => {
      console.log('[Idle] System suspend event received:', ts);
      handleIdle(ts);
    });
    const removeLockListener = window.electronAPI.powerMonitor.onScreenLock((_, ts) => {
      console.log('[Idle] Screen lock event received:', ts);
      handleIdle(ts);
    });
    const removeResumeListener = window.electronAPI.powerMonitor.onSystemResume((_, data) => {
      console.log('[Idle] System resume event received:', data);
      handleActive(data.wakeTime);
    });
    const removeUnlockListener = window.electronAPI.powerMonitor.onScreenUnlock((_, ts) => {
      console.log('[Idle] Screen unlock event received:', ts);
      handleActive(ts);
    });

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

  const start = useCallback(async (t: TaskRef) => {
    // Check permissions before starting timer (for non-admin users)
    if (user && user.role !== 'admin' && user.role !== 'director') {
      try {
        // Get the project ID from hierarchy to check permissions
        const hierarchy = await electronDB.getHierarchy();
        let projectId: number | null = null;

        // Find the project ID in the hierarchy
        for (const client of hierarchy) {
          if (client.name === t.client) {
            const project = client.projects?.find((p: any) => p.name === t.project);
            if (project) {
              projectId = project.id;
              break;
            }
          }
        }

        if (projectId) {
          const hasPermission = await electronDB.hasUserProjectPermission(
            user.id,
            projectId,
            'track_time'
          );

          if (!hasPermission) {
            // User doesn't have permission to track time on this project
            console.error('Permission denied: User cannot track time on this project', {
              user: user.username,
              project: `${t.client} / ${t.project}`
            });

            // Could show a toast notification here if needed
            if ((window as any).electronAPI?.showErrorDialog) {
              (window as any).electronAPI.showErrorDialog(
                'Permission Denied',
                `You don't have permission to track time on project "${t.client} / ${t.project}". Please contact your administrator.`
              );
            }
            return;
          }
        }
      } catch (error) {
        console.error('Error checking project permission before starting timer:', error);
        // On error, allow the timer to start for backward compatibility
      }
    }

    // If we get here, user has permission or is admin/director
    window.electronAPI?.timer.start(t);
  }, [user]);

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

    console.log(`[Idle] Handling choice: ${choice}`, {
      hasIdleStart: !!idleStartRef.current,
      hasTask: !!timerState.task,
      hasUser: !!user,
      userId: user?.id
    });

    // Handle test scenarios where idleStartRef might be null
    const isTestScenario = !idleStartRef.current;
    
    if (!timerState.task) {
      console.error("[Idle] Cannot handle choice, no active task.", {
        idleStart: idleStartRef.current,
        task: timerState.task
      });
      return closeDialog();
    }

    // For test scenarios, use the idle time from the dialog state
    // For real scenarios, calculate from the idle start time
    const idleMs = isTestScenario 
      ? idleDialog.idleMs 
      : Date.now() - idleStartRef.current;
    const originalTask = timerState.task;

    console.log(`[Idle] Processing choice with idle time: ${Math.round(idleMs / 1000)}s`);

    try {
      switch (choice) {
        case 'continue':
          console.log("[Idle] Continuing with original task - keeping idle time");
          if (isTestScenario) {
            console.log("[Idle] Test scenario - just resuming timer");
            window.electronAPI.timer.resume();
          } else {
            // Add the idle time to the timer (as if it kept running) then resume
            await window.electronAPI.timer.adjustTime(idleMs);
            window.electronAPI.timer.resume();
          }
          break;

        case 'break':
          console.log("[Idle] Break chosen - time discarded");
          if (isTestScenario) {
            console.log("[Idle] Test scenario - stopping timer");
            await window.electronAPI.timer.stop({ notes: "Stopped due to user idle (test).", token });
          } else {
            // Stop the current timer at the beginning of the idle period (discard idle time)
            await window.electronAPI.timer.adjustTime(-idleMs);
            await window.electronAPI.timer.stop({ notes: "Stopped due to user idle.", token });
          }
          break;

        case 'meeting':
        case 'admin':
          console.log(`[Idle] Creating ${choice} session for idle period`);
          
          if (isTestScenario) {
            console.log("[Idle] Test scenario - stopping timer and starting new");
            await window.electronAPI.timer.stop({ notes: `Stopped for ${choice} (test).`, token });
          } else {
            // First, stop the current timer at the beginning of the idle period
            await window.electronAPI.timer.adjustTime(-idleMs);
            await window.electronAPI.timer.stop({ notes: "Stopped due to user idle.", token });
          }
          
          // Create a new session for the idle period
          const meetingTask: TaskRef = {
            client: "Company",
            project: choice === 'meeting' ? "Meetings" : "Admin",
            task: "General",
          };
          
          const sessionStart = isTestScenario ? Date.now() - idleMs : idleStartRef.current;
          const sessionData = {
            id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
            task: meetingTask,
            client: meetingTask.client,
            project: meetingTask.project,
            start: sessionStart,
            end: Date.now(),
            activeMs: idleMs,
            pausedMs: 0,
            notes: isTestScenario ? "Logged from test." : "Logged from idle time.",
            createdAt: Date.now(),
            isBillable: false,
            userId: user?.id,
          };

          console.log("[Idle] Inserting session:", sessionData);
          
          try {
            await electronDB.insertSession(sessionData);
            console.log(`[Idle] Successfully inserted ${choice} session`);
          } catch (error) {
            console.error(`[Idle] Failed to insert ${choice} session:`, error);
            // Continue with the flow even if session insertion fails
          }
          
          // After logging the meeting/admin time, start a new timer for the original task
          console.log("[Idle] Starting timer for original task after logging idle time");
          start(originalTask);
          break;

        case 'switch':
          console.log("[Idle] Switching to new task");
          
          if (isTestScenario) {
            console.log("[Idle] Test scenario - stopping timer");
            await window.electronAPI.timer.stop({ notes: "Stopped for task switch (test).", token });
          } else {
            // Stop the current timer at the beginning of the idle period (discard idle time)
            await window.electronAPI.timer.adjustTime(-idleMs);
            await window.electronAPI.timer.stop({ notes: "Stopped due to user idle.", token });
          }
          
          if (nextTask) {
            console.log("[Idle] Starting timer for new task:", nextTask);
            // Start a new timer for the selected task
            start(nextTask);
          } else {
            console.log("[Idle] Switch chosen but no next task provided");
          }
          break;
      }

      // Reset idle state tracking after handling the choice
      idleStartRef.current = null;
      wasRunningBeforeIdleRef.current = false;

      console.log("[Idle] Refreshing sessions and closing dialog");
      refreshSessions();
      closeDialog();
    } catch (error) {
      console.error("[Idle] Error handling idle choice:", error);
      // Still close the dialog and reset state even if there's an error
      idleStartRef.current = null;
      wasRunningBeforeIdleRef.current = false;
      closeDialog();
    }
  }, [timerState.task, user?.id, refreshSessions, start, token]);

  const sessionsToday = React.useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return sessions.filter((s) => s.createdAt >= startOfDay.getTime());
  }, [sessions]);

  const totalTodayMs = React.useMemo(
    () => sessionsToday.reduce((sum, s) => sum + s.activeMs, 0),
    [sessionsToday]
  );

  // Session editing methods
  const editSession = useCallback(async (sessionId: string, updates: {
    startTime?: Date;
    endTime?: Date;
    client?: string;
    project?: string;
    task?: string;
    notes?: string;
  }, editReason: string) => {
    if (!user) {
      throw new Error('User must be logged in to edit sessions');
    }

    const dbUpdates: any = {};
    if (updates.startTime !== undefined) dbUpdates.startTime = updates.startTime.getTime();
    if (updates.endTime !== undefined) dbUpdates.endTime = updates.endTime.getTime();
    if (updates.client !== undefined) dbUpdates.client = updates.client;
    if (updates.project !== undefined) dbUpdates.project = updates.project;
    if (updates.task !== undefined) dbUpdates.task = updates.task;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await electronDB.editSession(sessionId, user.id, dbUpdates, editReason);
    
    // Refresh sessions to show updated data
    refreshSessions();
    
    // Update reliability metrics
    await electronDB.updateUserReliabilityMetrics(user.id);
  }, [user, refreshSessions]);

  const validateSessionEdit = useCallback(async (sessionId: string, updates: {
    startTime?: Date;
    endTime?: Date;
  }) => {
    if (!user) {
      throw new Error('User must be logged in to validate sessions');
    }

    const dbUpdates: any = {};
    if (updates.startTime !== undefined) dbUpdates.startTime = updates.startTime.getTime();
    if (updates.endTime !== undefined) dbUpdates.endTime = updates.endTime.getTime();

    return await electronDB.validateSessionEdit(sessionId, dbUpdates, user.id);
  }, [user]);

  const getSessionEditHistory = useCallback(async (sessionId: string) => {
    return await electronDB.getSessionEditHistory(sessionId);
  }, []);

  const getUserReliabilityRate = useCallback(async (weekStart: Date) => {
    if (!user) {
      throw new Error('User must be logged in to get reliability rate');
    }
    return await electronDB.getUserReliabilityRate(user.id, weekStart);
  }, [user]);

  const addSession = useCallback(async (sessionData: {
    startTime: Date;
    endTime: Date;
    client: string;
    project: string;
    task: string;
    notes?: string;
  }) => {
    if (!user) {
      throw new Error('User must be logged in to create sessions');
    }

    try {
      // Create a session object similar to how normal sessions are created
      const sessionId = crypto.randomUUID();
      const now = Date.now();
      const activeMs = sessionData.endTime.getTime() - sessionData.startTime.getTime();

      const newSession: SessionRecord = {
        id: sessionId,
        client: sessionData.client,
        project: sessionData.project,
        task: {
          client: sessionData.client,
          project: sessionData.project,
          task: sessionData.task,
        },
        start: sessionData.startTime.getTime(),
        end: sessionData.endTime.getTime(),
        activeMs,
        pausedMs: 0,
        notes: sessionData.notes || '',
        createdAt: now,
        isBillable: true,
        userId: user.id,
        isManuallyCreated: true, // Mark as manually created
      };

      // Save the session to the database
      await electronDB.addSession(newSession);
      
      // Refresh sessions to show the new one
      await refreshSessions();
      
      // Update reliability metrics
      const weekStart = new Date(sessionData.startTime);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);
      await electronDB.updateUserReliabilityMetrics(user.id, weekStart);

    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }, [user, refreshSessions]);

  // Debug function to manually test idle dialog
  const debugTestIdleDialog = useCallback(() => {
    console.log('[Debug] Manually triggering idle dialog for testing');
    setIdleDialog({ open: true, idleMs: 120000 }); // 2 minutes
  }, []);

  // Expose debug function to window for testing
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).debugTestIdleDialog = debugTestIdleDialog;
    }
  }, [debugTestIdleDialog]);

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
    // Session editing methods
    editSession,
    validateSessionEdit,
    getSessionEditHistory,
    getUserReliabilityRate,
    // Session creation method
    addSession,
    // Debug function for testing
    debugTestIdleDialog,
  } as any;

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
