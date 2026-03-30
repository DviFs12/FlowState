-- ============================================================
-- FlowState — Supabase Schema + RLS
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. TASKS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id          TEXT        PRIMARY KEY,          -- client-generated _id (matches current format)
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        TEXT        NOT NULL,
  note        TEXT        DEFAULT '',
  priority    TEXT        DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  category    TEXT        DEFAULT 'personal',
  due         TEXT        DEFAULT '',           -- ISO date string YYYY-MM-DD
  done        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at     TIMESTAMPTZ,
  recurring_type TEXT,                          -- 'weekly' | 'monthly' | null
  recurring_days INTEGER[],                     -- [0,1,5] for weekly
  recurring_day  INTEGER                        -- 15 for monthly
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks: user owns rows" ON public.tasks
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. SCHEDULE (cronograma blocks) ───────────────────────
CREATE TABLE IF NOT EXISTS public.schedule (
  id          TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  category    TEXT        DEFAULT 'other',
  color       TEXT        DEFAULT '#6ee7b7',
  start_time  TEXT        NOT NULL,             -- "HH:MM"
  end_time    TEXT        NOT NULL,             -- "HH:MM"
  days        INTEGER[]   NOT NULL DEFAULT '{0,1,2,3,4,5,6}'
);

ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule: user owns rows" ON public.schedule
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. SETTINGS ───────────────────────────────────────────
-- One row per user (upsert pattern)
CREATE TABLE IF NOT EXISTS public.settings (
  user_id         UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT  DEFAULT 'Usuário',
  avatar          TEXT  DEFAULT 'F',
  theme           TEXT  DEFAULT 'dark',
  custom_colors   JSONB DEFAULT '{}',
  pomodoro        JSONB DEFAULT '{"focus":25,"short":5,"long":15,"cycles":4,"notify":true,"sound":true}',
  daily_goals     JSONB DEFAULT '{"tasks":5,"cycles":4,"hours":2}',
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: user owns row" ON public.settings
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. STATS (daily productivity metrics) ─────────────────
CREATE TABLE IF NOT EXISTS public.stats (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE        NOT NULL,           -- YYYY-MM-DD
  focus_seconds INTEGER     NOT NULL DEFAULT 0,
  tasks_done    INTEGER     NOT NULL DEFAULT 0,
  pomo_cycles   INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats: user owns rows" ON public.stats
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. POMO_SESSIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pomo_sessions (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode              TEXT        NOT NULL CHECK (mode IN ('focus','short','long')),
  started_at        TIMESTAMPTZ NOT NULL,
  duration_seconds  INTEGER     NOT NULL
);

ALTER TABLE public.pomo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pomo_sessions: user owns rows" ON public.pomo_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 6. INDEXES (query performance) ────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_user      ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_done      ON public.tasks(user_id, done);
CREATE INDEX IF NOT EXISTS idx_schedule_user   ON public.schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_user_date ON public.stats(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user   ON public.pomo_sessions(user_id, started_at DESC);

-- ── 7. Automatic updated_at trigger for settings ──────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
