/**
 * FlowState — pomodoro-history.js
 * Renders Pomodoro history: bar chart, heatmap, donut, streak, session log, top days.
 * Reads from localStorage keys: flowstate_stats_YYYY-MM-DD & flowstate_pomo_sessions
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ─── PERIOD STATE ─── */
  let activeDays = 7;
  let barChart   = null;
  let donutChart = null;

  /* ─── DATA HELPERS ─── */

  /**
   * Return array of { dateKey, date, stats } for last N days (newest last).
   */
  function getRange(days) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      result.push({
        dateKey: key,
        date: d,
        stats: Store.get('stats_' + key, { focusSeconds: 0, tasksCompleted: 0, pomoCycles: 0 })
      });
    }
    return result;
  }

  /** All-time range for streak & heatmap (last 90 days). */
  function getAllRange() { return getRange(90); }

  /** Format seconds → "Xh Ym" */
  function fmtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
  }

  /** Format seconds → "X.Xh" short */
  function fmtHourShort(sec) {
    return (sec / 3600).toFixed(1) + 'h';
  }

  /** Date label short */
  function dayLabel(date) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  /** Weekday label */
  function weekdayShort(date) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  }

  /* ─── STREAK CALCULATOR ─── */
  function calcStreak() {
    const today = new Date().toISOString().split('T')[0];
    let streak = 0;
    for (let i = 0; i <= 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const stats = Store.get('stats_' + key, { pomoCycles: 0 });
      if ((stats.pomoCycles || 0) > 0) {
        streak++;
      } else if (i === 0) {
        // today not done yet — don't break streak if yesterday was done
        continue;
      } else {
        break;
      }
    }
    return streak;
  }

  /* ─── CSS VARIABLE HELPER ─── */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ─── RENDER ALL ─── */
  function renderAll(days) {
    const range = getRange(days);
    const all   = getAllRange();

    renderTopStats(range, all);
    renderBarChart(range);
    renderHeatmap(all);
    renderSessions();
    renderStreak(all);
    renderDonut(all);
    renderTopDays(all);
    updateSubtitle(range);
  }

  /* ─── TOP STATS ─── */
  function renderTopStats(range) {
    const totalFocus  = range.reduce((a, d) => a + (d.stats.focusSeconds || 0), 0);
    const totalCycles = range.reduce((a, d) => a + (d.stats.pomoCycles   || 0), 0);
    const activeDaysN = range.filter(d => (d.stats.pomoCycles || 0) > 0).length;
    const bestDay     = Math.max(0, ...range.map(d => d.stats.pomoCycles || 0));

    setText('total-focus-time', fmtTime(totalFocus));
    setText('total-cycles',     totalCycles);
    setText('active-days',      activeDaysN);
    setText('best-day-cycles',  bestDay);
  }

  /* ─── BAR CHART ─── */
  function renderBarChart(range) {
    const canvas = document.getElementById('history-chart');
    if (!canvas) return;

    const labels     = range.map(d => weekdayShort(d.date) + ' ' + d.date.getDate());
    const cycleData  = range.map(d => d.stats.pomoCycles   || 0);
    const focusData  = range.map(d => Math.round((d.stats.focusSeconds || 0) / 60));

    const primary  = cssVar('--primary');
    const purple   = cssVar('--accent-purple');
    const text2    = cssVar('--text-2');
    const border   = cssVar('--border');
    const surface2 = cssVar('--surface-2');

    if (barChart) barChart.destroy();

    barChart = new Chart(canvas, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Ciclos',
            data: cycleData,
            backgroundColor: primary + '40',
            borderColor: primary,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
            yAxisID: 'y',
            order: 2
          },
          {
            type: 'line',
            label: 'Foco (min)',
            data: focusData,
            borderColor: purple,
            backgroundColor: purple + '18',
            borderWidth: 2,
            pointRadius: range.length <= 7 ? 4 : 2,
            pointBackgroundColor: purple,
            fill: true,
            tension: 0.4,
            yAxisID: 'y2',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: text2,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: 'DM Sans', size: 11 },
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: surface2,
            titleColor: '#e8e8f0',
            bodyColor: text2,
            borderColor: border,
            borderWidth: 1,
            padding: 10,
            titleFont: { family: 'Syne', size: 12, weight: '700' },
            bodyFont: { family: 'DM Sans', size: 12 },
            callbacks: {
              label: ctx => {
                if (ctx.dataset.label === 'Foco (min)') {
                  const v = ctx.parsed.y;
                  return ` ${Math.floor(v/60)}h ${v%60}m focado`;
                }
                return ` ${ctx.parsed.y} ciclo${ctx.parsed.y !== 1 ? 's' : ''}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: border },
            ticks: { color: text2, font: { family: 'DM Sans', size: 10 }, maxRotation: 0 }
          },
          y: {
            position: 'left',
            grid: { color: border },
            ticks: {
              color: text2, font: { family: 'DM Sans', size: 10 },
              stepSize: 1,
              callback: v => v + ' ciclos'
            },
            beginAtZero: true
          },
          y2: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: text2, font: { family: 'DM Sans', size: 10 },
              callback: v => Math.floor(v/60) + 'h'
            },
            beginAtZero: true
          }
        }
      }
    });
  }

  /* ─── HEATMAP (4 weeks = 28 days, Sun–Sat) ─── */
  function renderHeatmap(all) {
    const labelsEl = document.getElementById('heatmap-labels');
    const gridEl   = document.getElementById('heatmap-grid');
    if (!labelsEl || !gridEl) return;

    // Day labels Sun→Sat
    const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    labelsEl.innerHTML = days.map(d => `<span>${d}</span>`).join('');

    // Last 28 days keyed by dateKey
    const last28 = getRange(28);
    const maxCycles = Math.max(1, ...last28.map(d => d.stats.pomoCycles || 0));

    // Build grid starting from the Sunday before the earliest date
    const earliest = last28[0].date;
    const startDow = earliest.getDay(); // 0=Sun
    const cells = [];

    // Pad empty cells before first day
    for (let i = 0; i < startDow; i++) {
      cells.push(null);
    }
    last28.forEach(d => cells.push(d));

    gridEl.innerHTML = cells.map(d => {
      if (!d) return `<div class="heatmap-day" style="opacity:0;pointer-events:none"></div>`;
      const cycles = d.stats.pomoCycles || 0;
      const level  = cycles === 0 ? 0
                   : cycles < maxCycles * 0.25 ? 1
                   : cycles < maxCycles * 0.5  ? 2
                   : cycles < maxCycles * 0.75 ? 3 : 4;
      const label  = dayLabel(d.date);
      const tip    = cycles === 0
        ? `${label}: sem atividade`
        : `${label}: ${cycles} ciclo${cycles!==1?'s':''} · ${fmtTime(d.stats.focusSeconds||0)} focado`;
      return `<div class="heatmap-day" data-level="${level}">
        <div class="heatmap-tooltip">${tip}</div>
      </div>`;
    }).join('');
  }

  /* ─── SESSIONS LOG ─── */
  function renderSessions() {
    const log = document.getElementById('sessions-log');
    const badge = document.getElementById('session-count-badge');
    if (!log) return;

    // Read stored sessions (added by pomodoro.js on each cycle end)
    const sessions = Store.get('pomo_sessions', []);
    if (badge) badge.textContent = `${sessions.length} sessão${sessions.length !== 1 ? 'ões' : ''}`;

    if (!sessions.length) {
      log.innerHTML = `<div class="history-empty"><div class="icon">⏱️</div><p>Nenhuma sessão registrada ainda.<br>Inicie o Pomodoro no Dashboard!</p></div>`;
      return;
    }

    // Show newest first, max 50
    const sorted = [...sessions].reverse().slice(0, 50);
    const modeLabel = { focus: 'Sessão de Foco', short: 'Pausa Curta', long: 'Pausa Longa' };
    const modeIcon  = { focus: '🎯', short: '☕', long: '🌙' };

    log.innerHTML = sorted.map(s => {
      const d   = new Date(s.startedAt);
      const dateStr = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
      const timeStr = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      return `
        <div class="session-entry">
          <div class="session-icon ${s.mode}">
            <span>${modeIcon[s.mode] || '⏱'}</span>
          </div>
          <div class="session-info">
            <div class="session-title">${modeLabel[s.mode] || s.mode}</div>
            <div class="session-meta">
              <span><i class="fa-regular fa-calendar" style="font-size:10px"></i> ${dateStr}</span>
              <span><i class="fa-regular fa-clock" style="font-size:10px"></i> ${timeStr}</span>
            </div>
          </div>
          <div class="session-duration">${fmtTime(s.durationSeconds || 0)}</div>
        </div>
      `;
    }).join('');
  }

  /* ─── STREAK ─── */
  function renderStreak(all) {
    const streak = calcStreak();
    setText('streak-count', streak);

    const fire = document.getElementById('streak-fire');
    if (fire) fire.textContent = streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : streak >= 1 ? '✨' : '💤';

    // Avg & consistency from all
    const activeDaysArr = all.filter(d => (d.stats.pomoCycles || 0) > 0);
    const totalCycles   = all.reduce((a, d) => a + (d.stats.pomoCycles   || 0), 0);
    const totalFocus    = all.reduce((a, d) => a + (d.stats.focusSeconds  || 0), 0);
    const n             = activeDaysArr.length || 1;
    const consistency   = Math.round((activeDaysArr.length / all.length) * 100);

    setText('avg-cycles-day', (totalCycles / n).toFixed(1));
    setText('avg-focus-day',  fmtHourShort(totalFocus / n));
    setText('completion-rate', consistency + '%');
  }

  /* ─── DONUT CHART ─── */
  function renderDonut(all) {
    const canvas = document.getElementById('donut-chart');
    const legend = document.getElementById('donut-legend');
    if (!canvas) return;

    const sessions = Store.get('pomo_sessions', []);
    const counts = { focus: 0, short: 0, long: 0 };
    sessions.forEach(s => { if (counts[s.mode] !== undefined) counts[s.mode]++; });

    const total = counts.focus + counts.short + counts.long;

    const primary = cssVar('--primary');
    const purple  = cssVar('--accent-purple');
    const pink    = cssVar('--accent-pink');
    const surface2 = cssVar('--surface-2');
    const text2   = cssVar('--text-2');

    if (donutChart) donutChart.destroy();

    donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Foco', 'Pausa Curta', 'Pausa Longa'],
        datasets: [{
          data: [counts.focus, counts.short, counts.long],
          backgroundColor: [primary + 'cc', purple + 'cc', pink + 'cc'],
          borderColor: [primary, purple, pink],
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: surface2,
            titleColor: '#e8e8f0',
            bodyColor: text2,
            borderColor: cssVar('--border'),
            borderWidth: 1,
            callbacks: {
              label: ctx => {
                const pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
                return ` ${ctx.parsed} sessão${ctx.parsed!==1?'ões':''} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Custom legend
    if (legend) {
      const items = [
        { label: 'Foco',        count: counts.focus, color: primary },
        { label: 'Pausa Curta', count: counts.short, color: purple  },
        { label: 'Pausa Longa', count: counts.long,  color: pink    }
      ];
      legend.innerHTML = items.map(item => `
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${item.color};display:inline-block;flex-shrink:0"></span>
            <span style="color:var(--text-2)">${item.label}</span>
          </div>
          <span style="font-weight:600;color:var(--text)">${item.count}</span>
        </div>
      `).join('');
    }
  }

  /* ─── TOP DAYS ─── */
  function renderTopDays(all) {
    const el = document.getElementById('top-days-list');
    if (!el) return;

    const sorted = [...all]
      .filter(d => (d.stats.pomoCycles || 0) > 0)
      .sort((a, b) => (b.stats.pomoCycles || 0) - (a.stats.pomoCycles || 0))
      .slice(0, 5);

    if (!sorted.length) {
      el.innerHTML = `<p style="color:var(--text-3);font-size:13px;text-align:center;padding:16px 0">Sem dados ainda</p>`;
      return;
    }

    const max = sorted[0].stats.pomoCycles;
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];

    el.innerHTML = sorted.map((d, i) => {
      const pct    = Math.round(((d.stats.pomoCycles || 0) / max) * 100);
      const label  = dayLabel(d.date);
      const cycles = d.stats.pomoCycles || 0;
      const focus  = fmtTime(d.stats.focusSeconds || 0);
      return `
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:18px;flex-shrink:0">${medals[i]}</span>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
              <span style="font-weight:600">${label}</span>
              <span style="color:var(--primary);font-weight:700">${cycles} ciclos · ${focus}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ─── SUBTITLE ─── */
  function updateSubtitle(range) {
    const sub = document.getElementById('history-subtitle');
    if (!sub) return;
    const totalCycles = range.reduce((a, d) => a + (d.stats.pomoCycles || 0), 0);
    const totalFocus  = range.reduce((a, d) => a + (d.stats.focusSeconds || 0), 0);
    sub.textContent = `Últimos ${activeDays} dias · ${totalCycles} ciclos · ${fmtTime(totalFocus)} focado`;
  }

  /* ─── UTIL ─── */
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ─── PERIOD BUTTONS ─── */
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDays = parseInt(btn.dataset.days);
      renderAll(activeDays);
    });
  });

  /* ─── CLEAR HISTORY ─── */
  document.getElementById('btn-clear-history')?.addEventListener('click', () => openModal('confirm-clear-modal'));
  document.getElementById('close-clear-modal')?.addEventListener('click', () => closeModal('confirm-clear-modal'));
  document.getElementById('cancel-clear')?.addEventListener('click', () => closeModal('confirm-clear-modal'));

  document.getElementById('confirm-clear')?.addEventListener('click', () => {
    // Remove all stats keys and sessions
    Object.keys(localStorage)
      .filter(k => k.startsWith('flowstate_stats_') || k === 'flowstate_pomo_sessions')
      .forEach(k => localStorage.removeItem(k));

    closeModal('confirm-clear-modal');
    Toast.show('Histórico apagado', 'info');
    renderAll(activeDays);
  });

  /* ─── INIT ─── */
  renderAll(activeDays);
});
