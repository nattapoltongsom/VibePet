import { BrowserWindow, screen } from 'electron';
import path from 'path';
import type { WindowPosition } from '../shared/types';

export const WINDOW_WIDTH = 360;
export const WINDOW_HEIGHT = 315;

export function getDefaultPosition(): WindowPosition {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - WINDOW_WIDTH - 24),
    y: Math.round(workArea.y + workArea.height - WINDOW_HEIGHT - 24),
  };
}

function getInitialPosition(savedPosition: WindowPosition | null): WindowPosition {
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

export function createPetWindow(opts: {
  savedPosition: WindowPosition | null;
  onClosed?: () => void;
}): BrowserWindow {
  const { x, y } = getInitialPosition(opts.savedPosition);

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

  win.setAlwaysOnTop(true, 'floating', 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });

  win.once('ready-to-show', () => {
    win.showInactive();
  });

  win.loadFile(path.join(__dirname, '../renderer/pet/index.html'));

  win.on('closed', () => {
    opts.onClosed?.();
  });

  return win;
}
