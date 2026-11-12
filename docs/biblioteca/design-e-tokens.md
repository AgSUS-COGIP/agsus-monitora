---
tipo: regra
area: front
atualizado: 2026-11-12
---

# Design e tokens

A norma de interface é o [Design System AgSUS](../design-system-agsus.md) (cores, tipografia,
espaçamento, raio, sombra, componentes, gráficos, linguagem, acessibilidade). Esta nota guarda só o
que é do MONITORA: as regras de ouro, os tokens, as exceções aceitas ao DS. Valores (cor, medida,
camada) moram no código (`src/styles/tokens.css`, `app.css`), não em documento. Onde escrever CSS e
a dívida: [[css]].

## Regras de ouro (leia antes de tocar em CSS)

1. Cor, raio, sombra, espaçamento e z-index vêm de **token** (`var(--…)`). Nenhum hex novo fora de
   `tokens.css` (`tests/cores-so-por-token.test.js`; exceções em
   `tests/fixtures/cores-literais-permitidas.json`).
2. Nenhum `!important` novo e nenhum seletor `#id` novo. Se for obrigatório vencer uma regra
   legada, faça e comente a origem.
3. Não crie `*-fix.css`, `post-NNN-*.css` ou `*-refinement.css`: corrija na regra de origem.
4. Antes de escrever, descubra quem já manda no elemento (`grep … | grep -E "important|#"`).
5. Confira o estilo computado no navegador (`getComputedStyle(el).prop`), não o arquivo.
6. Contraste AA: texto ≥ 4,5:1, texto grande e bordas de controle ≥ 3:1, só com os pares do DS
   (3.4). `--brand-accent` é só preenchimento decorativo, nunca cor de texto. Calcule, não estime
   (`tests/foco-e-borda-dos-campos.test.ts`).
7. Pesos só 400, 500 e 600; nada abaixo de 12px; conteúdo principal com 14px; sentence case
   (`tests/tipografia-das-telas.test.ts`).
8. Anime só `opacity` e `transform`.
9. Regra do escoteiro: ao mexer num componente, migre para token os valores daquele bloco.

## Trava do acabamento (só encolhe)

`npm run check:architecture` roda `scripts/check-acabamento-so-encolhe.mjs`: por arquivo de `src/`
(`.css`, e `.tsx` só em literais de string), conta cor fixa (hex, `rgb()`, `hsl()`; `tokens.css` é
isento), `!important`, `z-index` numérico, `border-radius` e `box-shadow` sem `var()`, curva
(`ease`, `linear` ou duração literal em `transition`/`animation`), `transition` de
`width`/`height`/`top`/`left`/`all` e `backdrop-filter` fora de bloco com `position: fixed` ou
`sticky`. O número de cada tipo, em cada arquivo, nunca passa da linha de base
(`scripts/acabamento-linha-de-base.json`); arquivo novo começa em zero. Comentário e `url()` não
contam; a cor só conta em valor de declaração (seletor `#abc` não), e `border-radius` com
`0`, `inherit`, `initial`, `unset` ou `calc()` com `var()` não é desvio.

- Corrigiu desvios: `node scripts/check-acabamento-so-encolhe.mjs --atualizar` baixa a linha de
  base (não grava se algum número subir) e o diff vai no mesmo commit.
- Exceção legítima (sobrepor CSS do Leaflet, círculo `50%`, z-index local dentro de contexto de
  empilhamento próprio, cor de mapa, gráfico, marca ou PDF) leva **na mesma linha** um comentário
  `acabamento: permitido — <motivo>` (em CSS, dentro de `/* */`; em `.tsx`, depois de `//`). O separador pode ser
  travessão (—, –) ou hífen (-). Sem motivo depois dele, o marcador não isenta. Não use o marcador para fugir de token que existe.

## Tokens

- Moram em `src/styles/tokens.css`, primeiro import do `src/main.ts`; os valores são os do DS,
  seção 8. **Código novo usa os nomes oficiais** (`--color-text-secondary`, `--color-bg-subtle`,
  `--radius-lg`, `--text-body`…); os nomes antigos do MONITORA (`--brand-*`, `--surface-*`,
  `--text-*`, `--state-*`, `--series-*`) e os de `app.css` (`--card`, `--muted`…) apontam para os
  oficiais (comentário no topo de cada arquivo).
- Raio: controle `--radius-md`, card `--radius-lg`, painel e modal `--radius-xl`.
- **Camadas** (`--z-*`, em `app.css`): nada acima de `--z-toast`. A Aya fica em 10042, acima do
  cabeçalho e da barra do celular e abaixo do aviso de parabéns (10045). Quem precisa ficar acima
  da barra lateral usa `--z-overlay` (modal de busca) ou `--z-toast` (link de pular, aviso de
  conexão, aviso de sessão); `tests/camadas-acima-da-barra.test.js` guarda a ordem.
- Cores de etapa do calendário: `--etapa-*`. Terras Indígenas têm cores de domínio, não de paleta
  ([[terras-indigenas]]).

## Séries de gráfico e mapa

`--series-1` … `--series-6` (azul, laranja, ciano, violeta, magenta, oliva; claro e escuro em
`tokens.css`, fixados por `tests/cores-das-series.test.js`), validadas com a skill `dataviz`
(luminosidade, croma, daltonismo, contraste ≥ 3:1). Além do DS 13:

- ordem fixa, nunca ciclada; a 7ª série vira "Outros";
- a cor segue a entidade, não a posição: filtrar não repinta quem ficou (ex.: um projeto no mapa
  de Projetos);
- verde, âmbar e vermelho são de estado, nunca de série;
- legenda com rótulo obrigatória: magenta e oliva ficam no limite da separação para tritanopia.

## Tema escuro

Chave canônica `html[data-theme="dark"]`, definida em `src/app/moldura.ts`. `body.dark-mode` é
espelho (não escreva regra nova com ele); `body.sidebar-theme-dark` é a cor configurada da barra,
outro assunto. O escuro é escolhido, não invertido: cada token tem o próprio valor no bloco escuro
de `tokens.css`. Fora do escopo do DS: mantido, sem investir.

## Exceções aceitas ao Design System

Decisões do responsável (25/09/2026); não "corrigir" para o DS.

| Exceção                                    | Como fica                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| KPIs em card (DS 11.7 pede faixa sem card) | `Kpi` de `src/ui/`: card compacto de ~78px no padrão do DS 11.6 (borda sutil, sem sombra), em todas as telas                                |
| Blocos da tela em card                     | filtros, tabela, mapa e blocos em card (DS 11.6, sem sombra), sem card dentro de card; 12px entre os blocos, não os 48px de seção do DS 5.2 |
| Cor da barra lateral                       | a de Configurações → Aparência (`ui_sidebar_background_color`), não o `--color-sidebar-bg` oficial                                          |

## Componentes

React usa `src/ui/` ([[componentes-padrao]]); marcação do legado usa as classes de componente do
DS 11 (`.btn`, `.card`, `.table-card`, `.modal`, `.chip`, `.alert`), sem inventar classe. Não
redefina `.btn` em CSS de módulo.

## Relacionadas

- [[css]] — onde escrever CSS, a cascata e a dívida
- [[acessibilidade]] — contraste, foco, teclado
- [[mobile]] — breakpoints e responsividade
- [[icones]] — Lucide e o registro único
- [[textos-da-interface]] — a linguagem da tela
