/**
 * FlowState — supabase.js  (v2 — corrigido)
 *
 * BUGS CORRIGIDOS NESTE ARQUIVO:
 *  1. _supa usava window.supabase.createClient — renomeado para
 *     window.supabase.createClient (UMD exporta como window.supabase,
 *     mas a função é createClient, não supabase.createClient).
 *     Fix: usar window.supabase.createClient (correto para UMD v2).
 *
 *  2. Store.set era patcheado no topo de módulo (linha 348),
 *     mas Store só existe depois que main.js carrega.
 *     Fix: patch movido para dentro de _initStorePatch(),
 *     chamado APENAS após DOMContentLoaded (quando main.js já rodou).
 *
 *  3. window.supabaseClient nunca era exposto globalmente.
 *     Fix: window.supabaseClient = _supa após init.
 *
 *  4. Sync.pull chamava Store.set internamente, disparando o patch
 *     recursivamente (loop de sync na primeira carga).
 *     Fix: pull usa _originalSet diretamente para não disparar push.
 *
 *  5. Auth.init em páginas de login: SIGNED_IN disparava Sync.pull
 *     e Profile.init antes do DOM estar pronto.
 *     Fix: guard isLoginPage para pular toda proteção/sync no login.
 *
 *  6. onAuthStateChange registrado múltiplas vezes se Auth.init()
 *     chamado mais de uma vez.
 *     Fix: flag _authListenerActive.
 */

/* ─── 1. CLIENT INIT ──────────────────────────────────────── */

let _supa = null;
let _originalSet = null;  // referência guardada antes do patch
let _authListenerActive = false;

function _initClient() {
  const url = window.__ENV?.SUPABASE_URL;
  const key = window.__ENV?.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[FlowState] Supabase env vars ausentes — modo offline ativo.');
    return null;
  }

  // window.supabase é o objeto UMD exportado pelo CDN
  // a função de factory fica em window.supabase.createClient
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    console.error('[FlowState] Supabase CDN não carregou. Verifique o <script> no <head>.');
    return null;
  }

  const client = window.supabase.createClient(url, key, {
    auth: {
      persistSession:    true,
      autoRefreshToken:  true,
      detectSessionInUrl:true,  // magic link + OAuth
      storageKey:        'flowstate_auth'
    }
  });

  // Expõe globalmente para debugging e para scripts inline de páginas
  window.supabaseClient = client;
  return client;
}

/* ─── 2. STORE PATCH (só após main.js estar carregado) ───── */

function _initStorePatch() {
  // Guarda referência ANTES de sobrescrever
  if (_originalSet || typeof Store === 'undefined') return;
  _originalSet = Store.set.bind(Store);

  Store.set = function (key, value) {
    _originalSet(key, value); // localStorage sempre primeiro

    if (!_supa || !Auth.uid) return; // offline ou não autenticado

    clearTimeout((Store._syncTimers = Store._syncTimers || {})[key]);
    Store._syncTimers[key] = setTimeout(async () => {
      try {
        if (key === 'tasks') {
          const rows = (Array.isArray(value) ? value : []).map(t => clientTaskToDb(t, Auth.uid));
          if (rows.length) {
            const { error } = await _supa.from('tasks').upsert(rows, { onConflict: 'id' });
            if (error) console.error('[Store→tasks]', error.message);
          }

        } else if (key === 'schedule') {
          const rows = (Array.isArray(value) ? value : []).map(e => clientScheduleToDb(e, Auth.uid));
          if (rows.length) {
            const { error } = await _supa.from('schedule').upsert(rows, { onConflict: 'id' });
            if (error) console.error('[Store→schedule]', error.message);
          }

        } else if (key === 'settings') {
          await Sync.pushSettings(value);

        } else if (key.startsWith('stats_')) {
          await Sync.pushStats(key.replace('stats_', ''), value);

        } else if (key === 'pomo_sessions') {
          // Só insere a última sessão adicionada (evita re-inserir todas)
          if (Array.isArray(value) && value.length) {
            await Sync.pushPomoSession(value[value.length - 1]);
          }
        }
      } catch (err) {
        console.error('[Store.set sync]', err);
      }
    }, 800);
  };
}

