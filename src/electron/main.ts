const { app: electronApp, BrowserWindow, ipcMain, dialog, powerMonitor, Tray, Menu, nativeImage } = require('electron');
const { join: pathJoin } = require('path');
const { writeFile } = require('fs').promises;
const { DatabaseService } = require('./database');
const { AuthService } = require('./auth-service');
// const { LoggerService } = require('./logger-service');
const { ConfigService } = require('./config-service');
const isDev = require('electron-is-dev');

// Set app name early to ensure proper userData path
electronApp.setName('tshifhinga-time-tracker');

// Keep a global reference of the database service and windows
let dbService: any;
let authService: any;
// let logger: any;
let config: any;
let mainWindow: any | null = null;
let miniWindow: any | null = null;
let taskSelectorWindow: any | null = null;
let tray: any | null = null;
let systemSleepTime: number | null = null;

// Timer state management with proper cleanup
interface TimerState {
  status: 'stopped' | 'running' | 'paused';
  activeMs: number;
  pausedMs: number;
  startTs: number | null;
  lastUpdateTs: number | null;
  task: any;
}

let currentTimerState: TimerState = {
  status: 'stopped',
  activeMs: 0,
  pausedMs: 0,
  startTs: null,
  lastUpdateTs: null,
  task: null
};

let timerInterval: NodeJS.Timeout | null = null;
let timerCleanupTimeout: NodeJS.Timeout | null = null;
let stateValidationInterval: NodeJS.Timeout | null = null;

