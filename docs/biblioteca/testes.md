---
tipo: regra
area: testes
atualizado: 2026-11-17
---

# Testes

Vitest (ambiente node por padrão; jsdom nos arquivos que o declaram) para lógica e componentes,
PGlite para o banco de verdade, pytest para o Python e Playwright para o navegador. Rode o mínimo
que responda a pergunta.

## Comandos

```bash
npx vitest run tests/<arquivo>.test.ts     # um arquivo — o padrão ao editar
npx vitest run tests/modulos/              # uma pasta
npx vitest run -t "trecho do nome"         # um caso
npm test                                   # tudo (lento; só antes de entregar)
python -m pytest                           # Python (tests/python/)
npm run test:smoke                         # Playwright smoke (lento)
npm run test:smoke:servidor                # smoke contra o server/servidor.ts
npm run test:e2e                           # todo o Playwright (muito lento; só se pedido)
```

## Vitest

- `vitest.config.js` inclui `tests/**/*.test.{js,ts,tsx}`. Os testes estão passando de `.js` para
  `.ts` em lotes: **teste novo é `.ts`** (`.tsx` só com JSX), checado por `npm run typecheck:testes`
  (`tsconfig.tests.json`, strict). Sem `any`, `@ts-ignore`/`@ts-nocheck` nem `as unknown as` (o
  lint recusa): tipe o mock com `Partial<>`/`Pick<>`, `vi.mocked` ou um ajudante tipado. Globais só
  de teste (`IS_REACT_ACT_ENVIRONMENT`) ficam em `tests/globais.d.ts`.
