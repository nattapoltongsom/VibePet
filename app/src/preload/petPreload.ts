import { contextBridge, ipcRenderer } from 'electron';
import type { CharacterType, PetInitPayload, PetStatus } from '../shared/types';

contextBridge.exposeInMainWorld('petAPI', {
  getInit: (): Promise<PetInitPayload> => ipcRenderer.invoke('pet:get-init'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('pet:set-ignore-mouse-events', ignore, options);
  },
  moveWindowBy: (dx: number, dy: number) => {
    ipcRenderer.send('pet:move-window-by', dx, dy);
  },
  toggleMute: () => ipcRenderer.send('pet:toggle-mute'),
  openSetup: () => ipcRenderer.send('pet:open-setup'),
  quitApp: () => ipcRenderer.send('pet:quit-app'),
  onStatusUpdate: (callback: (payload: PetStatus) => void) => {
    ipcRenderer.on('pet:status-update', (_event, payload: PetStatus) => callback(payload));
  },
  onCharacterChange: (callback: (character: CharacterType) => void) => {
    ipcRenderer.on('pet:character-change', (_event, character: CharacterType) => callback(character));
  },
  onMuteChange: (callback: (muted: boolean) => void) => {
    ipcRenderer.on('pet:mute-change', (_event, muted: boolean) => callback(muted));
  },
});
