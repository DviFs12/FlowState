/**
 * FlowState — pomodoro.js
 * Bugs fixed:
 *  1. Timer frozen after cycle end — setTimeout(onCycleEnd,50) lets browser paint first
 *  2. Timer reset on page navigation — full state persisted to localStorage
 *  3. Background tab drift — RAF + wall-clock timestamps instead of pure interval counting
 */

/* ─── PERSIST TIMER STATE ACROSS PAGES ─── */
function pomoPersist(state) { Store.set('pomo_state', state); }
function pomoRestore()      { return Store.get('pomo_state', null); }

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('btn-start')) return;

  /* ─── SETTINGS ─── */
  const settings    = Store.get('settings', {});
  const FOCUS_MINS  = settings.pomodoroFocus  || 25;
  const SHORT_MINS  = settings.pomodoroShort  || 5;
  const LONG_MINS   = settings.pomodoroLong   || 15;
  const CYCLE_LIMIT = settings.pomodoroCycles || 4;
  const MINS = { focus: FOCUS_MINS, short: SHORT_MINS, long: LONG_MINS };

  /* ─── STATE — restore or default ─── */
  const saved     = pomoRestore();
  let mode        = saved?.mode        || 'focus';
  let totalSecs   = saved?.totalSecs   || FOCUS_MINS * 60;
  let remaining   = saved?.remaining   ?? totalSecs;
  let cyclesDone  = saved?.cyclesDone  || 0;
  let sessionStart= saved?.sessionStart|| null;
  let sessionToday= Store.get('pomo_session_' + todayKey(), 0);
  let running     = false;
  let rafId       = null;
  let lastTick    = null;

  /* ─── ELEMENTS ─── */
  const display   = document.getElementById('timer-display');
  const modeLabel = document.getElementById('timer-mode');
  const ring      = document.getElementById('ring-progress');
  const btnStart  = document.getElementById('btn-start');
  const btnReset  = document.getElementById('btn-reset');
  const btnSkip   = document.getElementById('btn-skip');
  const cycleEl   = document.getElementById('cycle-count');
  const dotsEl    = document.getElementById('session-dots');
  const CIRCUMFERENCE = 2 * Math.PI * 88;

  /* ─── RENDER ─── */
  function render() {
    const r = Math.max(0, Math.round(remaining));
    const m = Math.floor(r / 60).toString().padStart(2, '0');
    const s = (r % 60).toString().padStart(2, '0');
    if (display)   display.textContent  = m + ':' + s;
    if (ring) {
      const pct = totalSecs > 0 ? r / totalSecs : 0;
      ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);
      const colors = { focus:'var(--primary)', short:'var(--accent-purple)', long:'var(--accent-pink)' };
      ring.style.stroke = colors[mode] || 'var(--primary)';
    }
    const labels = { focus:'FOCO', short:'PAUSA CURTA', long:'PAUSA LONGA' };
    if (modeLabel) modeLabel.textContent = labels[mode] || '';
    if (cycleEl)   cycleEl.textContent   = 'Ciclo ' + (cyclesDone + 1);
    renderDots();
    document.title = running ? (m + ':' + s + ' — FlowState') : 'FlowState';
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

  /* ─── RAF LOOP — timestamp-driven so background tabs catch up ─── */
  function loop(now) {
    if (!running) return;
    if (lastTick === null) lastTick = now;

    const elapsedMs = now - lastTick;
    if (elapsedMs >= 1000) {
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      lastTick += elapsedSecs * 1000;
      remaining -= elapsedSecs;

      if (mode === 'focus') updateFocusStats(elapsedSecs);

      if (remaining <= 0) {
        remaining = 0;
        render();
        running  = false;
        lastTick = null;
        saveState();
        setTimeout(onCycleEnd, 80); // let browser paint before heavy ops
        return;
      }
      saveState();
    }

    render();
    rafId = requestAnimationFrame(loop);
  }

  /* ─── VISIBILITY CHANGE — catch up time spent in background ─── */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && running) {
      // Recalibrate: compute how much time passed since we last saved runSince
      const st = pomoRestore();
      if (st && st.runSince) {
        const missed = Math.floor((Date.now() - st.runSince) / 1000);
        remaining = Math.max(0, (st.remaining || 0) - missed);
        if (mode === 'focus' && missed > 0) updateFocusStats(missed);
      }
      lastTick = null; // force RAF to recalibrate
    }
    if (running) saveState();
  });

  /* ─── SAVE / LOAD STATE ─── */
  function saveState() {
    pomoPersist({ mode, totalSecs, remaining, cyclesDone, sessionStart, runSince: running ? Date.now() : null });
  }

  /* ─── CONTROLS ─── */
  function startTimer() {
    if (!sessionStart) sessionStart = new Date().toISOString();
    running  = true;
    lastTick = null;
    saveState();
    btnStart.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
    const s = Store.get('settings', {});
    if (s.pomodoroNotify) requestNotificationPermission();
    rafId = requestAnimationFrame(loop);
  }

  function pauseTimer() {
    running  = false;
    lastTick = null;
    cancelAnimationFrame(rafId);
    saveState();
    btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Retomar';
  }

  function resetTimer() {
    running  = false;
    lastTick = null;
    cancelAnimationFrame(rafId);
    setMode(mode, false);
    btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
  }

  function skipTimer() {
    running  = false;
    lastTick = null;
    cancelAnimationFrame(rafId);
    remaining = 0;
    render();
    setTimeout(onCycleEnd, 80);
  }

  function setMode(m, autoStart) {
    mode         = m;
    totalSecs    = (MINS[m] || 25) * 60;
    remaining    = totalSecs;
    sessionStart = null;
    saveState();
    render();
    if (autoStart) startTimer();
  }

  /* ─── CYCLE END ─── */
  function logSession() {
    const dur = totalSecs - Math.max(0, remaining);
    if (dur < 5) return;
    const sessions = Store.get('pomo_sessions', []);
    sessions.push({ mode, startedAt: sessionStart || new Date().toISOString(), durationSeconds: dur });
    if (sessions.length > 500) sessions.splice(0, sessions.length - 500);
    Store.set('pomo_sessions', sessions);
    sessionStart = null;
  }

  function onCycleEnd() {
    logSession();
    playAlertSound();
    const s = Store.get('settings', {});

    if (mode === 'focus') {
      cyclesDone++;
      sessionToday++;
      updateCycleStats();
      Store.set('pomo_session_' + todayKey(), sessionToday);
      if (s.pomodoroNotify) sendNotification('FlowState — Foco concluído! 🎉', 'Hora de uma pausa.');
      Toast.show('Ciclo de foco concluído! 🎯', 'success');
      if (cyclesDone >= CYCLE_LIMIT) { cyclesDone = 0; Toast.show('Pausa longa! 🌙', 'info', 4000); setMode('long', false); }
      else setMode('short', false);
    } else {
      if (s.pomodoroNotify) sendNotification('FlowState — Pausa terminada!', 'Bora focar 🚀');
      Toast.show('Pausa terminada! Hora de focar. 🚀', 'info');
      setMode('focus', false);
    }
    btnStart.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
    render();
  }

  /* ─── STATS ─── */
  function updateFocusStats(secs) {
    const stats = getTodayStats();
    stats.focusSeconds = (stats.focusSeconds || 0) + secs;
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
      focusEl.textContent = h + 'h ' + m.toString().padStart(2,'0') + 'm';
    }
    const cyclesEl = document.getElementById('stat-cycles');
    if (cyclesEl) cyclesEl.textContent = stats.pomoCycles || 0;
    updateGoalProgress(stats);
  }

  /* ─── BUTTON EVENTS ─── */
  btnStart.addEventListener('click', () => running ? pauseTimer() : startTimer());
  btnReset.addEventListener('click', resetTimer);
  btnSkip.addEventListener('click',  skipTimer);

  /* ─── INIT: resume if was running when user left the page ─── */
  if (saved?.runSince && saved?.remaining > 0) {
    const missed = Math.floor((Date.now() - saved.runSince) / 1000);
    remaining = Math.max(0, remaining - missed);
    render();
    if (remaining <= 0) {
      setTimeout(onCycleEnd, 150);
    } else {
      btnStart.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
      running = true;
      lastTick = null;
      rafId = requestAnimationFrame(loop);
    }
  } else {
    render();
  }

  refreshDashboardStats();
});

