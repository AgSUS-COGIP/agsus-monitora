# Design do MONITORA

Guia **normativo** da interface: diz como a tela deve ficar e como sair do estado
atual até lá. Vale para `index.html`, `analises.html` e tudo em `src/styles/` e
`src/analises/*.css`.

Parte do que o sistema já tem — as cores da marca AgSUS (`--agsus-*` em `app.css`), a fonte
Geist, o shell de `platform-shell.css` — e organiza isso em tokens com papel definido, para que
o mesmo estado tenha a mesma aparência em Saúde Indígena, Núcleo, Calendário, Aprovados,
Configurações e Análises.

> **Norma institucional:** o [Design System AgSUS](docs/design-system-agsus.md) (cores, tipografia,
> espaçamento, raio, sombra, componentes, acessibilidade). Onde ele e este arquivo divergirem, vale
> o Design System; este arquivo diz como o MONITORA chega lá e guarda as regras locais (camadas,
> onde escrever CSS, medições). Divergências que ainda restam: seção 12.
>
> Leia a seção 0 sempre que for tocar em CSS. As demais, só a que o trabalho pede.

---

## 0. Regras de ouro

1. **Cor, raio, sombra, espaçamento e z-index vêm de token** (`var(--…)`, seção 3).
   Nenhum hex novo em regra de componente.
2. **Nenhum `!important` novo e nenhum seletor `#id` novo.** Se for obrigatório
   vencer uma regra legada, faça e comente a origem: `/* vence health-reference-kpis.css:120 */`.
3. **Não crie arquivo `*-fix.css`, `post-NNN-*.css` ou `*-refinement.css`.**
   Corrija na regra de origem, no CSS do próprio módulo.
4. **Antes de escrever, descubra quem já manda no elemento:**
   `grep -rn "nome-da-classe" src/styles src/analises | grep -E "important|#"`.
5. **Confira o estilo computado no navegador** (`getComputedStyle(el).prop`), não o arquivo.
   Declaração perdida na cascata falha em silêncio.
6. **Contraste AA:** texto ≥ 4,5:1, texto grande e bordas de controle ≥ 3:1. Use só os pares
   de fundo e texto do Design System (seção 3.4 dele). `--brand-accent` (azul claro) é só
   preenchimento decorativo, nunca cor de texto.
7. **Pesos só 400, 500 e 600** (Design System, 4.1). **Nada abaixo de 12px**; conteúdo principal com 14px.
   Sentence case: sem `text-transform: uppercase` em rótulos, títulos e botões.
8. **Anime só `opacity` e `transform`.** O tema escuro sai de `html[data-theme="dark"]`.
9. **Regra do escoteiro:** ao mexer num componente, migre para token os valores
   **daquele bloco** — não o arquivo inteiro, não outro componente.

---

## 1. Diagnóstico

Medido em 2026-09-22 na `main` (`e054867`). Os comandos para medir de novo estão na seção 9.

| Métrica | Hoje | Meta |
|---|---|---|
| Arquivos CSS / linhas | 47 / 16.748 | ~15 arquivos por módulo |
| `!important` | 795 (140 em `app.css`, 107 em `health-reference-kpis.css`) | só `.hidden`, `.sr-only` e reduced-motion |
| Cores hex distintas (6 dígitos) | 796 | ~40 tokens |
| `box-shadow` distintos | 146 | 3 |
| `border-radius` distintos | 20 | 4 |
| Tamanhos de fonte distintos | 43 (10px ×60, 9px ×17, 8px ×6) | 8, com mínimo de 11px |
| Pesos de fonte | 12 (800 ×92, 900 ×91, 850, 750, 950, 1000) | 4 |
| `text-transform: uppercase` | 55 | só o eyebrow de seção |
| Seletores com `#id` | 618 | só em código legado |
| z-index distintos | 38 (máximo 2147483000) | a escada da seção 3.7 |
| Mecanismos de tema escuro | 3 (`[data-theme]` ×401, `body.dark-mode` ×100, `body.sidebar-theme-dark` ×32) | 1 |
| Breakpoints distintos | ~15 | 4 |