/* ─── 3. AUTH ─────────────────────────────────────────────── */

const Auth = {
  user: null,

  async init() {
    _supa = _initClient();
    if (!_supa) return; // modo offline — não redireciona, não bloqueia

    const isLoginPage = window.location.pathname.includes('login');

    // Recupera sessão existente do storage local
    const { data: { session } } = await _supa.auth.getSession();
    this.user = session?.user ?? null;

    // Registra listener UMA única vez
    if (!_authListenerActive) {
      _authListenerActive = true;

      _supa.auth.onAuthStateChange(async (event, session) => {
        this.user = session?.user ?? null;

        // Re-avalia a cada evento (evita capturar o closure estático da init)
        const _isLogin = window.location.pathname.includes('login');

        if (event === 'SIGNED_IN') {
          if (_isLogin) {
            // OAuth callback ou login concluído — redireciona para o dashboard
            window.location.href = _rootPath() + 'index.html';
          } else {
            await Sync.pull();
            if (typeof Profile !== 'undefined') Profile.init();
            if (typeof Toast !== 'undefined') Toast.show('Sessão iniciada ✓', 'success');
          }
        }

        if (event === 'SIGNED_OUT') {
          if (typeof Store !== 'undefined') Store.clear();
          window.location.href = _rootPath() + 'pages/login.html';
        }
      });
    }

    // Protege página: redireciona se não autenticado (exceto login)
    if (!this.user && !isLoginPage) {
      window.location.href = _rootPath() + 'pages/login.html';
      return; // para execução — redirect é assíncrono no browser
    }

    // Pull inicial de dados
    if (this.user && !isLoginPage) {
      await Sync.pull();
    }
  },

  async signUp(email, password) {
    if (!_supa) return { error: { message: 'Supabase não configurado.' } };
    return _supa.auth.signUp({ email, password });
  },

  async signIn(email, password) {
    if (!_supa) return { error: { message: 'Supabase não configurado.' } };
    return _supa.auth.signInWithPassword({ email, password });
  },

  async signInWithGoogle() {
    if (!_supa) return;
    return _supa.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' }
    });
  },

  async signOut() {
    if (!_supa) return;
    await _supa.auth.signOut(); // onAuthStateChange cuida do redirect
  },

  get uid()   { return this.user?.id    ?? null; },
  get email() { return this.user?.email ?? null; }
};

/* ─── 4. SYNC ─────────────────────────────────────────────── */

