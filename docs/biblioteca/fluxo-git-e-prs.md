---
tipo: regra
area: operacao
atualizado: 2026-11-10
---

# Fluxo de Git e PRs

`main` é produção. Toda mudança entra por branch e Pull Request, e o merge publica.

## Regras

- **`main` protegida:** só entra por PR com o check "Arquitetura, qualidade, build e smoke" verde
  ([[ci-e-qualidade]]).
- **Português** em nomes de branch, commits e descrição do PR, como no código.
- Um assunto por PR. Trabalho em paralelo é comum: **não mova arquivos ou pastas em massa** sem
  combinar (gera conflito com quem trabalha ao lado; por isso a migração para `src/modulos/` é
  módulo a módulo e `src/legado/` só recebe código numa mudança em bloco combinada).
- Duas PRs em paralelo já escolheram o mesmo horário de migration: confira o timestamp antes de
  abrir a PR (`npm run check:migrations`; [[banco-e-migrations]]).
- No mesmo PR da mudança: o contrato de RPC ([[rpc-e-contrato]]), o retrato
  `supabase/esquema-atual.sql` (depois de aplicar a migration), a novidade em
  `src/lib/novidades.ts` quando muda algo para quem usa ([[deploy-e-vercel]]) e a nota da biblioteca
  do assunto ([[documentacao]]).
- Nenhum segredo no diff ([[seguranca]]); não commitar `.env`/`.env.local` nem `dist/`.
- Mudança confirmada pelo usuário → o legado que ela substituiu sai ([[codigo-legado]]).

## Antes de pedir revisão

```bash
npx vitest run tests/<o que mudou>.test.ts
npm run lint && npm run format:check
npm run check:architecture
npm run build            # lento; antes de entregar
```

## Do PR à produção

1. PR com o CI verde e revisão.
2. Migrations: aplicadas **antes** do merge quando o front novo depende delas, **depois** da
   publicação quando removem algo que o front atual ainda usa.
3. Merge em `main` → a Vercel publica ([[deploy-e-vercel]]). As outras branches não geram prévia:
   o que depende de `/api` só é testado depois do merge.

## Relacionadas

- [[regras-do-codigo]] — o que o PR não pode trazer
- [[testes]] — bug corrigido ganha teste
