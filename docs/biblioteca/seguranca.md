---
tipo: regra
area: seguranca
atualizado: 2026-11-17
---

# Segurança

O repositório é público e o sistema guarda dados de candidatos. As regras abaixo valem para front,
banco, funções e robôs.

## Sessão e autenticação

Login com Google pelo Supabase Auth, só em conta do domínio institucional. Conta nova entra por
convite ou por solicitação aprovada por um administrador, que define grupo e permissões
([[modulo-acessos]]). **Há um caminho único de auth**: nenhum `createClient` avulso
(`npm run check:auth-architecture`, `scripts/check-supabase-auth-architecture.mjs`).

- `src/lib/sessao/sessao.ts`, `sessao/session-lifecycle.ts`, `sessao/auth-flow.ts`, `sessao/supabaseClient.ts` — o único
  caminho de auth; o cliente Supabase é um só (`getSupabaseClient()`).
- `src/modules/auth-storage.ts` — guarda da sessão (vai para `src/lib/` na etapa 6 da
  arquitetura).
- `src/lib/sessao/novas-tentativas.ts` — **regra única de nova tentativa automática** de chamada ao
  Supabase (leitura passageira, token vencido): espera crescente sorteada, teto, limite e orçamento
  comum, aplicada pelo cliente único no `fetch`. Nada de laço próprio de repetição em tela; espera
  crescente usa `esperaAntesDaTentativa`.
- `src/app/sessao.ts` e `src/app/sistema.ts` — o contrato "Sessão ↔ sistema" entre a sessão e o
  resto do app ([docs/arquitetura-react.md](../arquitetura-react.md)).
- `src/app/entrada/` — a tela de acesso e o pedido de acesso (`src/lib/acessos/solicitacao-de-acesso.ts`).
  A marca da tela de acesso fica em `src/lib/entrada/access-branding.ts`, `entrada/access-branding-cache.ts` e
  `entrada/access-branding-publico.ts`; a da barra lateral, em `src/componentes/barra-lateral/marca.ts`.
- `src/auth/callback.ts` (de `auth/callback.html`) — o retorno do OAuth. O login volta para
  `<endereço>/auth/callback.html`, que precisa estar nas **Redirect URLs** do Supabase.
- `src/lib/sessao/env.ts` — leitura de variáveis; nunca chave escrita no código.
- `src/lib/base/versao-do-sistema.ts` — o sinal de "tela antiga" (PGRST202 / "recarregue a página") no
  fetch do cliente.

Regras da sessão:

- Nunca aplicar o acesso automático @agenciasus (decisão de nunca aplicar, em `supabase/`).
- Login e permissões falham de forma clara, nunca com tela travada.
- A cópia da sessão no navegador só abre a tela para o mesmo usuário, mesmo acesso e mesma versão
  (`src/lib/sessao/copia-da-sessao.ts`): afrouxar expõe dado a quem perdeu acesso
  ([[arquitetura-do-front]]).
- **Sem rede**, a sessão guardada e o perfil guardado servem por até 48 h, e o perfil é conferido
  quando a rede volta ([[pwa-e-modo-offline]], `src/lib/sessao/sessao-sem-rede.ts`). Só a falha de rede
  abre esse caminho: recusa do servidor e erro do banco seguem como antes.
- Testes: Playwright `sessao-simulada` (app com sessão e Supabase respondido por `page.route`) e,
  com banco de desenvolvimento, `sessao-autenticada` ([[testes]]).

## Dados no banco

**RLS ligada em todas as tabelas**; o navegador só chama RPCs `SECURITY DEFINER` com `search_path`
fixado ([[rpc-e-contrato]]). Não desligar RLS para "resolver" permissão.

## Segredos

- **Nenhum segredo no repositório** (`.env*` no `.gitignore`; não commitar `.env`/`.env.local`).
  Secret scanning com push protection, CodeQL e Dependabot estão ligados.
- **Tudo que começa com `VITE_` vai para o navegador.** No navegador só a chave **publicável**
  (`VITE_SUPABASE_PUBLISHABLE_KEY`), nunca a `service_role`. Na Vercel, só as variáveis `VITE_*`
  públicas e as das funções.
- A `service_role` e as credenciais dos robôs ficam nos segredos do GitHub Actions; o token que
  dispara os robôs fica no **Vault** do Supabase ([[robos-e-agenda]]).
- Não expor chave ou URL interna na resposta de função; segredo vem de variável de ambiente
  ([[deploy-e-vercel]]).
- Credencial de banco nunca vai para código de PR: o job de banco real só roda manualmente na
  `main`, com segredo só de desenvolvimento; nunca apontar esse segredo para produção.

## Fronteiras no código (não afrouxar)

- HTML dinâmico passa por `src/lib/seguranca/sanitize.ts` / `seguranca/html-security.ts`; CSV exportado por
  `seguranca/csv-security.ts`. Nunca `innerHTML` cru nem `dangerouslySetInnerHTML`.
- Os proxies da FUNAI validam a origem com `src/lib/seguranca/origem-da-requisicao.ts`
  (`origemDeTerceiro`): sem isso o endpoint vira proxy aberto.
- A API para outro sistema confere a chave em tempo constante (`api/_rota-com-chave.ts`).
- Cabeçalhos de segurança (HSTS, CSP etc.) no `vercel.json`, usados também pelo servidor
  TypeScript ([[servidor-web]]). `npm run check:dist-security` confere o HTML do build.
- **A CSP é aplicada** (deixou de ser só relatório em 16/11/2026): script de fora só do Google
  Analytics e do cdnjs, sem `eval`, sem `<object>`. Fonte nova de script, quadro ou conexão entra
  no `vercel.json` no mesmo PR, senão o navegador a bloqueia. Cada bloqueio vai para
  `TL_EVENTO_ACESSO` (`csp_report_only_violation`, nome antigo) por `src/lib/seguranca/csp-report-monitor.ts`.
- `tests/setup/rede-bloqueada.ts` bloqueia a rede em todo teste unitário (um teste já chamou o
  Supabase de produção via `.env.local`).
- O servidor e o `dist/` não servem `CLAUDE.md`, `.env` nem arquivo com ponto
  (`tests/servidor.test.js`).

## Processo

- `main` protegida: só entra por PR com o check "Arquitetura, qualidade, build e smoke" verde
  ([[deploy-e-vercel]]).
- **Correções de dados em massa:** antes de limpar ou corrigir, exporte o que vai mudar.
- Não rodar script de banco contra produção sem pedido explícito.

## Relacionadas

- [[dados-pessoais]] — o que não sai em log, tela ou arquivo
- [[modulo-acessos]] — convites, perfis e quem pode o quê depois de entrar
- [[arquitetura-do-front]] — o que carrega depois do login
- [[banco-e-migrations]] — RLS e RPCs no banco
- [[rpc-e-contrato]] — assinatura das RPCs e `SECURITY DEFINER`
- [[deploy-e-vercel]] — funções, variáveis da Vercel e proteção da `main`
- [[testes]] — os testes de navegador da sessão
