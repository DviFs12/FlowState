# FlowState — SETUP

## 1. SUPABASE

### 1.1 Criar projeto
1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Escolha nome, senha e região (preferencialmente South America)
3. Aguarde o provisionamento (~2 min)

### 1.2 Obter credenciais
**Project Settings → API**

| Variável | Onde fica | Uso |
|---|---|---|
| `SUPABASE_URL` | Project URL | Frontend + serverless |
| `SUPABASE_ANON_KEY` | anon / public | Frontend (seguro expor) |

> ⚠️ **Nunca use** a `service_role` key no frontend ou em arquivos commitados.

### 1.3 Criar tabelas
**SQL Editor → New query** → cole o conteúdo de `supabase-schema.sql` → **Run**

O script cria:
- `tasks` — tarefas com suporte a recorrência
- `schedule` — blocos de cronograma
- `settings` — configurações por usuário
- `stats` — métricas diárias de produtividade
- `pomo_sessions` — histórico de sessões Pomodoro
- RLS habilitado em todas as tabelas (cada usuário acessa apenas seus dados)

### 1.4 Configurar autenticação
**Authentication → Providers**

**Email (obrigatório):**
- Enable Email provider: ✓
- Confirm email: opcional para dev, recomendado para produção

**Google (opcional):**
1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web application
3. Authorized redirect URIs:
   ```
   https://<ref>.supabase.co/auth/v1/callback
   ```
4. Copie Client ID e Client Secret para: Supabase → Auth → Providers → Google

---

## 2. VERCEL

### 2.1 Importar projeto
1. [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório GitHub
3. Framework: **Other** (não selecionar nenhum framework)
4. Root Directory: `/` (raiz do projeto)

### 2.2 Variáveis de ambiente
**Project → Settings → Environment Variables**

| Name | Value | Environments |
|---|---|---|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |

### 2.3 Deploy
Após configurar as variáveis:
```bash
# Via CLI
npm i -g vercel
vercel --prod

# Ou pelo dashboard: Deployments → Redeploy
```

O `vercel.json` já está configurado com security headers e rewrites corretos.

---

## 3. DESENVOLVIMENTO LOCAL

### 3.1 Instalar Vercel CLI
```bash
npm install -g vercel
```

### 3.2 Configurar variáveis locais
```bash
cp .env.example .env.local
```

Edite `.env.local`:
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> `.env.local` está no `.gitignore` — nunca será commitado.

### 3.3 Rodar localmente
```bash
vercel dev
```

Acesse: `http://localhost:3000`

A função `/api/env.js` lê automaticamente de `.env.local` via Vercel CLI.

---

## 4. TESTES

### 4.1 Login
1. Abra `http://localhost:3000` → redireciona para `/pages/login.html`
2. Clique em **Criar conta** → preencha email e senha → **Criar conta**
3. Verifique e-mail de confirmação (se habilitado)
4. Faça login → deve redirecionar para o Dashboard

### 4.2 Salvar dados
1. Dashboard → crie uma tarefa de teste
2. Abra Supabase → Table Editor → `tasks`
3. A tarefa deve aparecer com o `user_id` do usuário logado

### 4.3 Sincronização entre dispositivos
1. Faça login no dispositivo A → crie tarefas
2. Abra o app em dispositivo B (outro browser ou aba anônima)
3. Faça login com a mesma conta
4. Os dados devem aparecer automaticamente após o login

### 4.4 Verificar RLS
No SQL Editor do Supabase:
```sql
-- Deve retornar 0 rows (RLS bloqueando acesso sem auth)
SELECT * FROM public.tasks;

-- Com um usuário específico (substitua o UUID real)
-- Isso simula uma query autenticada:
SELECT * FROM public.tasks WHERE user_id = '<uuid-do-usuario>';
```

### 4.5 Perfil e sync manual
1. Acesse `/pages/profile.html`
2. Verifique se email e ID estão corretos
3. Clique em **Sincronizar agora** → verifique Toast de confirmação
4. Clique em **Restaurar da nuvem** → dados recarregados do Supabase

---

## 5. ESTRUTURA DE ARQUIVOS

```
flowstate/
├── api/
│   └── env.js                  # Serverless function — expõe vars do Supabase
├── css/
│   ├── style.css               # Estilos globais
│   └── themes.css              # Variáveis de tema (dark/light/custom)
├── data/
│   └── data.json               # Estrutura de dados de referência
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── js/
│   ├── main.js                 # Core: Store, Toast, ThemeManager, Profile
│   ├── supabase.js             # Auth, Sync, patch do Store.set
│   ├── charts.js               # Gráficos do dashboard
│   ├── pomodoro.js             # Timer Pomodoro
│   ├── pomodoro-history.js     # Histórico de sessões
│   ├── schedule.js             # Cronograma
│   ├── schedule-banner.js      # Banner do cronograma no dashboard
│   ├── settings.js             # Página de configurações
│   └── todo.js                 # Lista de tarefas
├── pages/
│   ├── login.html              # Autenticação (signup + login + Google)
│   ├── profile.html            # Perfil do usuário + controles de sync
│   ├── todo.html               # Gerenciador de tarefas
│   ├── schedule.html           # Cronograma diário/semanal
│   ├── settings.html           # Configurações do app
│   └── pomodoro-history.html   # Histórico Pomodoro
├── index.html                  # Dashboard principal
├── manifest.json               # PWA manifest
├── sw.js                       # Service Worker (offline)
├── favicon.svg                 # Ícone vetorial
├── favicon.ico                 # Ícone fallback
├── vercel.json                 # Config Vercel (headers + rewrites)
├── supabase-schema.sql         # Schema completo do banco de dados
├── .env.example                # Template de variáveis (commitar este)
├── .gitignore                  # .env.local excluído
└── SETUP.md                    # Este arquivo
```

---

## 6. SOLUÇÃO DE PROBLEMAS

| Erro | Causa | Solução |
|---|---|---|
| `supabase is not defined` | CDN não carregou | Verificar conexão; CDN deve estar no `<head>` antes de `/api/env.js` |
| `window.__ENV is empty` | Vars não configuradas na Vercel | Adicionar vars no Dashboard da Vercel e fazer redeploy |
| Loop de redirect para login | Cookie de sessão expirado | Limpar localStorage e cookies; fazer login novamente |
| Dados não salvam no banco | RLS bloqueando | Verificar se `user_id` está sendo enviado; conferir policies no Supabase |
| `/api/env.js` retorna 404 local | Vercel CLI não instalado | `npm i -g vercel` e usar `vercel dev` em vez de abrir o HTML direto |
| Google OAuth não funciona | Redirect URI incorreta | Conferir URI no Google Cloud Console e no Supabase Auth |
