# Acabamento visual — Lotes 0 (trava) e 1 (base) — Plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** criar a trava "acabamento só encolhe" no `check:architecture` e zerar os desvios de
token em `src/styles/` e `src/ui/`, conferindo no navegador (sessão simulada) e em Docker antes
do PR.

**Architecture:** um script Node puro (funções exportadas e testadas no Vitest) conta os desvios
por arquivo e compara com uma linha de base em JSON versionada. Os lotes trocam valores fixos
pelos tokens já existentes em `src/styles/tokens.css` e `src/styles/app.css`, sem criar terceiro
valor. Um spec do Playwright reaproveita a sessão simulada para tirar as capturas.

**Tech Stack:** Node ≥ 20 (ESM `.mjs`), Vitest, Playwright, CSS com custom properties, React 19 +
TS, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-11-acabamento-visual-design.md`

**Lotes 2 a 5** (estrutura, processo seletivo, acompanhar, administração) ganham cada um o seu
plano curto, escrito ao fim deste, com a mesma receita das Tasks 3 a 7.

## Global Constraints

- A norma `docs/design-system-agsus.md` prevalece sobre a skill externa. Geist e Lucide ficam.
- Tokens divergentes: valem os do projeto (`tokens.css`, `app.css`). Nunca criar terceiro valor;
  a divergência com a norma é registrada em `docs/biblioteca/design-e-tokens.md`.
- Escala de z-index **do projeto** (`app.css`): `--z-sticky: 2`, `--z-header: 10010`,
  `--z-sidebar: 10020`, `--z-popover: 10040`, `--z-overlay: 20000`, `--z-loader: 20025`,
  `--z-toast: 20050`. Não usar a da norma (100…700).
- Sem dependência nova, sem `!important` ou `#id` novos, sem `MutationObserver`, sem remendo
  (`*-fix`, `post-N…`).
- Animar só `opacity`/`transform`, com `--duration-*` e `--ease-standard`/`--ease-exit`; respeitar
  `prefers-reduced-motion`.
- Exceção legítima leva na mesma linha: `/* acabamento: permitido — <motivo> */`.
- Português em nomes, commits e PR. Um PR por lote. A branch é `melhoria/acabamento-visual`,
  publicada com `git push -u origin melhoria/acabamento-visual` (o upstream local aponta para
  `origin/main`; não dar push sem `-u`).
- Mudança visível ganha nota em `src/lib/novidades.ts`.

## Review Focus

1. **Modo escuro:** hex trocado por token claro que não tem par escuro deixa texto ilegível no
   escuro. Teste: as capturas da Task 6 incluem o escuro, e `tests/contraste-dos-temas.spec.js`
   continua verde.
2. **Ordem das camadas:** trocar `z-index` numérico por token pode inverter quem cobre quem (mapa
   imersivo 12050, diálogo da Saúde Indígena 15000, modais, toast). Teste da Task 2: a tabela das
   camadas em ordem estritamente crescente.
3. **Marcador abusado:** o `acabamento: permitido` sem motivo vira escape. Teste da Task 1: um
   marcador sem texto depois do travessão não isenta.
4. **Hex dentro de comentário ou de `url()`:** não é cor aplicada e não pode contar. Teste da
   Task 1.
5. **Arquivo novo:** CSS que não estava na linha de base entra com limite zero. Teste da Task 1.

---

### Task 1: Contagem dos desvios e trava "só encolhe"

**Files:**
- Create: `scripts/check-acabamento-so-encolhe.mjs`
- Create: `scripts/acabamento-linha-de-base.json`
- Modify: `package.json` (`check:architecture` ganha `&& node scripts/check-acabamento-so-encolhe.mjs`)
- Test: `tests/check-acabamento-so-encolhe.test.js`

**Interfaces:**
- Produces:
  - `export const TIPOS_DE_DESVIO = ["cor", "important", "zIndex", "raio", "sombra", "curva", "animaLayout", "blur"]`
  - `export function contarDesvios(caminho: string, texto: string): Record<TipoDeDesvio, number>`
  - `export function compararComLinhaDeBase(base: Record<string, Contagem>, atual: Record<string, Contagem>): Array<{ caminho: string, tipo: string, antes: number, agora: number }>`
    (só as pioras; arquivo ausente na base tem limite 0; arquivo ausente em `atual` some)
  - CLI: sem argumento verifica e sai 1 se houver piora; `--atualizar` grava a contagem atual na
    linha de base, recusando gravar se algum número subir.

