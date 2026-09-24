# Design do MONITORA

Guia **normativo** da interface: diz como a tela deve ficar e como sair do estado
atual até lá. Vale para `index.html`, `analises.html` e tudo em `src/styles/` e
`src/analises/*.css`.

Parte do que o sistema já tem — as cores da marca AgSUS (`--agsus-*` em `app.css`), a fonte
Geist, o shell de `platform-shell.css` — e organiza isso em tokens com papel definido, para que
o mesmo estado tenha a mesma aparência em Saúde Indígena, Núcleo, Calendário, Aprovados,
Configurações e Análises.

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
6. **Contraste AA:** texto ≥ 4,5:1, texto grande e bordas de controle ≥ 3:1.
   `--brand-accent` (ciano) e `--state-warning-fill` (amarelo) **nunca** são cor de texto
   nem fundo de texto branco.
7. **Pesos só 400, 500, 600, 700. Informação operacional com no mínimo 12px.**
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

**Possível órfão:** `src/styles/pwa-lifecycle.css` não é importado por nenhum arquivo.
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

### 3.1 Cor

```css
:root {
  /* Marca */
  --brand-primary: #003b70;          /* ação principal, links, destaque (11,29) */
  --brand-primary-strong: #002b54;   /* hover/pressionado do primário */
  --brand-accent: #00a8d6;           /* SÓ preenchimento decorativo: tile de ícone, barra. Nunca texto (2,77) */
  --brand-secondary: #0b8f58;        /* identidade; como botão use --state-success-strong */

  /* Superfícies */
  --surface-page: #f3f7fb;
  --surface-card: #ffffff;
  --surface-raised: #f6f9fc;         /* cabeçalho de tabela, faixa de filtros */
  --surface-hover: #f1f5f9;
  --surface-inverse: #003b70;

  /* Texto */
  --text-primary: #10243e;           /* 15,63 */
  --text-secondary: #5f6f86;         /* 5,12 no card, 4,75 na página */
  --text-inverse: #ffffff;

  /* Bordas e foco */
  --border-subtle: #d7e5f2;          /* decorativa: card, divisória, linha de tabela */
  --border-control: #7d8fa5;         /* campo, select, checkbox (3,31 — WCAG 1.4.11) */
  --focus-ring: #1f8fff;             /* 3,27 */

  /* Estado — texto/ícone | fundo suave (texto sobre o suave ≥ 4,5) */
  --state-success: #087a4b;          --state-success-soft: #e7f5ee;   /* 5,39 | 4,80 */
  --state-success-strong: #087a4b;   /* fundo de botão com texto branco (5,39) */
  --state-warning: #8a5a00;          --state-warning-soft: #fdf4d8;   /* 5,93 | 5,39 */
  --state-warning-fill: #f2b705;     /* só com --text-primary por cima (8,59) */
  --state-danger: #c02634;           --state-danger-soft: #fdecee;    /* 5,89 | 5,16 */
  --state-info: #0f5db7;             --state-info-soft: #e8f1fc;      /* 6,42 | 5,63 */
  --state-neutral: #5f6f86;          --state-neutral-soft: #eef2f6;   /* 5,12 | 4,55 */
}

:root[data-theme="dark"] {
  --brand-primary: #70cfff;          /* 9,69 sobre o card escuro */
  --brand-primary-strong: #b5e5ff;
  --brand-accent: #4fdcff;
  --surface-page: #071421;
  --surface-card: #0e1e2e;
  --surface-raised: #14283a;
  --surface-hover: #1a3146;
  --surface-inverse: #10273f;
  --text-primary: #edf4fa;           /* 15,21 */
  --text-secondary: #a8b8c8;         /* 8,33 */
  --text-inverse: #071421;
  --border-subtle: #294158;
  --border-control: #6a829a;         /* 4,24 */
  --focus-ring: #7dd3fc;
  --state-success: #29b36a;          /* 6,23 */
  --state-warning: #f2b705;          /* 9,29 */
  --state-danger: #ff6b76;           /* 6,12 */
  --state-info: #70cfff;
  /* Os -soft escuros: a mesma cor com 16% de opacidade sobre o card — medir o texto por cima antes de usar. */
}
```

**Semântica de estado:** azul = disponível, pendente ou informativo ·
âmbar = atenção, prazo próximo ou em andamento · verde = sucesso, ativo ou concluído ·
vermelho = erro, bloqueio ou ação destrutiva · cinza = encerrado ou secundário.
Uma cor de estado não é usada para decorar nem para identificar uma série de gráfico.

**Nomes legados viram alias**, para não quebrar nada durante a migração:

