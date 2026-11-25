const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupAPI', {
  getState: () => ipcRenderer.invoke('setup:get-state'),
  setCharacter: (character) => ipcRenderer.invoke('setup:set-character', character),
  connect: (ids) => ipcRenderer.invoke('setup:connect', ids),
  disconnect: (id) => ipcRenderer.invoke('setup:disconnect', id),
  dismiss: () => ipcRenderer.send('setup:dismiss'),
});
