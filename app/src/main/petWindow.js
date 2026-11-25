const { BrowserWindow, screen } = require('electron');
const path = require('path');

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 315;

function getDefaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - WINDOW_WIDTH - 24),
    y: Math.round(workArea.y + workArea.height - WINDOW_HEIGHT - 24),
  };
}

function getInitialPosition(savedPosition) {
  if (
    savedPosition &&
    typeof savedPosition.x === 'number' &&
    typeof savedPosition.y === 'number'
  ) {
    const displays = screen.getAllDisplays();
    const visible = displays.some(({ workArea }) => {
      return (
        savedPosition.x + WINDOW_WIDTH > workArea.x + 40 &&
        savedPosition.x < workArea.x + workArea.width - 40 &&
        savedPosition.y + WINDOW_HEIGHT > workArea.y + 40 &&
        savedPosition.y < workArea.y + workArea.height - 40
      );
    });
    if (visible) return savedPosition;
  }
  return getDefaultPosition();
}

function createPetWindow({ savedPosition, onClosed }) {
  const { x, y } = getInitialPosition(savedPosition);

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/petPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // Float above all windows including macOS native fullscreen Spaces
  win.setAlwaysOnTop(true, 'floating', 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Transparent background clicks pass through to underlying apps
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, '../renderer/pet/index.html'));

  win.on('closed', () => {
    if (onClosed) onClosed();
  });

  return win;
}

module.exports = {
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  getDefaultPosition,
  createPetWindow,
};
