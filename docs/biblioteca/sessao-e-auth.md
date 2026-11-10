---
tipo: regra
area: seguranca
atualizado: 2026-11-10
---

# Sessão e autenticação

Login com Google pelo Supabase Auth, só em conta do domínio institucional, e só por convite ou por
solicitação aprovada. **Há um caminho único de auth**: nenhum `createClient` avulso
(`npm run check:auth-architecture`, `scripts/check-supabase-auth-architecture.mjs`).

## Onde fica

- `src/lib/sessao.ts`, `session-lifecycle.ts`, `auth-flow.ts`, `supabaseClient.ts` — o único
  caminho de auth; o cliente Supabase é um só (`getSupabaseClient()`).
- `src/modules/auth-storage.ts` — guarda da sessão (vai para `src/lib/` na etapa 6 da
  arquitetura).
- `src/lib/novas-tentativas.ts` — **regra única de nova tentativa automática** de chamada ao
  Supabase (leitura passageira, token vencido), com espera crescente sorteada, teto, limite e
  orçamento comum; o cliente único a aplica no `fetch`. Nada de laço próprio de repetição em tela:
  espera crescente usa `esperaAntesDaTentativa`.
- `src/app/sessao.ts` e `src/app/sistema.ts` — o contrato "Sessão ↔ sistema" entre a sessão e o
  resto do app ([docs/arquitetura-react.md](../arquitetura-react.md)).
- `src/app/entrada/` — a tela de acesso e o pedido de acesso (`src/lib/solicitacao-de-acesso.ts`).
  A marca da tela de acesso: `src/lib/access-branding.ts`, `access-branding-cache.ts` e
  `access-branding-publico.ts`; a da barra lateral, `src/componentes/barra-lateral/marca.ts`.
- `src/auth/callback.ts` (de `auth/callback.html`) — o retorno do OAuth. O login volta para
  `<endereço>/auth/callback.html`, que precisa estar nas **Redirect URLs** do Supabase.
- `src/lib/env.ts` — leitura de variáveis; nunca chave escrita no código.
- `src/lib/versao-do-sistema.ts` — o sinal de "tela antiga" (PGRST202 / "recarregue a página") no
  fetch do cliente.

## Regras

- Conta nova entra por convite ou por solicitação aprovada por um administrador, que define grupo
  e permissões ([[modulo-acessos]]).
- No navegador só a chave **publicável** (`VITE_SUPABASE_PUBLISHABLE_KEY`); nunca a `service_role`
  ([[seguranca]]).
- Nunca aplicar o acesso automático @agenciasus (decisão de nunca aplicar, em `supabase/`).
- Login e permissões falham de forma clara, nunca com tela travada.

## Testes

Playwright `sessao-simulada` (app com sessão e Supabase respondido por `page.route`) e, com banco de
desenvolvimento, `sessao-autenticada` ([[testes-de-navegador]]).

## Relacionadas

- [[permissoes-e-perfis]] — o que cada perfil pode depois de entrar
- [[carga-da-entrada]] — o que carrega depois do login
- [[seguranca]] — o resto das regras de segurança
