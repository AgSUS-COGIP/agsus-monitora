# Fontes das colunas dos Painéis — plano de implementação

> **Feito** no PR #829 (16/11/2026). As caixas abaixo não foram marcadas durante a execução: ficam como o roteiro que se seguiu, e o que vale é o código do PR.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar, por área e pela tela, a fonte de cada coluna editável dos três relatórios dos
Painéis, escolhendo entre visões conferidas do schema `painel`.

**Architecture:** as três RPCs dos relatórios continuam montando as linhas do padrão e, no fim,
passam o `jsonb` das linhas por `private."FC_APLICAR_FONTES_DO_PAINEL"`, que lê a configuração da
área, revalida cada fonte no catálogo do PostgreSQL e troca os valores com SQL montado só por
`format('%I')`. Duas RPCs novas listam e salvam as fontes; a tela ganha a gaveta "Fontes dos
dados". Três migrations: núcleo (testável em PGlite), catálogo inicial de visões, troca das RPCs
dos relatórios (guarda por md5).

**Tech Stack:** PostgreSQL/Supabase (plpgsql, PGlite nos testes), React 19 + TypeScript, Vitest.

**Spec:** `docs/_arquivo/planos/2026-11-13-fontes-das-colunas-dos-paineis-design.md`

## Global Constraints

- RPC `SECURITY DEFINER`, `set search_path to ''`, `revoke all … from public, anon` +
  `grant execute … to authenticated`; RPC nova → `src/lib/rpc-contrato.ts`.
- Nomes MAD (`TB_`/`TH_`/`VW_`/`FC_`, colunas com prefixo tipológico, `COMMENT ON` em tudo);
  rodar a skill `mad-ddl-review` no DDL antes de aplicar.
- Migrations novas (as de 20261113200000 e 20261113210000 já estão aplicadas: não editar), cada
  uma com `supabase/rollback/` e `supabase/ensaios/` de mesmo nome; aplicar com ensaio antes e
  registro em `public.migracoes_aplicadas` (caminho + sha256 sem `\r`) na mesma transação.
- Nada de SQL vindo do navegador; nomes de visão e coluna entram no SQL só depois de achados no
  catálogo (`pg_class`/`pg_attribute` do schema `painel`).
- Schema `painel` sem grant para `public`, `anon`, `authenticated`.
- Códigos de relatório = ids do front (`resumo-dos-editais`, `editais-por-cargo`, `aprovados`);
  códigos de coluna = `campo` de `src/lib/relatorios-dos-paineis.ts`.
- Front: `src/modulos/paineis-de-dados/`, `src/ui/` com tokens, lógica pura em `src/lib/` com
  teste `.ts`, sem dependência nova. Commit só quando o usuário pedir.

## Review Focus

1. Nome de visão/coluna malicioso na configuração (aspas, `;`, schema fora de `painel`) — nunca
   executa; a coluna fica vazia com aviso. Teste: Task 1 (`recusa nome fora do catálogo`).
2. Fonte com chave repetida — nenhuma linha duplicada; células dessas chaves vazias + aviso.
   Teste: Task 1 (`chave repetida esvazia a célula e avisa`).
3. Escolha de uma área vazando para outra — só a área da configuração muda. Teste: Task 1
   (`a escolha de uma área não muda a outra`).
4. Visão apagada depois de escolhida — relatório não quebra; coluna vazia + aviso. Teste: Task 1
   (`fonte que sumiu`).
5. Padrão intacto — sem configuração, as três RPCs devolvem as mesmas linhas de hoje (mais as
   chaves). Teste: Task 3 (verificação só de leitura contra o banco).

---

### Task 1: Núcleo no banco (schema, configuração, catálogo, aplicação, RPCs de fontes)

**Files:**

- Create: `supabase/migrations/20261113220000_fontes_das_colunas_dos_paineis.sql` (+ `rollback/`, `ensaios/` de mesmo nome)
- Create: `tests/apoio/banco-dos-paineis.ts`, `tests/fontes-dos-paineis-no-banco.test.ts`

**Interfaces:**

