# `src/lib/` — lógica pura e testável

Regra do diretório: **sem DOM e sem estado global**. Entrada → saída, com teste em
`tests/<nome>.test.js` (ou `tests/lib/`). UI pertence a `src/modules/`.

Arquivos que exigem cuidado:
- `rpc-contrato.js` — contrato das RPCs. Mudou no banco, muda aqui (`npm run check:rpc-contract`).
- `sessao.js`, `session-lifecycle.js`, `supabaseClient.js`, `auth-flow.js` — único caminho de auth.
- `perfis-de-acesso.js`, `access-roles.js` — matriz de permissão; costuma exigir migration junto.
- `sanitize.js`, `html-security.js`, `csv-security.js` — fronteira de segurança. Não afrouxar.
- `localizacoes-validadas-gerado.js` — **201 KB, gerado.** Não editar nem ler inteiro; regenere com
  `node scripts/recompilar-vereditos.mjs`. A API legível é `localizacoes-validadas.js`.
- `reconciliacao-unidades.js`, `uf-ibge.js`, `brasil-bounds.js` — referência geográfica usada pelos
  scripts de auditoria; mudar aqui muda o veredito das coordenadas.
- `fabrica-do-leaflet.js` — único lugar que cria mapa Leaflet (as guardas preservam o namespace `L`).
- `filtros-do-mapa.js` — regra dos filtros da página do mapa: comparação sem acento, opções sem
  duplicata, poda até estabilizar. O `legacy-app.js` só guarda o estado e delega para cá.
- `planilhas.js` — **catálogo de todas as planilhas** (modelo de aprovados, bucket da lista importada,
  link da origem das análises, planilha de Lotações). Planilha nova entra aqui, com `usadaEm`.
- `formatters.js` — `formatNumberBR`, `formatDateBR`: use em vez de `toLocaleString` solto.
- `contraste.js` — cálculo de contraste usado pelo aviso de branding; reutilize em vez de reescrever.
- `env.js` — leitura de variáveis; nunca hardcode de chave.

Arquivo novo: nome em português, kebab-case, com teste junto.
Teste: `npx vitest run tests/<nome>.test.js`.
