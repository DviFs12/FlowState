/**
 * FlowState — main.js
 * Shared utilities: storage, theme, sidebar, notifications, toasts
 */

/* ─── STORAGE HELPERS ─── */
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
  remove(key) {
    localStorage.removeItem('flowstate_' + key);
  },
  clear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('flowstate_'));
    keys.forEach(k => localStorage.removeItem(k));
  }
};

/* ─── TOAST NOTIFICATIONS ─── */
const Toast = {
  container: null,

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3000) {
    if (!this.container) this.init();
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span style="font-size:14px">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }
};

/* ─── THEME MANAGER ─── */
const ThemeManager = {
  init() {
    const saved = Store.get('settings', {});
    const theme = saved.theme || 'dark';
    this.apply(theme, saved.customColors);
  },

  apply(theme, colors = null) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'custom' && colors) {
      const root = document.documentElement;
      root.style.setProperty('--custom-primary', colors.primary || '#6ee7b7');
      root.style.setProperty('--custom-bg', colors.bg || '#0a0a0f');
      root.style.setProperty('--custom-surface', colors.surface || '#13131f');
    }
  }
};

/* ─── SIDEBAR ─── */
const Sidebar = {
  init() {
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !hamburger) return;

    hamburger.addEventListener('click', () => this.toggle(sidebar, hamburger, overlay));
    overlay?.addEventListener('click', () => this.close(sidebar, hamburger, overlay));
  },

  toggle(sidebar, hamburger, overlay) {
    const isOpen = sidebar.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    overlay?.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },

  close(sidebar, hamburger, overlay) {
    sidebar.classList.remove('open');
    hamburger.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
  }
};

/* ─── USER PROFILE ─── */
const Profile = {
  init() {
    const settings = Store.get('settings', {});
    const name = settings.username || 'Usuário';
    const avatar = settings.avatar || name.charAt(0).toUpperCase();

    ['sidebar-username'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = name;
    });

    ['user-avatar', 'mobile-avatar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = avatar;
    });

    // Greeting
    const greetEl = document.getElementById('greeting-text');
    if (greetEl) {
      const h = new Date().getHours();
      let gr = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
      greetEl.textContent = `${gr}, ${name}! Pronto para focar?`;
    }
  }
};

/* ─── DATE DISPLAY ─── */
function initDate() {
  const el = document.getElementById('current-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

/* ─── ANIMATE ON VIEW ─── */
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

/* ─── MODAL HELPERS ─── */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

/* ─── NOTIFICATION PERMISSION ─── */
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'icons/icon-192.png' });
  }
}

/* ─── SOUND ALERT ─── */
function playAlertSound() {
  const settings = Store.get('settings', {});
  if (settings.pomodoroSound === false) return;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tones = [523.25, 659.25, 783.99]; // C5 E5 G5

    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = ctx.currentTime + i * 0.18;
      osc.start(start);
      osc.stop(start + 0.18);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    });
  } catch {}
}

/* ─── TODAY'S DATE KEY ─── */
function todayKey() {
  return new Date().toISOString().split('T')[0];
}

/* ─── STATS HELPER ─── */
function getTodayStats() {
  const key = todayKey();
  return Store.get('stats_' + key, {
    focusSeconds: 0,
    tasksCompleted: 0,
    pomoCycles: 0
  });
}

function saveTodayStats(stats) {
  Store.set('stats_' + todayKey(), stats);
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  Sidebar.init();
  Profile.init();
  initDate();
  initAnimations();
  Toast.init();
});
