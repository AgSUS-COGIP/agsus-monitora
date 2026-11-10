# `supabase/` — banco

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. Processo completo: [[banco-e-migrations]] e
`migrations/README.md`; rollback: [[rollback-de-migration]].

- `migrations/` — só as migrations que ainda importam: `AAAAMMDDHHMMSS_descricao_em_portugues.sql`
  (14 dígitos, timestamp único). **Nunca editar migration já aplicada**: crie outra. Aplicação
  **manual** + registro em `public.migracoes_aplicadas`; **nunca `supabase db push`**.
- **As migrations aplicadas saíram do repositório (10/11/2026); o banco não mudou.** A fonte do
  código do banco é o banco: para trocar uma função, copie o corpo com `pg_get_functiondef` e guarde
  a migration pelo md5 do `prosrc` (modelo `20261109180000`). Nome de migration citado em doc é
  histórico do Git, não arquivo daqui.
- `esquema-atual.sql` — **retrato do schema de produção, só leitura, NÃO aplicar** (3,6 MB: use
  grep). Regere com `npm run db:esquema` depois de cada migration aplicada e commite junto.
- `rollback/` e `ensaios/` — desfazer e ensaiar (`begin; … rollback;`) cada migration, mesmo nome.
- `tests/` — testes SQL de RPCs (não gravam). `.temp/` — estado local da CLI; ignore.
- Não recriar `migrations-historicas/`, `descartadas/` nem `correcoes/`
  (`tests/migrations-pasta-limpa.test.js`). Nunca aplicar o acesso automático @agenciasus nem o
  bridge da IA local da Aya.

Regras:

- O app só fala por **RPC** `SECURITY DEFINER`; criou/alterou RPC → `src/lib/rpc-contrato.ts`
  ([[rpc-e-contrato]]). RLS ligada; não desligar para "resolver" permissão.
- Nomes no padrão MAD; a skill `mad-ddl-review` revisa o DDL ([[nomenclatura-mad]]).
- Banco valida a gravação de uma linha e guarda; cálculo em lote é do Python ([[python-e-jobs]]).
- Validar: `npm run check:rpc-contract:db`, `npm run db:capturar-baseline`,
  `node --env-file=.env.local scripts/estado-das-migrations.mjs` e o `scripts/validar-migration-*.mjs`
  do tema. Não rodar script de banco contra produção sem pedido explícito.
