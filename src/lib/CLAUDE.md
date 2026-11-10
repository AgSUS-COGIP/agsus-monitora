# `src/lib/` — lógica pura e testável

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. O que cada arquivo sensível faz: [[logica-em-src-lib]].

Regras do diretório:

- **Sem DOM e sem estado global.** Entrada → saída, com teste em `tests/<nome>.test.ts` (ou
  `tests/lib/`). A UI pertence a `src/modulos/`.
- Arquivo novo: nome em português, kebab-case, em TypeScript, com teste junto.
- Fronteiras que não se afrouxam:
  - `rpc-contrato.ts` — mudou no banco, muda aqui ([[rpc-e-contrato]]);
  - `sessao.ts`, `session-lifecycle.ts`, `supabaseClient.ts`, `auth-flow.ts`, `novas-tentativas.ts`
    — único caminho de auth e de nova tentativa ([[sessao-e-auth]]);
  - `sanitize.ts`, `html-security.ts`, `csv-security.ts` e `copia-da-sessao.ts` ([[seguranca]]);
  - `access-roles.ts`, `permissoes-recursos.ts` — costumam exigir migration junto
    ([[permissoes-e-perfis]]).
- Catálogos únicos: `planilhas.ts` ([[planilhas]]), `menu-lateral.ts` ([[modulo-barra-lateral]]),
  `agenda-do-cron.ts` e `catalogo-dos-robos.ts` ([[robos-e-agenda]]), `novidades.ts`
  ([[deploy-e-vercel]]). Reutilize `contraste.ts` em vez de reescrever.
- `env.ts` lê as variáveis; nunca chave escrita no código.

Teste: `npx vitest run tests/<nome>.test.ts`.