- Consumes: `private."FC_EXIGIR_PAINEIS_DA_AREA"(text)` e `private.pode_recurso(text, integer)` (já no banco).
- Produces:
  - schema `painel`; `public."TB_FONTE_COLUNA_PAINEL"` (PK `CO_AREA`,`CO_RELATORIO`,`CO_COLUNA`; `NO_VISAO`, `NO_COLUNA_VISAO`, `DS_MOTIVO` 3–500, `CO_USUARIO_ATUALIZACAO uuid` = `auth.uid()`, `DT_ATUALIZACAO`); `public."TH_FONTE_COLUNA_PAINEL"` (antes/depois, motivo, usuário, data). RLS ligada, sem policy.
  - `private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"() returns table(co_relatorio text, tp_grao text, co_coluna text, no_rotulo text, tp_coluna text, ds_padrao text)` — as 11 colunas da seção 2 do spec; `tp_grao` ∈ `EDITAL|VAGA|APROVADO`; `tp_coluna` ∈ `inteiro|decimal|data|texto`; `ds_padrao` ex.: "Padrão: título da vaga".
  - `private."FC_OPCOES_DE_FONTE_DO_PAINEL"(p_relatorio text, p_coluna text) returns table(no_visao text, ds_rotulo_visao text, no_coluna text, ds_rotulo_coluna text)` — visões de `painel` com nome `VW_<GRAO>_%`, `COMMENT` na visão e na coluna, com as colunas-chave do grão, coluna de tipo compatível (inteiro ← int2/4/8; decimal ← int2/4/8, numeric, float4/8; data ← date, timestamp, timestamptz; texto ← text, varchar, bpchar), sem as chaves.
  - `private."FC_APLICAR_FONTES_DO_PAINEL"(p_area text, p_relatorio text, p_linhas jsonb) returns jsonb` → `{ linhas, fontes, avisos }`. Chave da linha: `edital_id` (EDITAL), `edital_id`+`codigo_vaga` (VAGA), `candidato_id` (APROVADO) contra `CO_MONITORAMENTO`, `CO_VAGA`, `CO_CANDIDATO_APROVADO`. `fontes`: `{ <coluna>: { padrao: bool, visao, coluna, rotulo } }` para toda coluna editável. Data sai `YYYY-MM-DD` (timestamptz na hora de Brasília).
  - `public.listar_fontes_do_painel(p_area text, p_relatorio text) returns jsonb` → `{ pode_editar, colunas: [{ coluna, rotulo, tipo, padrao, escolha|null, opcoes: [{ visao, rotulo, colunas: [{ coluna, rotulo }] }] }], historico: [≤20 { em, nome, coluna, antes, depois, motivo }] }`.
  - `public.salvar_fonte_da_coluna(p_area text, p_relatorio text, p_coluna text, p_visao text, p_coluna_visao text, p_motivo text) returns jsonb` (o mesmo de `listar_fontes_do_painel`). `p_visao` nulo = padrão. Erros: 42501 sem Administrador (nível 3) em `paineis_dados` ou sem a área; 22023 relatório/coluna desconhecidos, fonte fora das opções, motivo fora de 3–500, nada mudou.

- [ ] **Step 1: Banco de teste.** `tests/apoio/banco-dos-paineis.ts` sobe PGlite com: papéis `anon`/`authenticated`/`service_role`; schemas `private`, `auth`; `auth.uid()` lendo `teste.uid`; `public."TB_AREA"`; `public."TB_PERFIL_USUARIO"(user_id uuid, nome text)`; `private.pode_recurso(text, integer)` lendo `teste.nivel` (0–3); `private."FC_PODE_AREA"(text)` lendo `teste.areas`; `private."FC_RECURSOS_MODULO"()` com `paineis_dados`; e `private."FC_EXIGIR_PAINEIS_DA_AREA"` recortado do arquivo de `20261113210000`. Exporta `bancoDosPaineis(): Promise<Banco>` com a migration da Task 1 já rodada, `entrar(banco, { uid, nivel, areas })` e `erroDe(promessa)`.
- [ ] **Step 2: Testes que falham** em `tests/fontes-dos-paineis-no-banco.test.ts` (o teste cria as próprias visões de exemplo em `painel`):
  - `lista só visões do grão, com comentário e tipo compatível` (uma `VW_VAGA_X` com coluna int comentada aparece em `editais-por-cargo/vagas_imediatas`; sem comentário, de outro grão ou text não aparece);
  - `sem configuração, aplicar devolve as linhas iguais e fontes padrão`;
  - `troca só a coluna escolhida e só na área escolhida` / `a escolha de uma área não muda a outra`;
  - `chave repetida esvazia a célula e avisa` (2 linhas da mesma chave → `null` + aviso; número de linhas igual);
  - `recusa nome fora do catálogo` (linha forjada em `TB_FONTE_COLUNA_PAINEL` com `NO_VISAO = 'VW_VAGA_X"; drop table x; --'` e com visão de `public` → coluna vazia + aviso, nada executado);
  - `fonte que sumiu` (`drop view` depois de salvar → vazio + aviso);
  - `data timestamptz sai na data de Brasília`;
  - `salvar exige Administrador e a área; motivo 3–500; grava histórico com nome; p_visao nulo volta ao padrão`;
  - `rollback devolve o banco sem nada do núcleo`.