Regras de contagem (uma ocorrência por linha que casa):
- `cor`: hex `#rgb…#rrggbbaa`, `rgb(`, `rgba(`, `hsl(` em `src/**/*.css` fora de
  `src/styles/tokens.css`; em `src/**/*.tsx`, só dentro de literais de string.
- `important`: `!important`. `zIndex`: `z-index:` seguido de número.
- `raio`: `border-radius:` com valor que não começa por `var(`. `sombra`: `box-shadow:` idem,
  fora `none`.
- `curva`: `transition`/`animation` com `ease`, `ease-in`, `ease-out`, `ease-in-out` ou `linear`
  como palavra, ou com duração em `ms`/`s` literal.
- `animaLayout`: `transition` que cita `width`, `height`, `top`, `left` ou `all`.
- `blur`: `backdrop-filter` em bloco sem `position: fixed` ou `position: sticky`.
- Ignorar o conteúdo de comentários `/* */` e de `url(...)`. A linha com
  `acabamento: permitido — <motivo não vazio>` não conta.

- [ ] **Step 1: Escrever os testes que falham**, no estilo de `tests/check-legado-so-encolhe.test.js`:
  - `contarDesvios("src/x.css", "a{color:#fff}")` → `cor: 1`.
  - `contarDesvios("src/styles/tokens.css", "--c:#fff;")` → `cor: 0`.
  - `"/* #fff */ a{background:url(#fff)}"` → `cor: 0`.
  - `"a{z-index:3}"` → `zIndex: 1`; `"a{z-index:var(--z-toast)}"` → `0`.
  - `"a{border-radius:8px}"` → `raio: 1`; `"a{border-radius:var(--radius-lg)}"` → `0`.
  - `"a{transition:opacity 120ms ease-in-out}"` → `curva: 1`;
    `"a{transition:opacity var(--duration-fast) var(--ease-standard)}"` → `0`.
  - `"a{transition:width var(--duration-fast) var(--ease-standard)}"` → `animaLayout: 1`.
  - `"a{border-radius:50% /* acabamento: permitido — círculo do avatar */}"` → `raio: 0`;
    `"... /* acabamento: permitido — */"` → `raio: 1`.
  - `compararComLinhaDeBase({"a.css":{cor:2,…}}, {"a.css":{cor:3,…}})` → uma piora `cor 2→3`;
    `{"novo.css":{cor:1}}` contra base vazia → piora `0→1`; arquivo só na base → nada.
  - `.tsx`: `` `style={{ color: "#fff" }}` `` → `cor: 1`; `` `// #fff` `` → `0`.
- [ ] **Step 2:** `npx vitest run tests/check-acabamento-so-encolhe.test.js` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar** as funções e a CLI em `scripts/check-acabamento-so-encolhe.mjs`.
  Arquivos listados por `git ls-files "src/**/*.css" "src/**/*.tsx"` (como o legado faz com `git`).
  Mensagem de falha em português, com caminho, tipo, antes→agora e o ponteiro para
  `docs/design-system-agsus.md`.
- [ ] **Step 4:** `npx vitest run tests/check-acabamento-so-encolhe.test.js` → PASS.
- [ ] **Step 5:** `node scripts/check-acabamento-so-encolhe.mjs --atualizar`, depois
  `npm run check:architecture` → verde. Conferir que os números de `src/styles/app.css` ficam
  perto da linha de base do desenho (≈ h42 i62 z8 r24 s8).
- [ ] **Step 6:** documentar a trava em `docs/biblioteca/scripts-e-checagens.md` e em
  `docs/biblioteca/design-e-tokens.md` (como usar o marcador); `npm run check:docs` → verde.
- [ ] **Step 7: Commit** — `Trava do acabamento: desvio de token por arquivo só encolhe`.

### Task 2: Tokens que faltam e duplicatas de `app.css`

**Files:**
- Modify: `src/styles/app.css:12-66`, `src/styles/tokens.css`
- Modify: `docs/biblioteca/design-e-tokens.md` (divergências registradas)
- Test: `tests/tokens-do-acabamento.test.ts`

**Interfaces:**
- Produces: variáveis `--z-dropdown` (= `var(--z-popover)`), `--z-modal` (= `var(--z-overlay)`),
  `--z-tooltip` (= `var(--z-toast)` + 1, escrito `calc(var(--z-toast) + 1)`), usadas pelas Tasks 3 a 5.

