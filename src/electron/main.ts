const { app: electronApp, BrowserWindow, ipcMain, dialog, powerMonitor, Tray, Menu, nativeImage } = require('electron');
const { join: pathJoin } = require('path');
const { writeFile } = require('fs').promises;
const { DatabaseService } = require('./database');
const { AuthService } = require('./auth-service');
const isDev = require('electron-is-dev');

// Set app name early to ensure proper userData path
electronApp.setName('tshifhinga-time-tracker');

// Keep a global reference of the database service and windows
let dbService: any;
let authService: any;
let mainWindow: any | null = null;
let miniWindow: any | null = null;
let tray: any | null = null;
let systemSleepTime: number | null = null;
let currentTimerState: any = {
  status: 'stopped',
  activeMs: 0,
  pausedMs: 0,
  startTs: null,
  task: null
};
let timerInterval: NodeJS.Timeout | null = null;

// Window state management
let windowState = {
  mode: 'full', // 'full', 'mini', 'tray'
  mainWindowBounds: { width: 1200, height: 800, x: undefined, y: undefined },
  miniWindowBounds: { width: 420, height: 42, x: undefined, y: undefined },
  transparency: 0.95,
  autoSwitch: {
    enabled: false,
    delay: 5000, // 5 seconds
    onlyWhenRunning: true
  },
  miniAlwaysOnTop: true
};

