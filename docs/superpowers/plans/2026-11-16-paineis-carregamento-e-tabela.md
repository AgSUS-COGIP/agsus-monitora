# Painéis: carregamento rápido, largura das colunas e origem dos dados — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** abrir cada relatório dos Painéis em menos de 1 s. Para isso, o resultado fica pronto
no banco e a tela lê só a página visível, guardando o que já leu na memória da aba. A pessoa
também pode arrastar a largura das colunas e vê um ⓘ com a origem dos dados.

**Architecture:**
- Uma migration cria duas tabelas de resultado pronto (cálculo por área e relatório; linhas)
  e uma função privada que monta as linhas de cada relatório. É o SQL de 20261113240000, sem
  a guarda de sessão e sem o recorte do usuário.
- O recálculo vem de três lugares: o cron de hora em hora, o Sincronizar (com lock e no
  máximo uma vez por minuto) e `salvar_fonte_da_coluna`, na mesma transação.
- A RPC nova `ler_relatorio_do_painel` pagina e aplica `FC_EDITAIS_VISIVEIS`. As três RPCs
  antigas saem.
- No front, o estado guarda as páginas lidas num `Map` por chave e as larguras por relatório,
  e a tela ganha a alça e o ⓘ.

**Tech Stack:** PostgreSQL/Supabase (plpgsql, pg_cron), PGlite nos testes, React 19 + TS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-paineis-carregamento-e-tabela-design.md`

## Global Constraints

- **RPCs:** Supabase só por RPC `security definer` com `set search_path to ''`. Grant só para
  `authenticated`; `revoke` de `public, anon`.
- **Contrato:** mudou RPC, mude `src/lib/rpc-contrato.ts` (`check:rpc-contract`).
- **Nomes MAD:** identificadores MAIÚSCULOS entre aspas, ≤ 30 caracteres, `PK_TB_<TABELA>`,
  `FK_`, `IN_`, `COMMENT ON` em tabela e coluna.
- **Migration:** manual, com ensaio (`begin … rollback`, NOTICE `Ensaio <ts> ok`) e rollback
  guardado conforme `docs/biblioteca/rollback-de-migration.md`. Tem md5 do `prosrc` antes de
  trocar ou apagar função. É aplicada e registrada em `public.migracoes_aplicadas` na mesma
  transação. Nunca `supabase db push`. O timestamp não pode repetir nenhum da main.
- **Visibilidade:** nenhuma linha de edital fora de `FC_EDITAIS_VISIVEIS()` chega à tela nem ao
  download.
- **Cache:** nada em localStorage, IndexedDB, Cache API ou service worker. Só no estado em
  memória.
- **Larguras:** só no estado em memória. Recarregar volta ao padrão. Mínimo de 60 px.
- **Recálculo:** cron de hora em hora. Sincronizar no máximo 1 vez por minuto por área e
  relatório (dentro do minuto, devolve em silêncio o que está pronto). A troca de fonte
  recalcula na mesma transação.
- **Interface:** texto em português, componentes de `src/ui`, CSS com tokens, sem `!important`.

## Review Focus

1. **Recorte da coordenação.** Quem tem recorte vê só os seus editais na página, no total e
   no download. Teste: Task 1, `o recorte da coordenação vale na página, no total e no
   download`.
2. **Página pedida além da última.** Se o resultado encolheu depois do recálculo, a resposta
   volta para a última página que existe. Teste: Task 1, `página além da última volta para a
   última`.
3. **Recálculo que falha numa troca de fonte.** A troca é desfeita e nada fica gravado pela
   metade. Teste: Task 1, `troca de fonte com recálculo que falha é desfeita`.
4. **Cache depois de Sincronizar ou de trocar uma fonte.** A tela não mostra a página antiga
   guardada. Teste: Task 3, `sincronizar e trocar fonte limpam o cache do relatório`.
5. **Cron com uma área ou relatório que falha.** As outras áreas e relatórios ainda são
   recalculados. Teste: Task 1, `o cálculo de todos segue quando um falha`.

---

### Task 1: Banco — resultado pronto, leitura paginada, Sincronizar e cron

**Files:**
- Create:
  - `supabase/migrations/20261116160000_relatorios_dos_paineis_prontos.sql`
  - `supabase/ensaios/20261116160000_relatorios_dos_paineis_prontos.sql`
  - `supabase/rollback/20261116160000_relatorios_dos_paineis_prontos.sql`
- Modify: `tests/apoio/banco-dos-paineis.ts`
- Test: `tests/relatorios-prontos-dos-paineis-no-banco.test.ts` (PGlite) e
  `tests/relatorios-prontos-dos-paineis-migration.test.ts` (estático)

**Interfaces:**
- Produces (banco):
  - `public."TB_CALCULO_RELATORIO_PAINEL"`: um registro por área e relatório.
    - Colunas: `"CO_AREA" text` (FK a `TB_AREA`), `"CO_RELATORIO" varchar(40)`,
      `"DT_CALCULO" timestamptz`, `"QT_LINHA" integer`, `"DS_FONTES" jsonb`,
      `"DS_AVISOS" jsonb`, `"CO_USUARIO_CALCULO" uuid null` (nulo quando foi o cron).
    - Constraints: PK `"PK_TB_CALCULO_RELATORIO_PAINEL"` em (área, relatório) e CK do
      relatório em (`'resumo-dos-editais'`, `'editais-por-cargo'`, `'aprovados'`).
  - `public."TB_LINHA_RELATORIO_PAINEL"`: as linhas prontas.
    - Colunas: `"CO_AREA"`, `"CO_RELATORIO"`, `"NU_POSICAO" integer`,
      `"CO_MONITORAMENTO" uuid not null`, `"DS_LINHA" jsonb`.
    - Constraints: PK `"PK_TB_LINHA_RELATORIO_PAINEL"` em (área, relatório, posição),
      FK `"FK_LINHARELPAINEL_CALCULO"` para o cálculo com `on delete cascade`, e índice
      `"IN_LINHARELPAINEL_EDITAL"` em (área, relatório, `CO_MONITORAMENTO`, `NU_POSICAO`).
  - As duas tabelas têm RLS, sem policy, com `revoke all` de `public, anon, authenticated`.
  - `private."FC_LINHAS_DO_RELATORIO_PAINEL"(p_area text, p_relatorio text) returns jsonb`:
    `{linhas, fontes, avisos}`, com cada linha tendo `edital_id`. É o SQL de cada RPC de
    20261113240000 sem `FC_EXIGIR_PAINEIS_DA_AREA` e com `v_editais` nulo, terminando em
    `FC_APLICAR_FONTES_DO_PAINEL`. Relatório desconhecido → erro `22023`.
  - `private."FC_CALCULAR_RELATORIO_PAINEL"(p_area text, p_relatorio text, p_usuario uuid,
    p_intervalo interval default null) returns boolean`:
    - toma `pg_advisory_xact_lock(hashtext('painel:' || p_area || ':' || p_relatorio))`;
    - se `p_intervalo` não for nulo e o último `DT_CALCULO` for mais recente que
      `now() - p_intervalo`, devolve `false` sem calcular;
    - senão apaga as linhas daquela área e relatório, insere as novas (posição = ordinal do
      array, `CO_MONITORAMENTO` = `(linha->>'edital_id')::uuid`), faz upsert do cálculo e
      devolve `true`.
  - `private."FC_CALCULAR_PAINEIS"() returns integer`: percorre `TB_AREA` × 3 relatórios.
    Cada um fica num bloco `begin … exception when others then raise warning …`, e a função
    devolve quantos calculou.
  - `public.ler_relatorio_do_painel(p_area text, p_relatorio text, p_pagina integer,
    p_por_pagina integer) returns json` (volatile, porque pode calcular):
    - aplica a guarda `FC_EXIGIR_PAINEIS_DA_AREA`;
    - `p_por_pagina` só aceita 25, 50, 100 ou nulo (nulo = todas as linhas, para o
      download); qualquer outro valor → `22023`;
    - sem cálculo ainda, calcula (`p_intervalo` nulo);
    - filtra por `v_editais := private."FC_EDITAIS_VISIVEIS"()` (nulo = vê tudo);
    - devolve `{schema_version: 4, area, relatorio, calculado_em, total, pagina, por_pagina,
      linhas, fontes, avisos}`. `pagina` vai até `[1, última]` e o total vem filtrado.
  - `public.sincronizar_relatorio_do_painel(p_area text, p_relatorio text) returns json`:
    aplica a guarda, chama `FC_CALCULAR_RELATORIO_PAINEL(p_area, p_relatorio, auth.uid(),
    interval '1 minute')` e devolve `{calculado_em, recalculado}`.
  - `public.salvar_fonte_da_coluna`: o mesmo corpo de 20261113220000 (guarda md5 desse
    corpo), mais `perform private."FC_CALCULAR_RELATORIO_PAINEL"(p_area, p_relatorio,
    v_usuario, null);` antes do `return`.
  - **Saem:** `public.listar_resumo_dos_editais_do_painel`,
    `public.listar_editais_por_cargo_do_painel` e `public.listar_aprovados_do_painel`
    (guardas md5: os corpos de 20261113240000).
  - **Cron:** linha em `public."TB_TAREFA_AGENDADA"` e a tarefa
    `agsus_paineis_recalcular_relatorios`, `'17 * * * *'`, com o comando
    `select private."FC_CALCULAR_PAINEIS"() where pg_try_advisory_xact_lock(hashtext('agsus_paineis_recalcular_relatorios'));`.
    A tarefa fica dentro de `if exists (select 1 from pg_extension where extname = 'pg_cron')`,
    para o PGlite.
  - **Pré-carga:** a última instrução antes do `commit` é
    `select private."FC_CALCULAR_PAINEIS"();`.
- Produces (teste): `tests/apoio/banco-dos-paineis.ts`
  - exporta `bancoComRelatoriosProntos(): Promise<Banco>`. O banco de
    `bancoDosPaineis()` recebe as três RPCs de 20261113240000 (extraídas do arquivo, mesmo
    texto, para o md5 bater) e um `private."FC_EDITAIS_VISIVEIS"()` de teste que lê
    `teste.editais` (vazio = nulo) e devolve `uuid[]`. Depois aplica a migration nova e
    troca `FC_LINHAS_DO_RELATORIO_PAINEL` por uma imitação que lê `public.linha_de_teste`;
  - `entrar()` ganha `editais?: string[]`.

- [ ] **Step 1: Escrever os testes PGlite que falham** em
  `tests/relatorios-prontos-dos-paineis-no-banco.test.ts`. Use 3 editais (A, B, C) e 120
  linhas de teste em `editais-por-cargo`, 40 por edital, na ordem A, B, C. Testes:
  - `lê a página pedida, na ordem do cálculo, com o total`:
    - pedido: página 2, 50 por página;
    - esperado: 50 linhas, a primeira na posição 51, `total` = 120, `pagina` = 2,
      `schema_version` = 4.
  - `sem tamanho de página, devolve todas as linhas`: `p_por_pagina` nulo → 120 linhas,
    `por_pagina` nulo.
  - `tamanho de página fora de 25/50/100 é recusado`: 10 → erro `22023`.
  - `o recorte da coordenação vale na página, no total e no download`: `editais: [A]` →
    `total` 40, todas as linhas com `edital_id` A, também com `p_por_pagina` nulo.
  - `página além da última volta para a última`: página 9, 50 por página → `pagina` 3, 20
    linhas.
  - `sem cálculo, a primeira leitura calcula`: não há linha em `TB_CALCULO_RELATORIO_PAINEL`
    → a leitura devolve 120 e grava o cálculo.
  - `sincronizar recalcula, mas não duas vezes no mesmo minuto`:
    - a 1ª chamada devolve `recalculado: true` e as linhas novas aparecem;
    - a 2ª chamada logo depois devolve `recalculado: false`;
    - com o `DT_CALCULO` voltado 2 minutos, devolve `true`.
  - `troca de fonte recalcula na mesma transação`: depois de `salvar_fonte_da_coluna`, o
    `DT_CALCULO` mudou e `DS_FONTES` tem a fonte nova.
  - `troca de fonte com recálculo que falha é desfeita`:
    - a imitação passa a dar erro;
    - `salvar_fonte_da_coluna` falha;
    - `TB_FONTE_COLUNA_PAINEL` e `TH_FONTE_COLUNA_PAINEL` continuam sem linha.
  - `o cálculo de todos segue quando um falha`:
    - a imitação dá erro só para `'sede'`;
    - `FC_CALCULAR_PAINEIS()` devolve 6 (3 áreas × 3 relatórios, menos os 3 da sede);
    - há cálculo para `saude-indigena` e `projetos`.
  - `a API não lê as tabelas prontas`: como `authenticated`, ler
    `public."TB_LINHA_RELATORIO_PAINEL"` dá erro `42501`.
  - `sem acesso à área, leitura e sincronizar são recusados`: nível 0 → `42501`.
  - `o rollback volta ao banco de antes`:
    - as tabelas e as funções novas somem;
    - as três RPCs antigas voltam com o md5 de 20261113240000;
    - `salvar_fonte_da_coluna` volta ao corpo de 20261113220000.

- [ ] **Step 2: Escrever os testes estáticos que falham** em
  `tests/relatorios-prontos-dos-paineis-migration.test.ts`, no modelo de
  `tests/admissoes-conciliadas-no-banco.test.ts`. Testes:
  - `as guardas usam o md5 dos corpos de antes`: o md5 de cada RPC extraída de 20261113240000
    e o de `salvar_fonte_da_coluna` extraído de 20261113220000 aparecem na migration como
    `is distinct from '<md5>'`.
  - `o rollback restaura os corpos de antes letra por letra`: os corpos no rollback são iguais
    aos extraídos dessas migrations.
  - `o rollback aborta se a migration não estiver aplicada`: o rollback contém `raise
    exception` e confere `to_regclass('public."TB_LINHA_RELATORIO_PAINEL"')`.
  - `o ensaio aplica o mesmo corpo e termina em rollback`: o corpo de
    `FC_LINHAS_DO_RELATORIO_PAINEL` no ensaio é igual ao da migration, o ensaio tem
    `Ensaio 20261116160000 ok` e termina em `rollback;`.

- [ ] **Step 3: Rodar e ver falhar**
  Run: `npx vitest run tests/relatorios-prontos-dos-paineis-no-banco.test.ts tests/relatorios-prontos-dos-paineis-migration.test.ts`
  Expected: FAIL (arquivo da migration não existe / `bancoComRelatoriosProntos` não existe)

- [ ] **Step 4: Escrever a migration, o ensaio e o rollback**
  - **Migration**, com cabeçalho POR QUE / O QUE MUDA / GUARDA / DEPENDE DE / DESFAZER / ENSAIO.
    - **Guardas:** `FC_APLICAR_FONTES_DO_PAINEL` existe; md5 das 3 RPCs e de
      `salvar_fonte_da_coluna`; `TB_LINHA_RELATORIO_PAINEL` ainda não existe.
    - **`FC_LINHAS_DO_RELATORIO_PAINEL`:** os três `with … select json_build_object(…)` de
      20261113240000 entram como ramos de um `case p_relatorio`, cada um com `v_editais` nulo.
      Copie o SQL, não reescreva.
  - **Ensaio:** o corpo inteiro, e mais:
    - confere que as tabelas não têm grant para `authenticated`;
    - confere que há 9 cálculos depois da pré-carga e `NOTICE` com o total de linhas por
      relatório;
    - fecha com `Ensaio 20261116160000 ok` e `rollback`.
  - **Rollback:** guarda (tabela existe; md5 das funções novas; e
    `salvar_fonte_da_coluna` tem o md5 do corpo novo). Depois:
    - `cron.unschedule` se existir;
    - recria as 3 RPCs com o corpo e o `COMMENT` de 20261113240000;
    - volta `salvar_fonte_da_coluna` ao corpo de 20261113220000;
    - apaga funções e tabelas novas e a linha de `TB_TAREFA_AGENDADA`.

- [ ] **Step 5: Implementar `bancoComRelatoriosProntos` e rodar até passar**
  Run: o comando do Step 3, mais `npx vitest run tests/fontes-dos-paineis-no-banco.test.ts`
  Expected: PASS em todos

- [ ] **Step 6: Commit**
  `git add` dos 3 SQL, dos 2 testes e do apoio → `git commit -m "Painéis: relatórios prontos no banco, leitura paginada e recálculo de hora em hora (migration)"`

### Task 2: Banco — conferir, aplicar e medir

**Files:**
- Create (scratchpad, não vai para o repositório):
  - `conferir-relatorios-prontos.mjs`
  - `aplicar-relatorios-prontos.mjs`

**Interfaces:**
- Consumes: a migration da Task 1; o modelo
  `<scratchpad>/aplicar-migrations-das-fontes.mjs`; o modelo
  `<scratchpad>/tempo-dos-relatorios.mjs`.

- [ ] **Step 1: Conferir antes de aplicar, numa transação que termina em rollback.** Como o
  usuário administrador, guarde as `linhas` das 3 RPCs antigas nas 3 áreas. Depois rode o
  corpo da migration e leia `ler_relatorio_do_painel(área, relatório, 1, null)`.
  Run: `node --env-file=.env.local <scratchpad>/conferir-relatorios-prontos.mjs <email>`
  Expected: `9/9 iguais` (mesmas linhas, na mesma ordem)

- [ ] **Step 2: Aplicar e registrar.** O fluxo é ensaio, aplicação e registro numa só
  transação.
  Run: `node --env-file=.env.local <scratchpad>/aplicar-relatorios-prontos.mjs`
  Expected: `Ensaio 20261116160000 ok`, `APLICADA e registrada`

- [ ] **Step 3: Medir como o usuário, só leitura.** Meça `ler_relatorio_do_painel` com página
  1 de 50 nas 9 combinações e confira `cron.job` com `agsus_paineis_recalcular_relatorios`.
  Expected: todas < 1000 ms; a tarefa existe com `'17 * * * *'`. Anote os números no ledger.

### Task 3: Front — leitura paginada, cache, Sincronizar e downloads

**Files:**
- Modify:
  - `src/lib/relatorios-dos-paineis.ts`
  - `src/lib/rpc-contrato.ts`
  - `src/modulos/paineis-de-dados/estado.ts`
- Test:
  - `tests/relatorios-dos-paineis.test.ts`
  - `tests/modulos/paineis-de-dados.test.ts` (as respostas imitadas passam a ser de
    `ler_relatorio_do_painel`)

**Interfaces:**
- Consumes: as RPCs da Task 1.
- Produces:
  - Constantes em `relatorios-dos-paineis.ts`:
    - `export const RPC_LER_RELATORIO_DO_PAINEL = "ler_relatorio_do_painel"`;
    - `export const RPC_SINCRONIZAR_RELATORIO_DO_PAINEL = "sincronizar_relatorio_do_painel"`.
  - `DefinicaoDoRelatorio.rpc` sai.
  - `export interface PaginaLida { linhas: LinhaDoRelatorio[]; total: number; pagina: number;
    porPagina: number | null; calculadoEm: string; fontes: Record<string, FonteDaColuna>;
    avisos: string[] }`.
  - `export function lerPaginaDoRelatorio(definicao: DefinicaoDoRelatorio, resposta:
    unknown): PaginaLida`, tolerante a campo ausente: `total` 0, `pagina` 1, listas vazias.
  - `export const chaveDaPagina = (area: string, relatorio: IdDoRelatorio, pagina: number,
    porPagina: number) => \`${area}|${relatorio}|${pagina}|${porPagina}\``.
  - `estado.ts`:
    - `LeituraDoRelatorio` passa a ter `pagina`, `porPagina`, `total` e `calculadoEm`;
    - novas ações `irParaPagina(pagina: number)` e `mudarPorPagina(porPagina: number)`;
    - `sincronizar()` chama a RPC de sincronizar, limpa o cache da área e do relatório e relê
      a página atual;
    - `salvarFonte` limpa o cache do relatório e da área depois de salvar;
    - `baixar` chama `ler_relatorio_do_painel` com `p_por_pagina: null` e passa `fontes` e
      `avisos` como hoje;
    - o cache é um `Map<string, PaginaLida>` interno. Uma leitura com `calculadoEm`
      diferente do guardado para a mesma área e relatório descarta as outras páginas
      guardadas.
  - `rpc-contrato.ts`: saem as 3 RPCs antigas; entram as 2 novas com os parâmetros.

