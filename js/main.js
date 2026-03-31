/**
 * FlowState — main.js
 * Core utilities: Store, Toast, ThemeManager, Sidebar, Profile, helpers.
 *
 * Load order on every page:
 *   1. Supabase CDN  (window.supabase)
 *   2. /api/env.js   (window.__ENV)
 *   3. main.js       ← this file (defines Store, Toast, etc.)
 *   4. supabase.js   (patches Store.set, defines Auth/Sync)
 *   5. page-*.js     (page-specific logic)
 *   DOMContentLoaded → Auth.init()
 */

/* ─── STORAGE ──────────────────────────────────────────── */
const Store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem('flowstate_' + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('flowstate_' + key, JSON.stringify(value)); } catch {}
  },
  remove(key) { localStorage.removeItem('flowstate_' + key); },
  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('flowstate_'))
      .forEach(k => localStorage.removeItem(k));
  }
};

/* ─── TOAST ────────────────────────────────────────────── */
const Toast = {
  _container: null,
  _init() {
    if (this._container) return;
    this._container = document.createElement('div');
    this._container.className = 'toast-container';
    document.body.appendChild(this._container);
  },
  show(message, type = 'info', duration = 3000) {
    this._init();
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    this._container.appendChild(el);
    setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 350); }, duration);
  }
};

/* ─── THEME ────────────────────────────────────────────── */
const ThemeManager = {
  init() {
    const s = Store.get('settings', {});
    this.apply(s.theme || 'dark', s.customColors);
  },
  apply(theme, colors = null) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'custom' && colors) {
      const r = document.documentElement;
      r.style.setProperty('--custom-primary', colors.primary || '#6ee7b7');
      r.style.setProperty('--custom-bg',      colors.bg      || '#0a0a0f');
      r.style.setProperty('--custom-surface',  colors.surface || '#13131f');
    }
  }
};

/* ─── SIDEBAR ──────────────────────────────────────────── */
const Sidebar = {
  init() {
    const sidebar   = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay   = document.getElementById('sidebar-overlay');
    if (!sidebar || !hamburger) return;
    hamburger.addEventListener('click',  () => this._toggle(sidebar, hamburger, overlay));
    overlay?.addEventListener('click',   () => this._close(sidebar, hamburger, overlay));
  },
  _toggle(s, h, o) {
    const open = s.classList.toggle('open');
    h.classList.toggle('open', open);
    o?.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  },
  _close(s, h, o) {
    s.classList.remove('open');
    h.classList.remove('open');
    o?.classList.remove('open');
    document.body.style.overflow = '';
  }
};

/* ─── PROFILE (UI only — reads from Store, which is populated by Sync.pull) ── */
const Profile = {
  init() {
    const s      = Store.get('settings', {});
    // Auth may or may not be loaded yet — use fallback chain
    const email  = (typeof Auth !== 'undefined' && Auth.email) || '';
    const name   = s.username || email.split('@')[0] || 'Usuário';
    const avatar = s.avatar   || name.charAt(0).toUpperCase() || 'F';

    document.querySelectorAll('#sidebar-username, #mobile-username').forEach(el => {
      el.textContent = name;
    });
    document.querySelectorAll('#user-avatar, #mobile-avatar').forEach(el => {
      el.textContent = avatar;
    });

    const greet = document.getElementById('greeting-text');
    if (greet) {
      const h  = new Date().getHours();
      const gr = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
      greet.textContent = `${gr}, ${name}! Pronto para focar?`;
    }
  }
};

/* ─── DATE DISPLAY ─────────────────────────────────────── */
function initDate() {
  const el = document.getElementById('current-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

/* ─── ANIMATE ON SCROLL ────────────────────────────────── */
function initAnimations() {
  const items = document.querySelectorAll('[data-animate]');
  if (!items.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('in-view'), i * 60);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  items.forEach(el => obs.observe(el));
}

/* ─── MODALS ───────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id)?.classList.add('open');    }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ─── NOTIFICATIONS ────────────────────────────────────── */
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '../icons/icon-192.png' });
  }
}

/* ─── SOUND ALERT ──────────────────────────────────────── */
function playAlertSound() {
  if (Store.get('settings', {}).pomodoroSound === false) return;
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
    const tones = [523.25, 659.25, 783.99];
    tones.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      osc.start(t); osc.stop(t + 0.18);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    });
  } catch {}
}

/* ─── DATE HELPERS ─────────────────────────────────────── */
function todayKey() {
  return new Date().toISOString().split('T')[0];
}

/* ─── STATS ────────────────────────────────────────────── */
function getTodayStats() {
  return Store.get('stats_' + todayKey(), { focusSeconds: 0, tasksCompleted: 0, pomoCycles: 0 });
}
function saveTodayStats(stats) {
  Store.set('stats_' + todayKey(), stats);
}

/* ─── ESCAPE HTML ──────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── BOOT ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  Sidebar.init();
  Profile.init();
  initDate();
  initAnimations();
});