/* ─── GOAL PROGRESS (global, called from multiple places) ─── */
function updateGoalProgress(stats) {
  const settings = Store.get('settings', {});
  const goals    = settings.dailyGoals || { tasks:5, cycles:4, hours:2 };
  const tasks    = Store.get('tasks', []);

  const todayTasks = tasks.filter(t => t.done && t.doneAt && t.doneAt.startsWith(todayKey())).length;
  const focusHours = (stats?.focusSeconds || 0) / 3600;
  const cycles     = stats?.pomoCycles || 0;

  const taskPct  = Math.min(100, (todayTasks / goals.tasks)  * 100);
  const cyclePct = Math.min(100, (cycles     / goals.cycles) * 100);
  const hourPct  = Math.min(100, (focusHours / goals.hours)  * 100);
  const overall  = Math.round((taskPct + cyclePct + hourPct) / 3);

  const goalStat = document.getElementById('stat-goal');
  if (goalStat) goalStat.textContent = overall + '%';

  const goalsList = document.getElementById('goals-list');
  if (goalsList) {
    goalsList.innerHTML = `
      <div class="goal-item"><span class="goal-icon">✅</span>
        <div class="goal-info"><div class="goal-name">Tarefas concluídas</div>
          <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${taskPct}%"></div></div></div>
        <span class="goal-value">${todayTasks}/${goals.tasks}</span></div>
      <div class="goal-item"><span class="goal-icon">⏱️</span>
        <div class="goal-info"><div class="goal-name">Ciclos Pomodoro</div>
          <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${cyclePct}%"></div></div></div>
        <span class="goal-value">${cycles}/${goals.cycles}</span></div>
      <div class="goal-item"><span class="goal-icon">🔥</span>
        <div class="goal-info"><div class="goal-name">Horas focadas</div>
          <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${hourPct}%"></div></div></div>
        <span class="goal-value">${focusHours.toFixed(1)}h/${goals.hours}h</span></div>`;
  }

  const fill = document.getElementById('goals-fill');
  const pct  = document.getElementById('goals-percent');
  if (fill) fill.style.width = overall + '%';
  if (pct)  pct.textContent  = overall + '%';
}

