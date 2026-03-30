# FlowState — Internal Developer Guide
## Vercel + Supabase Integration

---

## 1. REPO STRUCTURE AFTER INTEGRATION

```
flowstate/
├── api/
│   └── env.js                  ← Vercel serverless: exposes anon key safely
├── pages/
│   └── login.html              ← Auth UI (signup + login + Google OAuth)
├── js/
│   ├── supabase.js             ← Supabase client + Sync layer (load FIRST)
│   └── main.js                 ← Store (patched by supabase.js to auto-sync)
├── supabase-schema.sql         ← Run once in Supabase SQL Editor
├── vercel.json                 ← Headers + rewrites
├── .env.example                ← Commit this
├── .gitignore                  ← .env.local excluded
└── manifest.json
```

---

## 2. SUPABASE PROJECT SETUP

```
1. supabase.com → New project
2. Settings → API:
   - Copy "Project URL"          → SUPABASE_URL
   - Copy "anon / public" key   → SUPABASE_ANON_KEY
   ⚠ NEVER copy service_role key into any frontend file
3. SQL Editor → paste supabase-schema.sql → Run
4. Authentication → Providers:
   - Email: enable (confirm email: optional for dev, enable for prod)
   - Google: enable → add Client ID + Secret from Google Cloud Console
     Redirect URL: https://<your-vercel-domain>/api/auth/callback
```

---

## 3. VERCEL DEPLOY

```bash
# Install CLI
npm i -g vercel

# First deploy (run from project root)
vercel

# Set env vars (do this BEFORE the first production deploy)
vercel env add SUPABASE_URL          production
vercel env add SUPABASE_ANON_KEY     production

# Promote to production
vercel --prod
```

Or via Dashboard: Vercel → Project → Settings → Environment Variables → add both vars.

---

## 4. LOAD ORDER ON EVERY HTML PAGE

Every page must load scripts in this exact order:

```html
<head>
  <!-- 1. Supabase CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <!-- 2. Env vars from serverless function -->
  <script src="/api/env.js"></script>
</head>
<body>
  ...
  <!-- 3. App scripts (supabase.js BEFORE main.js) -->
  <script src="/js/supabase.js"></script>
  <script src="/js/main.js"></script>
  <script src="/js/todo.js"></script>
  <!-- etc -->
  <!-- 4. Auth init (last) -->
  <script>
    document.addEventListener('DOMContentLoaded', () => Auth.init());
  </script>
</body>
```

For pages under `/pages/`, adjust CDN/api paths:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="/api/env.js"></script>   <!-- always absolute path, Vercel handles it -->
...
<script src="../js/supabase.js"></script>
<script src="../js/main.js"></script>
```

---

## 5. SYNC BEHAVIOUR

| Action | What happens |
|--------|-------------|
| User logs in | `Auth.init()` → `Sync.pull()` → overwrites localStorage |
| `Store.set('tasks', [...])` | Debounced 800ms → `supabase.from('tasks').upsert()` |
| `Store.set('schedule', [...])` | Debounced → `supabase.from('schedule').upsert()` |
| `Store.set('settings', {...})` | Debounced → `supabase.from('settings').upsert()` |
| `Store.set('stats_YYYY-MM-DD', {...})` | Debounced → `supabase.from('stats').upsert()` |
| `Store.set('pomo_sessions', [...])` | Pushes last item → `supabase.from('pomo_sessions').insert()` |
| User logs out | `Store.clear()` → redirect to login |
| Second device logs in | `Sync.pull()` loads all data from Supabase |

The `Store.set` patch in `supabase.js` intercepts all writes transparently.
Existing `todo.js`, `schedule.js`, `settings.js` require **zero changes**.

---

## 6. RLS VERIFICATION (test in SQL Editor)

```sql
-- Test as a specific user (replace with real UUID)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims '{"sub":"<user-uuid>"}';

SELECT * FROM public.tasks;      -- should return only that user's rows
SELECT * FROM public.settings;   -- should return only that user's row
```

---

## 7. GOOGLE OAUTH SETUP (Supabase + Google Cloud)

```
Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs:
  Authorized redirect URIs:
    https://<project-ref>.supabase.co/auth/v1/callback
    https://<your-vercel-domain>/api/auth/callback  ← if using custom domain

Supabase Dashboard → Auth → Providers → Google:
  Client ID:     <from Google Cloud>
  Client Secret: <from Google Cloud>
```

---

## 8. OFFLINE FALLBACK

If `window.__ENV` is empty (local dev without env vars, or GitHub Pages deploy),
`supabase.js` sets `_supa = null` and all `Sync.*` calls are no-ops.
The app works 100% with localStorage only — no errors thrown.

---

## 9. WHAT MUST NOT GO TO GITHUB

| File/Value | Action |
|---|---|
| `.env.local` | In `.gitignore` — never commit |
| `SUPABASE_SERVICE_ROLE_KEY` | Never in any file anywhere |
| `supabase-schema.sql` | Safe to commit (no secrets) |
| `.env.example` | Commit — no real values |
| `api/env.js` | Commit — reads from `process.env`, no hardcoded values |
| `js/supabase.js` | Commit — reads from `window.__ENV` at runtime |

---

## 10. LOCAL DEVELOPMENT

```bash
# Install Vercel CLI
npm i -g vercel

# Create .env.local (gitignored)
cp .env.example .env.local
# → fill in real SUPABASE_URL and SUPABASE_ANON_KEY

# Run local dev server (Vercel CLI emulates serverless functions)
vercel dev

# App available at http://localhost:3000
# /api/env.js reads from .env.local automatically
```

---

## 11. TASKS DELETED ON ANOTHER DEVICE

Current sync is upsert-only (no delete propagation on pull).
To handle cross-device deletes, add a `deleted_at` soft-delete column:

```sql
ALTER TABLE public.tasks ADD COLUMN deleted_at TIMESTAMPTZ;
```

Then filter in `Sync.pull()`:
```js
_supa.from('tasks').select('*').eq('user_id', Auth.uid).is('deleted_at', null)
```

And in `Store.set` patch for task deletion, set `deleted_at = now()` instead of hard-deleting.
