/**
 * FlowState — pomodoro.js
 * Full Pomodoro timer: focus/break cycles, ring progress, sound, notifications
 */

document.addEventListener('DOMContentLoaded', () => {
  // Only init on dashboard
  if (!document.getElementById('btn-start')) return;

  /* ─── STATE ─── */
  const settings = Store.get('settings', {});
  const FOCUS_MINS  = settings.pomodoroFocus  || 25;
  const SHORT_MINS  = settings.pomodoroShort  || 5;
  const LONG_MINS   = settings.pomodoroLong   || 15;
  const CYCLE_LIMIT = settings.pomodoroCycles || 4;

  let totalSeconds = FOCUS_MINS * 60;
  let remaining    = totalSeconds;
  let running      = false;
  let interval     = null;
  let mode         = 'focus';  // 'focus' | 'short' | 'long'
  let cyclesDone   = 0;
  let sessionToday = Store.get('pomo_session_' + todayKey(), 0);
  let sessionStart = null; // ISO timestamp when current session started

  /* ─── ELEMENTS ─── */
  const display   = document.getElementById('timer-display');
  const modeLabel = document.getElementById('timer-mode');
  const ring      = document.getElementById('ring-progress');
  const btnStart  = document.getElementById('btn-start');
  const btnReset  = document.getElementById('btn-reset');
  const btnSkip   = document.getElementById('btn-skip');
  const cycleEl   = document.getElementById('cycle-count');
  const dotsEl    = document.getElementById('session-dots');

  const CIRCUMFERENCE = 2 * Math.PI * 88; // r=88

  /* ─── RENDER ─── */
  function render() {
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    display.textContent = `${m}:${s}`;

    // Ring
    const pct = remaining / totalSeconds;
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);

    // Color by mode
    const colors = { focus: 'var(--primary)', short: 'var(--accent-purple)', long: 'var(--accent-pink)' };
    ring.style.stroke = colors[mode];

    // Mode label
    const labels = { focus: 'FOCO', short: 'PAUSA CURTA', long: 'PAUSA LONGA' };
    modeLabel.textContent = labels[mode];

    // Cycle count
    cycleEl.textContent = `Ciclo ${cyclesDone + 1}`;

    // Session dots
    renderDots();

    // Page title
    document.title = `${m}:${s} — FlowState`;
  }

  function renderDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    for (let i = 0; i < CYCLE_LIMIT; i++) {
      const dot = document.createElement('span');
      dot.className = 'session-dot' + (i < cyclesDone ? ' done' : '');
      dotsEl.appendChild(dot);
    }
  }

  /* ─── TIMER LOGIC ─── */
  function tick() {
    if (remaining <= 0) {
      clearInterval(interval);
      running = false;
      btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
      onCycleEnd();
      return;
    }
    remaining--;
    render();

    // Update focus time in stats every 10s
    if (mode === 'focus' && remaining % 10 === 0) {
      updateFocusStats(10);
    }
  }

  function start() {
    if (!sessionStart) sessionStart = new Date().toISOString(); // mark start time
    running = true;
    interval = setInterval(tick, 1000);
    btnStart.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';

    // Request notifications on first start
    const s = Store.get('settings', {});
    if (s.pomodoroNotify) requestNotificationPermission();
  }

  function pause() {
    running = false;
    clearInterval(interval);
    btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Retomar';
  }

  function reset() {
    clearInterval(interval);
    running = false;
    setMode(mode);
    btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
    render();
  }

  function setMode(m) {
    mode = m;
    sessionStart = null; // new session begins fresh
    const mins = { focus: FOCUS_MINS, short: SHORT_MINS, long: LONG_MINS };
    totalSeconds = (mins[m] || 25) * 60;
    remaining    = totalSeconds;
    document.title = 'FlowState';
    render();
  }

  function skip() {
    clearInterval(interval);
    running = false;
    onCycleEnd();
  }

  function logSession() {
    const durationSeconds = totalSeconds - remaining;
    if (durationSeconds < 10) return; // ignore accidental skips
    const entry = {
      mode,
      startedAt: sessionStart || new Date().toISOString(),
      durationSeconds
    };
    const sessions = Store.get('pomo_sessions', []);
    sessions.push(entry);
    // Keep max 500 sessions to avoid bloating localStorage
    if (sessions.length > 500) sessions.splice(0, sessions.length - 500);
    Store.set('pomo_sessions', sessions);
    sessionStart = null; // reset for next session
  }

  function onCycleEnd() {
    logSession();
    playAlertSound();

    if (mode === 'focus') {
      cyclesDone++;
      sessionToday++;

      // Save to stats
      updateFocusStats(0);
      updateCycleStats();

      Store.set('pomo_session_' + todayKey(), sessionToday);

      // Notification
      const s = Store.get('settings', {});
      if (s.pomodoroNotify) {
        sendNotification('FlowState — Foco concluído! 🎉', 'Hora de uma pausa. Você merece!');
      }

      Toast.show('Ciclo de foco concluído! 🎯', 'success');

      if (cyclesDone >= CYCLE_LIMIT) {
        cyclesDone = 0;
        setMode('long');
        Toast.show('Pausa longa! Descanse bem. 🌙', 'info', 4000);
      } else {
        setMode('short');
      }
    } else {
      // Break ended → back to focus
      const s = Store.get('settings', {});
      if (s.pomodoroNotify) {
        sendNotification('FlowState — Pausa terminada!', 'Bora focar novamente 🚀');
      }
      Toast.show('Pausa terminada! Hora de focar. 🚀', 'info');
      setMode('focus');
    }

    btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
    render();
  }

  function updateFocusStats(seconds) {
    const stats = getTodayStats();
    stats.focusSeconds = (stats.focusSeconds || 0) + seconds;
    saveTodayStats(stats);
    refreshDashboardStats();
  }

  function updateCycleStats() {
    const stats = getTodayStats();
    stats.pomoCycles = (stats.pomoCycles || 0) + 1;
    saveTodayStats(stats);
    refreshDashboardStats();
  }

  function refreshDashboardStats() {
    const stats = getTodayStats();
    const focusEl = document.getElementById('stat-focus');
    if (focusEl) {
      const h = Math.floor(stats.focusSeconds / 3600);
      const m = Math.floor((stats.focusSeconds % 3600) / 60);
      focusEl.textContent = `${h}h ${m.toString().padStart(2,'0')}m`;
    }
    const cyclesEl = document.getElementById('stat-cycles');
    if (cyclesEl) cyclesEl.textContent = stats.pomoCycles || 0;

    updateGoalProgress(stats);
  }

  /* ─── BUTTON EVENTS ─── */
  btnStart.addEventListener('click', () => running ? pause() : start());
  btnReset.addEventListener('click', reset);
  btnSkip.addEventListener('click', skip);

  /* ─── INITIAL RENDER ─── */
  render();
  refreshDashboardStats();
});

