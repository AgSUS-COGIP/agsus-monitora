---
tipo: regra
area: banco
atualizado: 2026-11-10
---

# Banco e migrations

O banco é Supabase (PostgreSQL) com RLS ligada em todas as tabelas; o navegador não lê tabela, só
chama RPCs. Toda mudança de schema é uma migration **aplicada à mão** (SQL Editor do Supabase ou
`psql`), por quem opera o banco, depois de ensaiada, e **registrada** em `public.migracoes_aplicadas`
pelo caminho e pelo sha256 do arquivo. Esta nota é o processo completo; o modelo de dados, as
convenções e a história de cada assunto estão em [docs/banco-de-dados.md](../banco-de-dados.md)
(leia a seção do assunto).

## As migrations aplicadas saíram do repositório (10/11/2026, #712)

- Até 10/11/2026 o repositório guardava as ~300 migrations aplicadas, com rollbacks, ensaios,
  `migrations-historicas/`, `descartadas/` e `correcoes/`. Saíram todas: **o banco não mudou** e o
  registro `public.migracoes_aplicadas` continua com as linhas delas (o `db:estado` as lista como
  órfãs, o que é esperado). `supabase/migrations/` guarda só as que ainda importam.
- **A fonte do código do banco é o banco.** `supabase/esquema-atual.sql` é o retrato do schema de
  produção, **só leitura, NÃO aplicar**: é onde se lê e pesquisa o código vigente de função,
  tabela, policy e grant (e as tarefas do pg_cron, no fim). Regerado por `npm run db:esquema`
  (pg_dump; precisa de `SUPABASE_DB_URL`) depois de cada migration aplicada e commitado junto: o
  diff mostra o que a migration mudou. Pode estar atrasado; para a guarda md5, confira no banco.
- Para trocar uma função, copie o corpo vigente com `pg_get_functiondef` no SQL Editor
  (`select pg_get_functiondef('private."FC_X"(text)'::regprocedure);`) e guarde a migration pelo
  md5 do `prosrc` (modelo: `20261109180000`), para não sobrescrever uma mudança que você não viu.
- **O rollback copia o corpo de antes** desse mesmo `pg_get_functiondef`, não de uma migration.
- Os testes que precisavam do "antes" guardam só o trecho que usam, em fixture
  (`tests/fixtures/banco-antes-do-catalogo-dos-robos.sql`, `tests/fixtures/sql-de-dados/`).
- O histórico está no Git (`git log --all -- supabase/migrations/<arquivo>`); nome de migration
  citado em doc, nota ou comentário é esse histórico (e a linha do registro), não um arquivo daqui.
- Não recriar `migrations-historicas/`, `descartadas/` nem `correcoes/`
  (`tests/migrations-pasta-limpa.test.js` impede). Correção de dados de uso único vai junto da
  migration ou do script que a pede, com ensaio.

## Migration nova, passo a passo

1. `supabase/migrations/AAAAMMDDHHMMSS_descricao_em_portugues.sql`: 14 dígitos, timestamp crescente
   e **único** (`npm run check:migrations`; confira antes do PR), descrição no infinitivo,
   `begin;`/`commit;`, idempotente, cabeçalho com motivo, dependentes e rollback; nomes MAD e
   `search_path = ''` em `SECURITY DEFINER`.
2. Rollback em `supabase/rollback/<mesmo nome>.sql` ([[rollback-de-migration]]).
3. Ensaio em `supabase/ensaios/<mesmo nome>.sql`: o SQL dentro de `begin; … rollback;`, com as
   conferências que reprovam o resultado; roda no banco antes de aplicar.
4. Criou/alterou RPC → `src/lib/rpc-contrato.ts` ([[rpc-e-contrato]]).
5. **Aplicar** (SQL Editor ou `psql`), por quem opera o banco, depois do merge/aprovação.
6. **Registrar**: `npm run db:estado -- --registrar=migrations/<arquivo>.sql` (marca, não executa)
   e `npm run db:estado` (o que falta ou divergiu). Marcar sem ter aplicado é a única forma de o
   registro mentir. Sem `psql` nem `SUPABASE_DB_URL`, registre à mão no SQL Editor (hash de
   `hashDoConteudo` em `scripts/estado-das-migrations-nucleo.mjs`: sha256 sem `\r`).
7. `npm run db:esquema` e commit do retrato.

**Nunca editar migration já aplicada**: o hash deixa de bater (estado "divergente"); mudou o
efeito → migration nova.

### Por que nunca `supabase db push`

Nem `supabase migration up`/`db reset` contra o banco do projeto:

- o registro do projeto é `public.migracoes_aplicadas` (caminho + sha256 sem `\r`), não
  `supabase_migrations.schema_migrations`; a CLI não conhece o que já foi aplicado e tentaria rodar
  tudo de novo;
- as migrations aplicadas saíram do repositório: a CLI veria um banco que não bate com a pasta;
- várias mudanças dependem de dados e de ordem que só o ensaio confere, e a escrita no banco é
  decisão da equipe, não da ferramenta.

## Onde fica cada coisa

| Pasta                  | O que é                                                         | Aplica?                      |
| ---------------------- | --------------------------------------------------------------- | ---------------------------- |
| `supabase/migrations/` | schema, em ordem de timestamp                                   | sim, uma a uma, e registra   |
| `supabase/rollback/`   | como desfazer cada migration (mesmo nome)                       | só para desfazer             |
| `supabase/ensaios/`    | ensaio de cada migration/correção, sempre termina em `rollback` | antes de aplicar (não grava) |
| `supabase/tests/`      | testes SQL de RPCs específicas                                  | não grava                    |

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
- `supabase/tests/` — testes SQL de RPCs (não gravam). `supabase/.temp/` — estado local da CLI;
  ignore.

## Relacionadas

- [[nomenclatura-mad]] — os nomes de tabela, coluna e função
- [[seguranca]] — RLS e chaves
- [[testes]] — o banco de verdade em PGlite
- [[ci-e-qualidade]] — o que o CI confere do banco