**Falhas de contraste que existem hoje (WCAG AA):**

| Onde | Par | Razão | Correção |
|---|---|---|---|
| `.btn` primário | branco sobre o fim do gradiente, `--cyan #00a8d6` | 2,77 | fundo sólido `--brand-primary` (11,29) |
| `.btn.green` | branco sobre `#0b8f58` | 4,13 | `--state-success-strong #087a4b` (5,39) |
| texto secundário | `#63748d` / `#64748b` sobre o fundo `#f3f7fb` | 4,42 | `--text-secondary #5f6f86` (4,75) |
| borda de campo | `#d7e5f2` sobre branco | 1,28 | `--border-control #7d8fa5` (3,31) |
| vermelho como texto | `#d92d3a` sobre o fundo | 4,45 | `--state-danger #c02634` (5,47) |

**Divergências entre páginas:** `src/analises/analises.css` redefine os tokens com
outros valores (`--green #16934d` contra `#0b8f58`, `--red #e14444` contra `#d92d3a`,
`--yellow #e2a400` contra `#f2b705`, `--radius 20px` contra `18px`). O mesmo estado
tem cor diferente em cada tela.

**Fonte:** Geist, do Google Fonts, como fonte variável (400 a 900 num arquivo só).
**Ícones:** Font Awesome 6.5.2 via CDN (62 usos no `index.html`). A barra lateral e o que é dela
já usam o `lucide`, por `src/modules/icones.js` (ver "Ícones", seção 4).

`runtime-critical-fixes.css` é carregado de dentro de `src/modules/connectivity-status.js`.

---

## 2. Princípios

1. **Clareza antes de ornamento.** Cada tela deixa evidente a próxima ação.
2. **Consistência.** O mesmo estado tem a mesma cor, o mesmo ícone e o mesmo texto em todo o sistema.
3. **Uma ação principal por contexto.** As secundárias não competem com ela.
4. **Cor nunca sozinha.** Todo estado tem rótulo ou ícone além da cor.
5. **Responsivo de verdade.** Funciona em 375px sem perder informação.
6. **Feedback sempre.** Carregando, vazio, erro, sem permissão e offline são estados desenhados, não acidentes.

---

## 3. Tokens

Os valores abaixo são o alvo. Devem morar em **um único arquivo**, `src/styles/tokens.css`,
importado antes de qualquer outro CSS no `src/main.js` e no `src/analises/main.js`.
O arquivo já existe, com o que pôde entrar sem repintar nada: fonte, tamanhos `--text-sm/md/base`,
espaçamento, raio, `--shadow-overlay`, movimento e `--text-inverse`. As cores de texto e superfície
entram quando cada componente migrar (as reservas atuais divergem). As camadas (`--z-*`) seguem em
`app.css`.
O nome diz o **papel** (`--text-secondary`), não a cor (`--muted`), para que o tema escuro
troque o valor sem trocar o nome. Todo par de cor abaixo foi medido: os números entre
parênteses são a razão de contraste sobre `--surface-card`.

### 3.1 De onde vêm os tokens

Os valores (cor, tipografia, espaçamento, raio, sombra, movimento) são os do Design System
AgSUS, seção 8, copiados sem alteração no topo de `src/styles/tokens.css`. **Código novo usa os
nomes oficiais** (`--color-text-secondary`, `--color-bg-subtle`, `--radius-lg`, `--text-body`…).

Os nomes que o MONITORA já usava continuam valendo e apontam para os oficiais, para que o código
existente mude de cor sem mudar de código:

