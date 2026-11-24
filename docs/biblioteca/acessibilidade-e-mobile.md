---
tipo: regra
area: front
atualizado: 2026-11-23
---

# Acessibilidade e mobile

Meta: **WCAG 2.2 nível AA** em todas as telas, que funcionam em desktop, notebook, tablet e
celular. A norma completa está no [Design System AgSUS](../design-system-agsus.md): seção 17
(acessibilidade) e seção 16 (responsividade); as regras visuais locais, em [[design-e-tokens]].

## Acessibilidade

| Tema                  | Requisito                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Contraste de texto    | 4,5:1 (normal), 3:1 (grande); use só os pares de fundo e texto do Design System                   |
| Contraste não textual | 3:1 para contornos de campo, ícones essenciais, indicadores de estado e elementos de gráfico      |
| Foco                  | sempre visível (contorno de 2px `focus-ring`, offset 2px); nunca tirar o `outline` sem substituto |
| Foco não encoberto    | cabeçalho e barras fixas não cobrem o elemento em foco (`scroll-padding-top`)                     |
| Teclado               | tudo pelo teclado, em ordem lógica; Esc fecha camadas; foco preso no modal e devolvido à origem   |
| Link de salto         | "Pular para o conteúdo" é o primeiro elemento focável                                             |
| Área de clique        | mínimo 24 × 24px; 36px no desktop e 44px em toque; botão só com ícone tem alvo de 40×40           |
| Rótulos               | todo campo tem rótulo visível associado (`Campo`); botão só com ícone tem `aria-label` + `title`  |
| Semântica             | elementos nativos (`button`, `a`, `table`, `nav`, `main`); nada de `div` clicável                 |
| Cor                   | nenhuma informação só por cor (no mapa, a forma é a informação e a cor é reforço)                 |
| Feedback assíncrono   | `aria-live` em toasts e atualizações, `role="alert"` em erros, `aria-busy` ao carregar            |
| Erros                 | em texto, associados ao campo, com instrução de correção ([[textos-da-interface]])                |
| Movimento             | respeitar `prefers-reduced-motion`; animar só `opacity`/`transform`                               |
| Idioma                | `lang="pt-BR"`                                                                                    |

Como o sistema cumpre:

- Ícone é decorativo (`aria-hidden`); quem nomeia o controle é o texto ou o `aria-label`
  ([[componentes-padrao]]).
- Indicador que filtra marca o estado com `aria-pressed` (não só pela cor); tabela ordenável mostra
  `aria-sort` e ícone; `Segmentado` e `Abas` andam com as setas ← →.
- `Modal` e `Gaveta` prendem o foco e fecham com Esc.
- Pesos 400/500/600, nada abaixo de 12px, sentence case ([[design-e-tokens]]).
- Testes: `tests/contraste-dos-temas.spec.js` (Playwright, os dois temas; [[testes]]) e
  `tests/repositorio-e-banco.test.js` (bloco `cores-so-por-token`); `src/lib/base/contraste.ts` calcula o contraste do aviso de
  branding (reutilize em vez de reescrever).

## Mobile e responsividade

Não basta diminuir os componentes: reorganize a tela.

**Breakpoints.** Media query não aceita `var()`, então os valores são constantes documentadas:

- **420px** — celular pequeno
- **640px** — celular
- **900px** — tablet; a barra lateral vira gaveta (contrato com
  `src/componentes/barra-lateral/usar-ambiente.ts`) e as tabelas viram cartões
- **1220px** — desktop estreito

Os valores antigos (560, 680, 700, 720, 820, 1180) migram para o mais próximo quando a regra for
tocada.

**Comportamento esperado** (Design System, seção 16):

| Elemento           | Desktop                | Tablet (768–1023px)                       | Celular (< 768px)                    |
| ------------------ | ---------------------- | ----------------------------------------- | ------------------------------------ |
| Barra lateral      | expandida ou recolhida | gaveta sobreposta                         | gaveta sobreposta                    |
| Padding da página  | 32px                   | 24px                                      | 16px                                 |
| Indicadores        | 4 colunas              | 2 colunas                                 | 1 coluna                             |
| Ações do cabeçalho | visíveis               | principal visível; demais em "Mais ações" | idem                                 |
| Filtros            | em linha               | busca e "Filtros (n)"                     | busca e "Filtros (n)"                |
| Tabelas            | completas              | rolagem horizontal, 1ª coluna fixa        | rolagem horizontal ou lista de itens |
| Modais e gavetas   | centralizado / 480px   | centralizado / 480px                      | tela cheia ou folha inferior         |

- Toque (`pointer: coarse`): controles com no mínimo 44 × 44px, em qualquer tela (React ou
  legado). A regra está no fim de `ui.css` (botões, botão só com ícone, abas, segmentados, chips,
  campos, busca e selects); a caixa de marcar tem o rótulo em volta como alvo; os controles do
  mapa, em `map-base-layer-switcher.css` e `indigenous-territories-layer.css`. A trava está em
  `tests/auditoria-visual.spec.js` (nenhum alvo < 44px a 375px).
- Sem rolagem horizontal da página em 320px de largura e com zoom de 200% (WCAG 1.4.10); tabelas e
  gráficos rolam dentro do próprio contêiner. Nunca desabilitar o zoom.

Como o sistema faz:

- **Tela sem rolagem lateral:** `.ui-tela` é uma grade com `minmax(0, 1fr)`; sem isso, a tabela
  mais larga alargava a página inteira (Painéis chegou a 924px num celular de 375px).
- **Rótulos de gráfico em linhas:** `rotuloEmLinhas` (`src/lib/selecao/rotulo-em-linhas.ts`) quebra o
  rótulo do eixo para o Chart.js, que desenha um array como várias linhas.
- **Legenda do mapa** e **convite da Aya**: a legenda começa recolhida abaixo de 768px; o convite
  "Primeira vez em…?" fica menor no celular e some ao rolar a página.
- **Tabela que rola de lado** (`.ui-tabela-rolagem`, `.table-wrap`, em `ui.css`): a primeira
  coluna fica fixa e uma sombra na borda direita avisa que há mais tabela (só CSS, sem medir no
  JS). A palavra só quebra se não couber sozinha (`overflow-wrap: break-word`): a coluna curta não
  vira "Enfermeir/o"; o que não cabe rola dentro da caixa. No toque, link, "⋯" e botão de ícone
  da célula têm 44 × 44px; a célula tem 8/12px (tokens) no celular e no desktop.
- **Tabelas em cartões (≤ 900px):** `src/app/casca/tabelas-em-cartoes.ts` põe os rótulos do modo
  cartão; por isso toda tabela nova avisa `agsus:content-updated` depois de desenhar
  (`TabelaInfinita` já avisa). `CardDaLista` rola de lado no celular.
- CSS de celular em `src/styles/mobile-*.css` ([[css]]).
- A barra lateral vira gaveta abaixo de 900px ([[modulo-barra-lateral]]).
- A legenda do mapa nacional é recolhível e começa fechada abaixo de 768px.

## Relacionadas

- [[design-e-tokens]] — pares de cor, tipografia e regras de ouro
- [[componentes-padrao]] — `Modal`, `Gaveta`, `Campo`, `TabelaInfinita`, `CardDaLista` e os ícones
- [[textos-da-interface]] — mensagens de erro
- [[modulo-barra-lateral]] — a gaveta abaixo de 900px
- [[testes]] — o teste de contraste no navegador