- [ ] **Step 1: Teste que falha:** ler `app.css` e `tokens.css` como texto e afirmar que cada
  token usado nas Tasks 3 a 5 (`--z-dropdown`, `--z-modal`, `--z-tooltip`, `--radius-sm|md|lg|xl|full`,
  `--shadow-sm|md|lg`, `--duration-fast|base|slow`, `--ease-standard|exit`) está definido uma
  vez só; e que, resolvidos os `calc`/`var`, `sticky < header < sidebar < popover < overlay <
  loader < toast < tooltip` (Review Focus 2).
- [ ] **Step 2:** rodar → FAIL. **Step 3:** definir as variáveis em `app.css`, junto das outras `--z-*`.
- [ ] **Step 4:** rodar → PASS; registrar em `design-e-tokens.md` que a escala de z-index do
  projeto diverge da norma 7.2 e por quê (comentário existente em `app.css:36-43`).
- [ ] **Step 5: Commit** — `Tokens de camada que faltavam, na escala do projeto`.

### Task 3: Camadas, raios, sombras e curvas em `src/styles/` e `src/ui/`

**Files:**
- Modify: os CSS de `src/styles/` (menos `tokens.css`) e `src/ui/ui.css`,
  `src/ui/modal-institucional.css`
- Modify: `scripts/acabamento-linha-de-base.json` (baixada)

Mapeamentos fixos (sem escolha do executor):
- raio 4px→`--radius-sm`, 6px→`--radius-md`, 8px→`--radius-lg`, 12px→`--radius-xl`,
  ≥999px→`--radius-full`. Outro valor: o token mais próximo **pela hierarquia da norma 6.1**
  (o tipo de elemento), não pelo número. `50%` em círculo leva o marcador.
- sombra: igual a um token → o token; sombra em elemento estático (card, seção) → `none` (6.3);
  outra em camada flutuante → `--shadow-md` (menu, popover, toast) ou `--shadow-lg` (modal, gaveta).
- z-index numérico → a variável `--z-*` de mesmo papel; valor local (1–9 dentro de um contexto de
  empilhamento próprio) leva o marcador.
- curva: hover/cor → `var(--duration-fast) var(--ease-standard)`; abrir e recolher →
  `--duration-base`; gaveta e modal → `--duration-slow`; saída → `--ease-exit`. `transition: all`
  vira a lista das propriedades que mudam.

- [ ] **Step 1:** aplicar os mapeamentos em `src/styles/` e `src/ui/`.
- [ ] **Step 2:** `node scripts/check-acabamento-so-encolhe.mjs --atualizar` — `zIndex`, `raio`,
  `sombra`, `curva` e `animaLayout` zerados (ou só com marcador) nesses arquivos.
- [ ] **Step 3:** `npx vitest run tests/tokens-do-acabamento.test.ts tests/aviso-de-contraste.test.js` → PASS.
- [ ] **Step 4: Commit** — `Base: camadas, raios, sombras e curvas só por token`.

### Task 4: Cores só por token em `src/styles/` e `src/ui/`

**Files:**
- Modify: `src/styles/app.css`, `platform-shell.css`, `nielsen-shell-ux.css`, `barra-lateral.css`,
  `indigenous-territories-layer.css`, `map-base-layer-switcher.css`,
  `post157-interface-tuning.css`, `visual-polish.css` e `.tsx` de `src/ui/`

- [ ] **Step 1:** trocar cada hex/`rgb()` pelo **token semântico** da norma 3.4 que cumpre o mesmo
  papel (texto, fundo, borda, status). Se o hex coincide com um primitivo sem token semântico do
  papel, usar o primitivo. Cor de camada de mapa (Leaflet, terras indígenas) leva o marcador.
- [ ] **Step 2:** conferir o par escuro: todo token usado tem valor no bloco escuro de
  `tokens.css` (Review Focus 1). Token sem par → usar outro que tenha, nunca criar par novo aqui.
- [ ] **Step 3:** `--atualizar`, `npm run check:architecture` → verde; `cor` zerada nesses arquivos.
- [ ] **Step 4: Commit** — `Base: cores só por token semântico`.

### Task 5: `!important` e componentes de `src/ui/` contra a norma

**Files:**
- Modify: `src/styles/*.css`, `src/ui/*.tsx`, `src/ui/ui.css`
- Test: `tests/<componente>.test.*` existentes de `src/ui/` (rodar, não reescrever)