| Nome do MONITORA | Aponta para |
|---|---|
| `--brand-primary` / `--brand-primary-strong` | `--color-action-primary` / `-hover` (blue-600 / blue-700) |
| `--brand-accent` | `--color-blue-400` (o ciano saiu: não existe na paleta oficial) |
| `--surface-page`, `--surface-card` | `--color-bg-canvas` (branco) |
| `--surface-raised` / `--surface-hover` | `--color-bg-subtle` / `--color-bg-muted` |
| `--text-primary` / `--text-secondary` | `--color-text-primary` / `--color-text-secondary` |
| `--border-subtle` / `--border-control` | `--color-border-subtle` / `--color-border-input` |
| `--state-*` / `--state-*-soft` | `--color-status-*-text` / `--color-status-*-bg` |
| `--series-1…5` | `--color-chart-1…5` (`--series-6`: `--color-blue-200`) |
| `--shadow-card` / `--shadow-raised` / `--shadow-overlay` | `none` / `--shadow-md` / `--shadow-lg` |
| `--text-kpi` / `--text-kpi-sm` | `--text-metric` / `--text-metric-sm` |
| `--sidebar` / `--sidebar-mini` (platform-shell.css) | `--sidebar-width` (256px) / `--sidebar-width-collapsed` (64px) |
| Antigas de `app.css`: `--card`, `--bg`, `--line`, `--soft`, `--muted`, `--slate`, `--navy`, `--blue`, `--cyan`, `--agsus-*` | os tokens oficiais equivalentes (comentário no topo de `app.css`) |

**Raio:** os nomes `--radius-sm/md/lg` agora têm os valores oficiais (4/6/8px) e `--radius-xl` é
12px. O MONITORA usava `sm` para controle, `md` para card e `lg` para painel; os usos subiram um
degrau (controle `--radius-md`, card `--radius-lg`, painel e modal `--radius-xl`).

A barra lateral usa a cor configurada em Configurações → Aparência
(`ui_sidebar_background_color`), que é identidade do MONITORA. É **exceção aceita** ao
`--color-sidebar-bg` oficial (`#0B1F3D`), por decisão do responsável em 25/09/2026: não trocar
pela cor oficial (seção 12).

### 3.7 Camadas (z-index)

A escada já existe em parte (`app.css:40-42`). Formalizada:

| Token | Valor | Quem |
|---|---|---|
| `--z-sticky` | 100 | cabeçalho de tabela, barra de filtros |
| `--z-header` | 10010 | `.app .top` |
| `--z-sidebar` | 10020 | barra lateral acima de 900px: a alça de recolher e o painel flutuante do menu passam por cima do cabeçalho |
| `--z-popover` | 10040 | popovers do cabeçalho |
| `--z-map-immersive` | 12050 | mapa imersivo |
| `--z-exit-dialog` | 15000 | diálogo de saída da Saúde Indígena |
| `--z-overlay` | 20000 | modais |
| `--z-loader` | 20025 | carregamento de tela inteira |
| `--z-toast` | 20050 | toast (o topo) |

Nada acima de `--z-toast`. Os `2147483000` de `nina-conversation.css` e
`analises-residual-ui-fixes.js` devem descer para essa escada. Quem precisa ficar acima da barra
lateral usa os tokens de overlay: modal de busca (`--z-overlay`); link de pular, faixa offline,
aviso de conectividade e aviso de sessão (`--z-toast`). `tests/camadas-acima-da-barra.test.js`
guarda essa ordem.

### 3.8 Breakpoints

Media query não aceita `var()`, então os valores são constantes documentadas:
**420px** (celular pequeno) · **640px** (celular) · **900px** (tablet; a barra lateral
vira gaveta — contrato com `src/componentes/barra-lateral/usar-ambiente.js`) · **1220px** (desktop estreito).
Os valores de hoje (560, 680, 700, 720, 820, 1180) migram para o mais próximo quando a regra for tocada.

---

## 4. Componentes

### Botão — `.btn`

- **Primário** (`.btn`; `.btn.green` e `.btn.primary` são aliases): fundo sólido
  `--color-action-primary`, texto `--color-text-inverse`, hover `--color-action-primary-hover`,
  pressionado `--color-action-primary-pressed`. Sem gradiente, sem sombra. Ação principal é azul,
  também em "Salvar", "Aprovar" ou "Publicar". Um primário por contexto.
