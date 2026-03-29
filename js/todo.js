/**
 * FlowState — todo.js
 * Full task management: CRUD, filters, drag & drop, persistence
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('tasks-container')) return;

  /* ─── STATE ─── */
  let tasks       = Store.get('tasks', []);
  let currentFilter    = 'all';
  let filterCategory   = '';
  let filterPriority   = '';
  let dragSrcId        = null;
  let editingId        = null;

  /* ─── ELEMENTS ─── */
  const container  = document.getElementById('tasks-container');
  const emptyState = document.getElementById('empty-state');
  const summary    = document.getElementById('tasks-summary');
  const addPanel   = document.getElementById('add-task-panel');

  /* ─── HELPERS ─── */
  function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
  }

  function save() {
    Store.set('tasks', tasks);
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatDue(dateStr) {
    if (!dateStr) return '';
    const d    = new Date(dateStr + 'T00:00:00');
    const now  = new Date(); now.setHours(0,0,0,0);
    const diff = Math.round((d - now) / 86400000);
    if (diff < 0) return `<span class="task-due overdue"><i class="fa-solid fa-triangle-exclamation"></i> ${Math.abs(diff)}d atrás</span>`;
    if (diff === 0) return `<span class="task-due" style="color:var(--accent-yellow)">Hoje</span>`;
    if (diff === 1) return `<span class="task-due">Amanhã</span>`;
    return `<span class="task-due"><i class="fa-regular fa-calendar"></i> ${d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}</span>`;
  }

  const catLabels = { personal:'👤 Pessoal', work:'💼 Trabalho', study:'📚 Estudo', health:'❤️ Saúde', other:'📌 Outro' };
  const priLabels = { high:'🔴 Alta', medium:'🟡 Média', low:'🟢 Baixa' };

  /* ─── FILTER TASKS ─── */
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
    const list = filteredTasks();

    // Summary
    const pending = tasks.filter(t => !t.done).length;
    const done    = tasks.filter(t => t.done).length;
    if (summary) summary.textContent = `${pending} pendente${pending !== 1 ? 's' : ''} · ${done} concluída${done !== 1 ? 's' : ''}`;

    // Empty state
    if (list.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = list.map(task => renderTask(task)).join('');

    // Attach events
    container.querySelectorAll('.task-item').forEach(el => {
      const id = el.dataset.id;

      el.querySelector('.task-checkbox')?.addEventListener('click', () => toggleTask(id));
      el.querySelector('.btn-delete')?.addEventListener('click', () => deleteTask(id));
      el.querySelector('.btn-edit')?.addEventListener('click', () => openEditModal(id));

      // Drag & drop
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart', (e) => {
        dragSrcId = id;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.classList.add('drag-over');
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (dragSrcId && dragSrcId !== id) reorderTasks(dragSrcId, id);
      });
    });
  }

  function renderTask(task) {
    const catTag = task.category
      ? `<span class="task-tag tag-${task.category}">${catLabels[task.category] || task.category}</span>`
      : '';
    const priTag = task.priority
      ? `<span class="task-priority-badge priority-${task.priority}">${priLabels[task.priority] || task.priority}</span>`
      : '';
    const dueHtml = formatDue(task.due);
    const noteHtml = task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : '';

    return `
      <div class="task-item ${task.done ? 'done' : ''}" data-id="${task.id}">
        <div class="task-checkbox"></div>
        <div class="task-body">
          <div class="task-text">${escapeHtml(task.text)}</div>
          ${noteHtml}
          <div class="task-meta">
            ${catTag}
            ${priTag}
            ${dueHtml}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-icon-sm btn-edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon-sm btn-delete" title="Excluir" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  }

  /* ─── CRUD ─── */
  function addTask() {
    const text = document.getElementById('task-input')?.value.trim();
    if (!text) { Toast.show('Digite o nome da tarefa', 'warning'); return; }

    const task = {
      id:        generateId(),
      text,
      note:      document.getElementById('task-note')?.value.trim() || '',
      priority:  document.getElementById('task-priority')?.value || 'medium',
      category:  document.getElementById('task-category')?.value || 'personal',
      due:       document.getElementById('task-due')?.value || '',
      done:      false,
      createdAt: new Date().toISOString(),
      doneAt:    null
    };

    tasks.unshift(task);
    save();
    render();
    clearAddForm();
    Toast.show('Tarefa adicionada!', 'success');
  }

  function toggleTask(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.done  = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
    save();
    render();

    if (t.done) {
      Toast.show('Tarefa concluída! 🎉', 'success', 2000);
    }
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
    render();
    Toast.show('Tarefa removida', 'info', 2000);
  }

  function reorderTasks(srcId, dstId) {
    const srcIdx = tasks.findIndex(t => t.id === srcId);
    const dstIdx = tasks.findIndex(t => t.id === dstId);
    if (srcIdx === -1 || dstIdx === -1) return;
    const [src] = tasks.splice(srcIdx, 1);
    tasks.splice(dstIdx, 0, src);
    save();
    render();
  }

  /* ─── EDIT MODAL ─── */
  function openEditModal(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    editingId = id;
    document.getElementById('edit-task-id').value    = id;
    document.getElementById('edit-task-text').value  = t.text;
    document.getElementById('edit-task-note').value  = t.note || '';
    document.getElementById('edit-task-priority').value = t.priority || 'medium';
    document.getElementById('edit-task-category').value = t.category || 'personal';
    document.getElementById('edit-task-due').value   = t.due || '';
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
    save();
    render();
    closeModal('edit-modal');
    Toast.show('Tarefa atualizada!', 'success');
  });

  document.getElementById('cancel-edit')?.addEventListener('click', () => closeModal('edit-modal'));
  document.getElementById('close-edit-modal')?.addEventListener('click', () => closeModal('edit-modal'));

  /* ─── ADD FORM ─── */
  function clearAddForm() {
    ['task-input','task-note','task-due'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const p = document.getElementById('task-priority');
    const c = document.getElementById('task-category');
    if (p) p.value = 'medium';
    if (c) c.value = 'personal';
    if (addPanel) addPanel.style.display = 'none';
  }

  document.getElementById('btn-add-task')?.addEventListener('click', () => {
    if (addPanel) addPanel.style.display = addPanel.style.display === 'none' ? 'block' : 'none';
    document.getElementById('task-input')?.focus();
  });

  document.getElementById('btn-save-task')?.addEventListener('click', addTask);

  document.getElementById('task-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
    if (e.key === 'Escape') clearAddForm();
  });

  document.getElementById('btn-cancel-task')?.addEventListener('click', clearAddForm);

  /* ─── FILTERS ─── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  document.getElementById('filter-category')?.addEventListener('change', (e) => {
    filterCategory = e.target.value;
    render();
  });

  document.getElementById('filter-priority')?.addEventListener('change', (e) => {
    filterPriority = e.target.value;
    render();
  });

  document.getElementById('btn-clear-done')?.addEventListener('click', () => {
    const count = tasks.filter(t => t.done).length;
    if (!count) { Toast.show('Sem tarefas concluídas para limpar', 'info'); return; }
    tasks = tasks.filter(t => !t.done);
    save();
    render();
    Toast.show(`${count} tarefa${count > 1 ? 's' : ''} removida${count > 1 ? 's' : ''}`, 'info');
  });

  /* ─── INITIAL RENDER ─── */
  render();
});