/* ─── UPDATE GOAL PROGRESS (called from dashboard) ─── */
function updateGoalProgress(stats) {
  const settings = Store.get('settings', {});
  const goals = settings.dailyGoals || { tasks: 5, cycles: 4, hours: 2 };

  const tasks = Store.get('tasks', []);
  const todayTasks = tasks.filter(t => {
    const d = t.doneAt || t.createdAt;
    return t.done && d && d.startsWith(todayKey());
  }).length;

  const focusHours = (stats?.focusSeconds || 0) / 3600;
  const cycles = stats?.pomoCycles || 0;

  const taskPct  = Math.min(100, (todayTasks / goals.tasks) * 100);
  const cyclePct = Math.min(100, (cycles / goals.cycles) * 100);
  const hourPct  = Math.min(100, (focusHours / goals.hours) * 100);
  const overall  = Math.round((taskPct + cyclePct + hourPct) / 3);

  // Update stat card
  const goalStat = document.getElementById('stat-goal');
  if (goalStat) goalStat.textContent = overall + '%';

  // Update goals widget
  const goalsList = document.getElementById('goals-list');
  if (goalsList) {
    goalsList.innerHTML = `
      <div class="goal-item">
        <span class="goal-icon">✅</span>
        <div class="goal-info">
          <div class="goal-name">Tarefas concluídas</div>
          <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${taskPct}%"></div></div>
        </div>
        <span class="goal-value">${todayTasks}/${goals.tasks}</span>
      </div>
      <div class="goal-item">
        <span class="goal-icon">⏱️</span>
        <div class="goal-info">
          <div class="goal-name">Ciclos Pomodoro</div>
          <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${cyclePct}%"></div></div>
        </div>
        <span class="goal-value">${cycles}/${goals.cycles}</span>
      </div>
      <div class="goal-item">
        <span class="goal-icon">🔥</span>
        <div class="goal-info">
          <div class="goal-name">Horas focadas</div>
          <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${hourPct}%"></div></div>
        </div>
        <span class="goal-value">${focusHours.toFixed(1)}h/${goals.hours}h</span>
      </div>
    `;
  }

  const fill = document.getElementById('goals-fill');
  const pct  = document.getElementById('goals-percent');
  if (fill) fill.style.width = overall + '%';
  if (pct) pct.textContent = overall + '%';
}