- **Secundário** (`.btn.secondary`): fundo `--surface-card`, borda `--border-control`, texto `--text-primary`.
- **Terciário** (`.btn.outline`): sem fundo, texto `--brand-primary`. Para ações de baixo peso.
- **Destrutivo** (`.btn.danger`; hoje só existe em `.config-governance-footer`): `--state-danger`. Sempre com confirmação que cita o objeto afetado.
- Geometria (Design System 11.1, `md`): altura de 36px (44px no toque, `--mobile-touch-size`),
  padding `0 --space-4`, `--radius-md`, `--text-button` peso 500, ícone a 8px do texto.
- Só com ícone: `aria-label` + `title` e alvo de 40×40.
- Desabilitado: `opacity: .6` + `cursor: not-allowed`. Se o motivo não for óbvio, diga qual é (`title` ou texto ao lado).

### Superfície — `.card`, `.table-card`, `.admin-card`

`--surface-card`, borda de 1px `--border-subtle`, `--radius-lg`, `--shadow-card`, padding `--space-5`.
**Sem faixa colorida no topo** (`::before` de 3 a 4px): com seis cards lado a lado vira um arco-íris
que compete com o conteúdo. A cor vai para o tile do ícone e para o indicador, onde tem significado.

### Indicador — `.kpi`, `.approved-kpi`

**Card** — exceção aceita ao Design System 11.7 (que pede faixa sem card), por decisão do
responsável em 25/09/2026: os KPIs em card leem melhor no MONITORA. O card segue o DS 11.6.
Feito na Visão geral da Saúde Indígena (`health-reference-kpis.css`).

```
┌──────────────────────────┐   --surface-card · borda 1px --border-subtle · --radius-lg · sem sombra
│ [▣] Rótulo em cinza      │   --text-label/500 --text-secondary · ícone 13px num tile de 24px
│ 1.308                    │   --text-metric-sm/600 tabular-nums --text-primary
└──────────────────────────┘
```

- Tile do ícone na cor do estado (`--state-*` / `--state-*-soft`): azul por padrão, verde para
  contratação, vermelho para vagas ociosas, amarelo para processos críticos.
- Grade `repeat(auto-fit, minmax(170px, 1fr))` com 12px de gap: 6 numa linha em tela larga,
  quebrando conforme a largura; 2 colunas abaixo de 768px.
- KPI clicável (ex.: Processos críticos, que filtra): o card inteiro é o alvo, hover
  `--surface-hover`, foco visível; filtro ativo com borda `--brand-primary` e fundo `--state-info-soft`.

- Todos os KPIs de uma fileira têm o mesmo tratamento e a mesma altura. O indicador fica
  preso ao pé (`margin-top: auto`).
- **Carregando não é zero.** Antes do dado chegar, mostre um skeleton, nunca "0". Um zero
  que é boa notícia (0 processos críticos) usa `--state-success`, para não parecer vazio.
- Em `analises.html`, os KPIs são botões de filtro (`aria-pressed`). A anatomia vale, mas o comportamento
  de filtro precisa ser preservado e testado.

### Tabela — `.table-wrap`, `.sort-th`, `.num`

Busca e filtros ficam acima, com a contagem de resultados. O cabeçalho usa `--surface-raised`, é
sticky (`--z-sticky`) e tem ordenação visível (`aria-sort` + ícone). Números ficam à direita, com
`tabular-nums`. Linhas separadas por `--border-subtle`, hover `--surface-hover`. Abaixo de
900px, a tabela vira cards (`src/modules/mobile-table-cards.js`). Com volume grande, use virtualização
(`src/analises/analises-infinite-table.js`), não paginação improvisada. Exportação respeita os filtros ativos.

### Formulário — `.form-row`, `.form-grid`

O rótulo é sempre visível; o placeholder não substitui o rótulo. Campo com borda
`--border-control`, `--radius-md` e altura de 40px. No foco, anel `--focus-ring`. O erro
aparece junto do campo, em `--state-danger`, com ícone. Campo obrigatório é marcado. Os dados
digitados se mantêm depois de erro do servidor. Seleção múltipla: `src/componentes/multi-select-busca.jsx`
no app principal e Tom Select em análises. Não crie um terceiro.

