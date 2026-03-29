/**
 * FlowState — schedule.js
 * Daily timeline with 24h view, life-time donut, weekly overview.
 * Data stored as: flowstate_schedule → [{id, title, category, color, start, end, days[]}]
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ─── DATA ─── */
  let events    = Store.get('schedule', []);
  let lifeChart = null;
  let deletingId= null;

  const generateId = () => '_' + Math.random().toString(36).substr(2, 9);
  const save        = () => Store.set('schedule', events);

  /* ─── CATEGORY META ─── */
  const CAT = {
    study:     { label:'📚 Estudo',      color:'#a78bfa' },
    work:      { label:'💼 Trabalho',    color:'#60a5fa' },
    sleep:     { label:'😴 Dormir',      color:'#1e3a5f' },
    exercise:  { label:'🏃 Exercício',   color:'#6ee7b7' },
    leisure:   { label:'🎮 Lazer',       color:'#f472b6' },
    social:    { label:'👥 Social',      color:'#fbbf24' },
    transport: { label:'🚌 Transporte',  color:'#94a3b8' },
    food:      { label:'🍽️ Alimentação', color:'#fb923c' },
    hygiene:   { label:'🚿 Higiene',     color:'#67e8f9' },
    other:     { label:'📌 Outro',       color:'#9ca3af' }
  };

  /* ─── COLORS ─── */
  const SWATCHES = [
    '#6ee7b7','#a78bfa','#f472b6','#60a5fa','#fbbf24',
    '#f87171','#34d399','#fb923c','#67e8f9','#94a3b8'
  ];

  /* ─── QUICK PRESETS ─── */
  const PRESETS = [
    { label:'😴 Dormir',      start:'22:00', end:'07:00', category:'sleep',    color:'#1e3a5f', days:[0,1,2,3,4,5,6] },
    { label:'🍽️ Café da manhã', start:'07:00', end:'07:30', category:'food',   color:'#fb923c', days:[0,1,2,3,4,5,6] },
    { label:'🚿 Higiene',     start:'07:30', end:'08:00', category:'hygiene',  color:'#67e8f9', days:[0,1,2,3,4,5,6] },
    { label:'🚌 Ir à facul.', start:'08:00', end:'08:40', category:'transport',color:'#94a3b8', days:[1,2,3,4,5] },
    { label:'📚 Faculdade',   start:'08:40', end:'12:40', category:'study',    color:'#a78bfa', days:[1,2,3,4,5] },
    { label:'🍽️ Almoço',     start:'12:00', end:'13:00', category:'food',     color:'#fb923c', days:[0,1,2,3,4,5,6] },
    { label:'💼 Trabalho',    start:'13:00', end:'18:00', category:'work',     color:'#60a5fa', days:[1,2,3,4,5] },
    { label:'🏃 Academia',    start:'18:30', end:'20:00', category:'exercise', color:'#6ee7b7', days:[1,3,5] },
    { label:'🎮 Lazer',       start:'20:00', end:'22:00', category:'leisure',  color:'#f472b6', days:[0,1,2,3,4,5,6] },
    { label:'📖 Estudo livre',start:'19:00', end:'21:00', category:'study',    color:'#a78bfa', days:[1,2,3,4,5] },
  ];

  /* ─── RENDER COLOR SWATCHES ─── */
  function initColorSwatches() {
    const container = document.getElementById('color-options');
    if (!container) return;
    container.innerHTML = SWATCHES.map((c, i) => `
      <div class="color-swatch${i===0?' selected':''}" data-color="${c}" style="background:${c}" title="${c}"></div>
    `).join('');
    container.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        document.getElementById('ev-color').value = sw.dataset.color;
      });
    });
  }

  /* ─── RENDER PRESETS ─── */
  function initPresets() {
    const container = document.getElementById('quick-presets');
    if (!container) return;
    container.innerHTML = PRESETS.map((p, i) => `
      <button class="preset-btn" data-preset="${i}">${p.label}</button>
    `).join('');
    container.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = PRESETS[parseInt(btn.dataset.preset)];
        document.getElementById('ev-title').value    = p.label.replace(/^\S+\s/,''); // strip emoji
        document.getElementById('ev-start').value   = p.start;
        document.getElementById('ev-end').value     = p.end;
        document.getElementById('ev-category').value= p.category;
        document.getElementById('ev-color').value   = p.color;

        // Set swatches
        document.querySelectorAll('#color-options .color-swatch').forEach(sw => {
          sw.classList.toggle('selected', sw.dataset.color === p.color);
        });

        // Set DOW buttons
        document.querySelectorAll('[data-edow]').forEach(b => {
          b.classList.toggle('selected', p.days.includes(parseInt(b.dataset.edow)));
        });
      });
    });
  }

  /* ─── DOW BUTTONS (event form) ─── */
  document.querySelectorAll('[data-edow]').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });

  /* ─── TIMELINE ─── */
  const ROW_H   = 48; // px per hour
  const HOURS   = 24;

  function buildTimeline() {
    const axis = document.getElementById('time-axis');
    const grid = document.getElementById('timeline-grid');
    if (!axis || !grid) return;

    // Time axis labels
    axis.innerHTML = Array.from({length: HOURS}, (_, h) =>
      `<div class="time-label">${String(h).padStart(2,'0')}:00</div>`
    ).join('');

    // Grid rows
    grid.innerHTML = Array.from({length: HOURS}, (_, h) =>
      `<div class="timeline-row" data-h="${h}"></div>`
    ).join('');

    // Render today's events
    const todayDow = new Date().getDay();
    const todayEvents = events.filter(e => e.days && e.days.includes(todayDow));

    todayEvents.forEach(ev => {
      placeEventOnGrid(grid, ev);
    });

    // Current time line
    updateNowLine(grid);
    setInterval(() => updateNowLine(grid), 60000);
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function placeEventOnGrid(grid, ev) {
    const startMin = timeToMinutes(ev.start);
    let   endMin   = timeToMinutes(ev.end);
    if (endMin <= startMin) endMin += 24 * 60; // overnight wrap

    const top    = (startMin / 60) * ROW_H;
    const height = Math.max(20, ((endMin - startMin) / 60) * ROW_H - 2);

    const el = document.createElement('div');
    el.className = 'sched-event';
    el.style.cssText = `top:${top}px; height:${height}px; background:${ev.color}22; border-left:3px solid ${ev.color}; color:${ev.color};`;
    el.innerHTML = `
      <span class="ev-title">${escHtml(ev.title)}</span>
      <span class="ev-time">${ev.start} – ${ev.end}</span>`;
    el.addEventListener('click', () => confirmDelete(ev.id));
    grid.appendChild(el);
  }

  function updateNowLine(grid) {
    grid.querySelector('.now-line')?.remove();
    const now    = new Date();
    const mins   = now.getHours() * 60 + now.getMinutes();
    const top    = (mins / 60) * ROW_H;
    const line   = document.createElement('div');
    line.className = 'now-line';
    line.style.top = top + 'px';
    grid.appendChild(line);

    // Scroll into view
    const gridEl = document.getElementById('timeline-grid');
    if (gridEl) {
      const parent = gridEl.closest('.card');
      if (parent) {
        parent.scrollTop = Math.max(0, top - 120);
      }
    }
  }

  /* ─── LIFE DONUT ─── */
  function buildLifeChart() {
    const canvas = document.getElementById('life-chart');
    const legend = document.getElementById('life-legend');
    const note   = document.getElementById('free-time-note');
    if (!canvas) return;

    // Aggregate hours by category across all events (use avg daily hours from days count)
    const totals = {};
    events.forEach(ev => {
      let startMin = timeToMinutes(ev.start);
      let endMin   = timeToMinutes(ev.end);
      if (endMin <= startMin) endMin += 24 * 60;
      const durationH = (endMin - startMin) / 60;
      const daysPerWeek = (ev.days || [0,1,2,3,4,5,6]).length;
      const dailyAvg = durationH * (daysPerWeek / 7);
      totals[ev.category] = (totals[ev.category] || 0) + dailyAvg;
    });

    const usedH   = Object.values(totals).reduce((a,b)=>a+b,0);
    const freeH   = Math.max(0, 24 - usedH);
    const allCats = Object.keys(totals);

    const labels = [...allCats.map(c => (CAT[c]?.label || c)), 'Livre'];
    const data   = [...allCats.map(c => parseFloat(totals[c].toFixed(2))), parseFloat(freeH.toFixed(2))];
    const colors = [...allCats.map(c => CAT[c]?.color || '#9ca3af'), 'var(--surface-3)'];
    const borderColors = colors.map(c => c === 'var(--surface-3)' ? 'var(--border)' : c);

    const cssText2   = getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim();
    const cssSurf2   = getComputedStyle(document.documentElement).getPropertyValue('--surface-2').trim();
    const cssBorder  = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();

    if (lifeChart) lifeChart.destroy();
    lifeChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.map(c => c === 'var(--surface-3)' ? '#1a1a2e' : c + 'cc'),
          borderColor: borderColors,
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: cssSurf2,
            titleColor: '#e8e8f0', bodyColor: cssText2,
            borderColor: cssBorder, borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.parsed.toFixed(1)}h/dia (${Math.round(ctx.parsed/24*100)}%)` }
          }
        }
      }
    });

    // Legend
    if (legend) {
      legend.innerHTML = [...allCats.map((c, i) => ({
        label: CAT[c]?.label || c,
        color: CAT[c]?.color || '#9ca3af',
        hours: totals[c]
      })), { label:'⬜ Livre', color:'#3a3a5c', hours: freeH }]
      .filter(item => item.hours > 0)
      .sort((a,b) => b.hours - a.hours)
      .map(item => `
        <div class="life-legend-item">
          <div class="leg-left">
            <span class="leg-dot" style="background:${item.color}"></span>
            <span>${item.label}</span>
          </div>
          <div style="text-align:right">
            <span class="life-hours">${item.hours.toFixed(1)}h</span>
            <span class="life-pct"> · ${Math.round(item.hours/24*100)}%</span>
          </div>
        </div>`).join('');
    }

    if (note) {
      if (freeH <= 0) {
        note.innerHTML = `⚠️ Seu dia está <strong>100% preenchido</strong>. Considere revisar os blocos.`;
      } else {
        note.innerHTML = `Você tem em média <strong>${freeH.toFixed(1)}h livres</strong> por dia (${Math.round(freeH/24*100)}% do dia).`;
      }
    }
  }

  /* ─── WEEKLY OVERVIEW ─── */
  const DOW_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  function buildWeeklyOverview() {
    const container = document.getElementById('weekly-overview');
    if (!container) return;

    container.innerHTML = DOW_NAMES.map((name, dow) => {
      const dayEvents = events.filter(e => e.days?.includes(dow));
      let usedMin = 0;
      dayEvents.forEach(ev => {
        let s = timeToMinutes(ev.start), e2 = timeToMinutes(ev.end);
        if (e2 <= s) e2 += 1440;
        usedMin += e2 - s;
      });
      const usedH   = (usedMin / 60).toFixed(1);
      const pct     = Math.min(100, usedMin / 1440 * 100);
      const isToday = dow === new Date().getDay();

      return `
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="width:30px; font-size:12px; color:${isToday?'var(--primary)':'var(--text-3)'}; font-weight:${isToday?'700':'400'}">${name}</span>
          <div style="flex:1; height:6px; background:var(--surface-3); border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:${isToday?'var(--primary)':'var(--accent-purple)'}; border-radius:3px; transition:width .4s ease;"></div>
          </div>
          <span style="font-size:11px; color:var(--text-3); min-width:30px; text-align:right">${usedH}h</span>
        </div>`;
    }).join('');
  }

  /* ─── EVENTS LIST ─── */
  function buildEventsList() {
    const container = document.getElementById('events-list');
    const countEl   = document.getElementById('events-count');
    if (!container) return;
    if (countEl) countEl.textContent = events.length;

    if (!events.length) {
      container.innerHTML = `<div style="text-align:center; color:var(--text-3); font-size:13px; padding:20px 0">Nenhum bloco cadastrado ainda</div>`;
      return;
    }

    const sorted = [...events].sort((a,b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    container.innerHTML = sorted.map(ev => {
      const days = (ev.days || []).map(d => DOW_NAMES[d]).join(', ');
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--surface-2); border-radius:10px; border:1px solid var(--border);">
          <div style="width:10px; height:36px; border-radius:4px; background:${ev.color}; flex-shrink:0"></div>
          <div style="flex:1; min-width:0">
            <div style="font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escHtml(ev.title)}</div>
            <div style="font-size:11px; color:var(--text-3)">${ev.start}–${ev.end} · ${days}</div>
          </div>
          <button class="btn-icon-sm" onclick="schedDeleteEv('${ev.id}')" style="color:var(--danger)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>`;
    }).join('');
  }

  /* ─── ADD EVENT ─── */
  function addEvent() {
    const title = document.getElementById('ev-title')?.value.trim();
    if (!title) { Toast.show('Dê um nome ao bloco', 'warning'); return; }
    const start = document.getElementById('ev-start')?.value;
    const end   = document.getElementById('ev-end')?.value;
    if (!start || !end) { Toast.show('Defina os horários', 'warning'); return; }

    const days = [...document.querySelectorAll('[data-edow].selected')].map(b => parseInt(b.dataset.edow));
    if (!days.length) { Toast.show('Selecione ao menos um dia', 'warning'); return; }

    events.push({
      id:       generateId(),
      title,
      category: document.getElementById('ev-category')?.value || 'other',
      color:    document.getElementById('ev-color')?.value || '#6ee7b7',
      start, end, days
    });

    save();
    renderAll();
    document.getElementById('add-event-panel').style.display = 'none';
    document.getElementById('ev-title').value = '';
    Toast.show('Bloco adicionado!', 'success');
  }

  /* ─── DELETE ─── */
  window.schedDeleteEv = function(id) { confirmDelete(id); };

  function confirmDelete(id) {
    deletingId = id;
    const ev = events.find(e => e.id === id);
    const nameEl = document.getElementById('del-ev-name');
    if (nameEl) nameEl.textContent = `Remover "${ev?.title || 'este bloco'}" do cronograma?`;
    openModal('delete-ev-modal');
  }

  document.getElementById('confirm-del')?.addEventListener('click', () => {
    if (!deletingId) return;
    events = events.filter(e => e.id !== deletingId);
    save(); renderAll();
    closeModal('delete-ev-modal');
    Toast.show('Bloco removido', 'info');
    deletingId = null;
  });

  document.getElementById('cancel-del')?.addEventListener('click',    () => closeModal('delete-ev-modal'));
  document.getElementById('close-del-modal')?.addEventListener('click',() => closeModal('delete-ev-modal'));

  /* ─── CLEAR ALL ─── */
  document.getElementById('btn-clear-schedule')?.addEventListener('click', () => {
    if (!events.length) { Toast.show('Cronograma já está vazio', 'info'); return; }
    if (!confirm('Limpar todo o cronograma?')) return;
    events = []; save(); renderAll();
    Toast.show('Cronograma limpo', 'info');
  });

  /* ─── PANEL TOGGLE ─── */
  document.getElementById('btn-add-event')?.addEventListener('click', () => {
    const panel = document.getElementById('add-event-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') document.getElementById('ev-title')?.focus();
  });

  document.getElementById('btn-save-event')?.addEventListener('click',  addEvent);
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => {
    document.getElementById('add-event-panel').style.display = 'none';
  });

  /* ─── TODAY LABEL ─── */
  const todayLabel = document.getElementById('today-label');
  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  }

  /* ─── RENDER ALL ─── */
  function renderAll() {
    buildTimeline();
    buildLifeChart();
    buildWeeklyOverview();
    buildEventsList();
  }

  /* ─── INIT ─── */
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  initColorSwatches();
  initPresets();
  renderAll();
});
