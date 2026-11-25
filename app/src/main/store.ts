import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { CharacterType, Preferences } from '../shared/types';

export const VALID_CHARACTERS = new Set<CharacterType>(['cat', 'robot', 'dog']);

const DEFAULTS: Preferences = {
  character: 'cat',
  muted: false,
  showTrayTitle: true,
  setupPromptShown: false,
  position: null,
};

let cache: Preferences | null = null;

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function isValidCharacter(value: unknown): value is CharacterType {
  return typeof value === 'string' && VALID_CHARACTERS.has(value as CharacterType);
}

export function loadPreferences(): Preferences {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    cache = {
      ...DEFAULTS,
      ...parsed,
      character: isValidCharacter(parsed.character) ? parsed.character : DEFAULTS.character,
      muted: Boolean(parsed.muted),
      showTrayTitle: parsed.showTrayTitle !== undefined ? Boolean(parsed.showTrayTitle) : DEFAULTS.showTrayTitle,
      setupPromptShown: Boolean(parsed.setupPromptShown),
    };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function savePreferences(patch: Partial<Preferences> = {}): Preferences {
  const current = loadPreferences();
  const next: Preferences = { ...current, ...patch };
  if (!isValidCharacter(next.character)) {
    next.character = DEFAULTS.character;
  }
  cache = next;

  try {
    const filePath = getStorePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  } catch (err) {
    console.error('[AI Pet Store] Failed to save preferences:', err instanceof Error ? err.message : err);
  }
  return cache;
}
