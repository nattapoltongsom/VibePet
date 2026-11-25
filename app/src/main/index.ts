import { app, ipcMain, type BrowserWindow } from 'electron';
import type http from 'http';
import type { ActivityItem, CharacterType, PetStatus, PetStatusInput, Preferences } from '../shared/types';
import { loadPreferences, savePreferences } from './store';
import { isValidState, createHttpServer } from './httpServer';
import { STATE_META, createTrayManager } from './tray';
import { WINDOW_WIDTH, WINDOW_HEIGHT, getDefaultPosition, createPetWindow } from './petWindow';
import { openSetupWindow, closeSetupWindow } from './setupWindow';
import {
  ensureRuntimeInstalled,
  getIntegrationStatuses,
  connectIntegrations,
  disconnectIntegration,
} from './integrations';

const SUCCESS_AUTO_IDLE_MS = 10000;
const MAX_HISTORY_ITEMS = 6;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let petWindow: BrowserWindow | null = null;
let httpServer: http.Server | null = null;
let autoIdleTimer: NodeJS.Timeout | null = null;
const activityHistory: ActivityItem[] = [];

let currentStatus: PetStatus = {
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

function formatTimeHM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function clearAutoIdleTimer(): void {
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

function applyCharacter(character: CharacterType): Preferences {
  const prefs = savePreferences({ character });
  trayManager.setCharacterIcon(prefs.character);
  trayManager.update({ status: currentStatus, history: activityHistory, prefs });
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:character-change', prefs.character);
  }
  return prefs;
}

function toggleMute(): Preferences {
  const current = loadPreferences();
  const prefs = savePreferences({ muted: !current.muted });
  trayManager.update({ status: currentStatus, history: activityHistory, prefs });
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:mute-change', prefs.muted);
  }
  return prefs;
}

function pushStatus({
  state,
  message = '',
  detail = '',
  thought = '',
  project = '',
  model = '',
  modelName = '',
  source = '',
}: PetStatusInput): PetStatus {
  clearAutoIdleTimer();

  const safeState = isValidState(state) ? state : 'idle';
  const safeMessage = typeof message === 'string' ? message.trim().slice(0, 160) : '';
  const rawDetail = typeof detail === 'string' && detail.trim() ? detail : typeof thought === 'string' ? thought : '';
  const safeDetail = rawDetail.replace(/\s+/g, ' ').trim().slice(0, 240);
  const safeProject = typeof project === 'string' ? project.trim().slice(0, 40) : '';
  const rawModel = typeof model === 'string' && model.trim() ? model : typeof modelName === 'string' ? modelName : '';
  const safeModel = rawModel.trim().slice(0, 48);
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

function registerIpc(): void {
  ipcMain.handle('pet:get-init', () => {
    const prefs = loadPreferences();
    return { character: prefs.character, muted: prefs.muted };
  });

  ipcMain.on('pet:set-ignore-mouse-events', (_event, ignore: boolean, options?: { forward: boolean }) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    if (ignore) {
      petWindow.setIgnoreMouseEvents(true, options || { forward: true });
    } else {
      petWindow.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.on('pet:move-window-by', (_event, dx: number, dy: number) => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const [x, y] = petWindow.getPosition();
    const nextX = Math.round(x + dx);
    const nextY = Math.round(y + dy);
    petWindow.setBounds({ x: nextX, y: nextY, width: WINDOW_WIDTH, height: WINDOW_HEIGHT }, false);
    savePreferences({ position: { x: nextX, y: nextY } });
  });

  ipcMain.on('pet:toggle-mute', () => toggleMute());
  ipcMain.on('pet:open-setup', () => openSetupWindow());
  ipcMain.on('pet:quit-app', () => app.quit());

  ipcMain.handle('setup:get-state', () => {
    const prefs = loadPreferences();
    return {
      character: prefs.character,
      integrations: getIntegrationStatuses(),
    };
  });

  ipcMain.handle('setup:set-character', (_event, character: CharacterType) => {
    const prefs = applyCharacter(character);
    return { character: prefs.character };
  });

  ipcMain.handle('setup:connect', (_event, ids: string[]) => {
    const results = connectIntegrations(ids);
    savePreferences({ setupPromptShown: true });
    return {
      results,
      integrations: getIntegrationStatuses(),
    };
  });

  ipcMain.handle('setup:disconnect', (_event, id: string) => {
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

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  const prefs = loadPreferences();

  try {
    const statuses = getIntegrationStatuses();
    if (statuses.some((s) => s.connected)) {
      ensureRuntimeInstalled();
    }
  } catch (err) {
    console.error('[AI Pet] Runtime sync skipped:', err instanceof Error ? err.message : err);
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
