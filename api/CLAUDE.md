# `api/` — funções serverless (Vercel)

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. O que cada função faz e quem a usa:
[[funcoes-da-vercel]].

Cada arquivo é um endpoint `/api/<nome>`; o que começa com `_` não é rota. As rotas só existem na
Vercel (o `server/servidor.ts` não as tem).

Regras:

- Os proxies da FUNAI validam a origem com `src/lib/origem-da-requisicao.ts` (`origemDeTerceiro`).
  Não remover: sem isso o endpoint vira proxy aberto.
- Não expor chave ou URL interna na resposta. Segredo vem de variável de ambiente da Vercel;
  `EDITAIS_API_CHAVE` e `SUPABASE_SERVICE_ROLE_KEY` nunca vão para o front ([[seguranca]]).
- Código compartilhado com o front vem de `src/`; não duplicar lógica aqui.
- Pacote enxuto: toda função `api/*.py` leva no `vercel.json` o `excludeFiles`
  `{!(api)/**,.*/**,*,api/!(*.py)}` (e `includeFiles` se importar `python/monitora`). Guarda:
  `tests/funcoes-da-vercel-leves.test.js`.
- O que pode demorar mais que alguns segundos é job no GitHub Actions, não função
  ([[python-e-jobs]]).

Testes: `npx vitest run tests/funai-geodata-proxy.test.js tests/editais-api.test.js
tests/aprovados-e-cronograma-api.test.js`; `python -m pytest tests/python/test_anexos_do_edital.py
tests/python/test_retificacao_do_cronograma.py`.
