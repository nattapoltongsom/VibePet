(() => {
  const { setupAPI } = window;
  const charButtons = Array.from(document.querySelectorAll('.char-card'));
  const listEl = document.getElementById('integrations-list');
  const connectBtn = document.getElementById('connect-btn');
  const skipBtn = document.getElementById('skip-btn');
  const bannerEl = document.getElementById('feedback-banner');

  const selectedIds = new Set();

  function showBanner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.add('visible');
  }

  function renderCharacterSelection(activeChar) {
    charButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.char === activeChar);
    });
  }

  function renderIntegrations(integrations, preselectDetected = false) {
    listEl.innerHTML = '';

    integrations.forEach((item) => {
      if (preselectDetected && (item.detected || item.connected)) {
        selectedIds.add(item.id);
      }

      const row = document.createElement('div');
      row.className = 'int-row';

      const left = document.createElement('label');
      left.className = 'int-left';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedIds.has(item.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedIds.add(item.id);
        else selectedIds.delete(item.id);
      });

      const info = document.createElement('div');
      info.className = 'int-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'int-title-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'int-name';
      nameEl.textContent = item.name;
      titleRow.appendChild(nameEl);

      if (item.connected) {
        const badge = document.createElement('span');
        badge.className = 'pill pill-connected';
        badge.textContent = 'Connected ✓';
        titleRow.appendChild(badge);
      } else if (item.detected) {
        const badge = document.createElement('span');
        badge.className = 'pill pill-detected';
        badge.textContent = 'Detected';
        titleRow.appendChild(badge);
      } else {
        const badge = document.createElement('span');
        badge.className = 'pill pill-notfound';
        badge.textContent = 'Not detected';
        titleRow.appendChild(badge);
      }

      const descEl = document.createElement('p');
      descEl.className = 'int-desc';
      descEl.textContent = item.description;

      const filesEl = document.createElement('div');
      filesEl.className = 'int-files';
      filesEl.textContent = `Updates: ${item.files.join(', ')}`;

      info.appendChild(titleRow);
      info.appendChild(descEl);
      info.appendChild(filesEl);

      left.appendChild(checkbox);
      left.appendChild(info);
      row.appendChild(left);

      if (item.connected) {
        const disconnectBtn = document.createElement('button');
        disconnectBtn.type = 'button';
        disconnectBtn.className = 'disconnect-btn';
        disconnectBtn.textContent = 'Disconnect';
        disconnectBtn.addEventListener('click', async () => {
          const res = await setupAPI.disconnect(item.id);
          selectedIds.delete(item.id);
          renderIntegrations(res.integrations, false);
          showBanner(`Disconnected ${item.name}. Only AI Pet entries were removed.`);
        });
        row.appendChild(disconnectBtn);
      }

      listEl.appendChild(row);
    });
  }

  charButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextChar = btn.dataset.char;
      renderCharacterSelection(nextChar);
      await setupAPI.setCharacter(nextChar);
    });
  });

  connectBtn.addEventListener('click', async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showBanner('Select at least one AI tool above to connect.');
      return;
    }
    connectBtn.disabled = true;
    const res = await setupAPI.connect(ids);
    connectBtn.disabled = false;
    renderIntegrations(res.integrations, false);
    const okCount = res.results.filter((r) => r.ok).length;
    showBanner(`Connected ${okCount} tool(s)! Reload your IDE or open a new chat to start receiving live updates.`);
  });

  skipBtn.addEventListener('click', () => {
    setupAPI.dismiss();
  });

  setupAPI.getState().then(({ character, integrations }) => {
    renderCharacterSelection(character);
    renderIntegrations(integrations, true);
  });
})();
