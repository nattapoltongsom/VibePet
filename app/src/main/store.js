const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const VALID_CHARACTERS = new Set(['cat', 'robot', 'dog']);

const DEFAULTS = {
  character: 'cat',
  muted: false,
  showTrayTitle: true,
  setupPromptShown: false,
  position: null,
};

let cache = null;

function getStorePath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function loadPreferences() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf8');
    const parsed = JSON.parse(raw);
    cache = {
      ...DEFAULTS,
      ...parsed,
      character: VALID_CHARACTERS.has(parsed.character) ? parsed.character : DEFAULTS.character,
      muted: Boolean(parsed.muted),
      showTrayTitle: parsed.showTrayTitle !== undefined ? Boolean(parsed.showTrayTitle) : DEFAULTS.showTrayTitle,
      setupPromptShown: Boolean(parsed.setupPromptShown),
    };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function savePreferences(patch = {}) {
  const current = loadPreferences();
  const next = { ...current, ...patch };
  if (!VALID_CHARACTERS.has(next.character)) {
    next.character = DEFAULTS.character;
  }
  cache = next;

  try {
    const filePath = getStorePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  } catch (err) {
    console.error('[AI Pet Store] Failed to save preferences:', err.message);
  }
  return cache;
}

module.exports = {
  VALID_CHARACTERS,
  loadPreferences,
  savePreferences,
};
