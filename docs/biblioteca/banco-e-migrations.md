---
tipo: regra
area: banco
atualizado: 2026-11-17
---

# Banco e migrations

O banco é Supabase (PostgreSQL) com RLS ligada em todas as tabelas; o navegador não lê tabela, só
chama RPCs. Toda mudança de schema é uma migration **aplicada à mão** (SQL Editor do Supabase ou
`psql`), por quem opera o banco, depois de ensaiada, e **registrada** em `public.migracoes_aplicadas`
pelo caminho e pelo sha256 do arquivo. Esta nota é o processo completo; o modelo de dados, as
convenções e a história de cada assunto estão em [docs/banco-de-dados.md](../banco-de-dados.md)
(leia a seção do assunto).

## A fonte do código do banco é o banco

- `supabase/esquema-atual.sql` é o retrato do schema de produção, **só leitura, NÃO aplicar**: é
  onde se lê e pesquisa o código vigente de função, tabela, policy e grant (e as tarefas do
  pg_cron, no fim). Regerado por `npm run db:esquema` (pg_dump; precisa de `SUPABASE_DB_URL`)
  depois de cada migration aplicada e commitado junto: o diff mostra o que a migration mudou. Pode
  estar atrasado; para a guarda md5, confira no banco.
- As migrations aplicadas saíram do repositório (~300 em 10/11/2026, #712; mais 41 em 17/11/2026,
  conferidas pelo hash), com rollbacks, ensaios e testes de texto. **O banco não mudou** e o
  registro continua com as linhas delas (o `db:estado` as lista como órfãs, o que é esperado).
  `supabase/migrations/` guarda só as que ainda importam.
- O histórico está no Git (`git log --all -- supabase/migrations/<arquivo>`); nome de migration
  citado em doc, nota ou comentário é esse histórico (e a linha do registro), não um arquivo daqui.
- Os testes que precisavam do "antes" guardam só o trecho que usam, em fixture
  (`tests/fixtures/banco-antes-do-catalogo-dos-robos.sql`, `tests/fixtures/sql-de-dados/`). A
  migration que monta o banco de um teste de comportamento (PGlite) fica, sem mudança, em
  `tests/fixtures/sql-do-banco/<mesmo nome>.sql`.
- Não recriar `migrations-historicas/`, `descartadas/` nem `correcoes/`
  (`tests/repositorio-e-banco.test.js` (bloco `migrations-pasta-limpa`) impede). Correção de dados de uso único vai junto da
  migration ou do script que a pede, com ensaio.

## Migration nova, passo a passo

1. `supabase/migrations/AAAAMMDDHHMMSS_descricao_em_portugues.sql`: 14 dígitos, timestamp crescente
   e **único** (`npm run check:migrations`; confira antes do PR), descrição no infinitivo,
   `begin;`/`commit;`, idempotente, cabeçalho com motivo, dependentes e rollback; nomes MAD e
   `search_path = ''` em `SECURITY DEFINER`.
2. Rollback em `supabase/rollback/<mesmo nome>.sql` (seção abaixo).
3. Ensaio em `supabase/ensaios/<mesmo nome>.sql`: o SQL dentro de `begin; … rollback;`, com as
   conferências que reprovam o resultado; roda no banco antes de aplicar.
   `tests/repositorio-e-banco.test.js` (bloco `migrations-pasta-limpa`) cobra rollback e ensaio.
4. Criou/alterou RPC → `src/lib/rpc-contrato.ts` ([[rpc-e-contrato]]).
5. **Aplicar** (SQL Editor ou `psql`), por quem opera o banco, depois do merge/aprovação.
6. **Registrar**: `npm run db:estado -- --registrar=migrations/<arquivo>.sql` (marca, não executa)
   e `npm run db:estado` (o que falta ou divergiu). Marcar sem ter aplicado é a única forma de o
   registro mentir. Sem `psql` nem `SUPABASE_DB_URL` (a máquina de desenvolvimento não tem),
   registre à mão no SQL Editor (hash de `hashDoConteudo` em
   `scripts/estado-das-migrations-nucleo.mjs`: sha256 sem `\r`).