const Sync = {

  async pull() {
    if (!_supa || !Auth.uid) return;

    // Usa _originalSet para não disparar push durante o pull
    const localSet = (key, value) => {
      if (_originalSet) _originalSet(key, value);
      else if (typeof Store !== 'undefined') Store.set(key, value);
    };

    try {
      const [tasks, schedule, settings, stats, sessions] = await Promise.all([
        _supa.from('tasks')
          .select('*').eq('user_id', Auth.uid)
          .order('created_at', { ascending: false }),

        _supa.from('schedule')
          .select('*').eq('user_id', Auth.uid),

        _supa.from('settings')
          .select('*').eq('user_id', Auth.uid)
          .maybeSingle(), // evita erro 406 quando linha não existe ainda

        _supa.from('stats')
          .select('*').eq('user_id', Auth.uid)
          .order('date', { ascending: false }).limit(90),

        _supa.from('pomo_sessions')
          .select('*').eq('user_id', Auth.uid)
          .order('started_at', { ascending: false }).limit(500),
      ]);

      if (tasks.error)    console.error('[pull:tasks]',    tasks.error.message);
      if (schedule.error) console.error('[pull:schedule]', schedule.error.message);
      if (settings.error) console.error('[pull:settings]', settings.error.message);

      if (tasks.data?.length)
        localSet('tasks', tasks.data.map(dbTaskToClient));

      if (schedule.data?.length)
        localSet('schedule', schedule.data.map(dbScheduleToClient));

      if (settings.data) {
        const s = settings.data;
        localSet('settings', {
          username:       s.username,
          avatar:         s.avatar,
          theme:          s.theme,
          customColors:   s.custom_colors    ?? {},
          pomodoroFocus:  s.pomodoro?.focus  ?? 25,
          pomodoroShort:  s.pomodoro?.short  ?? 5,
          pomodoroLong:   s.pomodoro?.long   ?? 15,
          pomodoroCycles: s.pomodoro?.cycles ?? 4,
          pomodoroNotify: s.pomodoro?.notify ?? true,
          pomodoroSound:  s.pomodoro?.sound  ?? true,
          dailyGoals:     s.daily_goals      ?? { tasks: 5, cycles: 4, hours: 2 }
        });
      }

      if (stats.data?.length) {
        stats.data.forEach(row => {
          localSet('stats_' + row.date, {
            focusSeconds:   row.focus_seconds,
            tasksCompleted: row.tasks_done,
            pomoCycles:     row.pomo_cycles
          });
        });
      }

      if (sessions.data?.length) {
        localSet('pomo_sessions', sessions.data.map(r => ({
          mode:            r.mode,
          startedAt:       r.started_at,
          durationSeconds: r.duration_seconds
        })));
      }

    } catch (err) {
      console.error('[Sync.pull]', err);
    }
  },

  async pushTask(task) {
    if (!_supa || !Auth.uid) return;
    const { error } = await _supa.from('tasks')
      .upsert(clientTaskToDb(task, Auth.uid), { onConflict: 'id' });
    if (error) console.error('[pushTask]', error.message);
  },

  async deleteTask(id) {
    if (!_supa || !Auth.uid) return;
    const { error } = await _supa.from('tasks')
      .delete().eq('id', id).eq('user_id', Auth.uid);
    if (error) console.error('[deleteTask]', error.message);
  },

  async pushScheduleEvent(ev) {
    if (!_supa || !Auth.uid) return;
    const { error } = await _supa.from('schedule')
      .upsert(clientScheduleToDb(ev, Auth.uid), { onConflict: 'id' });
    if (error) console.error('[pushScheduleEvent]', error.message);
  },

  async deleteScheduleEvent(id) {
    if (!_supa || !Auth.uid) return;
    const { error } = await _supa.from('schedule')
      .delete().eq('id', id).eq('user_id', Auth.uid);
    if (error) console.error('[deleteScheduleEvent]', error.message);
  },

  async pushSettings(settings) {
    if (!_supa || !Auth.uid) return;
    const { error } = await _supa.from('settings').upsert({
      user_id:      Auth.uid,
      username:     settings.username     ?? 'Usuário',
      avatar:       settings.avatar       ?? 'F',
      theme:        settings.theme        ?? 'dark',
      custom_colors:settings.customColors ?? {},
      pomodoro: {
        focus:  settings.pomodoroFocus  ?? 25,
        short:  settings.pomodoroShort  ?? 5,
        long:   settings.pomodoroLong   ?? 15,
        cycles: settings.pomodoroCycles ?? 4,
        notify: settings.pomodoroNotify ?? true,
        sound:  settings.pomodoroSound  ?? true
      },
      daily_goals: settings.dailyGoals ?? { tasks: 5, cycles: 4, hours: 2 }
    }, { onConflict: 'user_id' });
    if (error) console.error('[pushSettings]', error.message);
  },

  async pushStats(date, stats) {
    if (!_supa || !Auth.uid) return;
    const { error } = await _supa.from('stats').upsert({
      user_id:       Auth.uid,
      date,
      focus_seconds: stats.focusSeconds   ?? 0,
      tasks_done:    stats.tasksCompleted ?? 0,
      pomo_cycles:   stats.pomoCycles     ?? 0
    }, { onConflict: 'user_id,date' });
    if (error) console.error('[pushStats]', error.message);
  },

  async pushPomoSession(session) {
    if (!_supa || !Auth.uid) return;
    const { error } = await _supa.from('pomo_sessions').insert({
      user_id:          Auth.uid,
      mode:             session.mode,
      started_at:       session.startedAt,
      duration_seconds: session.durationSeconds
    });
    if (error) console.error('[pushPomoSession]', error.message);
  },

  async pushAll() {
    if (!_supa || !Auth.uid) return;
    const tasks    = typeof Store !== 'undefined' ? Store.get('tasks',    []) : [];
    const schedule = typeof Store !== 'undefined' ? Store.get('schedule', []) : [];
    const settings = typeof Store !== 'undefined' ? Store.get('settings', {}) : {};

    await Promise.all([
      ...tasks.map(t => this.pushTask(t)),
      ...schedule.map(e => this.pushScheduleEvent(e)),
      this.pushSettings(settings)
    ]);

    if (typeof Toast !== 'undefined') Toast.show('Dados sincronizados ✓', 'success');
  },

  /** Retorna ISO string da última sincronização ou null */
  lastSyncAt() {
    return localStorage.getItem('flowstate_last_sync') || null;
  },

  _markSync() {
    localStorage.setItem('flowstate_last_sync', new Date().toISOString());
  }
};

