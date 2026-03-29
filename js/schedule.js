/**
 * FlowState — schedule.js
 * - 24h timeline with day navigation (±7 days from today)
 * - Week grid with color-coded blocks
 * - Life-time donut
 * - Custom color picker (swatches + hex input)
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ─── DATA ─── */
  let events     = Store.get('schedule', []);
  let lifeChart  = null;
  let deletingId = null;
  let viewDayOffset = 0; // 0 = today, +1 = tomorrow, etc.

  const generateId = () => '_' + Math.random().toString(36).substr(2, 9);
  const save        = () => Store.set('schedule', events);
  const escH        = s  => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  /* ─── CONSTANTS ─── */
  const DOW_NAMES  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const DOW_FULL   = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const ROW_H      = 48; // px per hour

  const CAT = {
    study:    { label:'📚 Estudo',       color:'#a78bfa' },
    work:     { label:'💼 Trabalho',     color:'#60a5fa' },
    sleep:    { label:'😴 Dormir',       color:'#1e3a5f' },
    exercise: { label:'🏃 Exercício',    color:'#6ee7b7' },
    leisure:  { label:'🎮 Lazer',        color:'#f472b6' },
    social:   { label:'👥 Social',       color:'#fbbf24' },
    transport:{ label:'🚌 Transporte',   color:'#94a3b8' },
    food:     { label:'🍽️ Alimentação',  color:'#fb923c' },
    hygiene:  { label:'🚿 Higiene',      color:'#67e8f9' },
    other:    { label:'📌 Outro',        color:'#9ca3af' }
  };

  const SWATCHES = [
    '#6ee7b7','#a78bfa','#f472b6','#60a5fa','#fbbf24',
    '#f87171','#34d399','#fb923c','#67e8f9','#94a3b8',
    '#c084fc','#4ade80','#22d3ee','#fb7185','#facc15'
  ];

  const PRESETS = [
    { label:'😴 Dormir',        start:'22:00', end:'07:00', category:'sleep',     color:'#334155', days:[0,1,2,3,4,5,6] },
    { label:'🍽️ Café da manhã', start:'07:00', end:'07:30', category:'food',      color:'#fb923c', days:[0,1,2,3,4,5,6] },
    { label:'🚿 Higiene',       start:'07:30', end:'08:00', category:'hygiene',   color:'#67e8f9', days:[0,1,2,3,4,5,6] },
    { label:'🚌 Ir à facul.',   start:'08:00', end:'08:40', category:'transport', color:'#94a3b8', days:[1,2,3,4,5]     },
    { label:'📚 Faculdade',     start:'08:40', end:'12:40', category:'study',     color:'#a78bfa', days:[1,2,3,4,5]     },
    { label:'🍽️ Almoço',       start:'12:00', end:'13:00', category:'food',      color:'#fb923c', days:[0,1,2,3,4,5,6] },
    { label:'💼 Trabalho',      start:'13:00', end:'18:00', category:'work',      color:'#60a5fa', days:[1,2,3,4,5]     },
    { label:'🏃 Academia',      start:'18:30', end:'20:00', category:'exercise',  color:'#6ee7b7', days:[1,3,5]         },
    { label:'🎮 Lazer',         start:'20:00', end:'22:00', category:'leisure',   color:'#f472b6', days:[0,1,2,3,4,5,6] },
    { label:'📖 Estudo livre',  start:'19:00', end:'21:00', category:'study',     color:'#a78bfa', days:[1,2,3,4,5]     },
  ];

  /* ─── TIME HELPERS ─── */
  function toMin(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
  function minToStr(m) { return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }

  /* ─── DAY OFFSET helpers ─── */
  function viewDate() {
    const d = new Date();
    d.setDate(d.getDate() + viewDayOffset);
    return d;
  }
  function viewDow() { return viewDate().getDay(); }

  /* ─── COLOR PICKER INIT ─── */
  function initColorPicker() {
    const container = document.getElementById('color-options');
    if (!container) return;
    container.innerHTML = SWATCHES.map((c,i) =>
      `<div class="color-swatch${i===0?' selected':''}" data-color="${c}" style="background:${c}" title="${c}"></div>`
    ).join('') + `
      <div style="display:flex; gap:6px; align-items:center; margin-top:8px; width:100%">
        <input type="color" id="color-custom-picker" value="#6ee7b7" style="width:36px;height:36px;border:1px solid var(--border);border-radius:8px;background:none;cursor:pointer;padding:2px" />
        <input type="text" id="color-custom-hex" value="#6ee7b7" maxlength="7"
          style="flex:1;background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 10px;font-family:'DM Sans',sans-serif;font-size:13px;outline:none" placeholder="#rrggbb" />
      </div>`;

    const hexInput    = document.getElementById('color-custom-hex');
    const colorPicker = document.getElementById('color-custom-picker');
    const hiddenInput = document.getElementById('ev-color');

    function selectSwatch(color) {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      if (hiddenInput) hiddenInput.value = color;
      if (hexInput)    hexInput.value    = color;
      if (colorPicker) colorPicker.value = color;
    }

    container.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        selectSwatch(sw.dataset.color);
      });
    });

    colorPicker?.addEventListener('input', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      if (hiddenInput) hiddenInput.value = colorPicker.value;
      if (hexInput)    hexInput.value    = colorPicker.value;
    });

    hexInput?.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) {
        if (hiddenInput) hiddenInput.value = hexInput.value;
        if (colorPicker) colorPicker.value = hexInput.value;
        container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      }
    });
  }

  function setPickerColor(color) {
    const container = document.getElementById('color-options');
    const hiddenInput = document.getElementById('ev-color');
    const hexInput    = document.getElementById('color-custom-hex');
    const colorPicker = document.getElementById('color-custom-picker');
    if (container) {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('selected', s.dataset.color === color));
    }
    if (hiddenInput) hiddenInput.value = color;
    if (hexInput)    hexInput.value    = color;
    if (colorPicker) colorPicker.value = color;
  }

  /* ─── PRESETS ─── */
  function initPresets() {
    const container = document.getElementById('quick-presets');
    if (!container) return;
    container.innerHTML = PRESETS.map((p,i) =>
      `<button class="preset-btn" data-preset="${i}">${p.label}</button>`
    ).join('');
    container.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = PRESETS[parseInt(btn.dataset.preset)];
        const stripped = p.label.replace(/^\S+\s/, '');
        document.getElementById('ev-title').value     = stripped;
        document.getElementById('ev-start').value     = p.start;
        document.getElementById('ev-end').value       = p.end;
        document.getElementById('ev-category').value  = p.category;
        setPickerColor(p.color);
        document.querySelectorAll('[data-edow]').forEach(b =>
          b.classList.toggle('selected', p.days.includes(parseInt(b.dataset.edow))));
      });
    });
  }

  /* ─── DOW BUTTONS (add form) ─── */
  document.querySelectorAll('[data-edow]').forEach(btn =>
    btn.addEventListener('click', () => btn.classList.toggle('selected'))
  );

  /* ─── TIMELINE ─── */
  function buildTimeline() {
    const axis = document.getElementById('time-axis');
    const grid = document.getElementById('timeline-grid');
    if (!axis || !grid) return;

    axis.innerHTML = Array.from({length:24}, (_,h) =>
      `<div class="time-label">${String(h).padStart(2,'0')}:00</div>`
    ).join('');

    // Rows for clicking to add event at that hour
    grid.innerHTML = Array.from({length:24}, (_,h) =>
      `<div class="timeline-row" data-h="${h}"></div>`
    ).join('');

    // Events for the viewed day
    const dow = viewDow();
    const dayEvs = events.filter(e => e.days?.includes(dow));
    dayEvs.forEach(ev => placeEvent(grid, ev));

    // Now line (only on today)
    if (viewDayOffset === 0) updateNowLine(grid);
  }

  function placeEvent(grid, ev) {
    let sMin = toMin(ev.start), eMin = toMin(ev.end);
    if (eMin <= sMin) eMin += 1440;
    const top    = (sMin / 60) * ROW_H;
    const height = Math.max(22, ((eMin - sMin) / 60) * ROW_H - 2);
    const el     = document.createElement('div');
    el.className = 'sched-event';
    el.style.cssText = `top:${top}px;height:${height}px;background:${ev.color}22;border-left:3px solid ${ev.color};color:${ev.color};`;
    el.innerHTML = `<span class="ev-title">${escH(ev.title)}</span><span class="ev-time">${ev.start}–${ev.end}</span>`;
    el.addEventListener('click', () => confirmDelete(ev.id));
    grid.appendChild(el);
  }

  function updateNowLine(grid) {
    grid.querySelector('.now-line')?.remove();
    const now  = new Date();
    const mins = now.getHours()*60 + now.getMinutes();
    const top  = (mins/60)*ROW_H;
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = top + 'px';
    grid.appendChild(line);
    // Scroll to current time
    const card = grid.closest('.card');
    if (card) card.scrollTop = Math.max(0, top - 150);
  }

  // Refresh now-line every minute
  setInterval(() => {
    if (viewDayOffset === 0) {
      const grid = document.getElementById('timeline-grid');
      if (grid) updateNowLine(grid);
    }
  }, 60000);

  /* ─── DAY NAVIGATION ─── */
  function updateDayLabel() {
    const d      = viewDate();
    const dow    = d.getDay();
    const isToday= viewDayOffset === 0;
    const label  = isToday
      ? 'Hoje — ' + DOW_FULL[dow] + ', ' + d.toLocaleDateString('pt-BR', {day:'numeric', month:'long'})
      : DOW_FULL[dow] + ', ' + d.toLocaleDateString('pt-BR', {day:'numeric', month:'long'});
    const el = document.getElementById('today-label');
    if (el) el.textContent = label;

    // Disable/enable arrows
    document.getElementById('btn-day-prev').disabled = viewDayOffset <= -7;
    document.getElementById('btn-day-next').disabled = viewDayOffset >= 7;
    document.getElementById('btn-day-today').style.display = isToday ? 'none' : 'inline-flex';
  }

  document.getElementById('btn-day-prev')?.addEventListener('click', () => {
    if (viewDayOffset > -7) { viewDayOffset--; buildTimeline(); updateDayLabel(); }
  });
  document.getElementById('btn-day-next')?.addEventListener('click', () => {
    if (viewDayOffset < 7)  { viewDayOffset++; buildTimeline(); updateDayLabel(); }
  });
  document.getElementById('btn-day-today')?.addEventListener('click', () => {
    viewDayOffset = 0; buildTimeline(); updateDayLabel();
  });

  /* ─── WEEK GRID ─── */
  function buildWeekGrid() {
    const container = document.getElementById('week-grid');
    if (!container) return;

    const todayDow = new Date().getDay();

    // Header row
    let header = '<div class="wg-row wg-header"><div class="wg-time-col"></div>';
    for (let d = 0; d < 7; d++) {
      const isToday = d === todayDow;
      header += `<div class="wg-day-col${isToday?' wg-today':''}">${DOW_NAMES[d]}</div>`;
    }
    header += '</div>';

    // Hour rows
    let rows = '';
    for (let h = 0; h < 24; h++) {
      rows += `<div class="wg-row"><div class="wg-time-col">${String(h).padStart(2,'0')}h</div>`;
      for (let d = 0; d < 7; d++) {
        const dayEvs = events.filter(e => e.days?.includes(d));
        const active = dayEvs.find(ev => {
          let s = toMin(ev.start), e2 = toMin(ev.end);
          if (e2 <= s) e2 += 1440;
          return h*60 >= s && h*60 < e2;
        });
        const isToday = d === todayDow;
        const style   = active ? `background:${active.color}33; border-left:2px solid ${active.color};` : '';
        const tip     = active ? `title="${escH(active.title)} ${active.start}–${active.end}"` : '';
        rows += `<div class="wg-cell${isToday?' wg-today':''}" ${tip} style="${style}">${active && h*60 === toMin(active.start) ? `<span class="wg-ev-label" style="color:${active.color}">${escH(active.title)}</span>` : ''}</div>`;
      }
      rows += '</div>';
    }

    container.innerHTML = header + rows;
  }

  /* ─── LIFE DONUT ─── */
  function buildLifeChart() {
    const canvas = document.getElementById('life-chart');
    const legend = document.getElementById('life-legend');
    const note   = document.getElementById('free-time-note');
    if (!canvas) return;

    const totals = {};
    events.forEach(ev => {
      let s = toMin(ev.start), e2 = toMin(ev.end);
      if (e2 <= s) e2 += 1440;
      const durH       = (e2 - s) / 60;
      const daysPerWk  = (ev.days || [0,1,2,3,4,5,6]).length;
      const dailyAvg   = durH * (daysPerWk / 7);
      totals[ev.category] = (totals[ev.category] || 0) + dailyAvg;
    });

    const usedH  = Object.values(totals).reduce((a,b)=>a+b,0);
    const freeH  = Math.max(0, 24 - usedH);
    const cats   = Object.keys(totals);

    const labels = [...cats.map(c => CAT[c]?.label || c), '⬜ Livre'];
    const data   = [...cats.map(c => +totals[c].toFixed(2)), +freeH.toFixed(2)];
    const colors = [...cats.map(c => CAT[c]?.color || '#9ca3af'), '#1a1a2e'];

    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

    if (lifeChart) lifeChart.destroy();
    lifeChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c+'cc'), borderColor: colors, borderWidth: 2, hoverOffset: 8 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: css('--surface-2'), titleColor: '#e8e8f0', bodyColor: css('--text-2'),
            borderColor: css('--border'), borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.parsed.toFixed(1)}h/dia (${Math.round(ctx.parsed/24*100)}%)` }
          }
        }
      }
    });

    if (legend) {
      legend.innerHTML = [...cats.map(c => ({ label: CAT[c]?.label||c, color: CAT[c]?.color||'#9ca3af', hours: totals[c] })),
        { label:'⬜ Livre', color:'#3a3a5c', hours: freeH }]
        .filter(i => i.hours > 0.05)
        .sort((a,b) => b.hours - a.hours)
        .map(item => `
          <div class="life-legend-item">
            <div class="leg-left"><span class="leg-dot" style="background:${item.color}"></span><span>${item.label}</span></div>
            <div style="text-align:right">
              <span class="life-hours">${item.hours.toFixed(1)}h</span>
              <span class="life-pct"> · ${Math.round(item.hours/24*100)}%</span>
            </div>
          </div>`).join('');
    }

    if (note) {
      note.innerHTML = freeH <= 0
        ? '⚠️ Dia <strong>100% preenchido</strong>. Considere revisar.'
        : `Média de <strong>${freeH.toFixed(1)}h livres</strong> por dia (${Math.round(freeH/24*100)}%).`;
    }
  }

  /* ─── EVENTS LIST ─── */
  function buildEventsList() {
    const container = document.getElementById('events-list');
    const countEl   = document.getElementById('events-count');
    if (!container) return;
    if (countEl) countEl.textContent = events.length;
    if (!events.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--text-3);font-size:13px;padding:20px 0">Nenhum bloco cadastrado ainda</div>';
      return;
    }
    const sorted = [...events].sort((a,b) => toMin(a.start) - toMin(b.start));
    container.innerHTML = sorted.map(ev => {
      const days = (ev.days||[]).map(d => DOW_NAMES[d]).join(', ');
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border)">
          <div style="width:10px;height:36px;border-radius:4px;background:${ev.color};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escH(ev.title)}</div>
            <div style="font-size:11px;color:var(--text-3)">${ev.start}–${ev.end} · ${days}</div>
          </div>
          <button class="btn-icon-sm" onclick="schedDelete('${ev.id}')" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
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
      id: generateId(), title, category: document.getElementById('ev-category')?.value||'other',
      color: document.getElementById('ev-color')?.value||'#6ee7b7', start, end, days
    });
    save(); renderAll();
    document.getElementById('add-event-panel').style.display = 'none';
    document.getElementById('ev-title').value = '';
    Toast.show('Bloco adicionado!', 'success');
  }

  /* ─── DELETE ─── */
  window.schedDelete = id => confirmDelete(id);

  function confirmDelete(id) {
    deletingId = id;
    const ev = events.find(e => e.id === id);
    const el = document.getElementById('del-ev-name');
    if (el) el.textContent = `Remover "${ev?.title || 'este bloco'}"?`;
    openModal('delete-ev-modal');
  }

  document.getElementById('confirm-del')?.addEventListener('click', () => {
    events = events.filter(e => e.id !== deletingId);
    save(); renderAll(); closeModal('delete-ev-modal');
    Toast.show('Bloco removido', 'info'); deletingId = null;
  });
  document.getElementById('cancel-del')?.addEventListener('click',     () => closeModal('delete-ev-modal'));
  document.getElementById('close-del-modal')?.addEventListener('click', () => closeModal('delete-ev-modal'));

  /* ─── CLEAR ─── */
  document.getElementById('btn-clear-schedule')?.addEventListener('click', () => {
    if (!events.length) { Toast.show('Cronograma vazio', 'info'); return; }
    if (!confirm('Limpar todo o cronograma?')) return;
    events = []; save(); renderAll(); Toast.show('Cronograma limpo', 'info');
  });

  /* ─── PANEL TOGGLE ─── */
  document.getElementById('btn-add-event')?.addEventListener('click', () => {
    const p = document.getElementById('add-event-panel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
    if (p.style.display === 'block') document.getElementById('ev-title')?.focus();
  });
  document.getElementById('btn-save-event')?.addEventListener('click',  addEvent);
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => {
    document.getElementById('add-event-panel').style.display = 'none';
  });

  /* ─── TODAY LABEL ─── */
  const todayLabelEl = document.getElementById('today-label');
  if (todayLabelEl) {
    todayLabelEl.textContent = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  }

  /* ─── RENDER ALL ─── */
  function renderAll() {
    buildTimeline();
    buildWeekGrid();
    buildLifeChart();
    buildEventsList();
    updateDayLabel();
  }

  initColorPicker();
  initPresets();
  renderAll();
});
