export type PetState = 'idle' | 'thinking' | 'coding' | 'waiting' | 'success';

export type CharacterType = 'cat' | 'robot' | 'dog';

export interface WindowPosition {
  x: number;
  y: number;
}

export interface Preferences {
  character: CharacterType;
  muted: boolean;
  showTrayTitle: boolean;
  setupPromptShown: boolean;
  position: WindowPosition | null;
}

export interface PetStatusInput {
  state?: PetState | string;
  message?: string;
  detail?: string;
  thought?: string;
  project?: string;
  model?: string;
  modelName?: string;
  source?: string;
  sessionId?: string;
}

export interface ActiveTask {
  id: string;
  state: PetState;
  message: string;
  model: string;
  project: string;
  updatedAt: string;
}

export interface PetStatus {
  state: PetState;
  message: string;
  detail: string;
  project: string;
  model: string;
  source: string;
  updatedAt: string;
  tasks: ActiveTask[];
}

export interface ActivityItem {
  time: string;
  state: PetState;
  message: string;
  detail: string;
  project: string;
  model: string;
  source: string;
}

export interface IntegrationInfo {
  id: string;
  name: string;
  description: string;
  files: string[];
  detected: boolean;
  connected: boolean;
}

export interface IntegrationActionResult {
  id: string;
  ok: boolean;
  error?: string;
}

export interface PetInitPayload {
  character: CharacterType;
  muted: boolean;
}

export interface SetupStatePayload {
  character: CharacterType;
  integrations: IntegrationInfo[];
}
