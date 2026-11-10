---
tipo: regra
area: testes
atualizado: 2026-11-10
---

# Testes

Vitest (ambiente jsdom) para lógica e componentes, PGlite para o banco de verdade, pytest para o
Python e Playwright para o navegador ([[testes-de-navegador]]). Rode o mínimo que responda a
pergunta.

## Rode o mínimo

```bash
npx vitest run tests/<arquivo>.test.ts     # um arquivo — o padrão ao editar
npx vitest run tests/modulos/              # uma pasta
npx vitest run -t "trecho do nome"         # um caso
npm test                                   # tudo (lento; só antes de entregar)
python -m pytest                           # Python (tests/python/)
```

## Vitest

- `vitest.config.js` inclui `tests/**/*.test.{js,ts,tsx}`. Os testes estão passando de `.js` para
  `.ts` em lotes: **teste novo é `.ts`** (`.tsx` só com JSX), checado por `npm run typecheck:testes`
  (`tsconfig.tests.json`, strict). Sem `any`, `@ts-ignore`/`@ts-nocheck` nem `as unknown as` (o
  lint recusa): tipe o mock com `Partial<>`/`Pick<>`, `vi.mocked` ou um ajudante tipado. Globais só
  de teste (`IS_REACT_ACT_ENVIRONMENT`) ficam em `tests/globais.d.ts`.
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
`// @vitest-environment node`. Modelo de migration testada antes × depois × rollback:
`tests/catalogo-dos-robos-no-banco.test.ts` ([[rollback-de-migration]]). Como as migrations
aplicadas saíram do repositório, o "antes" fica em fixture (`tests/fixtures/sql-de-dados/`,
`tests/fixtures/banco-antes-do-catalogo-dos-robos.sql`).

**Limitação conhecida:** os testes de banco são, na maioria, estáticos (leem o texto das
migrations, rollbacks e ensaios); o CI não sobe o banco do projeto. O comportamento no banco é
conferido pelo ensaio antes de aplicar.

## Escrever teste

- Nome do arquivo descreve o comportamento em português, não o arquivo testado.
- Teste a lógica em `src/lib/` (pura). Para `src/modules/`, monte o DOM mínimo no jsdom.
- **Bug corrigido → teste que falharia antes da correção.**
- Não leia `public/data/*.json` inteiro no teste; use um recorte fixo.
- Regra que existe em TypeScript e em Python: caso dourado compartilhado em
  `tests/fixtures/<assunto>/`, lido pelos dois ([[python-e-jobs]]).
- Dados fictícios sempre ([[dados-pessoais]]).

## Relacionadas

- [[ci-e-qualidade]] — o que roda em todo PR
- [[comandos-e-ambiente]] — os outros comandos
- [[logica-em-src-lib]] — o que se testa como lógica pura
