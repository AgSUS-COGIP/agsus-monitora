# `src/modulos/analises/` — Análises curriculares

A tela `#page-analises` (view `analises`), módulo do app desde a Etapa 4: monta na própria
`<section>` por `montarAnalises()` (`src/main.js` → `window.analisesController`); o legado chama
`render()` ao navegar (`TELAS_REACT`). Área = a atual do app; sessão, tema, aviso e tela cheia =
os do app. Sem iframe, sem postMessage, sem `window.*` próprio.

```
analises.tsx    <TelaDeAnalises> e montarAnalises(): filtros, KPI, busca e o responsável do
                gráfico (estado do componente), avisos de sessão/acesso/erro/demora, controlador
paineis.tsx     filtros (situação do processo, seleção múltipla em cascata, Mais opções, chips),
                os 7 KPIs, gráficos (responsável empilhado clicável, análises por data clicável —
                filtra pelo dia/período, também nos campos de data de Mais opções) e pendências
tabela.tsx      fila (TabelaInfinita: 50 por vez, Carregar mais, busca só da fila)
gaveta.tsx      detalhe: contexto, links (origem e PDF, só http/https), seções e parecer
estado.ts       store sem React: carga por área e escopo, cópia do navegador, porteiro, gaveta
                (detalhamento sob demanda), pareceres em lote, CSV, comemorações
consultas.ts    as RPCs (lista, porteiro, detalhamento, pareceres) e a cópia no IndexedDB
marcos.ts       edital 100% analisado e fila zerada (escopo Ativo)
```

Regras puras em `src/lib/analises-curriculares.ts` (janela e validação, filtros em cascata, KPIs,
gráficos, pendências, recorte, gaveta, CSV), mais `area-do-painel-de-analises.js`,
`lista-do-painel-de-analises.js`, `textos-do-painel-de-analises.js` e
`cache-do-painel-de-analises.js`. Visual só de `src/ui/` (sem CSS próprio). Testes:
`tests/analises-curriculares.test.js`, `tests/modulos/analises*.test.js`.

## TypeScript

O módulo inteiro e as regras puras estão em TypeScript, com contratos em `tipos.ts`.
Estado e ações, filtros, período, callbacks, gráficos e detalhamento são verificados
pelo compilador estrito. O snapshot expõe linhas e detalhes somente para leitura.

A lista e os pareceres recebidos das RPCs ou do cache têm o envelope validado antes
de serem decodificados: colunas textuais, linhas em arrays e nomes seguros. Respostas
malformadas não são guardadas como uma lista válida. O porteiro aceita booleanos;
uma resposta inesperada mantém a consulta da lista como decisão de acesso. Campos
dinâmicos das planilhas continuam sendo `unknown`, convertidos em texto na apresentação;
o compilador não verifica os consumidores JavaScript nem o esquema de cada edital.

O cliente Supabase continua compartilhado. Nenhuma RPC, permissão ou migration é
alterada. Os testes simulam consultas e armazenamento, com a rede bloqueada;
`tests/tipos/analises.tsx` também confere usos válidos e rejeições dos contratos.
