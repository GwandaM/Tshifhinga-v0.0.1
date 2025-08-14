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
    // Auto-switch settings
    getAutoSwitchSettings: () => ipcRenderer.invoke('window:get-auto-switch-settings'),
    setAutoSwitch: (enabled) => ipcRenderer.invoke('window:set-auto-switch', enabled),
    setAutoSwitchDelay: (delay) => ipcRenderer.invoke('window:set-auto-switch-delay', delay),
    setAutoSwitchCondition: (onlyWhenRunning) => ipcRenderer.invoke('window:set-auto-switch-condition', onlyWhenRunning),
    toggleMiniAlwaysOnTop: () => ipcRenderer.invoke('window:toggle-mini-always-on-top'),
    getMiniAlwaysOnTopState: () => ipcRenderer.invoke('window:get-mini-always-on-top-state'),
  },
  timer: {
    onStateSync: (callback) => ipcRenderer.on('timer:state-sync', callback),
    onTimerAction: (action, callback) => ipcRenderer.on(`timer-action-${action}`, callback),
    start: (task) => ipcRenderer.send('timer:start', task),
    pause: () => ipcRenderer.send('timer:pause'),
    resume: () => ipcRenderer.send('timer:resume'),
    stop: (notes) => ipcRenderer.send('timer:stop', notes),
    setTask: (task) => ipcRenderer.send('timer:set-task', task),
    getState: () => ipcRenderer.invoke('timer:get-state'),
    adjustTime: (adjustment) => ipcRenderer.invoke('timer:adjust-time', adjustment),
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
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