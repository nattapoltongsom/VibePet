(() => {
  const { petAPI, PetCharacters, PetAudio } = window;
  const body = document.body;

  const bubbleEl = document.getElementById('speech-bubble');
  const bubbleTextEl = document.getElementById('bubble-text');
  const bubbleThoughtEl = document.getElementById('bubble-thought');
  const sourceBadgeEl = document.getElementById('source-badge');
  const projectBadgeEl = document.getElementById('project-badge');
  const modelRowEl = document.getElementById('model-row');
  const modelBadgeEl = document.getElementById('model-badge');
  const stateLabelEl = document.getElementById('state-label');
  const petZoneEl = document.getElementById('pet-zone');
  const characterHostEl = document.getElementById('character-host');

  const setupBtn = document.getElementById('setup-btn');
  const muteBtn = document.getElementById('mute-btn');
  const quitBtn = document.getElementById('quit-btn');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');

  const STATE_LABELS = {
    idle: 'READY',
    thinking: 'THINKING',
    coding: 'CODING',
    waiting: 'WAITING',
    success: 'DONE',
  };

  let isMuted = false;
  let hideBubbleTimer = null;
  let isIgnoringMouse = true;
  let isDragging = false;
  let lastScreenX = 0;
  let lastScreenY = 0;

  function renderCharacter(character) {
    body.setAttribute('data-character', character);
    characterHostEl.innerHTML = PetCharacters.getSvg(character);
  }

  function renderMuteUI() {
    iconSoundOn.style.display = isMuted ? 'none' : 'block';
    iconSoundOff.style.display = isMuted ? 'block' : 'none';
    muteBtn.classList.toggle('muted', isMuted);
    muteBtn.title = isMuted ? 'Unmute sound' : 'Mute sound';
  }

  function updateSourceBadge(source) {
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

  function hideBubble() {
    bubbleEl.classList.remove('visible');
  }

  function clearTimers() {
    if (hideBubbleTimer) {
      clearTimeout(hideBubbleTimer);
      hideBubbleTimer = null;
    }
  }

  function applyStatus(
    { state = 'idle', message = '', detail = '', thought = '', project = '', model = '', source = '' },
    { playSound = true } = {}
  ) {
    clearTimers();

    const validState = STATE_LABELS[state] ? state : 'idle';
    body.setAttribute('data-state', validState);
    stateLabelEl.textContent = STATE_LABELS[validState];

    updateSourceBadge(source);

    const trimmedProject = (project || '').trim();
    if (trimmedProject) {
      projectBadgeEl.textContent = trimmedProject;
      projectBadgeEl.classList.add('visible');
    } else {
      projectBadgeEl.textContent = '';
      projectBadgeEl.classList.remove('visible');
    }

    const trimmedModel = (model || '').trim();
    if (trimmedModel) {
      modelBadgeEl.textContent = `⚡ ${trimmedModel}`;
      modelRowEl.classList.add('visible');
    } else {
      modelBadgeEl.textContent = '';
      modelRowEl.classList.remove('visible');
    }

    const trimmedMsg = (message || '').trim();
    const trimmedDetail = (detail || thought || '').trim();

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
      hideBubbleTimer = setTimeout(hideBubble, 6000);
    }
  }

  // ===== Controls =====
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

  // ===== IPC Listeners =====
  petAPI.onStatusUpdate((payload) => applyStatus(payload, { playSound: true }));
  petAPI.onCharacterChange((character) => renderCharacter(character));
  petAPI.onMuteChange((muted) => {
    isMuted = Boolean(muted);
    renderMuteUI();
    if (!isMuted) PetAudio.playStateSound('coding', false);
  });

  // ===== Click-through & Smooth Dragging =====
  function setIgnoreMouse(ignore) {
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
    if (e.button !== 0 || e.target.closest('button')) return;
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

  // ===== Bootstrap =====
  petAPI.getInit().then(({ character, muted }) => {
    isMuted = Boolean(muted);
    renderCharacter(character || 'cat');
    renderMuteUI();
    applyStatus(
      {
        state: 'idle',
        message: 'AI Pet is ready!',
        detail: 'Drag me anywhere or click the gear icon to switch characters & connect IDEs.',
        source: 'ai-pet',
      },
      { playSound: false }
    );
  });
})();