- [ ] **Step 1: Testes que falham.**
  - Em `relatorios-dos-paineis.test.ts`: `lerPaginaDoRelatorio` lê total, página, data,
    fontes e avisos e tolera resposta vazia.
  - Em `paineis-de-dados.test.ts`:
    - `pede ao banco só a página visível`: a chamada tem
      `{ p_area, p_relatorio, p_pagina: 1, p_por_pagina: 50 }`, e o rodapé mostra o `total`
      da resposta;
    - `voltar a uma página já lida não chama o banco`: página 2, depois 1 → só 2 chamadas;
    - `sincronizar e trocar fonte limpam o cache do relatório`: depois de Sincronizar, voltar
      à página 1 chama o banco de novo, e o mesmo vale depois de salvar uma fonte;
    - `o download pede todas as linhas`: a chamada tem `p_por_pagina: null`, e o CSV tem as
      linhas da resposta;
    - `Sincronizado em mostra a data do cálculo`;
    - `as setas da paginação ficam travadas enquanto a página carrega`.
  - Ajuste as imitações dos testes existentes para a RPC nova.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/relatorios-dos-paineis.test.ts tests/modulos/paineis-de-dados.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implementar** a lib, o contrato e o estado com as interfaces acima.
  `paginaDaTabela` continua valendo para a barra, com `total` vindo do banco.