// Window state management
let windowState = {
  mode: 'full', // 'full', 'mini', 'tray'
  mainWindowBounds: { width: 1200, height: 800, x: undefined, y: undefined },
  miniWindowBounds: { width: 420, height: 50, x: undefined, y: undefined },
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
    minHeight: 50,
    maxWidth: 500,
    maxHeight: 250,
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

const createTaskSelectorWindow = (): void => {
  // Create task selector window
  taskSelectorWindow = new BrowserWindow({
    width: 320,
    height: 400,
    minWidth: 300,
    minHeight: 350,
    maxWidth: 400,
    maxHeight: 450,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: pathJoin(__dirname, 'preload.js'),
    },
    frame: true,
    modal: true,
    parent: miniWindow || mainWindow,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    title: 'Select Task',
    titleBarStyle: 'default',
  });

  // Load task selector view
  const taskSelectorUrl = isDev 
    ? 'http://localhost:8080?mode=taskSelector' 
    : `file://${pathJoin(__dirname, '../dist/index.html')}?mode=taskSelector`;
  
  taskSelectorWindow.loadURL(taskSelectorUrl);

  // Show window when ready
  taskSelectorWindow.once('ready-to-show', () => {
    taskSelectorWindow.show();
    taskSelectorWindow.focus();
  });

  // Handle window close
  taskSelectorWindow.on('closed', () => {
    taskSelectorWindow = null;
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
  try {
    // Initialize services with proper error handling
    // logger = LoggerService.getInstance();
    config = ConfigService.getInstance();
    
    console.log('Application starting');
    
    // Validate configuration
    const configValidation = config.validateConfig();
    if (!configValidation.isValid) {
      console.error('Configuration validation failed:', {
        errors: configValidation.errors
      });
      throw new Error(`Configuration invalid: ${configValidation.errors.join(', ')}`);
    }
    
    // Initialize database
    dbService = new DatabaseService();
    await dbService.init();
    console.log('Database service initialized');
    
    // Create analytics tables and views for performance optimization
    try {
      await dbService.createAnalyticsTables();
      console.log('Analytics tables created successfully');
      
      // Populate analytics summary tables if they're empty
      await dbService.populateAnalyticsSummaries();
      console.log('Analytics summary tables populated');
    } catch (analyticsError) {
      console.error('Analytics setup failed:', analyticsError);
      // Don't fail the app startup, but log the error
    }
    
    // Initialize auth service
    authService = new AuthService();
    await authService.init();
    console.log('Auth service initialized');
    
    // Check if we need to promote the first user to admin
    const allUsers = await authService.getAllUsers();
    const adminUsers = allUsers.filter(user => user.role === 'admin');
    if (adminUsers.length === 0 && allUsers.length > 0) {
      console.log('No admin users found, promoting first user to admin...');
      await authService.promoteFirstUserToAdmin();
    }

    // Create main window initially
    if (!mainWindow) {
      createMainWindow();
    }

    // Create tray immediately
    createTray();
    
    console.log('Application initialized successfully');
    
  } catch (error) {
    console.error('Application initialization failed:', error);
    console.error('Critical error during app initialization:', error);
    electronApp.quit();
  }

  // Set up power monitor events for system sleep/wake detection
  powerMonitor.on('suspend', () => {
    console.log('[PowerMonitor] System is going to sleep');
    systemSleepTime = Date.now();
    // Notify all renderer processes about system sleep
    const windows = [mainWindow, miniWindow].filter(w => w && !w.isDestroyed());
    windows.forEach(win => win.webContents.send('system-suspend', systemSleepTime));
  });

  powerMonitor.on('resume', () => {
    console.log('[PowerMonitor] System woke up');
    const wakeTime = Date.now();
    const sleepDuration = systemSleepTime ? wakeTime - systemSleepTime : 0;
    console.log(`[PowerMonitor] System was asleep for ${Math.round(sleepDuration / 1000)}s`);
    
    // Notify all renderer processes about system wake
    const windows = [mainWindow, miniWindow].filter(w => w && !w.isDestroyed());
    windows.forEach(win => win.webContents.send('system-resume', { wakeTime, sleepDuration }));
    
    systemSleepTime = null;
  });

  powerMonitor.on('lock-screen', () => {
    console.log('[PowerMonitor] Screen locked');
    // Notify all renderer processes about screen lock
    const windows = [mainWindow, miniWindow].filter(w => w && !w.isDestroyed());
    windows.forEach(win => win.webContents.send('screen-lock', Date.now()));
  });

  powerMonitor.on('unlock-screen', () => {
    console.log('[PowerMonitor] Screen unlocked');
    // Notify all renderer processes about screen unlock
    const windows = [mainWindow, miniWindow].filter(w => w && !w.isDestroyed());
    windows.forEach(win => win.webContents.send('screen-unlock', Date.now()));
  });
}).catch((error) => {
  console.error('Failed to initialize application:', error);
  electronApp.quit();
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

electronApp.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') electronApp.quit();
});

electronApp.on('before-quit', async () => {
  console.log('Application shutting down', 'MAIN');
  
  try {
    // Clean up timer intervals
    stopTimerInterval();
    stopTimerStateValidation();
    
    // Clean up database and auth service connections
    if (authService) {
      await authService.close();
      console.log('Auth service closed', 'MAIN');
    }
    
    if (dbService) {
      await dbService.close();
      console.log('Database service closed', 'MAIN');
    }
    
    // Clean up logs if needed
    // if (logger) {
    //   await logger.cleanupOldLogs();
    //   logger.info('Application shutdown complete', 'MAIN');
    // }
    console.log('Application shutdown complete');
    
  } catch (error) {
    console.error('Error during application shutdown:', error);
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

// Mini window dynamic resizing handlers
let isExpanded = false;
let expandTimeout: NodeJS.Timeout | null = null;

ipcMain.handle('window:expand-mini-for-dropdown', () => {
  if (miniWindow && !miniWindow.isDestroyed() && !isExpanded) {
    // Clear any pending collapse
    if (expandTimeout) {
      clearTimeout(expandTimeout);
      expandTimeout = null;
    }
    
    const currentBounds = miniWindow.getBounds();
    const expandedHeight = 200; // Fixed expanded height for dropdown
    
    miniWindow.setSize(currentBounds.width, expandedHeight);
    isExpanded = true;
    console.log('Mini window expanded for dropdown');
    return true;
  }
  return false;
});

ipcMain.handle('window:collapse-mini-from-dropdown', () => {
  if (miniWindow && !miniWindow.isDestroyed() && isExpanded) {
    // Immediate collapse when called (after task selection)
    if (expandTimeout) {
      clearTimeout(expandTimeout);
      expandTimeout = null;
    }
    
    const originalHeight = 50; // Original mini window height
    const currentBounds = miniWindow.getBounds();
    
    miniWindow.setSize(currentBounds.width, originalHeight);
    isExpanded = false;
    console.log('Mini window collapsed from dropdown');
    return true;
  }
  return false;
});

// Add a force collapse handler for cases where user clicks outside
ipcMain.handle('window:force-collapse-mini', () => {
  if (miniWindow && !miniWindow.isDestroyed() && isExpanded) {
    if (expandTimeout) {
      clearTimeout(expandTimeout);
      expandTimeout = null;
    }
    
    const originalHeight = 50;
    const currentBounds = miniWindow.getBounds();
    
    miniWindow.setSize(currentBounds.width, originalHeight);
    isExpanded = false;
    console.log('Mini window force collapsed');
    return true;
  }
  return false;
});

// Task selector window handlers
ipcMain.handle('window:open-task-selector', () => {
  if (!taskSelectorWindow) {
    createTaskSelectorWindow();
  } else {
    taskSelectorWindow.show();
    taskSelectorWindow.focus();
  }
  return true;
});

ipcMain.handle('window:close-task-selector', () => {
  if (taskSelectorWindow) {
    taskSelectorWindow.close();
    taskSelectorWindow = null;
  }
  return true;
});

// Handler for task selection from the selector window
ipcMain.on('task:selected', (_, task) => {
  console.log('Task selected:', task);
  
  // Send the selected task to mini window and main window
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('task:selected', task);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('task:selected', task);
  }
  
  // Close the task selector window
  if (taskSelectorWindow) {
    taskSelectorWindow.close();
    taskSelectorWindow = null;
  }
});

// Timer state validation and cleanup
const startTimerStateValidation = () => {
  stateValidationInterval = setInterval(() => {
    try {
      // Check for state inconsistencies
      if (currentTimerState.status === 'running' && !timerInterval) {
        console.warn('Timer state shows running but no interval active - fixing', 'TIMER');
        startTimerInterval();
      } else if (currentTimerState.status !== 'running' && timerInterval) {
        console.warn('Timer interval active but state not running - fixing', 'TIMER');
        stopTimerInterval();
      }
      
      // Check for runaway timers (more than 24 hours)
      if (currentTimerState.activeMs > 24 * 60 * 60 * 1000) {
        console.warn('Timer has been running for more than 24 hours - auto-stopping', 'TIMER', {
          activeMs: currentTimerState.activeMs
        });
        stopTimerInterval();
        currentTimerState.status = 'stopped';
        broadcastTimerState();
      }
    } catch (error) {
      console.error('Error in timer state validation', 'TIMER', error as Error);
    }
  }, 30000); // Check every 30 seconds
};

// Start timer state validation
startTimerStateValidation();

const stopTimerStateValidation = () => {
  if (stateValidationInterval) {
    clearInterval(stateValidationInterval);
    stateValidationInterval = null;
  }
};

// Timer utility functions
const broadcastTimerState = () => {
  try {
    // Sanitize state before broadcasting
    const safeState = {
      status: currentTimerState.status,
      activeMs: Math.max(0, currentTimerState.activeMs || 0),
      pausedMs: Math.max(0, currentTimerState.pausedMs || 0),
      startTs: currentTimerState.startTs,
      task: currentTimerState.task
    };
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:state-sync', safeState);
    }
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.webContents.send('timer:state-sync', safeState);
    }
    
    // Update tray tooltip with timer info
    updateTrayTooltip(safeState);
  } catch (error) {
    console.error('Error broadcasting timer state', 'TIMER', error as Error);
  }
};

const updateTrayTooltip = (state: any) => {
  if (!tray || tray.isDestroyed()) return;
  
  try {
    if (state.status === 'running' && state.activeMs > 0) {
      const minutes = Math.floor(state.activeMs / 60000);
      const seconds = Math.floor((state.activeMs % 60000) / 1000);
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      const taskInfo = state.task?.client || 'No task';
      tray.setToolTip(`Tshifhinga - ${timeStr} - ${taskInfo}`);
    } else {
      tray.setToolTip('Tshifhinga Time Tracker');
    }
  } catch (error) {
    console.error('Error updating tray tooltip', 'TIMER', error as Error);
  }
};

const startTimerInterval = () => {
  // Clean up any existing intervals
  stopTimerInterval();
  
  // Clear any pending cleanup
  if (timerCleanupTimeout) {
    clearTimeout(timerCleanupTimeout);
    timerCleanupTimeout = null;
  }
  
  currentTimerState.lastUpdateTs = Date.now();
  
  timerInterval = setInterval(() => {
    try {
      if (currentTimerState.status === 'running' && currentTimerState.startTs) {
        const now = Date.now();
        const timeSinceLastUpdate = currentTimerState.lastUpdateTs ? now - currentTimerState.lastUpdateTs : 1000;
        
        // Prevent time drift by using actual elapsed time
        const maxUpdateTime = 2000; // Max 2 seconds to prevent large jumps
        const updateTime = Math.min(timeSinceLastUpdate, maxUpdateTime);
        
        currentTimerState.activeMs += updateTime;
        currentTimerState.lastUpdateTs = now;
        
        broadcastTimerState();
        
        // Log performance warning for slow updates
        if (timeSinceLastUpdate > 1500) {
          console.warn('Timer update was slow', 'TIMER', { 
            timeSinceLastUpdate,
            activeMs: currentTimerState.activeMs 
          });
        }
      } else {
        // Auto-cleanup if timer is not in expected state
        console.warn('Timer interval running but state is not running', 'TIMER', {
          status: currentTimerState.status,
          startTs: currentTimerState.startTs
        });
        stopTimerInterval();
      }
    } catch (error) {
      console.error('Error in timer interval', 'TIMER', error as Error);
      stopTimerInterval();
    }
  }, 1000);
  
  // Set up automatic cleanup after 24 hours (safety mechanism)
  timerCleanupTimeout = setTimeout(() => {
    console.warn('Timer auto-cleanup after 24 hours', 'TIMER');
    stopTimerInterval();
    currentTimerState.status = 'stopped';
    broadcastTimerState();
  }, 24 * 60 * 60 * 1000);
};

const stopTimerInterval = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  if (timerCleanupTimeout) {
    clearTimeout(timerCleanupTimeout);
    timerCleanupTimeout = null;
  }
  
  currentTimerState.lastUpdateTs = null;
};