const createMainWindow = (): void => {
  // Create the main browser window
  mainWindow = new BrowserWindow({
    width: windowState.mainWindowBounds.width,
    height: windowState.mainWindowBounds.height,
    x: windowState.mainWindowBounds.x,
    y: windowState.mainWindowBounds.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: pathJoin(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:8080' 
    : `file://${pathJoin(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    windowState.mode = 'full';
  });

  // Save window bounds on resize/move
  mainWindow.on('moved', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      windowState.mainWindowBounds = bounds;
    }
  });

  mainWindow.on('resized', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      windowState.mainWindowBounds = bounds;
    }
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    event.preventDefault();
    switchToTray();
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
};

const createMiniWindow = (): void => {
  // Create mini window
  miniWindow = new BrowserWindow({
    width: windowState.miniWindowBounds.width,
    height: windowState.miniWindowBounds.height,
    x: windowState.miniWindowBounds.x,
    y: windowState.miniWindowBounds.y,
    minWidth: 380,
    minHeight: 38,
    maxWidth: 500,
    maxHeight: 50,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: pathJoin(__dirname, 'preload.js'),
    },
    frame: false,
    alwaysOnTop: windowState.miniAlwaysOnTop,
    skipTaskbar: false,
    resizable: true,
    opacity: windowState.transparency,
    show: false,
  });

  // Load mini view
  const miniUrl = isDev 
    ? 'http://localhost:8080?mode=mini' 
    : `file://${pathJoin(__dirname, '../dist/index.html')}?mode=mini`;
  
  miniWindow.loadURL(miniUrl);

  // Show window when ready
  miniWindow.once('ready-to-show', () => {
    miniWindow.show();
    // Ensure always on top is set correctly after window is ready
    miniWindow.setAlwaysOnTop(windowState.miniAlwaysOnTop);
    console.log('Mini window created with always on top:', windowState.miniAlwaysOnTop);
    windowState.mode = 'mini';
  });

  // Save mini window bounds
  miniWindow.on('moved', () => {
    if (miniWindow) {
      const bounds = miniWindow.getBounds();
      windowState.miniWindowBounds = bounds;
    }
  });

  miniWindow.on('resized', () => {
    if (miniWindow) {
      const bounds = miniWindow.getBounds();
      windowState.miniWindowBounds = bounds;
    }
  });

  // Handle window close
  miniWindow.on('close', (event) => {
    event.preventDefault();
    switchToTray();
  });
};

const createTray = (): void => {
  let icon;
  try {
    // Try to load the tray icon from multiple possible locations
    const iconPaths = [
      pathJoin(__dirname, '../assets/tray-icon.png'),
      pathJoin(__dirname, '../public/favicon.ico'),
      pathJoin((process as any).resourcesPath || __dirname, '../assets/tray-icon.png')
    ];
    
    let iconLoaded = false;
    for (const iconPath of iconPaths) {
      try {
        icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          iconLoaded = true;
          console.log('Tray icon loaded from:', iconPath);
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    if (!iconLoaded) {
      console.warn('No tray icon found, using system default');
    }
    
    // Check if icon was loaded successfully
    if (!iconLoaded || icon.isEmpty()) {
      // Create a simple fallback icon
      icon = nativeImage.createEmpty();
      // You could also use a system icon or create a simple programmatic icon
      // For now, we'll use an empty icon which will show a default system icon
    } else {
      icon = icon.resize({ width: 16, height: 16 });
    }
  } catch (error) {
    console.error('Error loading tray icon:', error);
    // Create an empty icon as fallback
    icon = nativeImage.createEmpty();
  }

  try {
    tray = new Tray(icon);
  } catch (error) {
    console.error('Error creating system tray:', error);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Mini View',
      click: () => switchToMini()
    },
    {
      label: 'Show Full View', 
      click: () => switchToFull()
    },
    { type: 'separator' },
    {
      label: 'Start Timer',
      click: () => {
        // Send IPC to start timer
        if (mainWindow) mainWindow.webContents.send('timer-action', 'start');
        if (miniWindow) miniWindow.webContents.send('timer-action', 'start');
      }
    },
    {
      label: 'Pause Timer',
      click: () => {
        // Send IPC to pause timer
        if (mainWindow) mainWindow.webContents.send('timer-action', 'pause');
        if (miniWindow) miniWindow.webContents.send('timer-action', 'pause');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        electronApp.quit();
      }
    }
  ]);

  if (tray) {
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Tshifhinga Time Tracker');

    // Double click to show mini window
    tray.on('double-click', () => {
      switchToMini();
    });

    windowState.mode = 'tray';
    console.log('System tray created successfully');
  } else {
    console.error('Failed to create system tray');
  }
};

// Window state switching functions
const switchToFull = (): void => {
  if (miniWindow) {
    miniWindow.close();
    miniWindow = null;
  }
  
  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  
  windowState.mode = 'full';
};

const switchToMini = (): void => {
  if (mainWindow) {
    mainWindow.hide();
  }
  
  if (!miniWindow) {
    createMiniWindow();
  } else {
    miniWindow.show();
    miniWindow.focus();
  }
  
  windowState.mode = 'mini';
};

const switchToTray = (): void => {
  if (mainWindow) {
    mainWindow.hide();
  }
  if (miniWindow) {
    miniWindow.hide();
  }
  
  if (!tray || tray.isDestroyed()) {
    createTray();
  }
  
  if (tray && !tray.isDestroyed()) {
    windowState.mode = 'tray';
  } else {
    console.error('Could not switch to tray mode - tray creation failed');
    // Fallback to mini window if tray creation fails
    switchToMini();
  }
};

// App event listeners
electronApp.whenReady().then(async () => {
  // Initialize database
  dbService = new DatabaseService();
  await dbService.init();
  
  // Initialize auth service
  authService = new AuthService();
  await authService.init();
  
  // Create main window initially
  createMainWindow();
  
  // Create tray immediately
  createTray();

  // Set up power monitor events for system sleep/wake detection
  powerMonitor.on('suspend', () => {
    console.log('System is going to sleep');
    systemSleepTime = Date.now();
    // Notify renderer process about system sleep
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-suspend', systemSleepTime);
    }
  });

  powerMonitor.on('resume', () => {
    console.log('System woke up');
    const wakeTime = Date.now();
    const sleepDuration = systemSleepTime ? wakeTime - systemSleepTime : 0;
    console.log(`System was asleep for ${Math.round(sleepDuration / 1000)}s`);
    
    // Notify renderer process about system wake
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system-resume', { wakeTime, sleepDuration });
    }
    
    systemSleepTime = null;
  });

  powerMonitor.on('lock-screen', () => {
    console.log('Screen locked');
    // Notify renderer process about screen lock
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screen-lock', Date.now());
    }
  });

  powerMonitor.on('unlock-screen', () => {
    console.log('Screen unlocked');
    // Notify renderer process about screen unlock
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screen-unlock', Date.now());
    }
  });

  electronApp.on('activate', () => {
    // On macOS, re-create a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      if (windowState.mode === 'full') {
        createMainWindow();
      } else {
        switchToFull();
      }
    }
  });
});

electronApp.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') electronApp.quit();
});

electronApp.on('before-quit', async () => {
  // Clean up database and auth service connections
  if (authService) {
    await authService.close();
  }
  if (dbService) {
    await dbService.close();
  }
});

// IPC handlers for window management
ipcMain.handle('window:switch-to-mini', () => {
  switchToMini();
});

ipcMain.handle('window:switch-to-full', () => {
  switchToFull();
});

ipcMain.handle('window:hide-to-tray', () => {
  switchToTray();
});

ipcMain.handle('window:get-mode', () => {
  return windowState.mode;
});

ipcMain.handle('window:set-transparency', (_, opacity) => {
  windowState.transparency = opacity;
  if (miniWindow) {
    miniWindow.setOpacity(opacity);
  }
});

ipcMain.handle('window:get-transparency', () => {
  return windowState.transparency;
});

