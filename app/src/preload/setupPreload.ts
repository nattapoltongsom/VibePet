import { contextBridge, ipcRenderer } from 'electron';
import type { CharacterType, IntegrationActionResult, IntegrationInfo, SetupStatePayload } from '../shared/types';

contextBridge.exposeInMainWorld('setupAPI', {
  getState: (): Promise<SetupStatePayload> => ipcRenderer.invoke('setup:get-state'),
  setCharacter: (character: CharacterType): Promise<{ character: CharacterType }> =>
    ipcRenderer.invoke('setup:set-character', character),
  connect: (ids: string[]): Promise<{ results: IntegrationActionResult[]; integrations: IntegrationInfo[] }> =>
    ipcRenderer.invoke('setup:connect', ids),
  disconnect: (id: string): Promise<{ result: IntegrationActionResult; integrations: IntegrationInfo[] }> =>
    ipcRenderer.invoke('setup:disconnect', id),
  dismiss: () => ipcRenderer.send('setup:dismiss'),
});