// IPC handlers for timer actions
ipcMain.on('timer:start', (_, task) => {
  try {
    console.log('Timer start requested', 'TIMER', { task: task?.client });
    
    // Validate task data
    if (!task || !task.client || !task.project || !task.task) {
      console.error('Invalid task data for timer start', 'TIMER', undefined, { task });
      return;
    }
    
    // Stop any existing timer
    stopTimerInterval();
    
    currentTimerState = {
      status: 'running',
      activeMs: 0,
      pausedMs: 0,
      startTs: Date.now(),
      lastUpdateTs: Date.now(),
      task: {
        client: String(task.client || '').trim(),
        project: String(task.project || '').trim(),
        task: String(task.task || '').trim()
      }
    };
    
    startTimerInterval();
    broadcastTimerState();
    
    console.log('Timer started successfully', 'TIMER', {
      client: currentTimerState.task.client,
      project: currentTimerState.task.project,
      task: currentTimerState.task.task
    });
  } catch (error) {
    console.error('Error starting timer', 'TIMER', error as Error);
  }
});

ipcMain.on('timer:pause', () => {
  try {
    if (currentTimerState.status === 'running') {
      console.log('Timer paused', 'TIMER', { activeMs: currentTimerState.activeMs });
      currentTimerState.status = 'paused';
      stopTimerInterval();
      broadcastTimerState();
    } else {
      console.warn('Timer pause requested but timer not running', 'TIMER', {
        status: currentTimerState.status
      });
    }
  } catch (error) {
    console.error('Error pausing timer', 'TIMER', error as Error);
  }
});

