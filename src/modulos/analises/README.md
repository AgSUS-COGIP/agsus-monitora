# `src/modulos/analises/` — Análises curriculares

A tela `#page-analises` (view `analises`), módulo do app desde a Etapa 4: monta na própria
`<section>` por `montarAnalises()` (`src/main.ts` → `window.analisesController`); o legado chama
`render()` ao navegar (`TELAS_REACT`). Área = a atual do app; sessão, tema, aviso e tela cheia =
os do app. Sem iframe, sem postMessage, sem `window.*` próprio.

```
analises.tsx    <TelaDeAnalises> e montarAnalises(): filtros, KPI, busca e o responsável do
                gráfico (estado do componente), avisos de sessão/acesso/erro/demora, controlador
paineis.tsx     filtros (situação do processo, seleção múltipla em cascata, Mais opções, chips),
                os 7 KPIs, gráficos (responsável empilhado clicável, análises por data clicável —
                filtra pelo dia/período, também nos campos de data de Mais opções) e pendências
ritmo.tsx       card "Ritmo da análise" por edital analisado no MONITORA (prazo do
                cronograma, faltam, por dia e por avaliador, ritmo atual e projeção) e
                "Destaques de hoje" (🥇🥈🥉 do dia e selo 🎯 Precisão; zera todo dia)
tabela.tsx      fila (TabelaInfinita: 50 por vez, Carregar mais, busca só da fila)
gaveta.tsx      detalhe: contexto, links (origem e PDF, só http/https), seções e parecer
espelho-na-gaveta.tsx  linha da ficha concluída: nota autodeclarada × consolidada e, por critério,
                Declarada / Após análise / Teto, com as justificativas do critério que mudou
                (a conta do espelho de nota: src/lib/espelho-do-painel-de-analises.ts)
estado.ts       store sem React: carga por área e escopo, cópia do navegador, porteiro, gaveta
                (detalhamento sob demanda), pareceres em lote, CSV, comemorações
consultas.ts    as RPCs (lista, porteiro, detalhamento, pareceres, ritmo) e a cópia no IndexedDB
marcos.ts       edital 100% analisado e fila zerada (escopo Ativo); meta de hoje batida pela
                equipe (uma vez por dia por pessoa)
```

Regras puras em `src/lib/analises-curriculares.ts` (janela e validação, filtros em cascata, KPIs,
gráficos, pendências, recorte, gaveta, CSV), mais `area-do-painel-de-analises.ts`,
`lista-do-painel-de-analises.ts`, `textos-do-painel-de-analises.ts` e
`cache-do-painel-de-analises.ts`; o ritmo (etapa do cronograma, dias úteis, projeção) em
`src/lib/ritmo-da-analise.ts` (`tests/ritmo-da-analise.test.js`). Visual só de `src/ui/` (sem CSS próprio). Testes:
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

O cliente Supabase continua compartilhado. O detalhamento
(get_analise_detalhe_do_painel) traz, desde a migration 20261020150000, a chave
"espelho" na linha da ficha concluída: a mesma entrada dos espelhos de nota em massa,
montada no navegador por espelhoDaFichaGravada (gaveta e espelho sempre batem). Os testes simulam consultas e armazenamento, com a rede bloqueada;
`tests/tipos/analises.tsx` também confere usos válidos e rejeições dos contratos.
