# `src/modulos/analises/` — Análises curriculares

A tela `#page-analises` (view `analises`), módulo do app desde a Etapa 4: monta na própria
`<section>` por `montarAnalises()` (`src/main.js` → `window.analisesController`); o legado chama
`render()` ao navegar (`TELAS_REACT`). Área = a atual do app; sessão, tema, aviso e tela cheia =
os do app. Sem iframe, sem postMessage, sem `window.*` próprio.

```
analises.jsx    <TelaDeAnalises> e montarAnalises(): filtros, KPI, busca e o responsável do
                gráfico (estado do componente), avisos de sessão/acesso/erro/demora, controlador
paineis.jsx     filtros (situação do processo, seleção múltipla em cascata, Mais opções, chips),
                os 7 KPIs, gráficos (responsável empilhado clicável, evolução diária) e pendências
tabela.jsx      fila (TabelaInfinita: 50 por vez, Carregar mais, busca só da fila)
gaveta.jsx      detalhe: contexto, links (origem e PDF, só http/https), seções e parecer
estado.js       store sem React: carga por área e escopo, cópia do navegador, porteiro, gaveta
                (detalhamento sob demanda), pareceres em lote, CSV, comemorações
consultas.js    as RPCs (lista, porteiro, detalhamento, pareceres) e a cópia no IndexedDB
marcos.js       edital 100% analisado e fila zerada (escopo Ativo)
```

Regras puras em `src/lib/analises-curriculares.js` (janela e validação, filtros em cascata, KPIs,
gráficos, pendências, recorte, gaveta, CSV), mais `area-do-painel-de-analises.js`,
`lista-do-painel-de-analises.js`, `textos-do-painel-de-analises.js` e
`cache-do-painel-de-analises.js`. Visual só de `src/ui/` (sem CSS próprio). Testes:
`tests/analises-curriculares.test.js`, `tests/modulos/analises*.test.js`.
