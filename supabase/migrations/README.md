# `supabase/migrations/` — como o MONITORA muda o banco

## O processo, em uma frase

Migrations são **aplicadas à mão** (SQL Editor do Supabase ou `psql`), por quem opera o banco,
depois de ensaiadas, e **registradas** em `public.migracoes_aplicadas` pelo caminho e pelo sha256
do arquivo. **Não se usa `supabase db push`** (nem `supabase migration up`/`db reset` contra o
banco do projeto).

Por que não `db push`:

- o registro do projeto é `public.migracoes_aplicadas` (caminho + sha256 sem `\r`), não
  `supabase_migrations.schema_migrations`; a CLI não conhece o que já foi aplicado e tentaria
  rodar tudo de novo;
- as migrations já aplicadas saíram do repositório (abaixo): a CLI veria um banco que não
  bate com a pasta;
- várias mudanças dependem de dados e de ordem que só o ensaio confere, e a escrita no banco é
  decisão da equipe, não da ferramenta.

## As migrations aplicadas saíram do repositório (10/11/2026)

Até 10/11/2026 o repositório guardava as ~300 migrations já aplicadas, com rollbacks, ensaios,
`migrations-historicas/`, `descartadas/` e `correcoes/` (cerca de 286 mil linhas). Saíram todas:
**o banco não mudou** e o registro `public.migracoes_aplicadas` continua com as linhas delas (o
`db:estado` as lista como órfãs, o que é esperado). A pasta guarda só as migrations que ainda
importam, cada uma com rollback e ensaio.

O que isso muda no dia a dia:

- **A fonte do código do banco é o banco; `supabase/esquema-atual.sql` é o retrato dele** (só
  leitura, regerado por `npm run db:esquema`). Para ler e pesquisar, use o retrato. Para trocar
  uma função, copie o corpo vigente no SQL Editor (`select pg_get_functiondef('private."FC_X"(text)'::regprocedure);`) e ponha na migration
  uma guarda pelo md5 do `prosrc` (modelo: a guarda de `20261109180000`), para não sobrescrever
  uma mudança que você não viu.
- **O rollback copia o corpo de antes** desse mesmo `pg_get_functiondef`, não de uma migration.
- Os testes que precisavam do "antes" guardam só o trecho que usam, em fixture
  (`tests/fixtures/banco-antes-do-catalogo-dos-robos.sql`, `tests/fixtures/sql-de-dados/`).
- O histórico continua no Git: `git log --all -- supabase/migrations/<arquivo>` e
  `git show <commit>:supabase/migrations/<arquivo>`.

## Passo a passo de uma migration nova

1. **Arquivo** `supabase/migrations/AAAAMMDDHHMMSS_descricao_em_portugues.sql`: timestamp de
   **14 dígitos**, único (confira antes de abrir a PR — duas PRs em paralelo já escolheram o mesmo
   horário), descrição no infinitivo dizendo o efeito. `begin;`/`commit;`, idempotente, cabeçalho
   com motivo, dependentes e rollback. Nomenclatura MAD e `search_path = ''` em
   `SECURITY DEFINER` (`docs/banco-de-dados.md`).
2. **Rollback** em `supabase/rollback/<mesmo nome>.sql`.
3. **Ensaio** em `supabase/ensaios/<mesmo nome>.sql`: o SQL dentro de `begin; … rollback;`, com as
   conferências que reprovam o resultado. Roda no banco antes de aplicar de verdade.
4. Criou/alterou RPC → `src/lib/rpc-contrato.js` e `npm run check:rpc-contract`.
5. **Aplicar** o arquivo no banco (SQL Editor ou `psql`), depois do merge/aprovação.
6. **Registrar**:

   ```
   npm run db:estado -- --registrar=migrations/<arquivo>.sql   # marca, não executa
   npm run db:estado                                           # o que falta / divergiu
   ```

   (`SUPABASE_DB_URL` no ambiente, ex.: `node --env-file=.env.local scripts/estado-das-migrations.mjs`.)
   Marcar sem ter aplicado é a única forma de o registro mentir.

7. **Atualizar o retrato**: `npm run db:esquema` regrava `supabase/esquema-atual.sql` a partir do
   banco (pg_dump, só leitura). Commite o diff: ele é o registro legível do que a migration mudou.

**Nunca editar uma migration já aplicada**: o hash deixa de bater (estado "divergente"). Mudou o
efeito → migration nova.

## Onde fica cada coisa

| Pasta                  | O que é                                                         | Aplica?                      |
| ---------------------- | --------------------------------------------------------------- | ---------------------------- |
| `supabase/migrations/` | schema, em ordem de timestamp                                   | sim, uma a uma, e registra   |
| `supabase/rollback/`   | como desfazer cada migration (mesmo nome)                       | só para desfazer             |
| `supabase/ensaios/`    | ensaio de cada migration/correção, sempre termina em `rollback` | antes de aplicar (não grava) |
| `supabase/tests/`      | testes SQL de RPCs específicas                                  | não grava                    |

`tests/migrations-pasta-limpa.test.js` garante que esta pasta só tem `.sql` com timestamp de 14
dígitos, que cada migration tem rollback e ensaio com o mesmo nome e que as pastas de legado não
voltam. Correção de dados de uso único vai junto da migration ou do script que a pede (com ensaio),
não numa pasta própria.