/* ─── GOALS MODAL ─── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-edit-goals')?.addEventListener('click', () => {
    const g = (Store.get('settings', {}).dailyGoals) || { tasks:5, cycles:4, hours:2 };
    document.getElementById('goal-tasks').value  = g.tasks;
    document.getElementById('goal-cycles').value = g.cycles;
    document.getElementById('goal-hours').value  = g.hours;
    openModal('goals-modal');
  });

  document.getElementById('save-goals')?.addEventListener('click', () => {
    const s = Store.get('settings', {});
    s.dailyGoals = {
      tasks:  parseInt(document.getElementById('goal-tasks').value)   || 5,
      cycles: parseInt(document.getElementById('goal-cycles').value)  || 4,
      hours:  parseFloat(document.getElementById('goal-hours').value) || 2
    };
    Store.set('settings', s);
    closeModal('goals-modal');
    updateGoalProgress(getTodayStats());
    Toast.show('Metas atualizadas!', 'success');
  });

  document.getElementById('cancel-goals')?.addEventListener('click', () => closeModal('goals-modal'));
  document.getElementById('close-goals-modal')?.addEventListener('click', () => closeModal('goals-modal'));

  renderDashboardTasks();
});

/* ─── DASHBOARD TASK PREVIEW ─── */
function renderDashboardTasks() {
  const container = document.getElementById('dashboard-tasks');
  if (!container) return;
  const tasks = Store.get('tasks', []);
  const today = tasks.filter(t => {
    if (t.recurringType) return isRecurringDueToday(t);
    return t.createdAt && t.createdAt.startsWith(todayKey());
  }).slice(0, 5);

  if (!today.length) {
    container.innerHTML = `<div class="empty-state-small"><i class="fa-regular fa-clipboard"></i><span>Nenhuma tarefa hoje</span></div>`;
    return;
  }
  container.innerHTML = today.map(t => `
    <div class="task-preview-item ${t.done ? 'done' : ''}">
      <div class="task-check" onclick="toggleDashTask('${t.id}')"></div>
      <span class="priority-dot ${t.priority || 'medium'}"></span>
      <span class="task-preview-text">${escapeHtml(t.text)}</span>
    </div>`).join('');

  const todayDone = tasks.filter(t => t.done && t.doneAt && t.doneAt.startsWith(todayKey())).length;
  const el = document.getElementById('stat-tasks');
  if (el) el.textContent = todayDone;
}

function isRecurringDueToday(task) {
  const d   = new Date();
  const dow = d.getDay();
  const dom = d.getDate();
  if (task.recurringType === 'weekly'  && Array.isArray(task.recurringDays)) return task.recurringDays.includes(dow);
  if (task.recurringType === 'monthly' && task.recurringDay) return task.recurringDay === dom;
  return false;
}

function toggleDashTask(id) {
  const tasks = Store.get('tasks', []);
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done   = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  Store.set('tasks', tasks);
  renderDashboardTasks();
  const stats = getTodayStats();
  stats.tasksCompleted = tasks.filter(t => t.done && t.doneAt && t.doneAt.startsWith(todayKey())).length;
  saveTodayStats(stats);
  updateGoalProgress(stats);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
