# `src/lib/` — lógica pura e testável, uma pasta por assunto

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. O que cada arquivo sensível faz: [[regras-do-codigo]].
Qual pasta guarda o quê: [[mapa-do-repositorio]], seção "Assunto → pastas".

Regras do diretório:

- **Sem DOM e sem estado global.** Entrada → saída, com teste em `tests/<nome>.test.ts` (ou
  `tests/lib/`). A UI pertence a `src/modulos/`.
- **Arquivo novo vai para a pasta do assunto, nunca solto na raiz** (quebra o CI pelo teste
  `tests/scripts/check-lib-sem-arquivo-solto.test.ts`; à mão, `npm run check:lib-por-assunto`). Serve a uma tela só → a pasta com o nome dela em `src/modulos/` (`aprovados/`,
  `entrevistas/`…); várias telas usam → pasta técnica: `sessao/`, `seguranca/`, `entrada/`,
  `navegacao/`, `carga/` ou `base/` (só o que três ou mais assuntos usam). Pasta com mais de 30
  arquivos diretos ganha subpasta.
- Nome em português, kebab-case, em TypeScript, com teste junto.
- Fronteiras que não se afrouxam:
  - `rpc-contrato.ts` (o único solto na raiz) — mudou no banco, muda aqui ([[rpc-e-contrato]]);
  - `sessao/`: `sessao.ts`, `session-lifecycle.ts`, `supabaseClient.ts`, `auth-flow.ts`,
    `novas-tentativas.ts` — único caminho de auth e de nova tentativa ([[seguranca]]);
  - `seguranca/sanitize.ts`, `seguranca/html-security.ts`, `seguranca/csv-security.ts` e
    `sessao/copia-da-sessao.ts` ([[seguranca]]);
  - `acessos/access-roles.ts`, `acessos/permissoes-recursos.ts` — costumam exigir migration junto
    ([[modulo-acessos]]).
- Catálogos únicos: `base/planilhas.ts` ([[planilhas]]), `navegacao/menu-lateral.ts`
  ([[modulo-barra-lateral]]), `automacao/agenda-do-cron.ts` e `automacao/catalogo-dos-robos.ts`
  ([[robos-e-agenda]]), `base/novidades.ts` ([[deploy-e-vercel]]). Reutilize `base/contraste.ts`
  em vez de reescrever.
- `sessao/env.ts` lê as variáveis; nunca chave escrita no código.

Teste: `npx vitest run tests/<nome>.test.ts`.
