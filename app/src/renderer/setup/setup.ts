(() => {
  const { setupAPI } = window;
  const charButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.char-card'));
  const listEl = document.getElementById('integrations-list') as HTMLElement;
  const doneBtn = document.getElementById('done-btn') as HTMLButtonElement;

  const SHORT_NAMES: Record<string, string> = {
    antigravity: 'Antigravity',
    vscode: 'VS Code',
    codex: 'Codex',
    'claude-code': 'Claude Code',
  };

  function renderCharacterSelection(activeChar: RendererCharacterType): void {
    charButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.char === activeChar);
    });
  }

  function renderIntegrations(integrations: RendererIntegrationInfo[]): void {
    listEl.innerHTML = '';

    integrations.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'int-row';

      const left = document.createElement('div');
      left.className = 'int-left';

      const dot = document.createElement('span');
      dot.className = item.connected
        ? 'status-dot connected'
        : item.detected
          ? 'status-dot detected'
          : 'status-dot';

      const nameEl = document.createElement('span');
      nameEl.className = 'int-name';
      nameEl.textContent = SHORT_NAMES[item.id] || item.name;

      left.appendChild(dot);
      left.appendChild(nameEl);

      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'switch';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = item.connected;

      checkbox.addEventListener('change', async () => {
        checkbox.disabled = true;
        if (checkbox.checked) {
          const res = await setupAPI.connect([item.id]);
          renderIntegrations(res.integrations);
        } else {
          const res = await setupAPI.disconnect(item.id);
          renderIntegrations(res.integrations);
        }
      });

      const slider = document.createElement('span');
      slider.className = 'slider';

      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(slider);

      row.appendChild(left);
      row.appendChild(toggleLabel);
      listEl.appendChild(row);
    });
  }

  charButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextChar = btn.dataset.char as RendererCharacterType | undefined;
      if (!nextChar) return;
      renderCharacterSelection(nextChar);
      await setupAPI.setCharacter(nextChar);
    });
  });

  doneBtn.addEventListener('click', () => {
    setupAPI.dismiss();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setupAPI.dismiss();
  });

  setupAPI.getState().then(({ character, integrations }) => {
    renderCharacterSelection(character);
    renderIntegrations(integrations);
  });
})();
