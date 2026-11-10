---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Design e tokens

O guia normativo da interface é o [`DESIGN.md`](../../DESIGN.md), na raiz: **leia a seção 0 sempre
que for tocar em CSS**; as demais, só a que o trabalho pede. A norma institucional é o
[Design System AgSUS](../design-system-agsus.md) (cores, tipografia, espaçamento, raio, sombra,
componentes, acessibilidade): onde ele e o `DESIGN.md` divergirem, vale o Design System; o
`DESIGN.md` diz como o MONITORA chega lá e guarda as regras locais (divergências na seção 12).

## Regras de ouro (DESIGN.md, seção 0)

1. Cor, raio, sombra, espaçamento e z-index vêm de **token** (`var(--…)`). Nenhum hex novo em regra
   de componente (`tests/cores-so-por-token.test.js`).
2. Nenhum `!important` novo e nenhum seletor `#id` novo. Se for obrigatório vencer uma regra
   legada, faça e comente a origem.
3. Não crie `*-fix.css`, `post-NNN-*.css` ou `*-refinement.css`: corrija na regra de origem.
4. Antes de escrever, descubra quem já manda no elemento (`grep … | grep -E "important|#"`).
5. Confira o estilo computado no navegador (`getComputedStyle(el).prop`), não o arquivo.
6. Contraste AA: texto ≥ 4,5:1, texto grande e bordas de controle ≥ 3:1. `--brand-accent` é só
   preenchimento decorativo, nunca cor de texto.
7. Pesos só 400, 500 e 600; nada abaixo de 12px; conteúdo principal com 14px; sentence case.
8. Anime só `opacity` e `transform`. O tema escuro sai de `html[data-theme="dark"]`.
9. Regra do escoteiro: ao mexer num componente, migre para token os valores daquele bloco.

## Tokens

- Moram em `src/styles/tokens.css`, primeiro import do `src/main.ts`; os valores são os do Design
  System AgSUS, seção 8. **Código novo usa os nomes oficiais** (`--color-text-secondary`,
  `--color-bg-subtle`, `--radius-lg`, `--text-body`…); os nomes antigos do MONITORA (`--brand-*`,
  `--surface-*`, `--text-*`, `--state-*`, `--series-*`) apontam para os oficiais (tabela na seção
  3.1 do `DESIGN.md`).
- Raio: controle `--radius-md`, card `--radius-lg`, painel e modal `--radius-xl`.
- Camadas: escada `--z-sticky` … `--z-toast` (seção 3.7); nada acima de `--z-toast`
  (`tests/camadas-acima-da-barra.test.js`).
- Séries de gráfico e mapa: `--series-1` … `--series-6` (seção 6; `tests/cores-das-series.test.js`
  lê a tabela do `DESIGN.md`).
- Cores de etapa do calendário: tokens `--etapa-*`; Terras Indígenas têm cores de domínio (3.1).
- A cor da barra lateral vem de Configurações → Aparência (`ui_sidebar_background_color`):
  exceção aceita ao `--color-sidebar-bg` oficial, por decisão de 25/09/2026.

## Tema escuro (seção 5)

Chave canônica `html[data-theme="dark"]`, definida em `src/app/moldura.ts`. `body.dark-mode` é
espelho (não escreva regra nova com ele); `body.sidebar-theme-dark` é o tema configurável da
barra, outro assunto. O escuro é escolhido, não invertido: cada cor tem seu valor validado.

## Componentes

React usa `src/ui/` ([[componentes-padrao]]); marcação do legado usa os componentes da seção 4
(`.btn`, `.card`, `.table-card`, `.modal`, `.chip`, `.alert`), sem inventar classe.

## Relacionadas

- [[css]] — onde escrever CSS e como a cascata funciona
- [[acessibilidade]] — contraste, foco, teclado
- [[mobile]] — breakpoints e responsividade
- [[icones]] — Lucide e o registro único
- [[textos-da-interface]] — a linguagem da tela
