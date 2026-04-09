/**
 * FlowState — dashboard-layout.js
 * 
 * Two features, both 100% localStorage — never synced to Supabase:
 *
 * 1. LAYOUT MANAGER
 *    Lets users hide/show and reorder the built-in dashboard cards.
 *    Applied immediately on page load via CSS classes and DOM reorder.
 *    Controlled from Settings → Layout page.
 *
 * 2. CUSTOM BLOCKS
 *    User-defined cards rendered in the dashboard content-grid.
 *    Each block has: title, icon (emoji), content (text / link / note).
 *    Create/edit/delete from an inline panel on the Dashboard.
 */

/* ─── STORAGE KEYS ─── */
const LAYOUT_KEY  = 'dashboard_layout';   // { order: string[], hidden: string[] }
const BLOCKS_KEY  = 'custom_blocks';      // [{ id, title, icon, content, color }]

/* ─── BUILT-IN CARD IDs (match data-card attribute in index.html) ─── */
const BUILTIN_CARDS = [
  { id: 'pomodoro',  label: 'Pomodoro',          icon: '⏱️' },
  { id: 'tasks',     label: 'Tarefas de Hoje',    icon: '✅' },
  { id: 'goals',     label: 'Metas do Dia',       icon: '🏆' },
  { id: 'chart',     label: 'Produtividade',       icon: '📊' },
];

/* ─── HELPERS ─── */
function getLayout() {
  return Store.get(LAYOUT_KEY, { order: BUILTIN_CARDS.map(c => c.id), hidden: [] });
}
function saveLayout(layout) { Store.set(LAYOUT_KEY, layout); }

function getBlocks() { return Store.get(BLOCKS_KEY, []); }
function saveBlocks(blocks) { Store.set(BLOCKS_KEY, blocks); }

function genId() { return 'cb_' + Math.random().toString(36).slice(2, 9); }

/* ─── APPLY LAYOUT TO DASHBOARD DOM ─── */
function applyLayout() {
  const grid = document.getElementById('dashboard-content-grid');
  if (!grid) return;

  const layout = getLayout();

  // 1. Hide / show built-in cards
  BUILTIN_CARDS.forEach(({ id }) => {
    const el = grid.querySelector(`[data-card="${id}"]`);
    if (!el) return;
    if (layout.hidden.includes(id)) {
      el.style.display = 'none';
    } else {
      el.style.display = '';
    }
  });

  // 2. Reorder built-in cards by stored order
  const ordered = layout.order
    .map(id => grid.querySelector(`[data-card="${id}"]`))
    .filter(Boolean);
  ordered.forEach(el => grid.appendChild(el)); // move to end in order (appendChild reorders)

  // 3. Render custom blocks
  renderCustomBlocks(grid, layout);
}

/* ─── RENDER CUSTOM BLOCKS ─── */
function renderCustomBlocks(grid, layout) {
  // Remove existing custom block cards from DOM
  grid.querySelectorAll('[data-custom-block]').forEach(el => el.remove());

  const blocks = getBlocks();
  if (!blocks.length) return;

  blocks.forEach(block => {
    if (layout.hidden.includes(block.id)) return;

    const card = document.createElement('div');
    card.className = 'card custom-block-card';
    card.setAttribute('data-custom-block', block.id);
    card.setAttribute('data-card', block.id);

    // Determine content HTML
    let bodyHtml = '';
    const text = (block.content || '').trim();
    if (text.startsWith('http://') || text.startsWith('https://')) {
      bodyHtml = `<a href="${escHtml(text)}" target="_blank" rel="noopener"
        style="color:var(--primary);font-size:14px;word-break:break-all">${escHtml(text)}</a>`;
    } else {
      bodyHtml = `<p style="font-size:14px;color:var(--text-2);line-height:1.6;white-space:pre-wrap">${escHtml(text)}</p>`;
    }

    card.innerHTML = `
      <div class="card-header">
        <h2 class="card-title">
          <span style="font-size:16px;margin-right:4px">${escHtml(block.icon || '📌')}</span>
          ${escHtml(block.title)}
        </h2>
        <div style="display:flex;gap:4px">
          <button class="btn-icon-sm cb-edit" data-id="${block.id}" title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon-sm cb-delete" data-id="${block.id}" title="Remover"
            style="color:var(--danger)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="custom-block-body">${bodyHtml}</div>`;

    card.querySelector('.cb-edit').addEventListener('click', () => openBlockEditor(block.id));
    card.querySelector('.cb-delete').addEventListener('click', () => deleteBlock(block.id));

    grid.appendChild(card);
  });
}

/* ─── CUSTOM BLOCK CRUD ─── */
function deleteBlock(id) {
  const blocks = getBlocks().filter(b => b.id !== id);
  saveBlocks(blocks);

  // Also remove from layout hidden list if it was there
  const layout = getLayout();
  layout.hidden = layout.hidden.filter(h => h !== id);
  saveLayout(layout);

  applyLayout();
  Toast.show('Bloco removido', 'info', 2000);
}

function openBlockEditor(id) {
  const blocks = getBlocks();
  const block  = id ? blocks.find(b => b.id === id) : null;

  const modal = document.getElementById('custom-block-modal');
  if (!modal) return;

  document.getElementById('cb-modal-title').textContent = id ? 'Editar Bloco' : 'Novo Bloco';
  document.getElementById('cb-id').value      = id || '';
  document.getElementById('cb-title').value   = block?.title   || '';
  document.getElementById('cb-icon').value    = block?.icon    || '📌';
  document.getElementById('cb-content').value = block?.content || '';

  modal.classList.add('open');
  document.getElementById('cb-title').focus();
}