- [ ] **Step 4: Rodar até passar**, mais `npm run check:rpc-contract` e `npm run typecheck`.
  Expected: PASS e checagens limpas

- [ ] **Step 5: Commit**
  `git commit -m "Painéis: tela lê a página do banco, com cache na memória da aba"`

### Task 4: Tela — largura das colunas e ⓘ da origem

**Files:**
- Modify:
  - `src/lib/relatorios-dos-paineis.ts`
  - `src/modulos/paineis-de-dados/estado.ts`
  - `src/modulos/paineis-de-dados/paineis-de-dados.tsx`
- Create: `src/modulos/paineis-de-dados/paineis-de-dados.css` (importado pela tela)
- Test: `tests/relatorios-dos-paineis.test.ts`, `tests/modulos/paineis-de-dados.test.ts`

**Interfaces:**
- Produces, em `relatorios-dos-paineis.ts`:
  - `export const LARGURA_MINIMA_DA_COLUNA = 60`;
  - `export function larguraArrastada(inicial: number, deslocamento: number): number`, que
    devolve `Math.max(60, Math.round(inicial + deslocamento))`;
  - `export const ORIGEM_DOS_DADOS: Readonly<Record<IdDoRelatorio, string>>` com o texto
    exato:
    - `resumo-dos-editais`: "Uma linha por edital da área, sem os de treinamento. Vagas
      imediatas: cadastro do edital. Datas: cronograma do edital (início da 1ª etapa e fim
      da última) ou, sem cronograma, as datas do cadastro."
    - `editais-por-cargo`: "Uma linha por vaga. Vaga, cargo e inscritos: Seleção (planilha
      da Auditoria, aba Resultado). Aprovados: lista de aprovados vigente, casada pelo
      código da vaga. Vagas imediatas: o número no título da vaga. Vagas que só estão na
      lista e editais sem Seleção também aparecem."
    - `aprovados`: "Uma linha por aprovado da lista de aprovados vigente de cada edital.
      Status: situação registrada no sistema. Data de admissão: dia em que o aprovado
      virou Contratado no sistema."
  - `export function linhasDaOrigem(definicao: DefinicaoDoRelatorio, fontes:
    Readonly<Record<string, FonteDaColuna>>): string[]`. Devolve o texto fixo e, para cada
    coluna com `padrao === false` na ordem das colunas, `Fonte trocada nesta área:
    <rótulo da coluna> → <fonte.rotulo>`.