/* ─── GOALS MODAL (dashboard) ─── */
document.addEventListener('DOMContentLoaded', () => {
  const editBtn = document.getElementById('btn-edit-goals');
  const saveBtn = document.getElementById('save-goals');
  const cancelBtn = document.getElementById('cancel-goals');
  const closeBtn = document.getElementById('close-goals-modal');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const s = Store.get('settings', {});
      const g = s.dailyGoals || { tasks: 5, cycles: 4, hours: 2 };
      document.getElementById('goal-tasks').value = g.tasks;
      document.getElementById('goal-cycles').value = g.cycles;
      document.getElementById('goal-hours').value = g.hours;
      openModal('goals-modal');
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const s = Store.get('settings', {});
      s.dailyGoals = {
        tasks:  parseInt(document.getElementById('goal-tasks').value) || 5,
        cycles: parseInt(document.getElementById('goal-cycles').value) || 4,
        hours:  parseFloat(document.getElementById('goal-hours').value) || 2
      };
      Store.set('settings', s);
      closeModal('goals-modal');
      updateGoalProgress(getTodayStats());
      Toast.show('Metas atualizadas!', 'success');
    });
  }

  cancelBtn?.addEventListener('click', () => closeModal('goals-modal'));
  closeBtn?.addEventListener('click', () => closeModal('goals-modal'));

  // Also load dashboard tasks preview
  renderDashboardTasks();
});

/* ─── DASHBOARD TASKS PREVIEW ─── */
function renderDashboardTasks() {
  const container = document.getElementById('dashboard-tasks');
  if (!container) return;

  const tasks = Store.get('tasks', []);
  const today = tasks
    .filter(t => t.createdAt && t.createdAt.startsWith(todayKey()))
    .slice(0, 5);

  if (!today.length) {
    container.innerHTML = `
      <div class="empty-state-small">
        <i class="fa-regular fa-clipboard"></i>
        <span>Nenhuma tarefa hoje</span>
      </div>`;
    return;
  }

  container.innerHTML = today.map(t => `
    <div class="task-preview-item ${t.done ? 'done' : ''}">
      <div class="task-check" onclick="toggleDashTask('${t.id}')"></div>
      <span class="priority-dot ${t.priority || 'medium'}"></span>
      <span class="task-preview-text">${escapeHtml(t.text)}</span>
    </div>
  `).join('');

  // Update task stat
  const todayDone = tasks.filter(t => t.done && t.doneAt && t.doneAt.startsWith(todayKey())).length;
  const el = document.getElementById('stat-tasks');
  if (el) el.textContent = todayDone;
}

function toggleDashTask(id) {
  const tasks = Store.get('tasks', []);
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  Store.set('tasks', tasks);
  renderDashboardTasks();

  const stats = getTodayStats();
  const todayDone = tasks.filter(t => t.done && t.doneAt && t.doneAt.startsWith(todayKey())).length;
  stats.tasksCompleted = todayDone;
  saveTodayStats(stats);
  updateGoalProgress(stats);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
