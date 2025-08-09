const { app: electronApp, BrowserWindow, ipcMain, dialog, powerMonitor, Tray, Menu, nativeImage } = require('electron');
const { join: pathJoin } = require('path');
const { writeFile } = require('fs').promises;
const { DatabaseService } = require('./database');
const isDev = require('electron-is-dev');

// Set app name early to ensure proper userData path
electronApp.setName('tshifhinga-time-tracker');

// Keep a global reference of the database service and windows
let dbService: any;
let mainWindow: any | null = null;
let miniWindow: any | null = null;
let tray: any | null = null;
let systemSleepTime: number | null = null;

// Window state management
let windowState = {
  mode: 'full', // 'full', 'mini', 'tray'
  mainWindowBounds: { width: 1200, height: 800, x: undefined, y: undefined },
  miniWindowBounds: { width: 300, height: 150, x: undefined, y: undefined },
  transparency: 0.95
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
    ? 'http://localhost:8080?mode=full' 
    : `file://${pathJoin(__dirname, '../dist/index.html')}?mode=full`;
  
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
    minWidth: 280,
    minHeight: 120,
    maxWidth: 400,
    maxHeight: 200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: pathJoin(__dirname, 'preload.js'),
    },
    frame: false,
    alwaysOnTop: true,
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
  // Create tray icon (you'll need to add an icon file)
  const icon = nativeImage.createFromPath(pathJoin(__dirname, '../assets/tray-icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

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

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Tshifhinga Time Tracker');

  // Double click to show mini window
  tray.on('double-click', () => {
    switchToMini();
  });

  windowState.mode = 'tray';
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
  
  if (!tray) {
    createTray();
  }
  
  windowState.mode = 'tray';
};

// App event listeners
electronApp.whenReady().then(() => {
  // Initialize database
  dbService = new DatabaseService();
  
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
  // Clean up database connection
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

// IPC handlers for timer state sync
ipcMain.on('timer:state-changed', (_, timerState) => {
  // Broadcast timer state to all windows
  if (mainWindow) {
    mainWindow.webContents.send('timer:state-sync', timerState);
  }
  if (miniWindow) {
    miniWindow.webContents.send('timer:state-sync', timerState);
  }
  
  // Update tray tooltip with timer info
  if (tray && timerState.status === 'running' && timerState.activeMs) {
    const minutes = Math.floor(timerState.activeMs / 60000);
    const seconds = Math.floor((timerState.activeMs % 60000) / 1000);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    tray.setToolTip(`Tshifhinga - ${timeStr} - ${timerState.task?.client || 'No task'}`);
  } else {
    tray.setToolTip('Tshifhinga Time Tracker');
  }
});

// IPC handlers for database operations
ipcMain.handle('db:getAllSessions', async () => {
  return await dbService.getAllSessions();
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