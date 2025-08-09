const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI = {
  database: {
    getAllSessions: () => ipcRenderer.invoke('db:getAllSessions'),
    insertSession: (session) => ipcRenderer.invoke('db:insertSession', session),
    updateSession: (id, updates) => ipcRenderer.invoke('db:updateSession', id, updates),
    deleteSession: (id) => ipcRenderer.invoke('db:deleteSession', id),
    getSessionsByDateRange: (startDate, endDate) => 
      ipcRenderer.invoke('db:getSessionsByDateRange', startDate, endDate),
    getClientSummary: () => ipcRenderer.invoke('db:getClientSummary'),
    migrateFromLocalStorage: (data) => ipcRenderer.invoke('db:migrateFromLocalStorage', data),
    exportToCSV: () => ipcRenderer.invoke('db:exportToCSV'),
    exportToJSON: () => ipcRenderer.invoke('db:exportToJSON'),
    // Hierarchy operations
    getHierarchy: () => ipcRenderer.invoke('db:getHierarchy'),
    insertClient: (name) => ipcRenderer.invoke('db:insertClient', name),
    insertProject: (name, clientId) => ipcRenderer.invoke('db:insertProject', name, clientId),
    insertTask: (name, projectId) => ipcRenderer.invoke('db:insertTask', name, projectId),
    migrateHierarchyFromLocalStorage: (data) => ipcRenderer.invoke('db:migrateHierarchyFromLocalStorage', data),
  },
  window: {
    switchToMini: () => ipcRenderer.invoke('window:switch-to-mini'),
    switchToFull: () => ipcRenderer.invoke('window:switch-to-full'),
    hideToTray: () => ipcRenderer.invoke('window:hide-to-tray'),
    getMode: () => ipcRenderer.invoke('window:get-mode'),
    setTransparency: (opacity) => ipcRenderer.invoke('window:set-transparency', opacity),
    getTransparency: () => ipcRenderer.invoke('window:get-transparency'),
  },
  timer: {
    onStateSync: (callback) => ipcRenderer.on('timer:state-sync', callback),
    onTimerAction: (callback) => ipcRenderer.on('timer-action', callback),
    sendStateChange: (timerState) => ipcRenderer.send('timer:state-changed', timerState),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('timer:state-sync');
      ipcRenderer.removeAllListeners('timer-action');
    }
  },
  showSaveDialog: (options) => ipcRenderer.invoke('showSaveDialog', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('writeFile', filePath, content),
  powerMonitor: {
    onSystemSuspend: (callback) => ipcRenderer.on('system-suspend', callback),
    onSystemResume: (callback) => ipcRenderer.on('system-resume', callback),
    onScreenLock: (callback) => ipcRenderer.on('screen-lock', callback),
    onScreenUnlock: (callback) => ipcRenderer.on('screen-unlock', callback),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('system-suspend');
      ipcRenderer.removeAllListeners('system-resume');
      ipcRenderer.removeAllListeners('screen-lock');
      ipcRenderer.removeAllListeners('screen-unlock');
    }
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);