### Modal — `.modal` > `.modal-card` (`.modal-head`, `.modal-body`)

`--z-overlay`, `--radius-lg`, `--shadow-overlay` e fundo escurecido. O foco fica preso no modal,
`Esc` fecha e, ao fechar, o foco volta ao elemento que abriu. Largura máxima de 560px (formulário)
ou 880px (detalhe). Formulário longo não vai em modal pequeno: use página ou drawer.
Em React, `<Modal>` (`src/componentes/modal.jsx`) já faz o portal, o `Esc`, o foco preso e a volta
do foco; o legado ainda tem modais próprios (`#editModal`, `#searchModal`).

### Chip, badge e alerta — `.chip`, `.alert`

Fundo `--state-*-soft`, texto `--state-*`, **ícone obrigatório**, `--radius-pill` (chip) ou
`--radius-md` (alerta). A mensagem diz o que aconteceu e o que fazer.

### Estados de página

Toda consulta prevê: carregando (skeleton com o formato do conteúdo, não um spinner solto), com
dados, vazio (o que significa e qual é a próxima ação), erro recuperável (com "Tentar de novo"),
sem permissão e offline (`src/modules/connectivity-status.js`).

### Barra lateral

**É React** (`src/componentes/barra-lateral/`), o primeiro componente da migração; o legado a
alimenta por estado externo e eventos (ver `src/componentes/CLAUDE.md`). **Organizada em áreas** —
um grupo por área do usuário (Saúde Indígena, SEDE, Projetos), cada um com Editais, Cronograma e
Lista de aprovados (a Saúde Indígena também com Visão geral e Análises), depois Painéis e
Administração (`src/lib/menu-lateral.js`; área nova é uma entrada no catálogo). O item escolhido
define a área atual, que recorta as páginas; só o item da área atual fica ativo. Os painéis externos
que não são de área entram em Painéis; as seções de Configurações são as páginas de Administração.

- **Medidas:** 240px expandida e 60px recolhida. Marca 56px com logo de 32px. Cabeçalho de área
  36px, ícone 18px (traço 1,75), rótulo `--text-md`/500. Item 32px, pendurado numa linha-guia
  alinhada ao centro do ícone. Na gaveta do celular (≤ 900px), os botões mantêm 44px de toque.
- **Expandida:** acordeão, com **todas as áreas abertas por padrão**; só a seta gira, a altura não
  anima. Guarda-se (`localStorage`) só a lista das áreas que a pessoa fechou, então área nova no
  catálogo já nasce aberta. Abrir uma página reabre a área dela.
- **Recolhida:** trilho de ícones de 36px. O painel da área vira um flutuante ao lado do trilho,
  com a pílula do nome em cima. Abre por clique, Enter/Espaço ou ponteiro (só com hover) e fecha
  por `Esc`, clique fora, foco saindo ou item escolhido — um por vez. O estado mora no JS
  (`src/componentes/barra-lateral/menu-de-areas.jsx`), não em `:hover`.
- **Rodapé:** seletor Claro/Escuro (único controle de tema do app), Sair e versão. Recolhida,
  o tema vira um botão que alterna e o Sair vira ícone.
- **Alça de recolher:** círculo de 24px na borda direita, na altura da marca, metade para fora; a
  seta gira com a barra recolhida. Até 900px o mesmo botão vai para o cabeçalho, como hambúrguer da
  gaveta (`alca-de-recolher.jsx`, CSS em `barra-lateral.css`).
- **Cores:** tokens de componente `--menu-*` em `platform-shell.css`, trocados pelo tema escuro e
  pela barra com cor configurada escura. Hover e ativo são o próprio texto em baixa opacidade
  (`color-mix` com `currentColor`). O painel flutuante é um cartão da página
  (`--menu-flutuante-*`), fora do alcance da cor configurada.
