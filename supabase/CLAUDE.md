# `supabase/` — banco

- `migrations/` — **fonte de verdade do schema.** Nome `AAAAMMDDHHMMSS_descricao_em_portugues.sql`,
  timestamp crescente. **Nunca editar migration já aplicada**: crie outra que corrige.
- `correcoes/` — SQL de **correção de dados** (coordenadas de unidades, polos, aldeias), nome
  `AAAAMMDD-descricao.sql`. Não é schema: roda uma vez, junto com a auditoria que o justificou
  (`docs/auditoria-geografica.md`, `scripts/validar-localizacoes*.mjs`).
- `.temp/` — estado local da CLI do Supabase; ignore.

Não ler inteiro: `migrations/20260918160000_padronizacao_nomenclatura_tabelas.sql` (148 KB).

Regras:
- O app só fala por **RPC** (`SECURITY DEFINER`). Criou/alterou RPC → atualize `src/lib/rpc-contrato.js`.
- RLS ligada por padrão; não desligar para "resolver" permissão.
- Nomenclatura MAD: prefixo tipológico, MAIÚSCULAS, aspas duplas (PDTIC 2026–2027, resumido em
  `docs/padronizacao_nomenclatura_*.md`; o PDF fica fora do repositório). A skill `mad-ddl-review` revisa o DDL antes de aplicar.
- Validar: `npm run check:rpc-contract:db`, `npm run db:capturar-baseline`,
  `node scripts/estado-das-migrations.mjs` e o `scripts/validar-migration-*.mjs` do tema, quando houver.
