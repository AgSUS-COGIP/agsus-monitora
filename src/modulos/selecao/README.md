# `src/modulos/selecao/` — Seleção

A tela `#page-selecao` (view `selecao`), módulo do app desde a Etapa 2: monta na própria
`<section>` por `montarSelecao()` (`src/main.js` → `window.selecaoController`); o legado chama
`render()` ao navegar (`TELAS_REACT`). Área = a atual do app; sessão, tema, aviso e tela cheia =
os do app. Só leitura (`get_selecao_da_area`).

```
selecao.tsx     <TelaDeSelecao> e montarSelecao() (área atual, troca de área, controlador)
estado.ts       store tipado sem React: carga da área (cópia guardada), sessão, CSV
tipos.ts        contratos do cliente, snapshot, dados normalizados e armazenamento
paineis.tsx     topo (status e ações), filtros de escolha múltipla, KPIs, recorte, gráficos,
                alertas da coluna Observação
tabela.tsx      base operacional consolidada (TabelaInfinita)
selecao.css     só o que é desta tela (tokens); o resto vem de src/ui/
```

Regras puras em `src/lib/selecao-do-painel.ts` (carga: `selecao-da-planilha.js`,
`scripts/sincronizar-selecao.mjs`). Explicações das regras para a Aya:
`docs/aya/regras-da-selecao.md`. Testes: `tests/modulos/selecao.test.js` e
`tests/selecao-do-painel.test.js`.

## TypeScript

Estado, componentes e regras puras foram migrados. Filtros têm quatro campos conhecidos
com listas de texto; indicadores, observações, linhas da tabela e callbacks são tipados.
As opções e os plugins dos gráficos usam os contratos do Chart.js instalado. O cliente
real do Supabase é compatível com o contrato de leitura do módulo; os testes de tipos
também rejeitam nomes de RPC e argumentos incorretos. Nenhuma permissão ou RPC mudou.

Respostas da RPC e do cache entram como `unknown`. O normalizador verifica objetos e a
lista de vagas antes de ler campos; entradas sem identificação são descartadas. Contagens
normalizadas são `number | null`, mantendo as conversões existentes. Datas e `edital_id`
são preservados da origem, continuam `unknown` e não recebem validação de formato.

`npm run typecheck:frontend` inclui `tests/tipos/selecao.tsx`. Os testes existentes do módulo
conferem filtros, sessão, troca de área, cache, falhas e CSV, além de entradas malformadas e
callbacks dos gráficos. Os contratos JSDoc da UI compartilhada permitem verificar a
integração da tela, sem migrar os outros módulos nesta entrega.
