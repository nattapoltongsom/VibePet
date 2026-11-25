const { app, ipcMain } = require('electron');
const { loadPreferences, savePreferences } = require('./store');
const { VALID_STATES, createHttpServer } = require('./httpServer');
const { STATE_META, createTrayManager } = require('./tray');
const { WINDOW_WIDTH, WINDOW_HEIGHT, getDefaultPosition, createPetWindow } = require('./petWindow');
const { openSetupWindow, closeSetupWindow } = require('./setupWindow');
const {
  ensureRuntimeInstalled,
  getIntegrationStatuses,
  connectIntegrations,
  disconnectIntegration,
} = require('./integrations');

const SUCCESS_AUTO_IDLE_MS = 10000;
const MAX_HISTORY_ITEMS = 6;

// Allow Web Audio API sounds to play immediately without prior click
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let petWindow = null;
let httpServer = null;
let autoIdleTimer = null;
const activityHistory = [];

let currentStatus = {
  state: 'idle',
  message: '',
  detail: '',
  project: '',
  model: '',
  source: '',
  updatedAt: new Date().toISOString(),
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.showInactive();
      petWindow.setAlwaysOnTop(true, 'floating', 1);
    }
    openSetupWindow();
  });
}

function formatTimeHM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function clearAutoIdleTimer() {
  if (autoIdleTimer) {
    clearTimeout(autoIdleTimer);
    autoIdleTimer = null;
  }
}

const trayManager = createTrayManager({
  openSetup: () => openSetupWindow(),
  setCharacter: (character) => applyCharacter(character),
  setShowTrayTitle: (showTrayTitle) => {
    const prefs = savePreferences({ showTrayTitle: Boolean(showTrayTitle) });
    trayManager.update({ status: currentStatus, history: activityHistory, prefs });
  },
  toggleMute: () => toggleMute(),
  resetPosition: () => {
    if (petWindow && !petWindow.isDestroyed()) {
      const { x, y } = getDefaultPosition();
      petWindow.setPosition(x, y, false);
      savePreferences({ position: { x, y } });
    }
  },
  previewStatus: (payload) => pushStatus(payload),
  quit: () => app.quit(),
});

function applyCharacter(character) {
  const prefs = savePreferences({ character });
  trayManager.setCharacterIcon(prefs.character);
  trayManager.update({ status: currentStatus, history: activityHistory, prefs });
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:character-change', prefs.character);
  }
  return prefs;
}

function toggleMute() {
  const current = loadPreferences();
  const prefs = savePreferences({ muted: !current.muted });
  trayManager.update({ status: currentStatus, history: activityHistory, prefs });
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:mute-change', prefs.muted);
  }
  return prefs;
}

function pushStatus({ state, message = '', detail = '', thought = '', project = '', model = '', source = '' }) {
  clearAutoIdleTimer();

  const safeState = VALID_STATES.has(state) ? state : 'idle';
  const safeMessage = typeof message === 'string' ? message.trim().slice(0, 160) : '';
  const rawDetail = typeof detail === 'string' && detail.trim() ? detail : typeof thought === 'string' ? thought : '';
  const safeDetail = rawDetail.replace(/\s+/g, ' ').trim().slice(0, 240);
  const safeProject = typeof project === 'string' ? project.trim().slice(0, 40) : '';
  const safeModel = typeof model === 'string' ? model.trim().slice(0, 48) : '';
  const safeSource = typeof source === 'string' ? source.trim().slice(0, 32) : '';

  const now = new Date();
  currentStatus = {
    state: safeState,
    message: safeMessage,
    detail: safeDetail,
    project: safeProject,
    model: safeModel,
    source: safeSource,
    updatedAt: now.toISOString(),
  };

  if (safeMessage || safeDetail) {
    activityHistory.unshift({
      time: formatTimeHM(now),
      state: safeState,
      message: safeMessage || STATE_META[safeState].label,
      detail: safeDetail,
      project: safeProject,
      model: safeModel,
      source: safeSource,
    });
    if (activityHistory.length > MAX_HISTORY_ITEMS) {
      activityHistory.length = MAX_HISTORY_ITEMS;
    }
  }

  trayManager.update({
    status: currentStatus,
    history: activityHistory,
    prefs: loadPreferences(),
  });

  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:status-update', currentStatus);
  }

  if (safeState === 'success') {
    autoIdleTimer = setTimeout(() => {
      pushStatus({ state: 'idle', message: '', detail: '', project: '', model: '', source: '' });
    }, SUCCESS_AUTO_IDLE_MS);
  }

  return currentStatus;
}

// ================= IPC Registration =================
function registerIpc() {
  ipcMain.handle('pet:get-init', () => {
    const prefs = loadPreferences();
    return { character: prefs.character, muted: prefs.muted };
  });

  ipcMain.on('pet:set-ignore-mouse-events', (_event, ignore, options) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (ignore) {
      petWindow.setIgnoreMouseEvents(true, options || { forward: true });
    } else {
      petWindow.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.on('pet:move-window-by', (_event, dx, dy) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const [x, y] = petWindow.getPosition();
    const nextX = Math.round(x + dx);
    const nextY = Math.round(y + dy);
    petWindow.setBounds(
      { x: nextX, y: nextY, width: WINDOW_WIDTH, height: WINDOW_HEIGHT },
      false
    );
    savePreferences({ position: { x: nextX, y: nextY } });
  });

  ipcMain.on('pet:toggle-mute', () => toggleMute());
  ipcMain.on('pet:open-setup', () => openSetupWindow());
  ipcMain.on('pet:quit-app', () => app.quit());

  // Setup & Permissions Window IPC
  ipcMain.handle('setup:get-state', () => {
    const prefs = loadPreferences();
    return {
      character: prefs.character,
      integrations: getIntegrationStatuses(),
    };
  });

  ipcMain.handle('setup:set-character', (_event, character) => {
    const prefs = applyCharacter(character);
    return { character: prefs.character };
  });

  ipcMain.handle('setup:connect', (_event, ids) => {
    const results = connectIntegrations(ids);
    savePreferences({ setupPromptShown: true });
    return {
      results,
      integrations: getIntegrationStatuses(),
    };
  });

  ipcMain.handle('setup:disconnect', (_event, id) => {
    const result = disconnectIntegration(id);
    return {
      result,
      integrations: getIntegrationStatuses(),
    };
  });

  ipcMain.on('setup:dismiss', () => {
    savePreferences({ setupPromptShown: true });
    closeSetupWindow();
  });
}

// ================= App Startup =================
app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  const prefs = loadPreferences();

  // Keep ~/.ai-pet/scripts synced if already connected from a previous launch
  try {
    const statuses = getIntegrationStatuses();
    if (statuses.some((s) => s.connected)) {
      ensureRuntimeInstalled();
    }
  } catch (err) {
    console.error('[AI Pet] Runtime sync skipped:', err.message);
  }

  registerIpc();

  petWindow = createPetWindow({
    savedPosition: prefs.position,
    onClosed: () => {
      petWindow = null;
    },
  });

  trayManager.init({
    status: currentStatus,
    history: activityHistory,
    prefs,
  });

  httpServer = createHttpServer({
    getStatus: () => currentStatus,
    onStatusUpdate: (payload) => pushStatus(payload),
  });

  // First launch: open the explicit consent & character picker window
  if (!prefs.setupPromptShown) {
    openSetupWindow();
  }
});

app.on('before-quit', () => {
  clearAutoIdleTimer();
  if (httpServer) {
    try {
      httpServer.close();
    } catch {
      // ignore
    }
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
