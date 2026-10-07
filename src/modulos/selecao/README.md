# `src/modulos/selecao/` — Seleção

A tela `#page-selecao` (view `selecao`), módulo do app desde a Etapa 2: monta na própria
`<section>` por `montarSelecao()` (`src/main.js` → `window.selecaoController`); o legado chama
`render()` ao navegar (`TELAS_REACT`). Área = a atual do app; sessão, tema, aviso e tela cheia =
os do app. Só leitura (`get_selecao_da_area`).

```
selecao.jsx     <TelaDeSelecao> e montarSelecao() (área atual, troca de área, controlador)
estado.ts       store tipado sem React: carga da área (cópia guardada), sessão, CSV
tipos.ts        contratos do cliente, snapshot, dados normalizados e armazenamento
paineis.jsx     topo (status e ações), filtros de escolha múltipla, KPIs, recorte, gráficos,
                alertas da coluna Observação
tabela.jsx      base operacional consolidada (TabelaInfinita)
selecao.css     só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/selecao-do-painel.js` (carga: `selecao-da-planilha.js`,
`scripts/sincronizar-selecao.mjs`). Explicações das regras para a Aya:
`docs/aya/regras-da-selecao.md`. Testes: `tests/modulos/selecao.test.js` e
`tests/selecao-do-painel.test.js`.

## TypeScript — etapa 1

O estado e os contratos foram migrados; `selecao.jsx`, `paineis.jsx`, `tabela.jsx` e as
regras de `src/lib/selecao-do-painel.js` continuam em JavaScript nesta etapa. O cliente
real do Supabase é compatível com o contrato de leitura do módulo; os testes de tipos
também rejeitam nomes de RPC e argumentos incorretos. Nenhuma permissão ou RPC mudou.

Respostas da RPC e do cache entram como `unknown` e passam pelo normalizador existente.
Contagens normalizadas são `number | null`; datas e `edital_id`, preservados sem validação
pelo normalizador JS, continuam `unknown`. A declaração de tipos não acrescenta validação
de JSON em tempo de execução.

`npm run typecheck:frontend` inclui `tests/tipos/selecao.tsx`. Os testes existentes do módulo
conferem filtros, sessão, troca de área, cache, falhas e CSV. O helper `comTempoLimite` recebeu
apenas a declaração genérica em JSDoc para manter o tipo da promessa; sua execução é a mesma.
