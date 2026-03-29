# ⟁ FlowState — Produtividade com Propósito

> Uma aplicação de produtividade moderna, responsiva e personalizável. 100% offline, sem backend.

![FlowState](https://img.shields.io/badge/FlowState-v1.0.0-6ee7b7?style=for-the-badge)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Ready-brightgreen?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Enabled-blue?style=for-the-badge)

---

## 🚀 Deploy no GitHub Pages

### Passo a passo:

1. **Crie um repositório** no GitHub (ex: `meu-flowstate`)
2. **Faça upload** de todos os arquivos deste projeto
3. Vá em **Settings → Pages**
4. Em *Source*, selecione `main` branch e pasta `/root`
5. Clique em **Save** — seu site estará em `https://seunome.github.io/meu-flowstate`

---

## 🗂️ Estrutura do Projeto

```
flowstate/
├── index.html              → Dashboard principal
├── manifest.json           → Configuração PWA
├── sw.js                   → Service Worker (offline)
├── pages/
│   ├── todo.html           → Lista de tarefas
│   └── settings.html       → Configurações
├── css/
│   ├── style.css           → Estilos globais
│   └── themes.css          → Temas (dark/light/custom)
├── js/
│   ├── main.js             → Utilitários, tema, sidebar
│   ├── pomodoro.js         → Timer Pomodoro + estatísticas
│   ├── todo.js             → Lista de tarefas (CRUD + D&D)
│   ├── charts.js           → Gráficos de produtividade
│   └── settings.js         → Página de configurações
├── data/
│   └── data.json           → Estrutura de dados de referência
└── icons/
    ├── icon-192.png        → Ícone PWA 192x192
    └── icon-512.png        → Ícone PWA 512x512
```

---

## ✨ Funcionalidades

### 📊 Dashboard
- Estatísticas do dia: tempo focado, tarefas e ciclos
- Widget Pomodoro integrado
- Preview das tarefas de hoje
- Metas diárias com progresso visual
- Gráfico de produtividade semanal/mensal

### ✅ Lista de Tarefas
- Adicionar/editar/excluir tarefas
- Prioridade (Alta/Média/Baixa)
- Categorias (Trabalho, Estudo, Pessoal, Saúde)
- Data de vencimento com indicador de atraso
- Notas por tarefa
- **Drag & Drop** para reordenar
- Filtros por status, categoria e prioridade
- Persistência automática no `localStorage`

### ⏱️ Pomodoro Timer
- Foco (padrão 25min) + Pausas curtas e longas
- Progresso visual com anel SVG animado
- Alerta sonoro (WebAudio API)
- Notificações do browser
- Contador de ciclos com bolinhas
- Configurável (5 a 90 min)

### 🎨 Temas
- **Dark** (padrão) — escuro e moderno
- **Light** — limpo e claro
- **Custom** — cores definidas pelo usuário (primária, fundo, superfície)

### ⚙️ Configurações
- Editar perfil e avatar (emoji ou letra)
- Personalizar duração do Pomodoro
- Exportar/importar dados (JSON)
- Reset completo com confirmação

### 📱 PWA
- Funciona offline (Service Worker)
- Instalável no celular/desktop
- Manifest completo

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura |
| CSS3 | Estilos, animações, temas |
| JavaScript ES6+ | Lógica da aplicação |
| Chart.js (CDN) | Gráficos de produtividade |
| Font Awesome (CDN) | Ícones |
| Google Fonts | Tipografia (Syne + DM Sans) |
| localStorage | Persistência de dados |
| Web Audio API | Sons do Pomodoro |
| Notifications API | Alertas do browser |
| Service Worker | Suporte offline |

---

## 💾 Estrutura de Dados (localStorage)

```
flowstate_tasks         → Array de tarefas
flowstate_settings      → Objeto de configurações
flowstate_stats_YYYY-MM-DD → Estatísticas por dia
flowstate_pomo_session_YYYY-MM-DD → Sessões Pomodoro por dia
```

---

## 🎯 Personalização

### Adicionar novos temas
Edite `css/themes.css` e adicione um seletor `[data-theme="meu-tema"]` com as variáveis CSS.

### Ajustar duração padrão do Pomodoro
Em `js/pomodoro.js`, altere as constantes no topo ou use a página de Configurações.

### Adicionar categorias de tarefas
Em `pages/todo.html` e `js/todo.js`, adicione as novas opções nos selects e no objeto `catLabels`.

---

## 📄 Licença

MIT — Livre para usar, modificar e distribuir.

---

Feito com ❤️ e muito ☕ para quem leva a produtividade a sério.