- **Ambiente:** o padrão é node. Arquivo que usa DOM (`document`, `window`, React montado,
  `localStorage`) começa com `// @vitest-environment jsdom`. Sem a anotação, quem usa `document`
  direto falha com "document is not defined", mas código que lê `globalThis.document?.` cai em
  silêncio no caminho sem DOM: injete o `documento`/`janela` ou anote o arquivo. Não anote quem
  não precisa: montar o jsdom custava o dobro do tempo dos testes (#839). O Vitest lê a anotação em
  qualquer comentário do topo do arquivo, inclusive dentro de `/* */`: não a cite por extenso num
  comentário de arquivo que roda em node.
- Subpastas: `lib/`, `modules/`, `componentes/` (React), `modulos/` (telas de `src/modulos/`), `ui/`,
  `analises/`, `tipos/` (casos de tipo), `fixtures/`, `apoio/`, `python/`; a maioria fica na raiz,
  nomeada pelo comportamento (`terras-do-dsei.test.js`, `sobreposicao-na-tela.test.js`).
- **React:** o teste fica sem JSX (`.test.ts`): monte com a função de montagem do componente e
  envolva cada mudança em `act` (de `react`), com `globalThis.IS_REACT_ACT_ENVIRONMENT = true`.
  Modelo: `tests/componentes/barra-lateral.test.ts`. Campo controlado não aceita `campo.value = …`
  seguido de evento: use `digitar`, `escolher`, `clicar` e `teclar` de
  `tests/componentes/interacoes.ts`.
- **Rede bloqueada:** `tests/setup/rede-bloqueada.ts` bloqueia a rede em todo teste unitário,
  porque um teste já chamou o Supabase de produção via `.env.local`. Não desligue; teste que precisa
  de rede está errado, use mock.

## Postgres de verdade (PGlite)

`tests/apoio/banco-dos-robos.ts` monta o banco dos robôs e das chaves com as funções reais e
imitações de pg_cron, Vault, pg_net e sessão; roda dentro do processo, sem rede. Arquivo com
`// @vitest-environment node`. Modelo de migration testada antes × depois:
`tests/catalogo-dos-robos-no-banco.test.ts`. Como as migrations aplicadas saíram do repositório,
o "antes" fica em fixture (`tests/fixtures/sql-de-dados/`,
`tests/fixtures/banco-antes-do-catalogo-dos-robos.sql`), e a migration aplicada que monta o banco
de um teste de comportamento fica, sem mudança, em `tests/fixtures/sql-do-banco/<mesmo nome>.sql`
(só para os testes; o rollback e o ensaio saem com ela, e os testes deles também).

**Limitação conhecida:** os testes de banco são, na maioria, estáticos (leem o texto das
migrations, rollbacks e ensaios); o CI não sobe o banco do projeto. O comportamento no banco é
conferido pelo ensaio antes de aplicar ([[banco-e-migrations]]).

## Navegador (Playwright)

Os `*.spec.js` de `tests/` rodam no Playwright. O CI roda todos (`npm run test:e2e`) sobre o
`dist/` do build do PR. São lentos: rode localmente só o que a mudança pede.

- O Playwright sobe o servidor sozinho (`playwright.config.js`), refazendo o build;
  `PLAYWRIGHT_DIST_PRONTO=1` serve o `dist/` que já existe.
- **Sem sessão:** `smoke`, `aviso-global`, `contraste-dos-temas`.
- **`sessao-simulada`:** o app com sessão e o Supabase respondido por `page.route` (rotas, F5,
  voltar/avançar, áreas, sem perfil). Precisa de build com
  `VITE_SUPABASE_URL=https://teste.supabase.co` (o do CI); com outro endereço, é pulado. **Teste
  novo de tela com sessão vai aqui**, simulando as RPCs que ela chama.
- **`acabamento-capturas`:** as telas da base (Editais, Visão geral, Configurações → Módulos e
  abas, um modal e uma gaveta) em claro e escuro, a 375px e 1280px, com tabela cheia, texto longo,
  lista vazia e erro 500; grava PNG em `test-results/acabamento/` para conferir por olho e falha com
  `pageerror`, rolagem horizontal ou cenário que não aparece na tela. **Só roda sob demanda**
  (comando abaixo). Usa `tests/apoio/sessao-simulada.js` (`abrirComSessao` com `rpcs` e `tabelas`)
  e as respostas de `tests/fixtures/acabamento/`.
- **Com banco de desenvolvimento** (`E2E_SUPABASE_SESSION_JSON`; sem ela, pulados):
  `sessao-autenticada`, `analises-authenticated`, `mapa-workspace-autenticado`.

```bash
VITE_SUPABASE_URL=https://teste.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=teste npm run build
PLAYWRIGHT_DIST_PRONTO=1 npx playwright test tests/sessao-simulada.spec.js
CAPTURAS=1 PLAYWRIGHT_DIST_PRONTO=1 npx playwright test tests/acabamento-capturas.spec.js
```

`npm run test:smoke:servidor` aceita specs a mais depois de `--`; o CI passa
`tests/sessao-simulada.spec.js`, que confere as rotas das telas e o F5 no servidor TypeScript. O CI
roda o smoke também contra a imagem Docker ([[servidor-web]]). Na falha, o relatório e os traces
ficam no artefato `relatorio-do-playwright` do workflow `build-and-smoke.yml`
([[ci-e-qualidade]]).

## Escrever teste

- Nome do arquivo descreve o comportamento em português, não o arquivo testado.
- Teste a lógica em `src/lib/` (pura). Para `src/modules/`, monte o DOM mínimo no jsdom (com a
  anotação).
- **Bug corrigido → teste que falharia antes da correção.**
- Não leia `public/data/*.json` inteiro no teste; use um recorte fixo.
- Regra que existe em TypeScript e em Python: caso dourado compartilhado em
  `tests/fixtures/<assunto>/`, lido pelos dois ([[python-e-jobs]]).
- Dados fictícios sempre ([[dados-pessoais]]).

## Relacionadas

- [[ci-e-qualidade]] — o que roda em todo PR
- [[comandos-e-ambiente]] — os outros comandos
- [[regras-do-codigo]] — o que se testa como lógica pura
- [[banco-e-migrations]] — ensaio, rollback e as fixtures do banco
- [[seguranca]] — o que a sessão simulada imita
- [[acessibilidade-e-mobile]] — o `contraste-dos-temas` e a largura de 375px