- [ ] **Step 1:** remover cada `!important` de `src/styles/` cuja regra vence sem ele (subir a
  especificidade pela fonte, sem `#id`). Os que existem para vencer CSS de terceiro (Leaflet)
  levam o marcador. Os de `mobile-app.css` e `nielsen-shell-ux.css` que estilizam o legado: só
  os triviais (spec, "Fica a critério").
- [ ] **Step 2:** revisar cada componente de `src/ui/` contra a norma seção 11 e o checklist 21
  (estrutura, estados de vazio, carregamento e erro de `estados.tsx`/`erro-ao-carregar.tsx`,
  foco visível, textos 15). Corrigir direto (decisão do usuário), atualizando a página da Aya
  que citar o texto e rodando `npm run aya:conhecimento`.
- [ ] **Step 3:** botão pressionado: `.botao:active { transform: scale(0.98) }` com
  `--duration-fast`, anulado em `@media (prefers-reduced-motion: reduce)`.
- [ ] **Step 4:** `npx vitest run tests/<componentes de ui tocados>` e `npm run typecheck` → PASS;
  `--atualizar`.
- [ ] **Step 5: Commit** — `Base: componentes de src/ui na norma e menos !important`.

### Task 6: Capturas com sessão simulada

**Files:**
- Create: `tests/apoio/sessao-simulada.js` (extrai `abrirComSessao`, `SESSAO`, `USUARIO`,
  `contextoDoAdmin`, `CHAVE_DA_SESSAO`, `SUPABASE` de `tests/sessao-simulada.spec.js`, que passa a
  importá-los)
- Create: `tests/acabamento-capturas.spec.js`
- Create: `tests/fixtures/acabamento/` (respostas das RPCs: tabela cheia ≥ 200 linhas, nome de
  200 caracteres, lista vazia, erro 500)

**Interfaces:**
- Produces: `abrirComSessao(page, { contexto?, situacao?, rpcs?: Record<string, unknown> })` —
  `rpcs` mapeia nome da RPC → JSON devolvido; o resto segue como hoje (PGRST202).

- [ ] **Step 1:** extrair o apoio; `PLAYWRIGHT_DIST_PRONTO=1 npx playwright test tests/sessao-simulada.spec.js` → igual a antes.
- [ ] **Step 2:** o spec abre as telas do lote (Visão geral, Editais, Configurações → Módulos,
  uma tabela com `tabela-infinita`, um modal e uma gaveta) em claro e escuro, a 375px e 1280px,
  para os quatro cenários de dados; salva em `test-results/acabamento/<tela>-<tema>-<largura>-<cenario>.png`
  e falha se houver `pageerror` ou rolagem horizontal da página.
- [ ] **Step 3:** build simulado (`VITE_SUPABASE_URL=https://teste.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=teste npm run build`) e
  `PLAYWRIGHT_DIST_PRONTO=1 npx playwright test tests/acabamento-capturas.spec.js tests/contraste-dos-temas.spec.js` → PASS.
- [ ] **Step 4:** olhar as capturas contra o checklist "por olho" do desenho; corrigir e repetir.
- [ ] **Step 5: Commit** — `Capturas do acabamento com sessão simulada`.

### Task 7: Docker e PR

- [ ] **Step 1:** `docker compose up --build -d` com `VITE_SUPABASE_URL=https://teste.supabase.co`
  e `VITE_SUPABASE_PUBLISHABLE_KEY=teste` no ambiente; `curl -fsS http://127.0.0.1:8000/` → 200.
- [ ] **Step 2:** Playwright contra o contêiner: `tests/smoke.spec.js`,
  `tests/sessao-simulada.spec.js` e `tests/acabamento-capturas.spec.js` (base em
  `http://127.0.0.1:8000`, sem subir o servidor próprio) → PASS. `docker compose down`.
- [ ] **Step 3:** `npm run lint && npm run format:check && npm run typecheck && npm test &&
  npm run build` → verde.
- [ ] **Step 4:** nota em `src/lib/novidades.ts` se houver diferença visível.
- [ ] **Step 5:** `git push -u origin melhoria/acabamento-visual` e PR em português com: o que
  mudou, a linha de base antes→depois, as capturas principais (claro/escuro, 375/1280) e o
  resultado do Docker. Fim com a linha de atribuição.

### Task 8: Plano do próximo lote

- [ ] Escrever `docs/superpowers/plans/AAAA-MM-DD-acabamento-lote-2.md` com a mesma receita
  (Tasks 3 a 7 aplicadas aos arquivos do lote 2) e o que este lote ensinou.