function saveBlock() {
  const id      = document.getElementById('cb-id').value;
  const title   = document.getElementById('cb-title').value.trim();
  const icon    = document.getElementById('cb-icon').value.trim()   || '📌';
  const content = document.getElementById('cb-content').value.trim();

  if (!title) { Toast.show('Dê um título ao bloco', 'warning'); return; }

  const blocks = getBlocks();

  if (id) {
    // Edit existing
    const idx = blocks.findIndex(b => b.id === id);
    if (idx !== -1) blocks[idx] = { ...blocks[idx], title, icon, content };
  } else {
    // New block
    blocks.push({ id: genId(), title, icon, content });
  }

  saveBlocks(blocks);
  document.getElementById('custom-block-modal').classList.remove('open');
  applyLayout();
  Toast.show(id ? 'Bloco atualizado!' : 'Bloco criado!', 'success');
}

/* ─── ESCAPE HTML ─── */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── INIT ON DASHBOARD ─── */
document.addEventListener('DOMContentLoaded', () => {
  const isDashboard = !!document.getElementById('dashboard-content-grid');
  if (!isDashboard) return;

  // Apply saved layout immediately
  applyLayout();

  // "Novo Bloco" button
  document.getElementById('btn-new-custom-block')?.addEventListener('click', () => {
    openBlockEditor(null);
  });

  // Modal save / cancel
  document.getElementById('cb-save')?.addEventListener('click', saveBlock);
  document.getElementById('cb-cancel')?.addEventListener('click', () => {
    document.getElementById('custom-block-modal').classList.remove('open');
  });
  document.getElementById('cb-modal-close')?.addEventListener('click', () => {
    document.getElementById('custom-block-modal').classList.remove('open');
  });

  // Enter key saves
  document.getElementById('cb-title')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveBlock();
  });
});

/* ─── SETTINGS PAGE: LAYOUT PANEL ─── */
// Called by settings-layout.js (loaded only on settings page)
function initLayoutSettings() {
  const container = document.getElementById('layout-cards-list');
  if (!container) return;

  function renderLayoutList() {
    const layout = getLayout();
    const blocks = getBlocks();

    // Combine built-in + custom for display
    const allCards = [
      ...BUILTIN_CARDS,
      ...blocks.map(b => ({ id: b.id, label: b.title, icon: b.icon || '📌', custom: true }))
    ];

    // Sort by current order (items not in order go to end)
    allCards.sort((a, b) => {
      const oi = layout.order.indexOf(a.id);
      const oj = layout.order.indexOf(b.id);
      return (oi === -1 ? 999 : oi) - (oj === -1 ? 999 : oj);
    });

    container.innerHTML = '';
    allCards.forEach(card => {
      const hidden = layout.hidden.includes(card.id);
      const row = document.createElement('div');
      row.className = 'layout-card-row';
      row.setAttribute('draggable', 'true');
      row.dataset.cardId = card.id;
      row.innerHTML = `
        <span class="layout-drag-handle" title="Arrastar para reordenar">
          <i class="fa-solid fa-grip-vertical"></i>
        </span>
        <span class="layout-card-icon">${card.icon}</span>
        <span class="layout-card-label">${escHtml(card.label)}</span>
        ${card.custom ? '<span class="layout-custom-badge">personalizado</span>' : ''}
        <label class="toggle" style="margin-left:auto">
          <input type="checkbox" class="layout-visibility-toggle" data-id="${card.id}"
            ${hidden ? '' : 'checked'} />
          <span class="toggle-slider"></span>
        </label>`;

      // Visibility toggle
      row.querySelector('.layout-visibility-toggle').addEventListener('change', e => {
        const l = getLayout();
        if (e.target.checked) {
          l.hidden = l.hidden.filter(h => h !== card.id);
        } else {
          if (!l.hidden.includes(card.id)) l.hidden.push(card.id);
        }
        saveLayout(l);
        Toast.show('Layout salvo', 'success', 1500);
      });

      container.appendChild(row);
    });

    // Drag-and-drop reorder
    let dragSrc = null;
    container.querySelectorAll('.layout-card-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragSrc = row;
        row.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '';
        container.querySelectorAll('.layout-card-row').forEach(r => r.classList.remove('drag-over'));
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.layout-card-row').forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
      });
      row.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrc || dragSrc === row) return;
        row.classList.remove('drag-over');

        // Reorder in DOM
        const rows = [...container.querySelectorAll('.layout-card-row')];
        const srcIdx = rows.indexOf(dragSrc);
        const dstIdx = rows.indexOf(row);
        if (srcIdx < dstIdx) row.after(dragSrc);
        else row.before(dragSrc);

        // Save new order to localStorage
        const newOrder = [...container.querySelectorAll('.layout-card-row')]
          .map(r => r.dataset.cardId);
        const l = getLayout();
        l.order = newOrder;
        saveLayout(l);
        Toast.show('Ordem salva', 'success', 1500);
      });
    });
  }

  renderLayoutList();

  // Re-render when blocks change (e.g., user adds/removes custom blocks)
  document.getElementById('btn-reset-layout')?.addEventListener('click', () => {
    saveLayout({ order: BUILTIN_CARDS.map(c => c.id), hidden: [] });
    saveBlocks([]);
    renderLayoutList();
    Toast.show('Layout redefinido', 'info');
  });
}