- A coluna não anima a largura (ver o comentário em `platform-shell.css`).

### Ícones

**Todo o sistema desenha Lucide.** O Font Awesome não é mais carregado. Dois caminhos:

- **Barra lateral e o que é dela** (menu inferior do celular, Sair, tema, alça de recolher): SVG
  Lucide de verdade, pelo registro abaixo.
- **Resto do sistema:** o HTML e os módulos ainda escrevem `<i class="fa-solid fa-…">`, mas
  `src/styles/icones-lucide.css` (gerado por `npm run icones` a partir de
  `src/lib/mapa-de-icones-lucide.js`) desenha em cada classe o ícone Lucide equivalente, como
  máscara no `::before`. Ícone novo com classe `fa-…`: acrescente o par no mapa e rode
  `npm run icones`; `tests/icones-lucide.test.js` falha se faltar. Ao reescrever um componente,
  prefira o registro abaixo.

Regras:

- Lucide sai de um registro só, `src/modules/icones.js`, que importa cada ícone pelo nome — só os
  usados entram no bundle. Ícone novo: registre lá. Sem framework, `criarIcone(nome, { tamanho })`;
  em React, `<Icone nome="…" tamanho={…} />` (`src/componentes/icone.jsx`).
- Tamanhos 16, 18 e 20px, traço 1,75, na cor do texto ao lado (`stroke: currentColor`).
- O ícone é decorativo (`aria-hidden`); quem nomeia o controle é o texto dele ou um `aria-label`.

---

## 5. Tema escuro

- **Chave canônica: `html[data-theme="dark"]`**, definida em `src/modules/legacy-app.js`
  (`setAttribute("data-theme", …)`). A análise usa a mesma chave.
- `body.dark-mode` é um **espelho** mantido por `syncHealthDarkModeClass()`
  (`src/modules/health-dashboard-interaction-fixes.js`). Não escreva regra nova com ele.
- `body.sidebar-theme-dark` é o tema **configurável da barra lateral** (branding), um assunto
  à parte. Não use para o tema da página.
- Com as cores em token, o escuro sai de graça: basta redefinir os tokens em `:root[data-theme="dark"]`.
  Os 401 overrides `[data-theme="dark"]` existem porque as cores estão chumbadas. Cada componente
  migrado para token elimina os seus.
- O escuro é **escolhido, não invertido**: cada cor tem seu próprio valor, validado contra `--surface-card` escuro.

---

## 6. Gráficos

Chart.js em todo o sistema (`legacy-app.js` e `analises-app.js`, `window.Chart` via `src/lib/chartjs-global.js`).

**Paleta categórica, em ordem fixa**, validada com o validador da skill `dataviz`: faixa de luminosidade,
croma, separação para daltonismo (CVD), visão normal e contraste ≥ 3:1. Passou em todos.

| Série | Claro (sobre `#ffffff`) | Escuro (sobre `#0e1e2e`) |
|---|---|---|
| 1 azul | `#0f5db7` | `#4f8ff0` |
| 2 laranja | `#eb6834` | `#d95f2b` |
| 3 ciano | `#0090bc` | `#1a9fc8` |
| 4 violeta | `#6d5efc` | `#8e6cf2` |
| 5 magenta | `#d55181` | `#d55181` |
| 6 oliva | `#8a6d00` | `#a8861a` |

Viram `--series-1` … `--series-6` no `tokens.css`. Regras:

- **Ordem fixa, nunca ciclada.** Uma 7ª série vira "Outros" ou múltiplos gráficos pequenos.
- **A cor segue a entidade, não a posição.** Filtrar não pode repintar quem ficou.
- **Verde, âmbar e vermelho são de estado** e não servem para identificar série. Status em gráfico
  usa `--state-*`, com rótulo.
- **Um eixo Y só.** Duas grandezas de escala diferente pedem dois gráficos.
- Com duas ou mais séries, há legenda sempre. Com até quatro, também rótulo direto.
  Texto do gráfico usa `--text-*`, nunca a cor da série.
