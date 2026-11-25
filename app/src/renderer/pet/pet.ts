(() => {
  const { petAPI, PetCharacters, PetAudio } = window;
  const body = document.body;

  const bubbleEl = document.getElementById('speech-bubble') as HTMLElement;
  const bubbleTextEl = document.getElementById('bubble-text') as HTMLElement;
  const bubbleThoughtEl = document.getElementById('bubble-thought') as HTMLElement;
  const sourceBadgeEl = document.getElementById('source-badge') as HTMLElement;
  const projectBadgeEl = document.getElementById('project-badge') as HTMLElement;
  const modelRowEl = document.getElementById('model-row') as HTMLElement;
  const modelBadgeEl = document.getElementById('model-badge') as HTMLElement;
  const stateLabelEl = document.getElementById('state-label') as HTMLElement;
  const petZoneEl = document.getElementById('pet-zone') as HTMLElement;
  const characterHostEl = document.getElementById('character-host') as HTMLElement;

  const setupBtn = document.getElementById('setup-btn') as HTMLButtonElement;
  const muteBtn = document.getElementById('mute-btn') as HTMLButtonElement;
  const quitBtn = document.getElementById('quit-btn') as HTMLButtonElement;
  const iconSoundOn = document.getElementById('icon-sound-on') as HTMLElement;
  const iconSoundOff = document.getElementById('icon-sound-off') as HTMLElement;

  const STATE_LABELS: Record<RendererPetState, string> = {
    idle: 'READY',
    thinking: 'THINKING',
    coding: 'CODING',
    waiting: 'WAITING',
    success: 'DONE',
  };

  let isMuted = false;
  let hideBubbleTimer: number | null = null;
  let isIgnoringMouse = true;
  let isDragging = false;
  let lastScreenX = 0;
  let lastScreenY = 0;

  function renderCharacter(character: RendererCharacterType): void {
    body.setAttribute('data-character', character);
    characterHostEl.innerHTML = PetCharacters.getSvg(character);
  }

  function renderMuteUI(): void {
    iconSoundOn.style.display = isMuted ? 'none' : 'block';
    iconSoundOff.style.display = isMuted ? 'block' : 'none';
    muteBtn.classList.toggle('muted', isMuted);
    muteBtn.title = isMuted ? 'Unmute sound' : 'Mute sound';
  }

  function updateSourceBadge(source?: string): void {
    const raw = (source || '').trim();
    const lower = raw.toLowerCase();

    sourceBadgeEl.className = 'source-badge';
    if (!raw) {
      sourceBadgeEl.style.display = 'none';
      return;
    }

    sourceBadgeEl.style.display = 'inline-flex';
    if (lower.includes('antigravity') || lower === 'agy') {
      sourceBadgeEl.classList.add('antigravity');
      sourceBadgeEl.textContent = '✦ Antigravity';
    } else if (lower.includes('claude')) {
      sourceBadgeEl.classList.add('claude');
      sourceBadgeEl.textContent = '✳ Claude Code';
    } else if (lower.includes('codex')) {
      sourceBadgeEl.classList.add('codex');
      sourceBadgeEl.textContent = '◎ Codex';
    } else if (lower.includes('vscode') || lower.includes('vs code') || lower === 'code') {
      sourceBadgeEl.classList.add('vscode');
      sourceBadgeEl.textContent = '⌘ VS Code';
    } else {
      sourceBadgeEl.textContent = `● ${raw}`;
    }
  }

  function hideBubble(): void {
    bubbleEl.classList.remove('visible');
  }

  function clearTimers(): void {
    if (hideBubbleTimer !== null) {
      window.clearTimeout(hideBubbleTimer);
      hideBubbleTimer = null;
    }
  }

  function applyStatus(payload: RendererPetStatus, opts: { playSound?: boolean } = {}): void {
    const playSound = opts.playSound ?? true;
    clearTimers();

    const validState: RendererPetState =
      payload.state && payload.state in STATE_LABELS ? payload.state : 'idle';
    body.setAttribute('data-state', validState);
    stateLabelEl.textContent = STATE_LABELS[validState];

    updateSourceBadge(payload.source);

    const trimmedProject = (payload.project || '').trim();
    if (trimmedProject) {
      projectBadgeEl.textContent = trimmedProject;
      projectBadgeEl.classList.add('visible');
    } else {
      projectBadgeEl.textContent = '';
      projectBadgeEl.classList.remove('visible');
    }

    const trimmedModel = (payload.model || '').trim();
    if (trimmedModel) {
      modelBadgeEl.textContent = `⚡ ${trimmedModel}`;
      modelRowEl.classList.add('visible');
    } else {
      modelBadgeEl.textContent = '';
      modelRowEl.classList.remove('visible');
    }

    const trimmedMsg = (payload.message || '').trim();
    const trimmedDetail = (payload.detail || payload.thought || '').trim();

    if (trimmedMsg || trimmedDetail) {
      bubbleTextEl.textContent = trimmedMsg || STATE_LABELS[validState];
      if (trimmedDetail) {
        bubbleThoughtEl.textContent = `💭 ${trimmedDetail}`;
        bubbleThoughtEl.classList.add('visible');
      } else {
        bubbleThoughtEl.textContent = '';
        bubbleThoughtEl.classList.remove('visible');
      }
      bubbleEl.classList.add('visible');
    } else {
      hideBubble();
    }

    if (playSound) {
      PetAudio.playStateSound(validState, isMuted);
    }

    if (validState === 'idle' && (trimmedMsg || trimmedDetail)) {
      hideBubbleTimer = window.setTimeout(hideBubble, 6000);
    }
  }

  setupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    petAPI.openSetup();
  });

  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    petAPI.toggleMute();
  });

  quitBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    petAPI.quitApp();
  });

  bubbleEl.addEventListener('click', (e) => {
    e.stopPropagation();
    hideBubble();
  });

  petAPI.onStatusUpdate((payload) => applyStatus(payload, { playSound: true }));
  petAPI.onCharacterChange((character) => renderCharacter(character));
  petAPI.onMuteChange((muted) => {
    isMuted = Boolean(muted);
    renderMuteUI();
    if (!isMuted) PetAudio.playStateSound('coding', false);
  });

  function setIgnoreMouse(ignore: boolean): void {
    if (isIgnoringMouse === ignore) return;
    isIgnoringMouse = ignore;
    petAPI.setIgnoreMouseEvents(ignore, { forward: true });
  }

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.screenX - lastScreenX;
      const dy = e.screenY - lastScreenY;
      if (dx !== 0 || dy !== 0) {
        lastScreenX = e.screenX;
        lastScreenY = e.screenY;
        petAPI.moveWindowBy(dx, dy);
      }
      return;
    }

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const overInteractive = Boolean(el && el.closest('.interactive'));
    setIgnoreMouse(!overInteractive);
  });

  window.addEventListener('mouseleave', () => {
    if (!isDragging) setIgnoreMouse(true);
  });

  window.addEventListener('blur', () => {
    if (!isDragging) setIgnoreMouse(true);
  });

  petZoneEl.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement | null;
    if (e.button !== 0 || target?.closest('button')) return;
    isDragging = true;
    lastScreenX = e.screenX;
    lastScreenY = e.screenY;
    petZoneEl.classList.add('dragging');
    setIgnoreMouse(false);
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    petZoneEl.classList.remove('dragging');
  });

  petAPI.getInit().then(({ character, muted }) => {
    isMuted = Boolean(muted);
    renderCharacter(character || 'cat');
    renderMuteUI();
    applyStatus(
      {
        state: 'idle',
        message: 'VibePet is ready!',
        detail: 'Drag me anywhere or click the gear icon to switch characters & connect IDEs.',
        source: 'vibepet',
      },
      { playSound: false }
    );
  });
})();