```css
:root {
  --navy: var(--brand-primary);      --agsus-azul: var(--brand-primary);
  --cyan: var(--brand-accent);       --agsus-ciano: var(--brand-accent);
  --green: var(--brand-secondary);   --agsus-verde: var(--brand-secondary);
  --yellow: var(--state-warning-fill); --agsus-amarelo: var(--state-warning-fill);
  --red: var(--state-danger);        --agsus-vermelho: var(--state-danger);
  --slate: var(--text-primary);      --muted: var(--text-secondary);
  --bg: var(--surface-page);         --card: var(--surface-card);
  --soft: var(--surface-raised);     --line: var(--border-subtle);
  --platform-border: var(--border-subtle);
  --platform-muted: var(--text-secondary);
  --platform-hover: var(--surface-hover);
  --shadow: var(--shadow-card);      --radius: var(--radius-lg);
}
```

As cores de território (`--indigena-verde`, `--indigena-folha`) e as do mapa são semânticas do
domínio e têm teste (`tests/cor-da-terra-indigena.test.js`, `tests/fases-da-terra-indigena.test.js`).
Não as troque pela paleta geral.

### 3.2 Tipografia

```css
:root {
  --font-sans: "Geist", "Segoe UI", Roboto, Arial, sans-serif;   /* tokens.css */
  --text-xs: 11px;    /* só metadado auxiliar: eixo de gráfico, contador em badge */
  --text-sm: 12px;    /* mínimo para informação operacional */
  --text-md: 13px;    /* tabela, rótulo de campo */
  --text-base: 14px;  /* corpo */
  --text-lg: 16px;
  --text-xl: 18px;    /* título de painel */
  --text-2xl: 22px;   /* título de página */
  --text-kpi: clamp(22px, 1.75vw, 28px);
}
```

**A fonte é a Geist**, no app principal e em Análises. Vem do Google Fonts como fonte variável
(`family=Geist:wght@400..900`): um arquivo cobre todos os pesos, então os 800 e 900 legados não
custam download extra. Regra nova usa `var(--font-sans)` e fica em 400–700 — o problema da
tipografia daqui não é a família, é o peso.

| Uso | Tamanho | Peso | Tracking |
|---|---|---|---|
| Número de KPI | `--text-kpi` | 700 | `-0.03em` + `tabular-nums` |
| Título de página | `--text-2xl` | 700 | `-0.02em` |
| Título de painel | `--text-xl` | 700 | 0 |
| Eyebrow de seção (único caso de maiúsculas) | `--text-sm` | 600 | `0.04em` |
| Rótulo, botão, cabeçalho de tabela | `--text-sm` a `--text-md` | 600 | 0 |
| Célula de tabela, controle | `--text-md` | 500 | 0 |
| Texto corrido | `--text-base` | 400 | 0 |

**Por que não 800 e 900:** em corpo de 10 a 12px, peso 900 fecha as contraformas e o
texto vira uma mancha. Hoje há 183 declarações de 800 ou 900. Converta para 700
(títulos e números) ou 600 (rótulos). Tracking largo (`0.08em` ou mais) só funciona
em maiúsculas grandes. Em rótulo pequeno, separa demais as letras.

Números em tabela e KPI usam `font-variant-numeric: tabular-nums` e ficam alinhados à direita (`.num`).

### 3.3 Espaçamento