- Produces, em `estado.ts`: `larguras: Record<IdDoRelatorio, Record<string, number>>` no
  estado e a ação `mudarLargura(campo: string, largura: number)`. Sem persistência.
- Na tela:
  - **Alça:** dentro do `cabecalho` de cada coluna, um
    `<span role="separator" aria-orientation="vertical" tabIndex={0}
    aria-label="Largura — <rótulo>" data-alca-da-coluna>`.
    - Com o ponteiro: `pointerdown`, `pointermove` e `pointerup` chamam `larguraArrastada`
      sobre a largura medida do `th`.
    - Com o teclado: as setas ←/→ mudam a largura em ±16 px.
    - A coluna recebe `largura: \`${px}px\`` quando houver largura no estado.
  - **ⓘ:** um botão ⓘ ao lado do título do relatório (`aria-label="De onde vêm os dados"`)
    com dica por hover e foco, mostrando `linhasDaOrigem`. Use o componente de dica de
    `src/ui` se houver; senão use `title` mais `aria-describedby` num texto oculto.

- [ ] **Step 1: Testes que falham.**
  - `larguraArrastada(120, -100)` = 60 e `larguraArrastada(120, 35.6)` = 156.
  - `linhasDaOrigem` sem troca devolve só o texto fixo. Com `vagas_imediatas` fora do
    padrão, a 2ª linha é `Fonte trocada nesta área: Vagas imediatas (título da vaga) →
    Quadro de vagas do edital › Vagas imediatas (soma do quadro)`.
  - Na tela:
    - `arrastar a borda muda a largura da coluna e trocar de página mantém`;
    - `seta para a esquerda na alça estreita a coluna`;
    - `uma tela nova volta às larguras originais`: um segundo `montar()` sem a largura;
    - `o ⓘ mostra a origem e a fonte trocada`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/relatorios-dos-paineis.test.ts tests/modulos/paineis-de-dados.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implementar.** No CSS: o `th` com `position: relative`; a alça absoluta à
  direita, com 6 px de largura e `cursor: col-resize`; e foco visível com token.

