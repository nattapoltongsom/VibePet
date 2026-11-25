const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getInit: () => ipcRenderer.invoke('pet:get-init'),
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('pet:set-ignore-mouse-events', ignore, options);
  },
  moveWindowBy: (dx, dy) => {
    ipcRenderer.send('pet:move-window-by', dx, dy);
  },
  toggleMute: () => ipcRenderer.send('pet:toggle-mute'),
  openSetup: () => ipcRenderer.send('pet:open-setup'),
  quitApp: () => ipcRenderer.send('pet:quit-app'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('pet:status-update', (_event, payload) => callback(payload));
  },
  onCharacterChange: (callback) => {
    ipcRenderer.on('pet:character-change', (_event, character) => callback(character));
  },
  onMuteChange: (callback) => {
    ipcRenderer.on('pet:mute-change', (_event, muted) => callback(muted));
  },
});
