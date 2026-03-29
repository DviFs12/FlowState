/**
 * FlowState — settings.js
 * Settings page: theme, profile, pomodoro config, data export/import/reset
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('save-profile')) return;

  /* ─── LOAD SETTINGS ─── */
  const settings = Store.get('settings', {});

  /* ─── PROFILE ─── */
  const usernameInput = document.getElementById('setting-username');
  const avatarInput   = document.getElementById('setting-avatar');

  if (usernameInput) usernameInput.value = settings.username || '';
  if (avatarInput)   avatarInput.value   = settings.avatar   || '';

  // Avatar presets
  document.querySelectorAll('[data-avatar]').forEach(el => {
    el.addEventListener('click', () => {
      if (avatarInput) avatarInput.value = el.dataset.avatar;
    });
  });

  document.getElementById('save-profile')?.addEventListener('click', () => {
    settings.username = usernameInput?.value.trim() || 'Usuário';
    settings.avatar   = avatarInput?.value.trim() || settings.username.charAt(0).toUpperCase();
    Store.set('settings', settings);
    Profile.init();
    Toast.show('Perfil salvo!', 'success');
  });

  /* ─── THEME ─── */
  const themeRadios = document.querySelectorAll('input[name="theme"]');
  const customColors = document.getElementById('custom-colors');
  const currentTheme = settings.theme || 'dark';

  // Set active radio
  themeRadios.forEach(r => {
    r.checked = r.value === currentTheme;
    if (r.value === 'custom' && currentTheme === 'custom') {
      customColors?.classList.add('visible');
    }
  });

  themeRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.value === 'custom') {
        customColors?.classList.add('visible');
      } else {
        customColors?.classList.remove('visible');
      }
    });
  });

  // Color inputs sync
  syncColorInputs('color-primary', 'color-primary-text');
  syncColorInputs('color-bg',      'color-bg-text');
  syncColorInputs('color-surface', 'color-surface-text');

  // Load saved custom colors
  const cc = settings.customColors || {};
  if (cc.primary) {
    setColorInputs('color-primary', 'color-primary-text', cc.primary);
  }
  if (cc.bg) {
    setColorInputs('color-bg', 'color-bg-text', cc.bg);
  }
  if (cc.surface) {
    setColorInputs('color-surface', 'color-surface-text', cc.surface);
  }

  document.getElementById('save-theme')?.addEventListener('click', () => {
    const selected = [...themeRadios].find(r => r.checked)?.value || 'dark';
    settings.theme = selected;

    if (selected === 'custom') {
      settings.customColors = {
        primary: document.getElementById('color-primary')?.value || '#6ee7b7',
        bg:      document.getElementById('color-bg')?.value      || '#0a0a0f',
        surface: document.getElementById('color-surface')?.value || '#13131f'
      };
    }

    Store.set('settings', settings);
    ThemeManager.apply(selected, settings.customColors);
    Toast.show('Tema aplicado!', 'success');
    window.dispatchEvent(new Event('themechange'));
  });

  /* ─── POMODORO SETTINGS ─── */
  const ranges = [
    { id: 'pomo-focus',  valId: 'pomo-focus-val',  suffix: ' min',    key: 'pomodoroFocus'  },
    { id: 'pomo-short',  valId: 'pomo-short-val',  suffix: ' min',    key: 'pomodoroShort'  },
    { id: 'pomo-long',   valId: 'pomo-long-val',   suffix: ' min',    key: 'pomodoroLong'   },
    { id: 'pomo-cycles', valId: 'pomo-cycles-val', suffix: ' ciclos', key: 'pomodoroCycles' }
  ];

  ranges.forEach(({ id, valId, suffix, key }) => {
    const input = document.getElementById(id);
    const label = document.getElementById(valId);
    if (!input || !label) return;

    if (settings[key]) input.value = settings[key];
    label.textContent = input.value + suffix;

    input.addEventListener('input', () => {
      label.textContent = input.value + suffix;
    });
  });

  const notifyToggle = document.getElementById('pomo-notify');
  const soundToggle  = document.getElementById('pomo-sound');
  if (notifyToggle) notifyToggle.checked = settings.pomodoroNotify !== false;
  if (soundToggle)  soundToggle.checked  = settings.pomodoroSound  !== false;

  document.getElementById('save-pomodoro')?.addEventListener('click', () => {
    ranges.forEach(({ id, key }) => {
      const input = document.getElementById(id);
      if (input) settings[key] = parseInt(input.value);
    });
    settings.pomodoroNotify = notifyToggle?.checked ?? true;
    settings.pomodoroSound  = soundToggle?.checked  ?? true;
    Store.set('settings', settings);

    if (settings.pomodoroNotify) {
      requestNotificationPermission();
    }

    Toast.show('Configurações salvas!', 'success');
  });

  /* ─── EXPORT ─── */
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const data = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tasks:    Store.get('tasks',    []),
      settings: Store.get('settings', {}),
      stats:    {}
    };

    // Collect all stats keys
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('flowstate_stats_')) {
        const shortKey = k.replace('flowstate_stats_', '');
        try { data.stats[shortKey] = JSON.parse(localStorage.getItem(k)); } catch {}
      }
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `flowstate-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('Dados exportados!', 'success');
  });

  /* ─── IMPORT ─── */
  document.getElementById('btn-import')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version) throw new Error('Formato inválido');

        if (data.tasks)    Store.set('tasks',    data.tasks);
        if (data.settings) Store.set('settings', data.settings);
        if (data.stats) {
          Object.entries(data.stats).forEach(([key, val]) => {
            Store.set('stats_' + key, val);
          });
        }

        Toast.show('Dados importados com sucesso!', 'success', 4000);
        setTimeout(() => location.reload(), 1500);
      } catch {
        Toast.show('Erro ao importar: arquivo inválido', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ─── RESET ─── */
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    openModal('confirm-modal');
  });

  document.getElementById('close-confirm')?.addEventListener('click', () => closeModal('confirm-modal'));
  document.getElementById('cancel-confirm')?.addEventListener('click', () => closeModal('confirm-modal'));

  document.getElementById('confirm-action')?.addEventListener('click', () => {
    Store.clear();
    closeModal('confirm-modal');
    Toast.show('Todos os dados foram resetados', 'info');
    setTimeout(() => location.reload(), 1200);
  });

  /* ─── HELPERS ─── */
  function syncColorInputs(colorId, textId) {
    const colorInput = document.getElementById(colorId);
    const textInput  = document.getElementById(textId);
    if (!colorInput || !textInput) return;

    colorInput.addEventListener('input', () => {
      textInput.value = colorInput.value;
    });
    textInput.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(textInput.value)) {
        colorInput.value = textInput.value;
      }
    });
  }

  function setColorInputs(colorId, textId, value) {
    const c = document.getElementById(colorId);
    const t = document.getElementById(textId);
    if (c) c.value = value;
    if (t) t.value = value;
  }
});