- Linhas de 2px, grade recessiva (`--border-subtle`), tooltip no hover e alternativa em tabela.
- Magenta e oliva ficam na faixa mínima de separação para tritanopia: por isso, a legenda com rótulo
  é obrigatória, não opcional.
- O ciano da marca (`#00a8d6`) não é cor de série: tem 2,77:1 sobre o branco.

---

## 7. Onde escrever CSS

**Como a cascata funciona aqui:** `app.css` entra por `<link>` no `index.html` e carrega **antes**
dos 40 CSS importados pelo `src/main.js`. Por isso perde em empate de especificidade para todos eles,
e por isso acumulou 140 `!important`. Entre os importados, vence o último da lista do `main.js`.
Um `#id` vence qualquer número de classes. `health-reference-kpis.css` domina `#page-dashboard`
com `#id … !important` em quase toda regra.

- Estilo de um módulo vai em `src/styles/<modulo>.css`, importado no `main.js`, no ponto da lista
  onde a ordem faz sentido.
- Componentes compartilhados (botão, card, tabela, formulário, modal) devem convergir para um
  único `src/styles/componentes.css`. Não redefina `.btn` em CSS de módulo.
- `analises.html` carrega o próprio CSS (`analises.css`, `analises-layout-modern.css`,
  `analises-infinite-table.css` e, pelo JS, `analises-responsive-fixes.css`). Os tokens precisam
  chegar lá também.
- **Fase final: `@layer`.** Camadas resolvem os `!important` sem guerra de especificidade, mas
  **CSS fora de camada vence qualquer camada**. Só funciona depois que o legado for envolvido
  (`@import url("./app.css") layer(legado);`). Não comece por aqui.

---

## 8. Plano de migração

Cada fase é independente, entregável em PR próprio e reversível.

| Fase | O quê | Pronto quando |
|---|---|---|
| **1. Tokens** | Criar `src/styles/tokens.css` (seção 3) com os aliases e importar primeiro nos dois `main.js`. Remover o `:root` de cor de `app.css` e o `:root` de `nielsen-shell-ux.css`. | Existe um só bloco `:root` de cor e um só `[data-theme="dark"]` de token. Nada muda visualmente, exceto as cores corrigidas pelos aliases. |
| **2. Contraste** | Corrigir as 5 falhas da seção 1: `.btn` sólido, `.btn.green`, texto secundário, borda de campo, vermelho de texto. | As falhas da tabela da seção 1 passam no AA. |
| **3. Tipografia** | Pesos ≤ 700; nada abaixo de 11px; `uppercase` só no eyebrow; tirar `800;900` do Google Fonts. | `grep` da seção 9 não encontra 750–1000 nem 8–10px. |
| **4. Componentes** | Consolidar botão, card, tabela, formulário e modal em `componentes.css`, usando só tokens. | `.btn` é definido em um arquivo só. |
| **5. Dívida** | Dissolver `system-ui-fixes`, `post-152-regression-fixes`, `post157-interface-tuning`, `runtime-critical-fixes` e `health-*-fix*` no CSS do módulo; trocar `body.dark-mode` por `[data-theme]`; alinhar `analises.css` aos tokens; aplicar `@layer`. | `!important` < 50 e cores hex distintas < 80. |

As fases 1 e 2 têm o maior retorno pelo menor risco: são poucas linhas e corrigem problemas de acessibilidade reais.

---

## 9. Medir o progresso

Rode na raiz do `agsus-monitora`. A linha de base de 2026-09-22 está na seção 1.

```bash
S="src/styles/*.css src/analises/*.css"
cat $S | grep -o '!important' | wc -l                                          # !important
cat $S | grep -oiE '#[0-9a-f]{6}\b' | tr A-F a-f | sort -u | wc -l              # cores hex distintas
cat $S | grep -oE 'box-shadow:[^;]+' | tr -s ' ' | sort -u | wc -l              # sombras distintas
cat $S | grep -oE 'font-weight:\s*[0-9]+' | sort | uniq -c | sort -rn           # pesos
cat $S | grep -oE 'font-size:\s*(8|9|10)(\.[0-9])?px' | wc -l                   # fontes < 11px
cat $S | grep -c 'text-transform:\s*uppercase'                                  # maiúsculas
cat $S | grep -o 'body\.dark-mode' | wc -l                                      # tema escuro legado
```