// Auto-switch settings handlers
ipcMain.handle('window:get-auto-switch-settings', () => {
  return windowState.autoSwitch;
});

ipcMain.handle('window:set-auto-switch', (_, enabled) => {
  windowState.autoSwitch.enabled = enabled;
  console.log('Auto-switch enabled:', enabled);
});

ipcMain.handle('window:set-auto-switch-delay', (_, delay) => {
  windowState.autoSwitch.delay = Math.max(1000, delay); // Minimum 1 second
  console.log('Auto-switch delay set to:', delay);
});

ipcMain.handle('window:set-auto-switch-condition', (_, onlyWhenRunning) => {
  windowState.autoSwitch.onlyWhenRunning = onlyWhenRunning;
  console.log('Auto-switch condition - only when running:', onlyWhenRunning);
});

// Mini window always on top handlers
ipcMain.handle('window:toggle-mini-always-on-top', () => {
  // Get current state and toggle it
  const currentState = miniWindow && !miniWindow.isDestroyed() 
    ? miniWindow.isAlwaysOnTop() 
    : windowState.miniAlwaysOnTop;
  
  const newState = !currentState;
  windowState.miniAlwaysOnTop = newState;
  
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.setAlwaysOnTop(newState);
    console.log('Mini window always on top toggled to:', newState);
  } else {
    console.log('Mini window always on top state stored for future use:', newState);
  }
  
  return newState;
});

ipcMain.handle('window:get-mini-always-on-top-state', () => {
  // If mini window exists, get the actual state from the window
  if (miniWindow && !miniWindow.isDestroyed()) {
    const actualState = miniWindow.isAlwaysOnTop();
    // Sync our stored state with actual window state
    windowState.miniAlwaysOnTop = actualState;
    console.log('Mini window always on top state (actual):', actualState);
    return actualState;
  }
  console.log('Mini window always on top state (stored):', windowState.miniAlwaysOnTop);
  return windowState.miniAlwaysOnTop;
});

// Timer utility functions
const broadcastTimerState = () => {
  if (mainWindow) {
    mainWindow.webContents.send('timer:state-sync', currentTimerState);
  }
  if (miniWindow) {
    miniWindow.webContents.send('timer:state-sync', currentTimerState);
  }
  
  // Update tray tooltip with timer info
  if (tray && !tray.isDestroyed()) {
    try {
      if (currentTimerState.status === 'running' && currentTimerState.activeMs) {
        const minutes = Math.floor(currentTimerState.activeMs / 60000);
        const seconds = Math.floor((currentTimerState.activeMs % 60000) / 1000);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        tray.setToolTip(`Tshifhinga - ${timeStr} - ${currentTimerState.task?.client || 'No task'}`);
      } else {
        tray.setToolTip('Tshifhinga Time Tracker');
      }
    } catch (error) {
      console.error('Error updating tray tooltip:', error);
    }
  }
};

const startTimerInterval = () => {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (currentTimerState.status === 'running' && currentTimerState.startTs) {
      const now = Date.now();
      const elapsed = now - currentTimerState.startTs;
      currentTimerState.activeMs += 1000; // Add 1 second
      broadcastTimerState();
    }
  }, 1000);
};

const stopTimerInterval = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

// IPC handlers for timer actions
ipcMain.on('timer:start', (_, task) => {
  currentTimerState = {
    ...currentTimerState,
    status: 'running',
    task,
    startTs: Date.now(),
  };
  startTimerInterval();
  broadcastTimerState();
});

ipcMain.on('timer:pause', () => {
  if (currentTimerState.status === 'running') {
    currentTimerState.status = 'paused';
    stopTimerInterval();
    broadcastTimerState();
  }
});

ipcMain.on('timer:resume', () => {
  if (currentTimerState.status === 'paused') {
    currentTimerState = {
      ...currentTimerState,
      status: 'running',
      startTs: Date.now(),
    };
    startTimerInterval();
    broadcastTimerState();
  }
});

