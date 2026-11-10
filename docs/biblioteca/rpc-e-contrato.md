---
tipo: regra
area: banco
atualizado: 2026-11-10
---

# RPC e contrato

O navegador só fala com o banco por **RPC** (`SECURITY DEFINER`, `search_path` fixado), nunca lendo
tabela. Cada RPC que o front chama está declarada no contrato, e o build confere.

## Regras

- **Contrato:** `src/lib/rpc-contrato.ts`. Criou ou mudou a assinatura de uma RPC no banco → mude
  aqui no mesmo PR. `npm run check:rpc-contract` (`scripts/check-rpc-contract.mjs`, estático, sem
  rede) quebra o build: toda chamada `.rpc("nome")` do front precisa estar no contrato, e todo nome
  declarado precisa ser usado.
- **Contra o banco:** `npm run check:rpc-contract:db` (`scripts/check-rpc-contract-db.mjs`, precisa
  de credencial) confere o contrato contra o catálogo real; `npm run db:capturar-baseline` guarda o
  retrato das RPCs. No CI, o job de banco real não roda em PR (sem credencial para código de PR);
  roda manualmente na `main` com `SUPABASE_DB_URL_DEV`, só de desenvolvimento
  ([[ci-e-qualidade]]).
- **Cliente único:** `getSupabaseClient()` ([[sessao-e-auth]]); nova tentativa automática só pela
  regra de `src/lib/novas-tentativas.ts`.
- **RPC de job** (chamada pelo Python ou por robô com a `service_role`) **não** entra no contrato
  (o contrato é do front): é `revoke … from public, anon, authenticated` e
  `grant execute … to service_role`. A que a tela chama, entra ([[python-e-jobs]]).
- Resposta de RPC entra no front como `unknown` e passa por normalizador antes de ser lida
  ([[typescript-no-front]]).
- RPCs da API para outro sistema (`listar_editais_da_api`, `listar_aprovados_da_api`,
  `listar_cronograma_da_api`) são só `service_role` e chamadas pelas funções da Vercel
  ([[funcoes-da-vercel]]).
- Sinal de tela antiga: RPC que sumiu (PGRST202) faz o cliente pedir "recarregue a página"
  (`src/lib/versao-do-sistema.ts`).

## Relacionadas

- [[banco-e-migrations]] — como a RPC chega ao banco
- [[nomenclatura-mad]] — nomes de função e tabela
- [[seguranca]] — por que só RPC
