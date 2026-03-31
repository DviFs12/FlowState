/**
 * FlowState — settings.js
 * Settings page logic. Store.set is already patched by supabase.js to auto-sync.
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('save-profile')) return;

  const settings = Store.get('settings', {});

  /* ─── PROFILE ─── */
  const usernameInput = document.getElementById('setting-username');
  const avatarInput   = document.getElementById('setting-avatar');
  if (usernameInput) usernameInput.value = settings.username || '';
  if (avatarInput)   avatarInput.value   = settings.avatar   || '';

  document.querySelectorAll('[data-avatar]').forEach(el => {
    el.addEventListener('click', () => {
      if (avatarInput) avatarInput.value = el.dataset.avatar;
    });
  });

  document.getElementById('save-profile')?.addEventListener('click', () => {
    const s      = Store.get('settings', {});
    s.username   = usernameInput?.value.trim() || 'Usuário';
    s.avatar     = avatarInput?.value.trim()   || s.username.charAt(0).toUpperCase();
    Store.set('settings', s);  // supabase.js patch auto-syncs this
    Profile.init();
    Toast.show('Perfil salvo!', 'success');
  });

  /* ─── THEME ─── */
  const themeRadios  = document.querySelectorAll('input[name="theme"]');
  const customColors = document.getElementById('custom-colors');
  const currentTheme = settings.theme || 'dark';

  themeRadios.forEach(r => {
    r.checked = r.value === currentTheme;
    if (r.value === 'custom' && currentTheme === 'custom') customColors?.classList.add('visible');
    r.addEventListener('change', () => {
      customColors?.classList.toggle('visible', r.value === 'custom');
    });
  });

  _syncColorInputs('color-primary', 'color-primary-text');
  _syncColorInputs('color-bg',      'color-bg-text');
  _syncColorInputs('color-surface', 'color-surface-text');

  const cc = settings.customColors || {};
  if (cc.primary) _setColor('color-primary', 'color-primary-text', cc.primary);
  if (cc.bg)      _setColor('color-bg',      'color-bg-text',      cc.bg);
  if (cc.surface) _setColor('color-surface', 'color-surface-text', cc.surface);

  document.getElementById('save-theme')?.addEventListener('click', () => {
    const selected = [...themeRadios].find(r => r.checked)?.value || 'dark';
    const s        = Store.get('settings', {});
    s.theme        = selected;
    if (selected === 'custom') {
      s.customColors = {
        primary: document.getElementById('color-primary')?.value || '#6ee7b7',
        bg:      document.getElementById('color-bg')?.value      || '#0a0a0f',
        surface: document.getElementById('color-surface')?.value || '#13131f'
      };
    }
    Store.set('settings', s);
    ThemeManager.apply(selected, s.customColors);
    window.dispatchEvent(new Event('themechange'));
    Toast.show('Tema aplicado!', 'success');
  });

  /* ─── POMODORO ─── */
  const ranges = [
    { id:'pomo-focus',  val:'pomo-focus-val',  suffix:' min',    key:'pomodoroFocus'  },
    { id:'pomo-short',  val:'pomo-short-val',  suffix:' min',    key:'pomodoroShort'  },
    { id:'pomo-long',   val:'pomo-long-val',   suffix:' min',    key:'pomodoroLong'   },
    { id:'pomo-cycles', val:'pomo-cycles-val', suffix:' ciclos', key:'pomodoroCycles' }
  ];

  ranges.forEach(({ id, val, suffix, key }) => {
    const input = document.getElementById(id);
    const label = document.getElementById(val);
    if (!input || !label) return;
    if (settings[key]) input.value = settings[key];
    label.textContent = input.value + suffix;
    input.addEventListener('input', () => { label.textContent = input.value + suffix; });
  });

  const notifyToggle = document.getElementById('pomo-notify');
  const soundToggle  = document.getElementById('pomo-sound');
  if (notifyToggle) notifyToggle.checked = settings.pomodoroNotify !== false;
  if (soundToggle)  soundToggle.checked  = settings.pomodoroSound  !== false;

  document.getElementById('save-pomodoro')?.addEventListener('click', () => {
    const s = Store.get('settings', {});
    ranges.forEach(({ id, key }) => {
      const input = document.getElementById(id);
      if (input) s[key] = parseInt(input.value);
    });
    s.pomodoroNotify = notifyToggle?.checked ?? true;
    s.pomodoroSound  = soundToggle?.checked  ?? true;
    Store.set('settings', s);
    if (s.pomodoroNotify) requestNotificationPermission();
    Toast.show('Configurações salvas!', 'success');
  });

  /* ─── EXPORT ─── */
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const data = {
      version:    '1.0.0',
      exportedAt: new Date().toISOString(),
      tasks:      Store.get('tasks',    []),
      settings:   Store.get('settings', {}),
      stats:      {}
    };
    Object.keys(localStorage)
      .filter(k => k.startsWith('flowstate_stats_'))
      .forEach(k => {
        try { data.stats[k.replace('flowstate_stats_', '')] = JSON.parse(localStorage.getItem(k)); } catch {}
      });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a   = document.createElement('a');
    a.href = url; a.download = `flowstate-backup-${todayKey()}.json`; a.click();
    URL.revokeObjectURL(url);
    Toast.show('Dados exportados!', 'success');
  });

  /* ─── IMPORT ─── */
  document.getElementById('btn-import')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version) throw new Error('Formato inválido');
        if (data.tasks)    Store.set('tasks',    data.tasks);
        if (data.settings) Store.set('settings', data.settings);
        if (data.stats)    Object.entries(data.stats).forEach(([k, v]) => Store.set('stats_' + k, v));
        Toast.show('Dados importados! Recarregando…', 'success', 2000);
        setTimeout(() => location.reload(), 1800);
      } catch { Toast.show('Arquivo inválido', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ─── RESET ─── */
  document.getElementById('btn-reset')?.addEventListener('click',   () => openModal('confirm-modal'));
  document.getElementById('close-confirm')?.addEventListener('click',() => closeModal('confirm-modal'));
  document.getElementById('cancel-confirm')?.addEventListener('click',() => closeModal('confirm-modal'));

  document.getElementById('confirm-action')?.addEventListener('click', async () => {
    Store.clear();
    closeModal('confirm-modal');
    Toast.show('Dados locais apagados.', 'info');
    // If Supabase is active, sign out fully; otherwise just reload
    if (typeof Auth !== 'undefined' && Auth.uid) {
      await Auth.signOut();
    } else {
      setTimeout(() => location.reload(), 1000);
    }
  });

  /* ─── HELPERS ─── */
  function _syncColorInputs(colorId, textId) {
    const c = document.getElementById(colorId);
    const t = document.getElementById(textId);
    if (!c || !t) return;
    c.addEventListener('input', () => { t.value = c.value; });
    t.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(t.value)) c.value = t.value; });
  }
  function _setColor(colorId, textId, value) {
    const c = document.getElementById(colorId);
    const t = document.getElementById(textId);
    if (c) c.value = value;
    if (t) t.value = value;
  }
});