ipcMain.on('timer:stop', async (_, data) => {
  if (currentTimerState.status !== 'stopped' && currentTimerState.task) {
    const { notes, token } = data || {};
    
    // Get user ID from token
    let userId = null;
    if (token) {
      try {
        const user = await authService.verifyToken(token);
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        console.error('Error verifying token:', error);
      }
    }

    // Save session to database
    const session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      client: currentTimerState.task.client,
      project: currentTimerState.task.project,
      task: currentTimerState.task.task,
      start: currentTimerState.startTs || Date.now(),
      end: Date.now(),
      activeMs: currentTimerState.activeMs,
      pausedMs: currentTimerState.pausedMs || 0,
      notes: notes || null,
      createdAt: Date.now(),
      isBillable: true,
      userId: userId,
    };

    try {
      await dbService.insertSession(session);
      console.log('Session saved to database');
      
      // Notify renderer to refresh sessions
      if (mainWindow) {
        mainWindow.webContents.send('timer-action-refresh-sessions');
      }
      if (miniWindow) {
        miniWindow.webContents.send('timer-action-refresh-sessions');
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  currentTimerState = {
    status: 'stopped',
    activeMs: 0,
    pausedMs: 0,
    startTs: null,
    task: currentTimerState.task, // Keep task selected
  };
  stopTimerInterval();
  broadcastTimerState();
});

ipcMain.on('timer:set-task', (_, task) => {
  currentTimerState.task = task;
  broadcastTimerState();
});

ipcMain.handle('timer:adjust-time', (_, adjustment) => {
  currentTimerState.activeMs = Math.max(0, currentTimerState.activeMs + adjustment);
  broadcastTimerState();
});

// IPC handlers for timer state sync
ipcMain.handle('timer:get-state', () => {
  return currentTimerState;
});

ipcMain.on('timer:state-changed', (_, timerState) => {
  currentTimerState = { ...currentTimerState, ...timerState };
  broadcastTimerState();
});

// IPC handlers for database operations
ipcMain.handle('db:getAllSessions', async () => {
  return await dbService.getAllSessions();
});

ipcMain.handle('db:getUserSessions', async (_, userId) => {
  return await dbService.getUserSessions(userId);
});

ipcMain.handle('db:insertSession', async (_, session) => {
  return await dbService.insertSession(session);
});

ipcMain.handle('db:updateSession', async (_, id, updates) => {
  return await dbService.updateSession(id, updates);
});

ipcMain.handle('db:deleteSession', async (_, id) => {
  return await dbService.deleteSession(id);
});

ipcMain.handle('db:getSessionsByDateRange', async (_, startDate, endDate) => {
  return await dbService.getSessionsByDateRange(startDate, endDate);
});

ipcMain.handle('db:getClientSummary', async () => {
  return await dbService.getClientSummary();
});

ipcMain.handle('db:migrateFromLocalStorage', async (_, data) => {
  return await dbService.migrateFromLocalStorage(data);
});

// Hierarchy handlers
ipcMain.handle('db:getHierarchy', async () => {
  return await dbService.getHierarchy();
});

ipcMain.handle('db:insertClient', async (_, name) => {
  return await dbService.insertClient(name);
});

ipcMain.handle('db:insertProject', async (_, name, clientId) => {
  return await dbService.insertProject(name, clientId);
});

ipcMain.handle('db:insertTask', async (_, name, projectId) => {
  return await dbService.insertTask(name, projectId);
});

ipcMain.handle('db:migrateHierarchyFromLocalStorage', async (_, data) => {
  return await dbService.migrateHierarchyFromLocalStorage(data);
});

// Export handlers
ipcMain.handle('db:exportToCSV', async () => {
  return await dbService.exportToCSV();
});

ipcMain.handle('db:exportToJSON', async () => {
  return await dbService.exportToJSON();
});

// File save dialog handler
ipcMain.handle('showSaveDialog', async (_, options) => {
  const result = await dialog.showSaveDialog(options);
  return result;
});

// File write handler
ipcMain.handle('writeFile', async (_, filePath, content) => {
  try {
    await writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing file:', error);
    return { success: false, error: error.message };
  }
});

// Auth IPC handlers
ipcMain.handle('auth:login', async (_, username, password) => {
  return await authService.login(username, password);
});

ipcMain.handle('auth:register', async (_, username, email, password, role) => {
  return await authService.register(username, email, password, role);
});

ipcMain.handle('auth:verify-token', async (_, token) => {
  return await authService.verifyToken(token);
});

ipcMain.handle('auth:get-current-user', async (_, token) => {
  return await authService.getCurrentUser(token);
});

ipcMain.handle('auth:get-user-project-permissions', async (_, userId) => {
  return await authService.getUserProjectPermissions(userId);
});

ipcMain.handle('auth:has-project-permission', async (_, userId, projectId) => {
  return await authService.hasProjectPermission(userId, projectId);
});

ipcMain.handle('auth:add-user-to-project', async (_, userId, projectId) => {
  return await authService.addUserToProject(userId, projectId);
});

ipcMain.handle('auth:remove-user-from-project', async (_, userId, projectId) => {
  return await authService.removeUserFromProject(userId, projectId);
});

ipcMain.handle('auth:get-all-users', async () => {
  return await authService.getAllUsers();
});

ipcMain.handle('auth:update-user-role', async (_, userId, role) => {
  return await authService.updateUserRole(userId, role);
});

ipcMain.handle('auth:deactivate-user', async (_, userId) => {
  return await authService.deactivateUser(userId);
});