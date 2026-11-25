const { BrowserWindow } = require('electron');
const path = require('path');

let setupWindow = null;

function openSetupWindow() {
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

function closeSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.close();
  }
}

module.exports = {
  openSetupWindow,
  closeSetupWindow,
};