- [ ] **Step 4: Rodar até passar**, mais `npm run lint` e `npm run format:check`.

- [ ] **Step 5: Commit**
  `git commit -m "Painéis: largura das colunas arrastável e origem dos dados no ⓘ"`

### Task 5: Documentação, Aya e verificação completa

**Files:**
- Modify:
  - `docs/biblioteca/modulo-paineis-de-dados.md`
  - `docs/aya/regras-dos-paineis.md`
  - `src/modules/aya-conhecimento-gerado.js` (gerado)

- [ ] **Step 1: Documentação.**
  - **Nota do módulo:** resultado pronto (tabelas, recálculo de hora em hora, Sincronizar
    1/min, troca de fonte), leitura paginada, cache só em memória e por quê, alça de
    largura e ⓘ. Os testes novos, e as RPCs antigas que saíram.
  - **Aya:**
    - troque "Atualizar" por "Sincronizar" e explique que os dados são recalculados de hora
      em hora;
    - aponte os `**fonte:**` para a migration nova;
    - novo verbete "Largura das colunas" (perguntas: largura da coluna | aumentar coluna |
      diminuir coluna | arrastar coluna).

- [ ] **Step 2:**
  Run: `npm run aya:conhecimento`
  Expected: `verbetes compilados`, sem termo repetido

- [ ] **Step 3: Verificação completa**
  Run: `npm run typecheck && npm run format:check && npm run lint && npm run check:architecture && npm run check:migrations && npm test`
  (Redirecione para um log.)
  Expected: só a falha de `tests/lib/avaliacao-documental-espelho-visual.test.ts`, que já
  existe na main.

- [ ] **Step 4: Commit e push** em `funcionalidade/aba-de-paineis`. O PR #829 se atualiza.
  `git commit -m "Painéis: documentação e Aya do carregamento rápido"` → `git push`