- [ ] **Step 3:** `npx vitest run tests/fontes-dos-paineis-no-banco.test.ts` → FAIL (migration não existe).
- [ ] **Step 4: Migration** com guarda (exige `paineis_dados` em `FC_RECURSOS_MODULO` e `FC_EXIGIR_PAINEIS_DA_AREA`), DDL, funções e grants acima; `revoke all on schema painel from public, anon, authenticated`. `FC_APLICAR_FONTES_DO_PAINEL`: para cada coluna configurada da área, a escolha só vale se `(visao, coluna)` estiver em `FC_OPCOES_DE_FONTE_DO_PAINEL`; a fonte entra como subconsulta agrupada pela chave (`count(*)` e o valor), juntada às linhas por `jsonb_array_elements … with ordinality`, preservando a ordem.
- [ ] **Step 5:** rollback (apaga RPCs, funções, tabelas e schema) e ensaio (aplica, confere `has_schema_privilege('authenticated','painel','USAGE') = false`, as 11 colunas editáveis, NOTICE `Ensaio 20261113220000 ok`, `rollback`).
- [ ] **Step 6:** testes → PASS; rodar `mad-ddl-review` no DDL e ajustar nomes.

### Task 2: Catálogo inicial de visões

**Files:**

- Create: `supabase/migrations/20261113230000_catalogo_inicial_de_fontes_dos_paineis.sql` (+ `rollback/`, `ensaios/`)

**Interfaces:**

- Consumes: schema `painel` (Task 1).
- Produces (cada uma com `COMMENT ON VIEW` e `COMMENT ON COLUMN` nas colunas de valor, chave única):
  `VW_EDITAL_QUADRO_DE_VAGAS` (soma `TB_QUADRO_VAGA_EDITAL.QT_VAGA_IMEDIATA` ativos), `VW_EDITAL_VAGAS_DA_CONVOCACAO` (soma `TB_VAGA_IMEDIATA`), `VW_EDITAL_CADASTRO` (`data_inicio`, `data_fim`, `vagas_total`), `VW_VAGA_CONVOCACAO` (`TB_VAGA_IMEDIATA` por `CO_EDITAL::uuid`/`CO_VAGA`), `VW_VAGA_TRIAGEM` (último `TB_PRE_CLASSIF_VAGA` por vaga: vagas e inscritos), `VW_VAGA_INSCRICOES` (último `TH_INSCRICAO_VAGA_EDITAL.QT_INSCRITO` por vaga), `VW_APROVADO_CONTRATACAO` (`TB_CONTRATACAO_APROVADO."TP_SITUACAO"`, rótulo "Situação calculada pela contratação"), `VW_APROVADO_ANTES_DA_DECISAO_JUDICIAL` (`nota_original`, `classificacao_original`).

- [ ] **Step 1:** escrever a migration (guarda: schema `painel` existe), rollback (`drop view` de cada uma, depois de apagar configurações que apontam para elas) e ensaio (cria e confere, por visão, `count(*) = count(distinct chave)` e que `FC_OPCOES_DE_FONTE_DO_PAINEL` lista as colunas esperadas; NOTICE `Ensaio 20261113230000 ok`).
- [ ] **Step 2:** `mad-ddl-review` no DDL.