7. `npm run db:esquema` e commit do retrato.

**Nunca editar migration já aplicada**: o hash deixa de bater (estado "divergente"); mudou o
efeito → migration nova.

**Trocar uma função:** copie o corpo vigente com `pg_get_functiondef` no SQL Editor
(`select pg_get_functiondef('private."FC_X"(text)'::regprocedure);`) e guarde a migration pelo md5
do `prosrc`, para não sobrescrever uma mudança que você não viu (modelo:
`tests/fixtures/sql-do-banco/20261109180000_catalogo_dos_robos_e_chave_unica.sql`).

### Por que nunca `supabase db push`

Nem `supabase migration up`/`db reset` contra o banco do projeto:

- o registro do projeto é `public.migracoes_aplicadas` (caminho + sha256 sem `\r`), não
  `supabase_migrations.schema_migrations`; a CLI não conhece o que já foi aplicado e tentaria rodar
  tudo de novo;
- as migrations aplicadas saíram do repositório: a CLI veria um banco que não bate com a pasta;
- várias mudanças dependem de dados e de ordem que só o ensaio confere, e a escrita no banco é
  decisão da equipe, não da ferramenta.

## Rollback

- **Transação e guardas.** Fica em `begin; … commit;`. Antes de mexer em qualquer coisa, aborta com
  `raise exception` se a migration não estiver aplicada (o objeto que ela cria não existe) ou se
  houver dado que o estado antigo não aceita (ex.: linha que a CHECK antiga recusaria). Um rollback
  que falha no meio não pode deixar o banco pela metade.
- **Volta ao corpo de antes, letra por letra.** Função trocada volta com o corpo e o `COMMENT`
  vigentes antes dela, copiados do banco (`pg_get_functiondef`, `obj_description`), não reescritos
  de memória nem tirados de migration antiga. O mesmo vale para constraint e comentário de coluna.
  Depois remove o que a migration criou: tarefas do pg_cron (`cron.unschedule`), funções e tabelas,
  na ordem inversa das dependências.
- **Dado não se desfaz.** Linhas gravadas, histórico (`TH_*`) e estados já corrigidos (ex.: tarefa
  que o alinhador desligou) ficam como estão. O comentário de topo diz o que fica e por quê.
- **Teste.** O rollback restaura exatamente o banco de antes: as mesmas funções, constraints,
  comentários e tabelas. Quando a migration troca função, o modelo é o que
  `tests/editais-cargas-e-paineis.test.ts` (bloco `catalogo-dos-robos-no-banco`) fazia enquanto ela estava pendente (PGlite: hoje ×
  migrada × migrada + rollback com as mesmas respostas; o "hoje" numa fixture com os corpos
  copiados do banco; no Git, antes de 17/11/2026). No mínimo, um teste estático confere que os
  blocos restaurados são idênticos aos de antes. Aplicada a migration, os testes do rollback e do
  ensaio saem com ela.

**Aplicar um rollback em produção:**

1. Rodar o arquivo inteiro no SQL Editor. Na pergunta sobre RLS, escolha rodar sem acrescentar
   nada: a opção "enable RLS" põe um `alter table` no fim do script, depois do
   `commit`/`rollback` (no ensaio, isso dá erro numa tabela temporária que já sumiu).
2. Tirar o registro, para `db:estado` voltar a mostrá-la como pendente:
   `delete from public.migracoes_aplicadas where caminho = 'migrations/<arquivo>.sql';`
3. Se o front já dependia da migration (RPC nova), voltar o front antes, ou junto.

## Nomes: padrão MAD

Os nomes do banco seguem o **Padrão Institucional de Nomenclatura da AgSUS** (MAD, PDTIC
2026–2027). O PDF fica fora do repositório (saiu em 25/09/2026; está no histórico do git). **Use a
skill `mad-ddl-review`** para revisar o DDL antes de virar migration.

- Prefixo tipológico no nome da tabela, em **MAIÚSCULAS**, sempre entre **aspas duplas** no SQL e
  com a grafia exata no PostgREST/supabase-js (`.from('TB_CONFIGURACAO')`).
