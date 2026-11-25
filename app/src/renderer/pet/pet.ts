(() => {
  const { petAPI, PetCharacters, PetAudio } = window;
  const body = document.body;

  const bubbleEl = document.getElementById('speech-bubble') as HTMLElement;
  const singleTaskViewEl = document.getElementById('single-task-view') as HTMLElement;
  const taskListEl = document.getElementById('task-list') as HTMLElement;
  const bubbleTextEl = document.getElementById('bubble-text') as HTMLElement;
  const modelPillEl = document.getElementById('model-pill') as HTMLElement;
  const modelBadgeEl = document.getElementById('model-badge') as HTMLElement;
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

  function hideBubble(): void {
    bubbleEl.classList.remove('visible');
  }

  function clearTimers(): void {
    if (hideBubbleTimer !== null) {
      window.clearTimeout(hideBubbleTimer);
      hideBubbleTimer = null;
    }
  }

  function renderMultiTasks(tasks: RendererActiveTask[]): void {
    taskListEl.innerHTML = '';
    for (const task of tasks) {
      const row = document.createElement('div');
      row.className = 'task-row';

      const dot = document.createElement('span');
      const taskState: RendererPetState = task.state in STATE_LABELS ? task.state : 'idle';
      dot.className = `task-dot ${taskState}`;
      row.appendChild(dot);

      const msgEl = document.createElement('div');
      msgEl.className = 'task-msg';
      msgEl.textContent = task.message || STATE_LABELS[taskState];
      row.appendChild(msgEl);

      taskListEl.appendChild(row);
    }
  }

  function updateModelPill(payload: RendererPetStatus): void {
    const models: string[] = [];
    if (Array.isArray(payload.tasks) && payload.tasks.length > 0) {
      for (const task of payload.tasks) {
        const m = (task.model || '').trim();
        if (m && !models.includes(m)) models.push(m);
      }
    } else {
      const m = (payload.model || '').trim();
      if (m) models.push(m);
    }

    if (models.length > 0) {
      modelBadgeEl.textContent = models.join(' · ');
      modelPillEl.classList.add('visible');
    } else {
      modelBadgeEl.textContent = '';
      modelPillEl.classList.remove('visible');
    }
  }

  function applyStatus(payload: RendererPetStatus, opts: { playSound?: boolean } = {}): void {
    const playSound = opts.playSound ?? true;
    clearTimers();

    const validState: RendererPetState =
      payload.state && payload.state in STATE_LABELS ? payload.state : 'idle';
    body.setAttribute('data-state', validState);

    updateModelPill(payload);

    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];

    if (tasks.length > 1) {
      singleTaskViewEl.style.display = 'none';
      renderMultiTasks(tasks);
      taskListEl.classList.add('visible');
      bubbleEl.classList.add('visible');
    } else {
      taskListEl.classList.remove('visible');
      taskListEl.innerHTML = '';
      singleTaskViewEl.style.display = 'flex';

      const trimmedMsg = (payload.message || '').trim();
      if (trimmedMsg) {
        bubbleTextEl.textContent = trimmedMsg;
        bubbleEl.classList.add('visible');
      } else {
        hideBubble();
      }
    }

    if (playSound) {
      PetAudio.playStateSound(validState, isMuted);
    }

    if (validState === 'idle' && (payload.message || '').trim()) {
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
      },
      { playSound: false }
    );
  });
})();