Para contraste, calcule e não estime: a razão WCAG sai da luminância relativa dos dois hex. Um
`node -e` de dez linhas resolve; os valores deste guia foram obtidos assim.

---

## 10. Checklist antes do merge

- [ ] A próxima ação está evidente, e há um só primário no contexto?
- [ ] Carregando, vazio, erro e sem permissão estão desenhados?
- [ ] Funciona só com teclado, com foco visível?
- [ ] Funciona em 375px e no tema escuro?
- [ ] Os pares de cor novos passam no AA (texto 4,5; controle 3)?
- [ ] Nenhum hex, `!important` ou `#id` novo? Nenhum arquivo `*-fix.css` novo?
- [ ] O estado tem ícone ou rótulo além da cor?
- [ ] Ação destrutiva pede confirmação citando o objeto?
- [ ] Conferi o estilo computado no navegador, e não só o CSS?

## 11. Linguagem da interface

Português do Brasil, com acentos. Verbos de ação ("Importar lista", "Publicar edital",
"Tentar de novo"). Nada de termo de banco ou de código na tela. Erro diz o que aconteceu e o
que fazer. Confirmação cita o objeto ("Excluir o edital 101/2026?"). Número segue o formato
brasileiro (`1.308`, `60,5%`), com `toLocaleString("pt-BR")` (ex.: `formatarNumero` em `src/lib/editais-do-nucleo.js`).

---

## 12. Divergências com o Design System AgSUS

Medido em 2026-09-25, depois da Visão geral da Saúde Indígena no Design System (antes, na troca
de tokens: 215 · 54 · 28 · 157 · 547 · 1645). Ocorrências em `src/styles/*.css`, contadas com
`cat src/styles/*.css | grep -oiE '<padrão>' | wc -l` (hex: `#[0-9a-f]{3,8}`). O caminho é o
da seção 8: resolver ao migrar cada tela (de preferência junto com a passagem para React), não num
mutirão.

| Divergência | Hoje | Alvo |
|---|---|---|
| Peso ≥ 700 (`font-weight: 700/800/900/bold`) | 163 | 0 (máximo 600) |
| `text-transform: uppercase` | 42 | 0 (sentence case) |
| `linear-gradient` | 12 | 0 (proibido) |
| `box-shadow` | 145 | só menus, popovers, modais e toasts |
| `!important` | 493 | < 50 (seção 8) |
| Hex chumbado em CSS | 1579 | só dentro de `tokens.css` |
| **Exceção aceita:** KPIs em card | Cards no padrão do DS 11.6 (fundo claro, borda sutil, sem sombra), por decisão do responsável (25/09/2026). Feito na Saúde Indígena; Editais e Aprovados ainda com o card antigo. | Manter card; alinhar Editais e Aprovados ao mesmo card. |
| **Exceção aceita:** filtros, tabela, mapa e "unidades com mais de um processo" em card | Na Visão geral, no mesmo card dos KPIs (DS 11.6, sem sombra), por decisão do responsável (25/09/2026). | Manter card; não aninhar card dentro de card. |
| Botão verde arredondado (`.btn.green`) | feito: `.btn`, `.btn.green` e `.btn.primary` no primário azul (`app.css`); `analises.html` ainda tem o seu | `--color-action-primary`, `--radius-md`, sem sombra |
| Modo escuro | existe | fora do escopo do DS: manter, sem investir |
| **Exceção aceita:** cor da barra lateral | Segue a cor configurada em Configurações → Aparência (`ui_sidebar_background_color`), identidade do MONITORA — exceção aceita ao `--color-sidebar-bg` oficial (decisão do responsável, 25/09/2026). | Não trocar. |