### Task 3: As três RPCs dos relatórios passam pelas fontes

**Files:**

- Create: `supabase/migrations/20261113240000_relatorios_dos_paineis_com_fontes.sql` (+ `rollback/`, `ensaios/`)

**Interfaces:**

- Consumes: `FC_APLICAR_FONTES_DO_PAINEL` (Task 1).
- Produces: as mesmas assinaturas de `listar_resumo_dos_editais_do_painel`, `listar_editais_por_cargo_do_painel`, `listar_aprovados_do_painel`, agora devolvendo `jsonb`: `{ schema_version: 3, area, gerado_em, linhas, fontes, avisos }`; as linhas do relatório 2 ganham `edital_id`; as do 3, `candidato_id`.

- [ ] **Step 1:** no banco (só leitura), tirar o md5 do `prosrc` das três funções; a migration recusa se não bater. O corpo novo é o de `20261113210000` com `json`→`jsonb`, as chaves novas e o retorno passando por `FC_APLICAR_FONTES_DO_PAINEL(p_area, '<id>', linhas)`. Rollback = os corpos de `20261113210000` (iguais ao banco, conferido pelo md5).
- [ ] **Step 2:** ensaio (aplica; sem configuração, cada RPC chamada como Administrador simulado devolve `fontes` todas padrão; NOTICE `Ensaio 20261113240000 ok`).
- [ ] **Step 3: Verificação só de leitura** (script no scratchpad, como o de 13/11): o SQL novo, extraído do arquivo, devolve por área as mesmas linhas de hoje (comparar sem as chaves novas) e a soma dos aprovados por vaga continua = linhas de Aprovados.

### Task 4: Lógica pura e permissão no front

**Files:**

- Create: `src/lib/fontes-dos-paineis.ts`, `tests/fontes-dos-paineis.test.ts`
- Modify: `src/lib/relatorios-dos-paineis.ts` (aba "Fontes" no XLSX), `src/lib/access-roles.ts`, `src/lib/rpc-contrato.ts`, `tests/relatorios-dos-paineis.test.ts`

**Interfaces:**

- Produces:
  - `interface FonteDaColuna { padrao: boolean; visao: string | null; coluna: string | null; rotulo: string }`
  - `lerFontesDoRelatorio(resposta: unknown): { fontes: Readonly<Record<string, FonteDaColuna>>; avisos: readonly string[] }`
  - `interface OpcaoDeFonte { visao: string; rotulo: string; colunas: readonly { coluna: string; rotulo: string }[] }`
  - `interface ColunaComFonte { coluna: string; rotulo: string; tipo: string; padrao: string; escolha: { visao: string; coluna: string } | null; opcoes: readonly OpcaoDeFonte[] }`
  - `interface FontesDoPainel { podeEditar: boolean; colunas: readonly ColunaComFonte[]; historico: readonly { em: string; nome: string; coluna: string; antes: string; depois: string; motivo: string }[] }`
  - `lerFontesDoPainel(resposta: unknown): FontesDoPainel | null` (tolerante; `null` se não for objeto)
  - `canManagePaineisDeDados(profile: unknown): boolean` em `access-roles.ts` = `hasResource(profile, "paineis_dados", 3)` com matriz; sem matriz, `false`.
  - `planilhaDoRelatorio`/`xlsxDoRelatorio` ganham parâmetro opcional `fontes?: Record<string, FonteDaColuna>`; com ele, o XLSX tem a 2ª aba `Fontes` com `[Coluna, Fonte]` por coluna do relatório (fixas = "Padrão").
  - `rpc-contrato.ts`: `listar_fontes_do_painel` (`p_area`, `p_relatorio`) e `salvar_fonte_da_coluna` (6 argumentos), via constantes `RPC_*`.

- [ ] **Step 1:** testes que falham (leitura tolerante das duas respostas; `canManagePaineisDeDados` com admin/editor/leitor/sem matriz; XLSX com e sem `fontes` — com: `xl/worksheets/sheet2.xml` existe e `workbook.xml` tem `name="Fontes"`).
- [ ] **Step 2:** implementar; `npx vitest run tests/fontes-dos-paineis.test.ts tests/relatorios-dos-paineis.test.ts` → PASS; `npm run check:rpc-contract`.

