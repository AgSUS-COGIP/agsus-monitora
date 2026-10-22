# `supabase/` — banco

- `migrations/` — **fonte de verdade do schema.** Nome `AAAAMMDDHHMMSS_descricao_em_portugues.sql`
  (14 dígitos, timestamp crescente e único). **Nunca editar migration já aplicada**: crie outra que
  corrige. Aplicação **manual** + registro em `public.migracoes_aplicadas`; **nunca `supabase db push`**.
  Processo completo em `migrations/README.md`.
- `rollback/` e `ensaios/` — desfazer e ensaiar (`begin; … rollback;`) cada migration, mesmo nome.
- `migrations-historicas/` — já aplicadas, só histórico; **não reaplicar** (`perfis_usuarios`,
  `search_path` não vazio, nomes pré-MAD). O registro as guarda como `migrations/<arquivo>`.
- `descartadas/` — decididas para **nunca aplicar** (acesso automático @agenciasus, bridge da IA
  local da Aya). Não trazer de volta; o teste `tests/migrations-pasta-limpa.test.js` impede.
- `correcoes/` — SQL de **correção de dados** (coordenadas de unidades, polos, aldeias), nome
  `AAAAMMDD-descricao.sql`. Não é schema: roda uma vez, junto com a auditoria que o justificou
  (`docs/auditoria-oficial-das-coordenadas-2026-10-01.md`).
- `.temp/` — estado local da CLI do Supabase; ignore.

Não ler inteiro: `migrations-historicas/20260918160000_padronizacao_nomenclatura_tabelas.sql` (148 KB).

Regras:

- O app só fala por **RPC** (`SECURITY DEFINER`). Criou/alterou RPC → atualize `src/lib/rpc-contrato.js`.
- RLS ligada por padrão; não desligar para "resolver" permissão.
- Nomenclatura MAD: prefixo tipológico, MAIÚSCULAS, aspas duplas (PDTIC 2026–2027, resumido em
  `docs/padronizacao_nomenclatura_*.md`; o PDF fica fora do repositório). A skill `mad-ddl-review` revisa o DDL antes de aplicar.
- Validar: `npm run check:rpc-contract:db`, `npm run db:capturar-baseline`,
  `node scripts/estado-das-migrations.mjs` e o `scripts/validar-migration-*.mjs` do tema, quando houver.