Base de 4px: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`,
`--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`, `--space-10: 40px`.
O padding de card é `--space-5`. O espaço entre cards é `--space-4`. O espaço entre seções é `--space-8`.

### 3.4 Raio

| Token | Valor | Uso | Absorve hoje |
|---|---|---|---|
| `--radius-sm` | 8px | chip interno, checkbox, tooltip | 3–9px |
| `--radius-md` | 12px | botão, campo, tile de ícone, KPI | 10–14px |
| `--radius-lg` | 18px | card, painel, modal (= `--radius` atual) | 16–26px |
| `--radius-pill` | 999px | badge, pílula, toggle | 99px, 999px |

### 3.5 Sombra

```css
:root {
  --shadow-card: 0 4px 14px rgba(15, 35, 60, 0.06);        /* repouso (= --shadow atual) */
  --shadow-raised: 0 1px 2px rgba(15, 35, 60, 0.03),
                   0 12px 32px -24px rgba(15, 35, 60, 0.28); /* destaque, hover */
  --shadow-overlay: 0 24px 64px -16px rgba(15, 35, 60, 0.32); /* modal, popover, drawer */
}
:root[data-theme="dark"] {
  --shadow-card: none;   /* no escuro, a borda separa as superfícies */
  --shadow-raised: 0 1px 2px rgba(0, 0, 0, 0.38);
  --shadow-overlay: 0 24px 64px -16px rgba(0, 0, 0, 0.6);
}
```

A sombra de destaque tem duas camadas de propósito: a curta assenta o card, e a longa, quase
transparente, dá a elevação. Com uma camada só, o card parece uma caixa flutuando.

### 3.6 Movimento

`--motion-fast: 140ms` (fade), `--motion-base: 220ms` (deslocamento),
`--ease-standard: cubic-bezier(0.22, 0.61, 0.36, 1)`. São os valores do colapso da
barra lateral, generalizados. Nunca anime `width`, `height`, `top`, `left` nem
`grid-template-columns`, porque recalculam o layout a cada quadro. `display` não
interpola: para esconder com transição, use `opacity` + `visibility`. O
`prefers-reduced-motion` já está tratado globalmente em `app.css`.

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

- **Primário** (`.btn`): fundo sólido `--brand-primary`, texto `--text-inverse`, hover
  `--brand-primary-strong`. **Sem gradiente**, porque o gradiente atual termina em ciano
  e reprova o contraste. Um primário por contexto.
- **Secundário** (`.btn.secondary`): fundo `--surface-card`, borda `--border-control`, texto `--text-primary`.
- **Terciário** (`.btn.outline`): sem fundo, texto `--brand-primary`. Para ações de baixo peso.
- **Sucesso** (`.btn.success`; `.btn.green` fica como alias): `--state-success-strong`.
- **Destrutivo** (`.btn.danger`; hoje só existe em `.config-governance-footer`): `--state-danger`. Sempre com confirmação que cita o objeto afetado.
- Geometria: altura mínima de 40px (44px no toque, `--mobile-touch-size`), `--radius-md`,
  peso 600, ícone a 8px do texto.
- Só com ícone: `aria-label` + `title` e alvo de 40×40.
- Desabilitado: `opacity: .6` + `cursor: not-allowed`. Se o motivo não for óbvio, diga qual é (`title` ou texto ao lado).

### Superfície — `.card`, `.table-card`, `.admin-card`

`--surface-card`, borda de 1px `--border-subtle`, `--radius-lg`, `--shadow-card`, padding `--space-5`.
**Sem faixa colorida no topo** (`::before` de 3 a 4px): com seis cards lado a lado vira um arco-íris
que compete com o conteúdo. A cor vai para o tile do ícone e para o indicador, onde tem significado.

### Indicador — `.kpi`, `.approved-kpi`

```
┌──────────────────────────────────────┐
│ Rótulo em cinza              [ícone] │  --text-sm/600 --text-secondary · tile 34px --radius-md
│ 1.308                                │  --text-kpi/700 tabular-nums --text-primary
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  60% das vagas    │  barra de 4px + percentual na cor do estado
└──────────────────────────────────────┘
```

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
digitados se mantêm depois de erro do servidor. Seleção múltipla: `src/modules/multi-select-busca.js`
no app principal e Tom Select em análises. Não crie um terceiro.

### Modal — `.modal` > `.modal-card` (`.modal-head`, `.modal-body`)

`--z-overlay`, `--radius-lg`, `--shadow-overlay` e fundo escurecido. O foco fica preso no modal,
`Esc` fecha e, ao fechar, o foco volta ao elemento que abriu. Largura máxima de 560px (formulário)
ou 880px (detalhe). Formulário longo não vai em modal pequeno: use página ou drawer.

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
Saúde indígena, Recrutamento e seleção, Administração —, cada uma com as suas páginas
(`src/lib/menu-lateral.js`; área nova é uma entrada no catálogo). Painéis externos
entram em Recrutamento e seleção; as seções de Configurações são as páginas de Administração. Área
marcada como `paginaUnica` (Saúde indígena) é link direto.

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

**Migração para o `lucide` em andamento, por componente.** Já migrados: a barra lateral e o que é
dela (menu inferior do celular, Sair, seletor de tema, alça de recolher). O resto segue em Font
Awesome 6 até o componente migrar. Regras:

- Um conjunto por componente: nunca Lucide e Font Awesome dentro do mesmo componente.
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

Chart.js (`legacy-app.js`, `window.Chart` via `src/lib/chartjs-global.js`) e ECharts (`analises-app.js`).

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
| **5. Dívida** | Dissolver `system-ui-fixes`, `post-152-regression-fixes`, `post157-interface-tuning`, `runtime-critical-fixes` e `health-*-fix*` no CSS do módulo; trocar `body.dark-mode` por `[data-theme]`; alinhar `analises.css` aos tokens; decidir sobre `pwa-lifecycle.css`; aplicar `@layer`. | `!important` < 50 e cores hex distintas < 80. |

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
brasileiro (`1.308`, `60,5%`), via `src/lib/formatters.js`.