### Task 5: Gaveta "Fontes dos dados" e marcador nos cabeçalhos

**Files:**

- Create: `src/modulos/paineis-de-dados/fontes-dos-dados.tsx`
- Modify: `src/modulos/paineis-de-dados/estado.ts`, `src/modulos/paineis-de-dados/paineis-de-dados.tsx`, `tests/modulos/paineis-de-dados.test.ts`

**Interfaces:**

- Consumes: Task 4.
- Produces (estado): `LeituraDoRelatorio` ganha `fontes` e `avisos`; `EstadoDosPaineis` ganha `gaveta: { aberta: boolean; situacao: "vazio" | "carregando" | "pronto" | "erro"; dados: FontesDoPainel | null; erro: string; salvando: boolean }`; ações `abrirFontes(): Promise<void>`, `fecharFontes(): void`, `salvarFonte(p: { coluna: string; visao: string | null; colunaDaVisao: string | null; motivo: string }): Promise<boolean>` (sucesso relê a gaveta e chama `sincronizar()`). `ClienteDosPaineis.rpc` aceita as duas RPCs novas.

- [ ] **Step 1:** testes que falham (`tests/modulos/paineis-de-dados.test.ts`):
  - `o botão Fontes dos dados abre a gaveta do relatório e da área` (chama `listar_fontes_do_painel` com `{ p_area, p_relatorio }`);
  - `quem não é Administrador vê a gaveta sem os controles` (`pode_editar: false` → sem select nem Salvar);
  - `salvar manda a fonte e o motivo e relê o relatório`; `Voltar ao padrão manda p_visao nulo`;
  - `coluna fora do padrão tem marcador no cabeçalho com a fonte na dica`;
  - `avisos da resposta aparecem acima da tabela`;
  - `o XLSX baixado tem a aba Fontes`.
- [ ] **Step 2:** implementar a gaveta com `Modal`/`TopoDaGaveta` de `src/ui/` (desenho da seção 6 do spec: por coluna, Origem e Coluna; Motivo; Salvar; Voltar ao padrão; histórico); botão na barra do relatório depois de "Baixar XLSX"; marcador via `ColunaDaTabela.cabecalho` + `dica`; aviso "fonte diferente do padrão: os totais entre relatórios podem não fechar" na gaveta quando houver escolha.
- [ ] **Step 3:** `npx vitest run tests/modulos/paineis-de-dados.test.ts` → PASS; `npm run typecheck`.

### Task 6: Documentação, retrato e verificação completa

**Files:**

- Modify: `docs/aya/regras-dos-paineis.md` (verbete "Fontes dos dados"), `docs/biblioteca/modulo-paineis-de-dados.md`, `scripts/gerar-esquema-atual.mjs` (`SCHEMAS` += `"painel"`)

- [ ] **Step 1:** textos; `npm run aya:conhecimento`; `npm run check:docs`.
- [ ] **Step 2:** `npm run typecheck && npm run format:check && npm run lint && npm run check:architecture && npm run check:migrations && npm test` → só a falha já existente do PDF do espelho.

### Task 7: Aplicar no banco do .env.local (autorizado pelo usuário em 13/11/2026)

- [ ] **Step 1:** script no scratchpad (modelo do de 13/11): para 20261113220000, 20261113230000, 20261113240000, em ordem — pula se registrada; roda o ensaio e exige o NOTICE `Ensaio <ts> ok`; aplica o corpo e registra na mesma transação.
- [ ] **Step 2:** conferir como o usuário (transação só de leitura, `set local role authenticated`, `request.jwt.claims` com o `user_id` dele): as três RPCs devolvem as mesmas contagens de antes e `fontes` todas padrão; `listar_fontes_do_painel` lista as visões do catálogo inicial; `has_schema_privilege('authenticated','painel','USAGE')` é falso.
- [ ] **Step 3:** avisar que `npm run db:esquema` fica pendente até haver `pg_dump`.
