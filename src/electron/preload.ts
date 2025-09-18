const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI = {
  database: {
    getAllSessions: () => ipcRenderer.invoke('db:getAllSessions'),
    getUserSessions: (userId) => ipcRenderer.invoke('db:getUserSessions', userId),
    insertSession: (session) => ipcRenderer.invoke('db:insertSession', session),
    addSession: (session) => ipcRenderer.invoke('db:addSession', session),
    updateSession: (id, updates) => ipcRenderer.invoke('db:updateSession', id, updates),
    deleteSession: (id) => ipcRenderer.invoke('db:deleteSession', id),
    getSessionsByDateRange: (startDate, endDate) => 
      ipcRenderer.invoke('db:getSessionsByDateRange', startDate, endDate),
    getClientSummary: () => ipcRenderer.invoke('db:getClientSummary'),
    // Session editing operations
    editSession: (sessionId, userId, updates, editReason) => 
      ipcRenderer.invoke('db:editSession', sessionId, userId, updates, editReason),
    getSessionEditHistory: (sessionId) => 
      ipcRenderer.invoke('db:getSessionEditHistory', sessionId),
    validateSessionEdit: (sessionId, updates, userId) => 
      ipcRenderer.invoke('db:validateSessionEdit', sessionId, updates, userId),
    getUserReliabilityRate: (userId, weekStart) => 
      ipcRenderer.invoke('db:getUserReliabilityRate', userId, weekStart),
    getAllUserReliabilityMetrics: () => 
      ipcRenderer.invoke('db:getAllUserReliabilityMetrics'),
    updateUserReliabilityMetrics: (userId) => 
      ipcRenderer.invoke('db:updateUserReliabilityMetrics', userId),
    migrateFromLocalStorage: (data) => ipcRenderer.invoke('db:migrateFromLocalStorage', data),
    exportToCSV: () => ipcRenderer.invoke('db:exportToCSV'),
    exportToJSON: () => ipcRenderer.invoke('db:exportToJSON'),
    // Hierarchy operations
    getHierarchy: () => ipcRenderer.invoke('db:getHierarchy'),
    insertClient: (name) => ipcRenderer.invoke('db:insertClient', name),
    insertProject: (name, clientId) => ipcRenderer.invoke('db:insertProject', name, clientId),
    insertTask: (name, projectId) => ipcRenderer.invoke('db:insertTask', name, projectId),
    migrateHierarchyFromLocalStorage: (data) => ipcRenderer.invoke('db:migrateHierarchyFromLocalStorage', data),
    // Project Management CRUD operations
    getAllClients: () => ipcRenderer.invoke('db:getAllClients'),
    getProjectsByClient: (clientId) => ipcRenderer.invoke('db:getProjectsByClient', clientId),
    getTasksByProject: (projectId) => ipcRenderer.invoke('db:getTasksByProject', projectId),
    updateClient: (id, name) => ipcRenderer.invoke('db:updateClient', id, name),
    updateProject: (id, name, clientId) => ipcRenderer.invoke('db:updateProject', id, name, clientId),
    updateTask: (id, name, projectId) => ipcRenderer.invoke('db:updateTask', id, name, projectId),
    deleteClient: (id) => ipcRenderer.invoke('db:deleteClient', id),
    deleteProject: (id) => ipcRenderer.invoke('db:deleteProject', id),
    deleteTask: (id) => ipcRenderer.invoke('db:deleteTask', id),
    copyTask: (sourceTaskId, targetProjectId) => ipcRenderer.invoke('db:copyTask', sourceTaskId, targetProjectId),
    createDefaultProjectStructure: () => ipcRenderer.invoke('db:createDefaultProjectStructure'),
    exportToXLSX: () => ipcRenderer.invoke('db:exportToXLSX'),
    // Configuration data
    getTeams: () => ipcRenderer.invoke('db:getTeams'),
    getRegions: () => ipcRenderer.invoke('db:getRegions'),
    getJobLevels: () => ipcRenderer.invoke('db:getJobLevels'),
    getBillableRateByJobLevel: (jobLevelCode) => ipcRenderer.invoke('db:getBillableRateByJobLevel', jobLevelCode),
    createTeam: (name, description) => ipcRenderer.invoke('db:createTeam', name, description),
    createRegion: (name) => ipcRenderer.invoke('db:createRegion', name),
    createJobLevel: (name, defaultRate) => ipcRenderer.invoke('db:createJobLevel', name, defaultRate),
    // Analytics aggregation methods
    getUserDailyMetrics: (userId, dateFrom, dateTo) => ipcRenderer.invoke('db:getUserDailyMetrics', userId, dateFrom, dateTo),
    getClientProfitability: (userId) => ipcRenderer.invoke('db:getClientProfitability', userId),
    getTeamPerformance: (dateFrom, dateTo, team, region) => ipcRenderer.invoke('db:getTeamPerformance', dateFrom, dateTo, team, region),
    getMonthlyTrends: (userId, monthsBack) => ipcRenderer.invoke('db:getMonthlyTrends', userId, monthsBack),
    populateAnalyticsSummaries: () => ipcRenderer.invoke('db:populateAnalyticsSummaries'),
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
    expandMiniForDropdown: () => ipcRenderer.invoke('window:expand-mini-for-dropdown'),
    collapseMiniFromDropdown: () => ipcRenderer.invoke('window:collapse-mini-from-dropdown'),
    forceCollapseMini: () => ipcRenderer.invoke('window:force-collapse-mini'),
    openTaskSelector: () => ipcRenderer.invoke('window:open-task-selector'),
    closeTaskSelector: () => ipcRenderer.invoke('window:close-task-selector'),
  },
  timer: {
    // Return a cleanup function for each listener
    onStateSync: (callback) => {
      ipcRenderer.on('timer:state-sync', callback);
      return () => ipcRenderer.removeListener('timer:state-sync', callback);
    },
    onTimerAction: (action, callback) => {
      const channel = `timer-action-${action}`;
      ipcRenderer.on(channel, callback);
      return () => ipcRenderer.removeListener(channel, callback);
    },
    start: (task) => ipcRenderer.send('timer:start', task),
    pause: () => ipcRenderer.send('timer:pause'),
    resume: () => ipcRenderer.send('timer:resume'),
    stop: (data) => ipcRenderer.invoke('timer:stop', data), // Use invoke for async operations
    setTask: (task) => ipcRenderer.send('timer:set-task', task),
    getState: () => ipcRenderer.invoke('timer:get-state'),
    adjustTime: (adjustment) => ipcRenderer.invoke('timer:adjust-time', adjustment),
    selectTask: (task) => ipcRenderer.send('task:selected', task),
    onTaskSelected: (callback) => {
      ipcRenderer.on('task:selected', callback);
      return () => ipcRenderer.removeListener('task:selected', callback);
    },
  },
  showSaveDialog: (options) => ipcRenderer.invoke('showSaveDialog', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('writeFile', filePath, content),
  powerMonitor: {
    onSystemSuspend: (callback) => {
      ipcRenderer.on('system-suspend', callback);
      return () => ipcRenderer.removeListener('system-suspend', callback);
    },
    onSystemResume: (callback) => {
      ipcRenderer.on('system-resume', callback);
      return () => ipcRenderer.removeListener('system-resume', callback);
    },
    onScreenLock: (callback) => {
      ipcRenderer.on('screen-lock', callback);
      return () => ipcRenderer.removeListener('screen-lock', callback);
    },
    onScreenUnlock: (callback) => {
      ipcRenderer.on('screen-unlock', callback);
      return () => ipcRenderer.removeListener('screen-unlock', callback);
    },
  },
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    register: (username, email, password, role, additionalData) => ipcRenderer.invoke('auth:register', username, email, password, role, additionalData),
    verifyToken: (token) => ipcRenderer.invoke('auth:verify-token', token),
    getCurrentUser: (token) => ipcRenderer.invoke('auth:get-current-user', token),
    getUserProjectPermissions: (userId) => ipcRenderer.invoke('auth:get-user-project-permissions', userId),
    hasProjectPermission: (userId, projectId) => ipcRenderer.invoke('auth:has-project-permission', userId, projectId),
    addUserToProject: (userId, projectId) => ipcRenderer.invoke('auth:add-user-to-project', userId, projectId),
    removeUserFromProject: (userId, projectId) => ipcRenderer.invoke('auth:remove-user-from-project', userId, projectId),
    getAllUsers: () => ipcRenderer.invoke('auth:get-all-users'),
    updateUser: (userId, userData) => ipcRenderer.invoke('auth:update-user', userId, userData),
    updateUserRole: (userId, role) => ipcRenderer.invoke('auth:update-user-role', userId, role),
    deactivateUser: (userId) => ipcRenderer.invoke('auth:deactivate-user', userId),
  },
  // Enhanced permission operations for Phase 1
  permissions: {
    getUserProjectDetails: (userId) => ipcRenderer.invoke('permissions:get-user-project-details', userId),
    setUserProjectPermission: (userId, projectId, permissionLevel, grantedBy) =>
      ipcRenderer.invoke('permissions:set-user-project-permission', userId, projectId, permissionLevel, grantedBy),
    hasUserProjectPermission: (userId, projectId, requiredLevel) =>
      ipcRenderer.invoke('permissions:has-user-project-permission', userId, projectId, requiredLevel),
    getAllUserProjectPermissions: () => ipcRenderer.invoke('permissions:get-all-user-project-permissions'),
    bulkSetPermissions: (assignments, grantedBy) =>
      ipcRenderer.invoke('permissions:bulk-set-permissions', assignments, grantedBy),
    removeUserProjectPermission: (userId, projectId) =>
      ipcRenderer.invoke('permissions:remove-user-project-permission', userId, projectId),
  },
  // Permission template operations
  templates: {
    createPermissionTemplate: (name, description, templateData, createdBy) =>
      ipcRenderer.invoke('templates:create-permission-template', name, description, templateData, createdBy),
    getAllPermissionTemplates: () => ipcRenderer.invoke('templates:get-all-permission-templates'),
    applyPermissionTemplate: (templateId, userIds, grantedBy) =>
      ipcRenderer.invoke('templates:apply-permission-template', templateId, userIds, grantedBy),
    deletePermissionTemplate: (id) => ipcRenderer.invoke('templates:delete-permission-template', id),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);