import { BrowserWindow } from 'electron';
import path from 'path';

let setupWindow: BrowserWindow | null = null;

export function openSetupWindow(): BrowserWindow {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.show();
    setupWindow.focus();
    return setupWindow;
  }

  setupWindow = new BrowserWindow({
    width: 600,
    height: 670,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'AI Desktop Pet — Setup & Integrations',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/setupPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setupWindow.loadFile(path.join(__dirname, '../renderer/setup/index.html'));

  setupWindow.on('closed', () => {
    setupWindow = null;
  });

  return setupWindow;
}

export function closeSetupWindow(): void {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.close();
  }
}
