---
tipo: guia
area: testes
atualizado: 2026-11-10
---

# Testes de navegador (Playwright)

Os `*.spec.js` de `tests/` rodam no Playwright. O CI roda todos (`npm run test:e2e`) sobre o
`dist/` do build do PR. São lentos: rode localmente só o que a mudança pede.

## Como rodam

- O Playwright sobe o servidor sozinho (`playwright.config.js`), refazendo o build;
  `PLAYWRIGHT_DIST_PRONTO=1` serve o `dist/` que já existe.
- **Sem sessão:** `smoke`, `aviso-global`, `contraste-dos-temas`.
- **`sessao-simulada`:** o app com sessão e o Supabase respondido por `page.route` (rotas, F5,
  voltar/avançar, áreas, sem perfil). Precisa de build com `VITE_SUPABASE_URL=https://teste.supabase.co`
  (o do CI); com outro endereço, é pulado. **Teste novo de tela com sessão vai aqui**, simulando as
  RPCs que ela chama.
- **`acabamento-capturas`:** as telas da base (Editais, Visão geral, Configurações → Módulos e abas, um modal e uma gaveta) em claro e escuro, a 375px e 1280px, com tabela cheia, texto longo, lista vazia e erro 500; grava PNG em `test-results/acabamento/` para conferir por olho e falha com `pageerror` ou rolagem horizontal. Usa `tests/apoio/sessao-simulada.js` (`abrirComSessao` com `rpcs` e `tabelas`) e as respostas de `tests/fixtures/acabamento/`.
- **Com banco de desenvolvimento** (`E2E_SUPABASE_SESSION_JSON`; sem ela, pulados):
  `sessao-autenticada`, `analises-authenticated`, `mapa-workspace-autenticado`.

## Comandos

```bash
npm run test:smoke                         # Playwright smoke (lento)
VITE_SUPABASE_URL=https://teste.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=teste npm run build
PLAYWRIGHT_DIST_PRONTO=1 npx playwright test tests/sessao-simulada.spec.js   # com sessão simulada
npm run test:smoke:servidor                # smoke contra o server/servidor.ts
npm run test:e2e                           # todos (muito lento; só se pedido)
```

`npm run test:smoke:servidor` aceita specs a mais depois de `--`; o CI passa
`tests/sessao-simulada.spec.js`, que confere as rotas das telas e o F5 no servidor TypeScript. O CI
roda o smoke também contra a imagem Docker ([[servidor-web]]).

## No CI

Na falha, o relatório e os traces ficam no artefato `relatorio-do-playwright` do workflow
`build-and-smoke.yml` ([[ci-e-qualidade]]).

## Relacionadas

- [[testes]] — Vitest, PGlite e pytest
- [[acessibilidade]] — o `contraste-dos-temas`
- [[sessao-e-auth]] — o que a sessão simulada imita