// Marca timestamp após cada pull bem-sucedido
const _originalPull = Sync.pull.bind(Sync);
Sync.pull = async function () {
  await _originalPull();
  Sync._markSync();
};

/* ─── 5. MAPPERS ──────────────────────────────────────────── */

function clientTaskToDb(task, userId) {
  return {
    id:             task.id,
    user_id:        userId,
    text:           task.text             ?? '',
    note:           task.note             ?? '',
    priority:       task.priority         ?? 'medium',
    category:       task.category         ?? 'personal',
    due:            task.due              ?? '',
    done:           task.done             ?? false,
    created_at:     task.createdAt        ?? new Date().toISOString(),
    done_at:        task.doneAt           ?? null,
    recurring_type: task.recurringType    ?? null,
    recurring_days: task.recurringDays    ?? null,
    recurring_day:  task.recurringDay     ?? null
  };
}

function dbTaskToClient(row) {
  return {
    id:            row.id,
    text:          row.text,
    note:          row.note           ?? '',
    priority:      row.priority,
    category:      row.category,
    due:           row.due            ?? '',
    done:          row.done,
    createdAt:     row.created_at,
    doneAt:        row.done_at        ?? null,
    recurringType: row.recurring_type ?? null,
    recurringDays: row.recurring_days ?? null,
    recurringDay:  row.recurring_day  ?? null
  };
}

function clientScheduleToDb(ev, userId) {
  return {
    id:         ev.id,
    user_id:    userId,
    title:      ev.title,
    category:   ev.category ?? 'other',
    color:      ev.color    ?? '#6ee7b7',
    start_time: ev.start,
    end_time:   ev.end,
    days:       ev.days     ?? [0, 1, 2, 3, 4, 5, 6]
  };
}

function dbScheduleToClient(row) {
  return {
    id:       row.id,
    title:    row.title,
    category: row.category,
    color:    row.color,
    start:    row.start_time,
    end:      row.end_time,
    days:     row.days
  };
}

/* ─── 6. UTILITY ──────────────────────────────────────────── */

function _rootPath() {
  const p = window.location.pathname;
  if (p.includes('/pages/')) return p.split('/pages/')[0] + '/';
  return p.endsWith('/') ? p : p.split('/').slice(0, -1).join('/') + '/';
}

/* ─── 7. BOOT — espera DOM para garantir que Store existe ── */

document.addEventListener('DOMContentLoaded', () => {
  _initStorePatch(); // Store já existe porque main.js carregou antes
});
