import { Tray, Menu, nativeImage, type MenuItemConstructorOptions } from 'electron';
import type { ActivityItem, CharacterType, PetState, PetStatus, PetStatusInput, Preferences } from '../shared/types';

export const STATE_META: Record<PetState, { icon: string; label: string }> = {
  idle: { icon: '🔵', label: 'Ready' },
  thinking: { icon: '🟣', label: 'Thinking' },
  coding: { icon: '🟢', label: 'Coding' },
  waiting: { icon: '🟠', label: 'Waiting' },
  success: { icon: '✅', label: 'Done' },
};

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

function buildTraySvg(character: CharacterType): string {
  if (character === 'robot') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
        <line x1="9" y1="2" x2="9" y2="5" stroke="black" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="9" cy="2" r="1.4" fill="black"/>
        <rect x="3" y="5" width="12" height="9.5" rx="4" fill="none" stroke="black" stroke-width="1.6"/>
        <circle cx="6.8" cy="9.6" r="1.15" fill="black"/>
        <circle cx="11.2" cy="9.6" r="1.15" fill="black"/>
        <path d="M7.2 12.2 Q9 13.4 10.8 12.2" fill="none" stroke="black" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
    `.trim();
  }

  if (character === 'dog') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
        <path d="M4.2 5.2 Q1.6 6.2 2 10.4 Q2.5 11.4 3.8 10.2" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M13.8 5.2 Q16.4 6.2 16 10.4 Q15.5 11.4 14.2 10.2" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 7.8 Q4.2 3.8 9 3.8 Q13.8 3.8 14 7.8 Q14.2 13.8 9 14.8 Q3.8 13.8 4 7.8 Z" fill="none" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="6.8" cy="8.5" r="1.05" fill="black"/>
        <circle cx="11.2" cy="8.5" r="1.05" fill="black"/>
        <ellipse cx="9" cy="10.6" rx="1.4" ry="1.0" fill="black"/>
        <path d="M7.5 12.3 Q9 13.4 10.5 12.3" fill="none" stroke="black" stroke-width="1.15" stroke-linecap="round"/>
      </svg>
    `.trim();
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <path d="M3.2 8.2 L3.8 3.2 L7.2 5.7 Q9 5.2 10.8 5.7 L14.2 3.2 L14.8 8.2 Q15.2 13.8 9 14.8 Q2.8 13.8 3.2 8.2 Z" fill="none" stroke="black" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="6.7" cy="9.4" r="1.05" fill="black"/>
      <circle cx="11.3" cy="9.4" r="1.05" fill="black"/>
      <path d="M7.4 11.4 Q8.2 12.4 9 11.4 Q9.8 12.4 10.6 11.4" fill="none" stroke="black" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="1.3" y1="9.6" x2="3.3" y2="10.0" stroke="black" stroke-width="1.1" stroke-linecap="round"/>
      <line x1="1.5" y1="11.5" x2="3.4" y2="11.2" stroke="black" stroke-width="1.1" stroke-linecap="round"/>
      <line x1="16.7" y1="9.6" x2="14.7" y2="10.0" stroke="black" stroke-width="1.1" stroke-linecap="round"/>
      <line x1="16.5" y1="11.5" x2="14.6" y2="11.2" stroke="black" stroke-width="1.1" stroke-linecap="round"/>
    </svg>
  `.trim();
}

function createTrayImage(character: CharacterType) {
  const svg = buildTraySvg(character);
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const icon = nativeImage.createFromDataURL(dataUrl);
  icon.setTemplateImage(true);
  return icon;
}

function truncateGraphemes(text: string, maxGraphemes = 26): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const segments = Array.from(graphemeSegmenter.segment(clean), (s) => s.segment);
  if (segments.length <= maxGraphemes) return clean;
  return `${segments.slice(0, maxGraphemes - 1).join('')}…`;
}

export interface TrayActions {
  openSetup: () => void;
  setCharacter: (character: CharacterType) => void;
  setShowTrayTitle: (show: boolean) => void;
  toggleMute: () => void;
  resetPosition: () => void;
  previewStatus: (input: PetStatusInput) => void;
  quit: () => void;
}

export interface TraySnapshot {
  status: PetStatus;
  history: ActivityItem[];
  prefs: Preferences;
}

export interface TrayManager {
  init: (initialState: TraySnapshot) => void;
  update: (snapshot: TraySnapshot) => void;
  setCharacterIcon: (character: CharacterType) => void;
}

export function createTrayManager(actions: TrayActions): TrayManager {
  let tray: Tray | null = null;

  function update({ status, history, prefs }: TraySnapshot): void {
    if (!tray) return;

    const meta = STATE_META[status.state] || STATE_META.idle;
    const shortMsg = truncateGraphemes(status.message, 26);
    const activeCount = status.tasks?.length || 0;

    if (prefs.showTrayTitle) {
      if (status.state === 'idle' && !shortMsg) {
        tray.setTitle(' VibePet');
      } else {
        const detail = shortMsg || meta.label;
        const countPrefix = activeCount > 1 ? `(${activeCount}) ` : '';
        tray.setTitle(` ${meta.icon} ${countPrefix}${detail}`);
      }
    } else {
      tray.setTitle('');
    }

    const modelLine = status.model ? `\n⚡ ${status.model}` : '';
    const msgLine = status.message ? `\n${status.message}` : '';
    tray.setToolTip(`VibePet — ${meta.label}${modelLine}${msgLine}`);

    const headerItems: MenuItemConstructorOptions[] = [];
    if (status.tasks && status.tasks.length > 1) {
      headerItems.push({ label: `Active Tasks (${status.tasks.length})`, enabled: false });
      for (const task of status.tasks) {
        const tMeta = STATE_META[task.state] || STATE_META.idle;
        const tModel = task.model ? `[${truncateGraphemes(task.model, 18)}] ` : '';
        headerItems.push({
          label: `${tMeta.icon} ${tModel}${truncateGraphemes(task.message, 42)}`,
          enabled: false,
        });
      }
    } else {
      const menuMsg = truncateGraphemes(status.message, 44);
      const statusLine = menuMsg ? `${meta.icon} ${meta.label}: ${menuMsg}` : `${meta.icon} ${meta.label}`;
      headerItems.push({ label: statusLine, enabled: false });
      if (status.model) {
        headerItems.push({ label: `⚡ ${truncateGraphemes(status.model, 40)}`, enabled: false });
      }
    }

    const historySubmenu: MenuItemConstructorOptions[] =
      history.length > 0
        ? history.map((item) => {
            const itemMeta = STATE_META[item.state] || STATE_META.idle;
            const modelPrefix = item.model ? `[${truncateGraphemes(item.model, 16)}] ` : '';
            const summary = truncateGraphemes(item.message, 52);
            return {
              label: `${item.time} ${itemMeta.icon} ${modelPrefix}${summary}`,
              enabled: false,
            };
          })
        : [{ label: 'No activity yet', enabled: false }];

    const menu = Menu.buildFromTemplate([
      ...headerItems,
      { type: 'separator' },
      {
        label: 'Integrations & Permissions...',
        click: () => actions.openSetup(),
      },
      {
        label: 'Character',
        submenu: [
          {
            label: 'Cat',
            type: 'radio',
            checked: prefs.character === 'cat',
            click: () => actions.setCharacter('cat'),
          },
          {
            label: 'Robot',
            type: 'radio',
            checked: prefs.character === 'robot',
            click: () => actions.setCharacter('robot'),
          },
          {
            label: 'Dog',
            type: 'radio',
            checked: prefs.character === 'dog',
            click: () => actions.setCharacter('dog'),
          },
        ],
      },
      {
        label: `Recent Activity (${history.length})`,
        submenu: historySubmenu,
      },
      { type: 'separator' },
      {
        label: 'Show Status in Menu Bar',
        type: 'checkbox',
        checked: prefs.showTrayTitle,
        click: (menuItem) => actions.setShowTrayTitle(menuItem.checked),
      },
      {
        label: prefs.muted ? 'Unmute Sound' : 'Mute Sound',
        click: () => actions.toggleMute(),
      },
      {
        label: 'Reset Pet Position',
        click: () => actions.resetPosition(),
      },
      {
        label: 'Preview States',
        submenu: [
          {
            label: 'Idle (Blue)',
            click: () =>
              actions.previewStatus({
                state: 'idle',
                message: 'Ready whenever you are!',
                sessionId: 'preview',
              }),
          },
          {
            label: 'Thinking (Purple)',
            click: () =>
              actions.previewStatus({
                state: 'thinking',
                message: 'Analyzing authentication flow...',
                model: 'gemini-3-pro',
                sessionId: 'preview',
              }),
          },
          {
            label: 'Coding (Green)',
            click: () =>
              actions.previewStatus({
                state: 'coding',
                message: 'Editing App.tsx',
                model: 'gpt-5.5',
                sessionId: 'preview',
              }),
          },
          {
            label: 'Waiting for Approval (Amber)',
            click: () =>
              actions.previewStatus({
                state: 'waiting',
                message: 'Approval needed!',
                model: 'claude-sonnet-4',
                sessionId: 'preview',
              }),
          },
          {
            label: 'Success (Bright Green)',
            click: () =>
              actions.previewStatus({
                state: 'success',
                message: 'All tests passed!',
                model: 'gpt-5.5',
                sessionId: 'preview',
              }),
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Quit VibePet',
        click: () => actions.quit(),
      },
    ]);

    tray.setContextMenu(menu);
  }

  function init(initialState: TraySnapshot): void {
    try {
      tray = new Tray(createTrayImage(initialState.prefs.character));
      update(initialState);
    } catch (err) {
      console.error('[AI Pet Tray] Failed to initialize:', err instanceof Error ? err.message : err);
    }
  }

  function setCharacterIcon(character: CharacterType): void {
    if (!tray) return;
    tray.setImage(createTrayImage(character));
  }

  return { init, update, setCharacterIcon };
}