- Tipos de tabela (item 6 do padrão):

  | Prefixo | Tipo                           | Exemplo                        |
  | ------- | ------------------------------ | ------------------------------ |
  | `TB_`   | tabela de sistema              | `TB_EDITAL_ANALISE`            |
  | `TA_`   | tabela auxiliar                | `TA_DASHBOARD_ANALISE`         |
  | `TH_`   | tabela de histórico            | `TH_CONFIGURACAO`              |
  | `TL_`   | tabela de log de operações     | `TL_SYNC_ANALISE`              |
  | `TM_`   | tabela temporária              | `TM_ANALISE_CURRICULAR`        |
  | `TD_`   | tabela dimensão (DM/DW)        | `TD_UNIDADE`                   |
  | `RL_`   | tabela de relacionamento (N:N) | `RL_PERFIL_USUARIO_PAINEL_EXT` |

- Colunas com prefixo tipológico (no banco hoje: `ST_TREINAMENTO`, `DS_RETRATO`…).
- `COMMENT ON` em tudo (tabela, coluna, função).
- Como está no banco hoje: funções internas no schema `private` com `FC_`
  (`private."FC_DISPARAR_ROBO"`); as RPCs públicas que o front chama em português minúsculo
  (`obter_inicio_da_sessao`).
- As tabelas antigas (`configuracoes`, `analises_curriculares`, `dim_unidades`…) foram renomeadas
  em 18/09/2026. O mapa nome antigo → novo e os pontos de código alterados estão em
  [padronizacao_nomenclatura_mapa](../_arquivo/padronizacao_nomenclatura_mapa.md) e
  [padronizacao_nomenclatura_ajustes_frontend](../_arquivo/padronizacao_nomenclatura_ajustes_frontend.md)
  (registro aplicado; útil para ler código ou dado antigo).

## Onde fica cada coisa

| Pasta                  | O que é                                                         | Aplica?                      |
| ---------------------- | --------------------------------------------------------------- | ---------------------------- |
| `supabase/migrations/` | schema, em ordem de timestamp                                   | sim, uma a uma, e registra   |
| `supabase/rollback/`   | como desfazer cada migration (mesmo nome)                       | só para desfazer             |
| `supabase/ensaios/`    | ensaio de cada migration/correção, sempre termina em `rollback` | antes de aplicar (não grava) |
| `supabase/tests/`      | testes SQL de RPCs específicas                                  | não grava                    |

`supabase/.temp/` é estado local da CLI; ignore.

## Regras do banco

- O app só fala por **RPC** `SECURITY DEFINER` com `search_path` fixado. RLS ligada por padrão; não
  desligar para "resolver" permissão.
- Banco só valida a gravação de uma linha e guarda; cálculo em lote é do Python
  ([[python-e-jobs]]). O cálculo dos itens da ficha tem paridade tela × banco × Python pelos casos
  de `tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json`.
- Exclusão lógica; a exceção (edital de treinamento) está em `docs/banco-de-dados.md`, seção 16.
- Nunca aplicar o acesso automático @agenciasus nem o bridge da IA local da Aya (decisões de
  nunca aplicar).
- Ordem com o front: migration aplicada **antes** do merge quando o front novo depende dela, e
  **depois** da publicação quando remove algo que o front atual ainda usa ([[deploy-e-vercel]]).
- Validar: `npm run check:rpc-contract:db`, `npm run db:capturar-baseline`,
  `node --env-file=.env.local scripts/estado-das-migrations.mjs` e o
  `scripts/validar-migration-*.mjs` do tema, quando houver.

## Relacionadas

- [[rpc-e-contrato]] — os nomes e as assinaturas das RPCs no contrato
- [[seguranca]] — RLS e chaves
- [[python-e-jobs]] — o cálculo em lote fora do banco
- [[testes]] — o banco de verdade em PGlite
- [[ci-e-qualidade]] — o que o CI confere do banco
- [[deploy-e-vercel]] — a ordem entre migration e publicação
