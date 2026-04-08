/**
 * FlowState — todo.js
 * - Simple tasks with date shortcuts (Hoje, Amanhã, +7 dias)
 * - Recurring tasks (weekly by day-of-week / monthly by day-of-month)
 * - Drag & drop reordering
 * - Filters: status, category, priority
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('tasks-container')) return;

  /* ─── STATE ─── */
  let tasks          = Store.get('tasks', []);
  let currentFilter  = 'all';
  let filterCategory = '';
  let filterPriority = '';
  let dragSrcId      = null;
  let editingId      = null;
  // Which "new task" mode is open: null | 'simple' | 'recurring'
  let addMode        = null;

  /* ─── ELEMENTS ─── */
  const container  = document.getElementById('tasks-container');
  const emptyState = document.getElementById('empty-state');
  const summary    = document.getElementById('tasks-summary');

  /* ─── HELPERS ─── */
  const generateId = () => '_' + Math.random().toString(36).substr(2, 9);
  const save       = () => Store.set('tasks', tasks);
  const escHtml    = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function todayISO() { return new Date().toISOString().split('T')[0]; }
  function offsetDate(days) {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  function formatDue(dateStr) {
    if (!dateStr) return '';
    const d    = new Date(dateStr + 'T00:00:00');
    const now  = new Date(); now.setHours(0,0,0,0);
    const diff = Math.round((d - now) / 86400000);
    if (diff < 0)  return `<span class="task-due overdue"><i class="fa-solid fa-triangle-exclamation"></i> ${Math.abs(diff)}d atrás</span>`;
    if (diff === 0) return `<span class="task-due" style="color:var(--accent-yellow)">Hoje</span>`;
    if (diff === 1) return `<span class="task-due">Amanhã</span>`;
    return `<span class="task-due"><i class="fa-regular fa-calendar"></i> ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>`;
  }

  const catLabels = { personal:'👤 Pessoal', work:'💼 Trabalho', study:'📚 Estudo', health:'❤️ Saúde', other:'📌 Outro' };
  const priLabels = { high:'🔴 Alta', medium:'🟡 Média', low:'🟢 Baixa' };
  const DOW_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  /* ─── RECURRING LOGIC ─── */
  function isRecurringDueToday(task) {
    const dow = new Date().getDay();
    const dom = new Date().getDate();
    if (task.recurringType === 'weekly'  && Array.isArray(task.recurringDays)) return task.recurringDays.includes(dow);
    if (task.recurringType === 'monthly' && task.recurringDay) return task.recurringDay === dom;
    return false;
  }

  function recurringLabel(task) {
    if (task.recurringType === 'weekly') {
      const names = (task.recurringDays || []).map(d => DOW_LABELS[d]).join(', ');
      return `🔁 Semanal · ${names}`;
    }
    if (task.recurringType === 'monthly') {
      return `🔁 Mensal · Dia ${task.recurringDay}`;
    }
    return '';
  }

  /* ─── FILTER ─── */
  function filteredTasks() {
    return tasks.filter(t => {
      if (currentFilter === 'done'    && !t.done) return false;
      if (currentFilter === 'pending' && t.done)  return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      return true;
    });
  }

  /* ─── RENDER ─── */
  function render() {
    const list    = filteredTasks();
    const pending = tasks.filter(t => !t.done).length;
    const done    = tasks.filter(t => t.done).length;
    if (summary) summary.textContent = `${pending} pendente${pending!==1?'s':''} · ${done} concluída${done!==1?'s':''}`;

    if (!list.length) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';
    container.innerHTML = list.map(renderTask).join('');

    container.querySelectorAll('.task-item').forEach(el => {
      const id = el.dataset.id;
      el.querySelector('.task-checkbox')?.addEventListener('click', () => toggleTask(id));
      el.querySelector('.btn-delete')?.addEventListener('click',   () => deleteTask(id));
      el.querySelector('.btn-edit')?.addEventListener('click',     () => openEditModal(id));
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', e => { dragSrcId = id; el.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
      el.addEventListener('dragend',   () => el.classList.remove('dragging'));
      el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-over'); });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop',      e => { e.preventDefault(); el.classList.remove('drag-over'); if (dragSrcId && dragSrcId !== id) reorderTasks(dragSrcId, id); });
    });
  }

  function renderTask(task) {
    const catTag  = task.category ? `<span class="task-tag tag-${task.category}">${escHtml(catLabels[task.category]||task.category)}</span>` : '';
    const priTag  = task.priority ? `<span class="task-priority-badge priority-${task.priority}">${priLabels[task.priority]||task.priority}</span>` : '';
    const dueHtml = formatDue(task.due);
    const noteHtml= task.note ? `<div class="task-note">${escHtml(task.note)}</div>` : '';
    const recHtml = task.recurringType ? `<span class="task-due" style="color:var(--accent-purple)">${recurringLabel(task)}</span>` : '';

    return `
      <div class="task-item ${task.done?'done':''}" data-id="${task.id}">
        <div class="task-checkbox"></div>
        <div class="task-body">
          <div class="task-text">${escHtml(task.text)}</div>
          ${noteHtml}
          <div class="task-meta">${catTag}${priTag}${dueHtml}${recHtml}</div>
        </div>
        <div class="task-actions">
          <button class="btn-icon-sm btn-edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon-sm btn-delete" title="Excluir" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
  }

  /* ─── CRUD ─── */
  function addSimpleTask() {
    const text = document.getElementById('task-input')?.value.trim();
    if (!text) { Toast.show('Digite o nome da tarefa', 'warning'); return; }
    tasks.unshift({
      id: generateId(), text,
      note:      document.getElementById('task-note')?.value.trim()     || '',
      priority:  document.getElementById('task-priority')?.value        || 'medium',
      category:  document.getElementById('task-category')?.value        || 'personal',
      due:       document.getElementById('task-due')?.value             || '',
      done: false, createdAt: new Date().toISOString(), doneAt: null
    });
    save(); render(); closeAddPanel();
    Toast.show('Tarefa adicionada!', 'success');
  }

  function addRecurringTask() {
    const text = document.getElementById('rec-task-input')?.value.trim();
    if (!text) { Toast.show('Digite o nome da tarefa', 'warning'); return; }
    const recType = document.querySelector('input[name="rec-type"]:checked')?.value || 'weekly';

    let recurringDays = null;
    let recurringDay  = null;

    if (recType === 'weekly') {
      recurringDays = [...document.querySelectorAll('.dow-btn.selected')].map(b => parseInt(b.dataset.dow));
      if (!recurringDays.length) { Toast.show('Selecione ao menos um dia da semana', 'warning'); return; }
    } else {
      recurringDay = parseInt(document.getElementById('rec-dom')?.value) || 1;
    }

    tasks.unshift({
      id: generateId(), text,
      note:          document.getElementById('rec-note')?.value.trim()  || '',
      priority:      document.getElementById('rec-priority')?.value     || 'medium',
      category:      document.getElementById('rec-category')?.value     || 'personal',
      recurringType: recType,
      recurringDays,
      recurringDay,
      done: false, createdAt: new Date().toISOString(), doneAt: null
    });
    save(); render(); closeAddPanel();
    Toast.show('Tarefa recorrente criada!', 'success');
  }

  function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.done   = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
    save(); render();
    if (t.done) Toast.show('Tarefa concluída! 🎉', 'success', 2000);
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save(); render();
    // Propaga deleção ao Supabase diretamente (save() faz upsert dos restantes,
    // mas o select+diff do patch pode ser lento; deleteTask é imediato)
    if (typeof Sync !== 'undefined') Sync.deleteTask(id);
    Toast.show('Tarefa removida', 'info', 2000);
  }

  function reorderTasks(srcId, dstId) {
    const si = tasks.findIndex(t => t.id === srcId);
    const di = tasks.findIndex(t => t.id === dstId);
    if (si === -1 || di === -1) return;
    const [src] = tasks.splice(si, 1);
    tasks.splice(di, 0, src);
    save(); render();
  }

  /* ─── ADD PANEL ─── */
  function openAddPanel(mode) {
    addMode = mode;
    document.getElementById('add-simple-panel').style.display = mode === 'simple'    ? 'block' : 'none';
    document.getElementById('add-recurring-panel').style.display = mode === 'recurring' ? 'block' : 'none';
    document.getElementById('add-task-panel').style.display = 'block';
    if (mode === 'simple')    document.getElementById('task-input')?.focus();
    if (mode === 'recurring') document.getElementById('rec-task-input')?.focus();
  }

  function closeAddPanel() {
    addMode = null;
    document.getElementById('add-task-panel').style.display = 'none';
    // Clear fields
    ['task-input','task-note','task-due','rec-task-input','rec-note'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.querySelectorAll('.dow-btn').forEach(b => b.classList.remove('selected'));
  }

  /* ─── DATE SHORTCUTS ─── */
  document.querySelectorAll('.date-shortcut').forEach(btn => {
    btn.addEventListener('click', () => {
      const days = parseInt(btn.dataset.days);
      const field = document.getElementById('task-due');
      if (field) field.value = days === 0 ? todayISO() : offsetDate(days);
    });
  });

  /* ─── RECURRING TYPE TOGGLE ─── */
  document.querySelectorAll('input[name="rec-type"]').forEach(r => {
    r.addEventListener('change', () => {
      const isWeekly = r.value === 'weekly';
      document.getElementById('dow-picker').style.display   = isWeekly ? 'flex' : 'none';
      document.getElementById('dom-picker').style.display   = isWeekly ? 'none' : 'flex';
    });
  });

  /* ─── DOW BUTTONS ─── */
  document.querySelectorAll('.dow-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });

  /* ─── BUTTONS ─── */
  document.getElementById('btn-add-simple')?.addEventListener('click',    () => openAddPanel('simple'));
  document.getElementById('btn-add-recurring')?.addEventListener('click', () => openAddPanel('recurring'));
  document.getElementById('btn-save-task')?.addEventListener('click',     addSimpleTask);
  document.getElementById('btn-save-recurring')?.addEventListener('click',addRecurringTask);
  document.getElementById('btn-cancel-task')?.addEventListener('click',   closeAddPanel);
  document.getElementById('btn-cancel-recurring')?.addEventListener('click', closeAddPanel);

  document.getElementById('task-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addSimpleTask();
    if (e.key === 'Escape') closeAddPanel();
  });

  /* ─── EDIT MODAL ─── */
  function openEditModal(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    editingId = id;
    document.getElementById('edit-task-id').value       = id;
    document.getElementById('edit-task-text').value     = t.text;
    document.getElementById('edit-task-note').value     = t.note    || '';
    document.getElementById('edit-task-priority').value = t.priority|| 'medium';
    document.getElementById('edit-task-category').value = t.category|| 'personal';
    document.getElementById('edit-task-due').value      = t.due     || '';
    openModal('edit-modal');
  }

  document.getElementById('save-edit')?.addEventListener('click', () => {
    if (!editingId) return;
    const t = tasks.find(t => t.id === editingId);
    if (!t) return;
    const text = document.getElementById('edit-task-text').value.trim();
    if (!text) { Toast.show('O nome não pode ser vazio', 'warning'); return; }
    t.text     = text;
    t.note     = document.getElementById('edit-task-note').value.trim();
    t.priority = document.getElementById('edit-task-priority').value;
    t.category = document.getElementById('edit-task-category').value;
    t.due      = document.getElementById('edit-task-due').value;
    save(); render();
    closeModal('edit-modal');
    Toast.show('Tarefa atualizada!', 'success');
  });

  document.getElementById('cancel-edit')?.addEventListener('click',       () => closeModal('edit-modal'));
  document.getElementById('close-edit-modal')?.addEventListener('click',  () => closeModal('edit-modal'));

  /* ─── FILTERS ─── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  document.getElementById('filter-category')?.addEventListener('change', e => { filterCategory = e.target.value; render(); });
  document.getElementById('filter-priority')?.addEventListener('change', e => { filterPriority = e.target.value; render(); });

  document.getElementById('btn-clear-done')?.addEventListener('click', () => {
    const count = tasks.filter(t => t.done).length;
    if (!count) { Toast.show('Sem tarefas concluídas para limpar', 'info'); return; }
    const removedIds = tasks.filter(t => t.done).map(t => t.id);
    tasks = tasks.filter(t => !t.done);
    save(); render();
    // Propaga cada deleção ao Supabase
    if (typeof Sync !== 'undefined') {
      removedIds.forEach(id => Sync.deleteTask(id));
    }
    Toast.show(`${count} tarefa${count>1?'s':''} removida${count>1?'s':''}`, 'info');
  });

  render();
});
