type RendererPetState = 'idle' | 'thinking' | 'coding' | 'waiting' | 'success';
type RendererCharacterType = 'cat' | 'robot' | 'dog';

interface RendererPetStatus {
  state?: RendererPetState;
  message?: string;
  detail?: string;
  thought?: string;
  project?: string;
  model?: string;
  source?: string;
}

interface RendererIntegrationInfo {
  id: string;
  name: string;
  description: string;
  files: string[];
  detected: boolean;
  connected: boolean;
}

interface RendererIntegrationResult {
  id: string;
  ok: boolean;
  error?: string;
}

interface PetBridgeAPI {
  getInit: () => Promise<{ character: RendererCharacterType; muted: boolean }>;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  moveWindowBy: (dx: number, dy: number) => void;
  toggleMute: () => void;
  openSetup: () => void;
  quitApp: () => void;
  onStatusUpdate: (cb: (payload: RendererPetStatus) => void) => void;
  onCharacterChange: (cb: (character: RendererCharacterType) => void) => void;
  onMuteChange: (cb: (muted: boolean) => void) => void;
}

interface SetupBridgeAPI {
  getState: () => Promise<{ character: RendererCharacterType; integrations: RendererIntegrationInfo[] }>;
  setCharacter: (character: RendererCharacterType) => Promise<{ character: RendererCharacterType }>;
  connect: (ids: string[]) => Promise<{ results: RendererIntegrationResult[]; integrations: RendererIntegrationInfo[] }>;
  disconnect: (id: string) => Promise<{ result: RendererIntegrationResult; integrations: RendererIntegrationInfo[] }>;
  dismiss: () => void;
}

interface Window {
  petAPI: PetBridgeAPI;
  setupAPI: SetupBridgeAPI;
  PetCharacters: {
    getSvg: (character: RendererCharacterType) => string;
  };
  PetAudio: {
    playStateSound: (state: RendererPetState, muted: boolean) => void;
  };
  webkitAudioContext?: typeof AudioContext;
}
