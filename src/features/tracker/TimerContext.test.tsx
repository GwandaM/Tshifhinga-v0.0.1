import { render, screen, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { TimerProvider, useTimer, type TaskRef, type IdleChoice } from './TimerContext';
import { electronDB } from '@/lib/electron-database';

// Mock the electronDB API
vi.mock('@/lib/electron-database', () => ({
  electronDB: {
    getAllSessions: vi.fn().mockResolvedValue([]),
    getUserSessions: vi.fn().mockResolvedValue([]),
    updateSession: vi.fn().mockResolvedValue(undefined),
    insertSession: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Date.now for consistent testing
const mockDateNow = vi.fn();
const originalDateNow = Date.now;

// Test utilities
const setupMockTimes = (idleStartTime: number, currentTime: number) => {
  mockDateNow.mockReturnValue(currentTime);
  Date.now = mockDateNow;
  return { idleMs: currentTime - idleStartTime, idleStartTime, currentTime };
};

const restoreDateNow = () => {
  Date.now = originalDateNow;
};

// Mock the global electronAPI with enhanced power monitor mocks
const createMockElectronAPI = () => ({
  timer: {
    getState: vi.fn().mockResolvedValue({ status: 'stopped', activeMs: 0, pausedMs: 0 }),
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    adjustTime: vi.fn(),
    setTask: vi.fn(),
    onStateSync: vi.fn(() => () => {}),
    onTimerAction: vi.fn(() => () => {}),
  },
  powerMonitor: {
    onSystemSuspend: vi.fn(() => () => {}),
    onScreenLock: vi.fn(() => () => {}),
    onSystemResume: vi.fn(() => () => {}),
    onScreenUnlock: vi.fn(() => () => {}),
  },
});

// Mock AuthContext
const createMockAuthContext = (overrides = {}) => ({
  user: { id: 1, username: 'testuser', role: 'user' },
  token: 'test-token',
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  hasPermission: vi.fn(() => true),
  isAuthenticated: true,
  isLoading: false,
  ...overrides,
});

// Test component to expose internal refs and methods for testing
const IdleTestComponent: React.FC<{
  onTimerRef?: (ref: any) => void;
  onIdleHandlers?: (handlers: any) => void;
}> = ({ onTimerRef, onIdleHandlers }) => {
  const timer = useTimer();
  const handlersRef = useRef<any>();

  // Expose timer context for testing
  React.useEffect(() => {
    onTimerRef?.(timer);
  }, [timer, onTimerRef]);

  // Capture idle handlers for direct testing - use a timeout to ensure power monitor listeners are registered
  React.useEffect(() => {
    const extractHandlers = () => {
      if (window.electronAPI?.powerMonitor) {
        const handlers = {
          handleSuspend: null as any,
          handleLock: null as any,
          handleResume: null as any,
          handleUnlock: null as any,
        };

        // Extract handlers from mock calls
        const suspendCalls = (window.electronAPI.powerMonitor.onSystemSuspend as any).mock?.calls;
        const lockCalls = (window.electronAPI.powerMonitor.onScreenLock as any).mock?.calls;
        const resumeCalls = (window.electronAPI.powerMonitor.onSystemResume as any).mock?.calls;
        const unlockCalls = (window.electronAPI.powerMonitor.onScreenUnlock as any).mock?.calls;

        if (suspendCalls?.[0]?.[0]) handlers.handleSuspend = suspendCalls[0][0];
        if (lockCalls?.[0]?.[0]) handlers.handleLock = lockCalls[0][0];
        if (resumeCalls?.[0]?.[0]) handlers.handleResume = resumeCalls[0][0];
        if (unlockCalls?.[0]?.[0]) handlers.handleUnlock = unlockCalls[0][0];

        handlersRef.current = handlers;
        onIdleHandlers?.(handlers);
      }
    };

    // Try immediately
    extractHandlers();
    
    // Also try after a short delay to ensure useEffect in TimerProvider has run
    const timeout = setTimeout(extractHandlers, 10);
    
    return () => clearTimeout(timeout);
  }, [onIdleHandlers]);

  return (
    <div>
      <div data-testid="timer-status">{timer.status}</div>
      <div data-testid="idle-dialog-open">{timer.idleDialog.open.toString()}</div>
      <div data-testid="idle-dialog-ms">{timer.idleDialog.idleMs}</div>
      <button 
        data-testid="start-timer" 
        onClick={() => timer.start({ client: 'Test Client', project: 'Test Project', task: 'Test Task' })}
      >
        Start Timer
      </button>
      <button data-testid="pause-timer" onClick={timer.pause}>Pause Timer</button>
      <button data-testid="resume-timer" onClick={timer.resume}>Resume Timer</button>
      <button data-testid="stop-timer" onClick={() => timer.stop()}>Stop Timer</button>
    </div>
  );
};

const renderTimerProvider = (authContextOverrides = {}, onTimerRef?: (ref: any) => void, onIdleHandlers?: (handlers: any) => void) => {
  // Use the existing mockElectronAPI from the global scope
  const mockElectronAPI = global.window.electronAPI || createMockElectronAPI();
  if (!global.window.electronAPI) {
    global.window.electronAPI = mockElectronAPI;
  }
  
  const authContext = createMockAuthContext(authContextOverrides);
  
  return {
    ...render(
      <AuthContext.Provider value={authContext}>
        <TimerProvider>
          <IdleTestComponent onTimerRef={onTimerRef} onIdleHandlers={onIdleHandlers} />
        </TimerProvider>
      </AuthContext.Provider>
    ),
    mockElectronAPI,
    authContext,
  };
};

// Sample task for testing
const sampleTask: TaskRef = {
  client: 'Test Client',
  project: 'Test Project', 
  task: 'Test Task'
};

// Helper function to set up a running timer state
const setupRunningTimer = async (timerRef: any, mockElectronAPI: any) => {
  // Start the timer
  await act(async () => {
    timerRef.start(sampleTask);
  });
  
  // Mock the state sync to simulate the timer being started
  const runningState = { status: 'running', activeMs: 5000, pausedMs: 0, task: sampleTask };
  await act(async () => {
    // Simulate state sync from main process
    const stateSyncCalls = mockElectronAPI.timer.onStateSync.mock.calls;
    if (stateSyncCalls.length > 0) {
      const stateSyncHandler = stateSyncCalls[0][0];
      stateSyncHandler(null, runningState);
    }
  });
};

describe('TimerContext - Idle Tracking Comprehensive Tests', () => {
  let mockElectronAPI: ReturnType<typeof createMockElectronAPI>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure electronAPI is available before any tests run
    mockElectronAPI = createMockElectronAPI();
    global.window = global.window || {};
    global.window.electronAPI = mockElectronAPI;
  });

  afterEach(() => {
    restoreDateNow();
    vi.clearAllMocks();
  });

  describe('Power Monitor Integration', () => {
    it('should register all power monitor event listeners on mount', () => {
      renderTimerProvider();
      
      expect(mockElectronAPI.powerMonitor.onSystemSuspend).toHaveBeenCalledWith(expect.any(Function));
      expect(mockElectronAPI.powerMonitor.onScreenLock).toHaveBeenCalledWith(expect.any(Function));
      expect(mockElectronAPI.powerMonitor.onSystemResume).toHaveBeenCalledWith(expect.any(Function));
      expect(mockElectronAPI.powerMonitor.onScreenUnlock).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should call handleIdle when system suspends with running timer', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      const { mockElectronAPI } = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      // Set up running timer state
      await setupRunningTimer(timerRef, mockElectronAPI);
      
      const suspendTime = Date.now();
      
      // Trigger system suspend
      await act(async () => {
        idleHandlers.handleSuspend?.(null, suspendTime);
      });
      
      expect(mockElectronAPI.timer.pause).toHaveBeenCalled();
    });

    it('should call handleIdle when screen locks with running timer', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      const { mockElectronAPI } = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      // Set up running timer state
      await setupRunningTimer(timerRef, mockElectronAPI);
      
      const lockTime = Date.now();
      
      // Trigger screen lock
      await act(async () => {
        idleHandlers.handleLock?.(null, lockTime);
      });
      
      expect(mockElectronAPI.timer.pause).toHaveBeenCalled();
    });

    it('should call handleActive when system resumes', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      const { mockElectronAPI } = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      // Set up running timer state
      await setupRunningTimer(timerRef, mockElectronAPI);
      
      const suspendTime = Date.now() - 120000; // 2 minutes ago
      const resumeTime = Date.now();
      
      // Simulate suspend first
      await act(async () => {
        idleHandlers.handleSuspend?.(null, suspendTime);
      });
      
      // Then resume
      await act(async () => {
        idleHandlers.handleResume?.(null, { wakeTime: resumeTime, sleepDuration: 120000 });
      });
      
      await waitFor(() => {
        expect(timerRef.idleDialog.open).toBe(true);
        expect(timerRef.idleDialog.idleMs).toBeGreaterThan(60000);
      });
    });

    it('should call handleActive when screen unlocks', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      const unlockTime = Date.now();
      
      // Trigger screen unlock
      await act(async () => {
        idleHandlers.handleUnlock?.(null, unlockTime);
      });
      
      // Should not show dialog if timer wasn't running before idle
      expect(timerRef.idleDialog.open).toBe(false);
    });
  });

  describe('Idle Detection Logic', () => {
    it('should not trigger idle handling if timer is not running', async () => {
      let idleHandlers: any;
      const { mockElectronAPI } = renderTimerProvider({}, undefined, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers).toBeDefined());
      
      // Timer is stopped, should not trigger idle handling
      await act(async () => {
        idleHandlers.handleSuspend?.(null, Date.now());
      });
      
      expect(mockElectronAPI.timer.pause).not.toHaveBeenCalled();
    });

    it('should show idle dialog for long idle periods (>= 60 seconds)', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      const { mockElectronAPI } = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      // Set up running timer state
      await setupRunningTimer(timerRef, mockElectronAPI);
      
      const idleStart = Date.now() - 70000; // 70 seconds ago
      const resumeTime = Date.now();
      
      // Simulate idle and resume cycle
      await act(async () => {
        idleHandlers.handleSuspend?.(null, idleStart);
      });
      
      await act(async () => {
        idleHandlers.handleResume?.(null, { wakeTime: resumeTime });
      });
      
      await waitFor(() => {
        expect(timerRef.idleDialog.open).toBe(true);
        expect(timerRef.idleDialog.idleMs).toBeGreaterThanOrEqual(60000);
      });
    });

    it('should auto-resume timer for short idle periods (< 60 seconds)', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      const { mockElectronAPI } = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      // Set up running timer state
      await setupRunningTimer(timerRef, mockElectronAPI);
      
      const idleStart = Date.now() - 30000; // 30 seconds ago
      const resumeTime = Date.now();
      
      // Simulate idle and resume cycle
      await act(async () => {
        idleHandlers.handleSuspend?.(null, idleStart);
      });
      
      await act(async () => {
        idleHandlers.handleResume?.(null, { wakeTime: resumeTime });
      });
      
      expect(mockElectronAPI.timer.resume).toHaveBeenCalled();
      expect(timerRef.idleDialog.open).toBe(false);
    });

    it('should track idle state correctly with wasRunningBeforeIdleRef', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      // Timer not running - should not track idle
      await act(async () => {
        idleHandlers.handleSuspend?.(null, Date.now() - 70000);
      });
      
      await act(async () => {
        idleHandlers.handleResume?.(null, { wakeTime: Date.now() });
      });
      
      expect(timerRef.idleDialog.open).toBe(false);
    });
  });

  describe('Idle Choice Handling', () => {
    let timerRef: any;
    let mockElectronAPI: any;
    let idleHandlers: any;
    
    beforeEach(async () => {
      const setup = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      mockElectronAPI = setup.mockElectronAPI;
      
      await waitFor(() => expect(timerRef && idleHandlers).toBeDefined());
      
      // Set up running timer state
      await setupRunningTimer(timerRef, mockElectronAPI);
      
      // Simulate idle cycle to set up internal state properly
      const idleStart = Date.now() - 70000;
      const resumeTime = Date.now();
      
      setupMockTimes(idleStart, resumeTime);
      
      // Trigger the idle detection flow
      await act(async () => {
        idleHandlers.handleSuspend?.(null, idleStart);
      });
      
      await act(async () => {
        idleHandlers.handleResume?.(null, { wakeTime: resumeTime });
      });
      
      // Wait for idle dialog to open
      await waitFor(() => {
        expect(timerRef.idleDialog.open).toBe(true);
      });
    });

    it('should handle "continue" choice correctly', async () => {
      const task = sampleTask;
      
      await act(async () => {
        await timerRef.handleIdleChoice('continue');
      });
      
      expect(mockElectronAPI.timer.adjustTime).toHaveBeenCalledWith(expect.any(Number));
      expect(mockElectronAPI.timer.stop).toHaveBeenCalledWith({ notes: 'Stopped due to user idle.' });
      expect(mockElectronAPI.timer.start).toHaveBeenCalled();
      expect(timerRef.idleDialog.open).toBe(false);
    });

    it('should handle "break" choice correctly', async () => {
      await act(async () => {
        await timerRef.handleIdleChoice('break');
      });
      
      expect(mockElectronAPI.timer.adjustTime).toHaveBeenCalledWith(expect.any(Number));
      expect(mockElectronAPI.timer.stop).toHaveBeenCalledWith({ notes: 'Stopped due to user idle.' });
      expect(mockElectronAPI.timer.start).not.toHaveBeenCalled();
      expect(timerRef.idleDialog.open).toBe(false);
    });

    it('should handle "meeting" choice correctly', async () => {
      const mockUser = { id: 1 };
      
      await act(async () => {
        await timerRef.handleIdleChoice('meeting');
      });
      
      expect(mockElectronAPI.timer.adjustTime).toHaveBeenCalledWith(expect.any(Number));
      expect(mockElectronAPI.timer.stop).toHaveBeenCalledWith({ notes: 'Stopped due to user idle.' });
      expect(electronDB.insertSession).toHaveBeenCalledWith(expect.objectContaining({
        task: {
          client: 'Internal',
          project: 'Meetings & Admin',
          task: 'Meeting'
        },
        notes: 'Logged from idle time.',
        isBillable: false
      }));
      expect(mockElectronAPI.timer.start).toHaveBeenCalled();
      expect(timerRef.idleDialog.open).toBe(false);
    });

    it('should handle "admin" choice correctly', async () => {
      await act(async () => {
        await timerRef.handleIdleChoice('admin');
      });
      
      expect(mockElectronAPI.timer.adjustTime).toHaveBeenCalledWith(expect.any(Number));
      expect(mockElectronAPI.timer.stop).toHaveBeenCalledWith({ notes: 'Stopped due to user idle.' });
      expect(electronDB.insertSession).toHaveBeenCalledWith(expect.objectContaining({
        task: {
          client: 'Internal',
          project: 'Meetings & Admin',
          task: 'Admin / Non-billable'
        },
        notes: 'Logged from idle time.',
        isBillable: false
      }));
      expect(mockElectronAPI.timer.start).toHaveBeenCalled();
      expect(timerRef.idleDialog.open).toBe(false);
    });

    it('should handle "switch" choice correctly', async () => {
      const newTask: TaskRef = {
        client: 'New Client',
        project: 'New Project',
        task: 'New Task'
      };
      
      await act(async () => {
        await timerRef.handleIdleChoice('switch', newTask);
      });
      
      expect(mockElectronAPI.timer.adjustTime).toHaveBeenCalledWith(expect.any(Number));
      expect(mockElectronAPI.timer.stop).toHaveBeenCalledWith({ notes: 'Stopped due to user idle.' });
      expect(mockElectronAPI.timer.start).toHaveBeenCalledWith(newTask);
      expect(timerRef.idleDialog.open).toBe(false);
    });

    it('should handle switch choice without nextTask gracefully', async () => {
      await act(async () => {
        await timerRef.handleIdleChoice('switch'); // No nextTask provided
      });
      
      expect(mockElectronAPI.timer.adjustTime).toHaveBeenCalledWith(expect.any(Number));
      expect(mockElectronAPI.timer.stop).toHaveBeenCalledWith({ notes: 'Stopped due to user idle.' });
      expect(mockElectronAPI.timer.start).not.toHaveBeenCalled();
      expect(timerRef.idleDialog.open).toBe(false);
    });

    it('should reset idle tracking state after handling choice', async () => {
      await act(async () => {
        await timerRef.handleIdleChoice('break');
      });
      
      // Verify internal state is reset (indirectly through behavior)
      expect(timerRef.idleDialog.open).toBe(false);
      expect(timerRef.idleDialog.idleMs).toBe(0);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle missing idle start time gracefully', async () => {
      let timerRef: any;
      
      renderTimerProvider({}, (ref) => {
        timerRef = ref;
      });
      
      await waitFor(() => expect(timerRef).toBeDefined());
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await act(async () => {
        await timerRef.handleIdleChoice('continue');
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot handle choice'));
      expect(timerRef.idleDialog.open).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it('should handle missing task gracefully', async () => {
      let timerRef: any;
      
      renderTimerProvider({}, (ref) => {
        timerRef = ref;
      });
      
      await waitFor(() => expect(timerRef).toBeDefined());
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await act(async () => {
        await timerRef.handleIdleChoice('continue');
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot handle choice'));
      expect(timerRef.idleDialog.open).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it('should handle electronAPI unavailability', async () => {
      // Remove electronAPI temporarily
      const originalAPI = global.window.electronAPI;
      delete (global.window as any).electronAPI;
      
      let timerRef: any;
      
      renderTimerProvider({}, (ref) => {
        timerRef = ref;
      });
      
      await waitFor(() => expect(timerRef).toBeDefined());
      
      // Should not crash when electronAPI is missing
      expect(() => {
        timerRef.start(sampleTask);
        timerRef.pause();
        timerRef.resume();
      }).not.toThrow();
      
      // Restore electronAPI
      global.window.electronAPI = originalAPI;
    });

    it('should handle database operation failures gracefully', async () => {
      // Mock database failure
      const mockInsertSession = electronDB.insertSession as any;
      mockInsertSession.mockRejectedValueOnce(new Error('Database error'));
      
      let timerRef: any;
      
      renderTimerProvider({}, (ref) => {
        timerRef = ref;
      });
      
      await waitFor(() => expect(timerRef).toBeDefined());
      
      // Setup idle state
      setupMockTimes(Date.now() - 70000, Date.now());
      
      // Should not crash on database error
      await act(async () => {
        await expect(timerRef.handleIdleChoice('meeting')).resolves.not.toThrow();
      });
    });

    it('should handle rapid suspend/resume cycles', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      const { mockElectronAPI } = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      const now = Date.now();
      
      // Rapid suspend/resume cycles
      await act(async () => {
        idleHandlers.handleSuspend?.(null, now - 10000);
        idleHandlers.handleResume?.(null, { wakeTime: now - 5000 });
        idleHandlers.handleSuspend?.(null, now - 3000);
        idleHandlers.handleResume?.(null, { wakeTime: now });
      });
      
      // Should handle gracefully without showing dialog for short periods
      expect(timerRef.idleDialog.open).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete full idle workflow: suspend -> long idle -> resume -> show dialog -> choose continue', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      const { mockElectronAPI } = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      // Set up running timer state
      await setupRunningTimer(timerRef, mockElectronAPI);
      
      const idleStart = Date.now() - 120000; // 2 minutes ago
      const resumeTime = Date.now();
      
      // Step 1: System suspends while timer is running
      await act(async () => {
        idleHandlers.handleSuspend?.(null, idleStart);
      });
      
      expect(mockElectronAPI.timer.pause).toHaveBeenCalled();
      
      // Step 2: System resumes after long idle
      await act(async () => {
        idleHandlers.handleResume?.(null, { wakeTime: resumeTime });
      });
      
      // Step 3: Idle dialog should be shown
      await waitFor(() => {
        expect(timerRef.idleDialog.open).toBe(true);
        expect(timerRef.idleDialog.idleMs).toBeGreaterThan(60000);
      });
      
      // Step 4: User chooses to continue
      await act(async () => {
        await timerRef.handleIdleChoice('continue');
      });
      
      // Step 5: Verify complete workflow
      expect(mockElectronAPI.timer.adjustTime).toHaveBeenCalledWith(expect.any(Number));
      expect(mockElectronAPI.timer.stop).toHaveBeenCalledWith({ notes: 'Stopped due to user idle.' });
      expect(mockElectronAPI.timer.start).toHaveBeenCalled();
      expect(timerRef.idleDialog.open).toBe(false);
    });

    it('should handle screen lock/unlock with meeting choice workflow', async () => {
      let idleHandlers: any;
      let timerRef: any;
      
      const { mockElectronAPI } = renderTimerProvider({}, (ref) => {
        timerRef = ref;
      }, (handlers) => {
        idleHandlers = handlers;
      });
      
      await waitFor(() => expect(idleHandlers && timerRef).toBeDefined());
      
      // Set up running timer state
      await setupRunningTimer(timerRef, mockElectronAPI);
      
      const lockTime = Date.now() - 90000; // 1.5 minutes ago
      const unlockTime = Date.now();
      
      // Screen locks while timer running
      await act(async () => {
        idleHandlers.handleLock?.(null, lockTime);
      });
      
      expect(mockElectronAPI.timer.pause).toHaveBeenCalled();
      
      // Screen unlocks
      await act(async () => {
        idleHandlers.handleUnlock?.(null, unlockTime);
      });
      
      // Idle dialog shown
      await waitFor(() => {
        expect(timerRef.idleDialog.open).toBe(true);
      });
      
      // User chooses meeting
      await act(async () => {
        await timerRef.handleIdleChoice('meeting');
      });
      
      // Verify meeting session created and original timer restarted
      expect(electronDB.insertSession).toHaveBeenCalledWith(expect.objectContaining({
        task: {
          client: 'Internal',
          project: 'Meetings & Admin',
          task: 'Meeting'
        },
        isBillable: false
      }));
      expect(mockElectronAPI.timer.start).toHaveBeenCalled();
      expect(timerRef.idleDialog.open).toBe(false);
    });
  });
});