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
      auth: {
        login: (username: string, password: string) => Promise<any>;
        logout: () => Promise<void>;
        getCurrentUser: () => Promise<any>;
        getAllUsers: () => Promise<any[]>;
        createUser: (userData: any) => Promise<any>;
        updateUser: (id: number, updates: any) => Promise<any>;
        deleteUser: (id: number) => Promise<any>;
      };
      database: {
        getAllSessions: () => Promise<any[]>;
        getUserSessions: (userId: number) => Promise<any[]>;
        insertSession: (session: any) => Promise<void>;
        addSession: (session: any) => Promise<void>;
        updateSession: (id: string, updates: any) => Promise<void>;
        deleteSession: (id: string) => Promise<void>;
        getSessionsByDateRange: (startDate: number, endDate: number) => Promise<any[]>;
        getClientSummary: () => Promise<Record<string, number>>;
        migrateFromLocalStorage: (sessions: any[]) => Promise<void>;
        exportToCSV: () => Promise<string>;
        exportToJSON: () => Promise<string>;
        getHierarchy: () => Promise<any[]>;
        insertClient: (name: string) => Promise<number>;
        insertProject: (name: string, clientId: number) => Promise<number>;
        insertTask: (name: string, projectId: number) => Promise<number>;
        migrateHierarchyFromLocalStorage: (data: any[]) => Promise<void>;
        getUserDailyMetrics: (userId?: number, dateFrom?: Date, dateTo?: Date) => Promise<any[]>;
        getClientProfitability: (userId?: number) => Promise<any[]>;
        getTeamPerformance: (dateFrom?: Date, dateTo?: Date, team?: string, region?: string) => Promise<any[]>;
        getMonthlyTrends: (userId?: number, monthsBack?: number) => Promise<any[]>;
        populateAnalyticsSummaries: () => Promise<void>;
        editSession: (sessionId: string, userId: number, updates: any, editReason: string) => Promise<void>;
        getSessionEditHistory: (sessionId: string) => Promise<any[]>;
        validateSessionEdit: (sessionId: string, updates: any, userId: number) => Promise<{ isValid: boolean; errors: string[] }>;
        getUserReliabilityRate: (userId: number, weekStart: Date) => Promise<number>;
        getAllUserReliabilityMetrics: () => Promise<any[]>;
        updateUserReliabilityMetrics: (userId: number) => Promise<void>;
      };
      showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
      // Add other APIs as needed
    };
  }
}