ipcMain.on('timer:resume', () => {
  try {
    if (currentTimerState.status === 'paused') {
      console.log('Timer resumed', 'TIMER', { activeMs: currentTimerState.activeMs });
      currentTimerState = {
        ...currentTimerState,
        status: 'running',
        startTs: Date.now(),
        lastUpdateTs: Date.now()
      };
      startTimerInterval();
      broadcastTimerState();
    } else {
      console.warn('Timer resume requested but timer not paused', 'TIMER', {
        status: currentTimerState.status
      });
    }
  } catch (error) {
    console.error('Error resuming timer', 'TIMER', error as Error);
  }
});

ipcMain.handle('timer:stop', async (_, data) => {
  const stopTime = Date.now();
  
  try {
    if (currentTimerState.status === 'stopped') {
      console.warn('Timer stop requested but timer already stopped', 'TIMER');
      return;
    }
    
    if (!currentTimerState.task) {
      console.error('Timer stop requested but no task set', 'TIMER');
      stopTimerInterval();
      currentTimerState.status = 'stopped';
      broadcastTimerState();
      return;
    }
    
    const { notes, token } = data || {};
    
    console.log('Timer stop requested', 'TIMER', {
      activeMs: currentTimerState.activeMs,
      pausedMs: currentTimerState.pausedMs,
      hasNotes: !!notes
    });
    
    // Stop the timer interval first
    stopTimerInterval();
    
    // Get user ID from token
    let userId = null;
    if (token) {
      try {
        const user = await authService.verifyToken(token);
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        console.error('Error verifying token for session save', 'TIMER', error as Error);
      }
    }

    // Ensure minimum session duration (at least 1 second)
    const finalActiveMs = Math.max(currentTimerState.activeMs, 1000);
    
    // Save session to database
    const sessionId = `session-${stopTime}-${Math.random().toString(36).substring(2, 15)}`;
    const session = {
      id: sessionId,
      client: currentTimerState.task.client,
      project: currentTimerState.task.project,
      task: currentTimerState.task.task,
      start: currentTimerState.startTs || (stopTime - finalActiveMs),
      end: stopTime,
      activeMs: finalActiveMs,
      pausedMs: currentTimerState.pausedMs || 0,
      notes: notes || null,
      createdAt: stopTime,
      isBillable: true,
      userId: userId,
    };

    try {
      await dbService.insertSession(session);
      console.log('Session saved to database', 'TIMER', {
        sessionId,
        activeMs: finalActiveMs,
        userId
      });
      
      // Notify renderer to refresh sessions
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('timer-action-refresh-sessions');
      }
      if (miniWindow && !miniWindow.isDestroyed()) {
        miniWindow.webContents.send('timer-action-refresh-sessions');
      }
    } catch (error) {
      console.error('Error saving session to database', 'TIMER', error as Error, {
        sessionId,
        activeMs: finalActiveMs
      });
    }
    
    // Reset timer state (preserve task selection for UI)
    currentTimerState = {
      status: 'stopped',
      activeMs: 0,
      pausedMs: 0,
      startTs: null,
      lastUpdateTs: null,
      task: currentTimerState.task // Keep the task selected in UI
    };
    
    broadcastTimerState();
    
  } catch (error) {
    console.error('Error stopping timer', 'TIMER', error as Error);
    
    // Ensure timer is stopped even if there's an error
    stopTimerInterval();
    currentTimerState.status = 'stopped';
    broadcastTimerState();
  }
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

ipcMain.handle('db:addSession', async (_, session) => {
  return await dbService.addSession(session);
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

// Session editing handlers
ipcMain.handle('db:editSession', async (_, sessionId, userId, updates, editReason) => {
  return await dbService.editSession(sessionId, userId, updates, editReason);
});

ipcMain.handle('db:getSessionEditHistory', async (_, sessionId) => {
  return await dbService.getSessionEditHistory(sessionId);
});

ipcMain.handle('db:validateSessionEdit', async (_, sessionId, updates, userId) => {
  return await dbService.validateSessionEdit(sessionId, updates, userId);
});

ipcMain.handle('db:getUserReliabilityRate', async (_, userId, weekStart) => {
  return await dbService.getUserReliabilityRate(userId, weekStart);
});

ipcMain.handle('db:getAllUserReliabilityMetrics', async () => {
  return await dbService.getAllUserReliabilityMetrics();
});

ipcMain.handle('db:updateUserReliabilityMetrics', async (_, userId) => {
  return await dbService.updateUserReliabilityMetrics(userId);
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

// Project Management CRUD operations
ipcMain.handle('db:getAllClients', async () => {
  return await dbService.getAllClients();
});
ipcMain.handle('db:getProjectsByClient', async (_, clientId) => {
  return await dbService.getProjectsByClient(clientId);
});
ipcMain.handle('db:getTasksByProject', async (_, projectId) => {
  return await dbService.getTasksByProject(projectId);
});
ipcMain.handle('db:updateClient', async (_, id, name) => {
  return await dbService.updateClient(id, name);
});
ipcMain.handle('db:updateProject', async (_, id, name, clientId) => {
  return await dbService.updateProject(id, name, clientId);
});
ipcMain.handle('db:updateTask', async (_, id, name, projectId) => {
  return await dbService.updateTask(id, name, projectId);
});
ipcMain.handle('db:deleteClient', async (_, id) => {
  return await dbService.deleteClient(id);
});
ipcMain.handle('db:deleteProject', async (_, id) => {
  return await dbService.deleteProject(id);
});
ipcMain.handle('db:deleteTask', async (_, id) => {
  return await dbService.deleteTask(id);
});
ipcMain.handle('db:copyTask', async (_, sourceTaskId, targetProjectId) => {
  return await dbService.copyTask(sourceTaskId, targetProjectId);
});
ipcMain.handle('db:createDefaultProjectStructure', async () => {
  return await dbService.createDefaultProjectStructure();
});
ipcMain.handle('db:exportToXLSX', async () => {
  return await dbService.exportToXLSX();
});

// Configuration data handlers
ipcMain.handle('db:getTeams', async () => {
  return await dbService.getTeams();
});
ipcMain.handle('db:getRegions', async () => {
  return await dbService.getRegions();
});
ipcMain.handle('db:getJobLevels', async () => {
  return await dbService.getJobLevels();
});
ipcMain.handle('db:getBillableRateByJobLevel', async (_, jobLevelCode) => {
  return await dbService.getBillableRateByJobLevel(jobLevelCode);
});
ipcMain.handle('db:createTeam', async (_, name, description) => {
  return await dbService.createTeam(name, description);
});
ipcMain.handle('db:createRegion', async (_, name) => {
  return await dbService.createRegion(name);
});
ipcMain.handle('db:createJobLevel', async (_, name, defaultRate) => {
  return await dbService.createJobLevel(name, defaultRate);
});

// Analytics aggregation handlers
ipcMain.handle('db:getUserDailyMetrics', async (_, userId, dateFrom, dateTo) => {
  return await dbService.getUserDailyMetrics(userId, dateFrom, dateTo);
});
ipcMain.handle('db:getClientProfitability', async (_, userId) => {
  return await dbService.getClientProfitability(userId);
});
ipcMain.handle('db:getTeamPerformance', async (_, dateFrom, dateTo, team, region) => {
  return await dbService.getTeamPerformance(dateFrom, dateTo, team, region);
});
ipcMain.handle('db:getMonthlyTrends', async (_, userId, monthsBack) => {
  return await dbService.getMonthlyTrends(userId, monthsBack);
});
ipcMain.handle('db:populateAnalyticsSummaries', async () => {
  return await dbService.populateAnalyticsSummaries();
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

ipcMain.handle('auth:register', async (_, username, email, password, role, additionalData) => {
  return await authService.register(username, email, password, role, additionalData);
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

ipcMain.handle('auth:update-user', async (_, userId, userData) => {
  return await authService.updateUser(userId, userData);
});

ipcMain.handle('auth:update-user-role', async (_, userId, role) => {
  return await authService.updateUserRole(userId, role);
});

ipcMain.handle('auth:deactivate-user', async (_, userId) => {
  return await authService.deactivateUser(userId);
});

// Enhanced permission handlers for Phase 1
ipcMain.handle('permissions:get-user-project-details', async (_, userId) => {
  return await dbService.getUserProjectPermissionDetails(userId);
});

ipcMain.handle('permissions:set-user-project-permission', async (_, userId, projectId, permissionLevel, grantedBy) => {
  return await dbService.setUserProjectPermission(userId, projectId, permissionLevel, grantedBy);
});

ipcMain.handle('permissions:has-user-project-permission', async (_, userId, projectId, requiredLevel) => {
  return await dbService.hasUserProjectPermission(userId, projectId, requiredLevel);
});

ipcMain.handle('permissions:get-all-user-project-permissions', async () => {
  return await dbService.getAllUserProjectPermissions();
});

ipcMain.handle('permissions:bulk-set-permissions', async (_, assignments, grantedBy) => {
  return await dbService.bulkSetUserProjectPermissions(assignments, grantedBy);
});

ipcMain.handle('permissions:remove-user-project-permission', async (_, userId, projectId) => {
  return await dbService.removeUserProjectPermission(userId, projectId);
});

// Permission Template handlers
ipcMain.handle('templates:create-permission-template', async (_, name, description, templateData, createdBy) => {
  return await dbService.createPermissionTemplate(name, description, templateData, createdBy);
});

ipcMain.handle('templates:get-all-permission-templates', async () => {
  return await dbService.getAllPermissionTemplates();
});

ipcMain.handle('templates:apply-permission-template', async (_, templateId, userIds, grantedBy) => {
  return await dbService.applyPermissionTemplate(templateId, userIds, grantedBy);
});

ipcMain.handle('templates:delete-permission-template', async (_, id) => {
  return await dbService.deletePermissionTemplate(id);
});