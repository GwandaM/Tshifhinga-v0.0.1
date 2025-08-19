/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      // Each API group corresponds to a contextBridge key in preload.ts
      timer: {
        start: (task: any) => void;
        pause: () => void;
        resume: () => void;
        stop: (data: { notes?: string; token?: string }) => Promise<void>;
        setTask: (task?: any) => void;
        adjustTime: (adjustment: number) => void;
        getState: () => Promise<any>;
        onStateSync: (callback: (event: any, state: any) => void) => () => void; // Return a cleanup function
        onTimerAction: (action: string, callback: () => void) => () => void; // Return a cleanup function
      };
      powerMonitor: {
        onSystemSuspend: (callback: (event: any, timestamp: number) => void) => () => void;
        onSystemResume: (callback: (event: any, data: { wakeTime: number; sleepDuration: number }) => void) => () => void;
        onScreenLock: (callback: (event: any, timestamp: number) => void) => () => void;
        onScreenUnlock: (callback: (event: any, timestamp: number) => void) => () => void;
      };
      // Add other APIs as needed
    };
  }
}
