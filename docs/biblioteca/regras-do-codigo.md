---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Regras do código

As regras que valem para todo o repositório. As mais importantes estão resumidas no `CLAUDE.md`
da raiz; cada uma tem nota própria quando há mais a dizer. Várias são guardadas por checagens
que quebram o build e o CI ([[scripts-e-checagens]]).

## Gerais

- ES Modules; **português** em nomes de arquivo (kebab-case), funções, commits e PRs.
- Front em TypeScript/TSX; **não converter o front para TypeScript sem pedido explícito**
  ([[typescript-no-front]]).
- **Dados só por RPC do Supabase.** Mudou assinatura de RPC → `src/lib/rpc-contrato.ts`
  (`check:rpc-contract` quebra o build). Ver [[rpc-e-contrato]].
- **Auth só pelos módulos de sessão** (`check:auth-architecture` bloqueia `createClient` avulso).
  Ver [[sessao-e-auth]].
- **Nenhum `MutationObserver` novo** (`scripts/check-no-new-mutation-observer.mjs`).
- **Nenhum remendo novo** (`scripts/check-no-new-patch-layers.mjs`): nada de arquivo `*-fix`,
  `*-refinement`, `*-enhancements`, `post-N…` nem `window.navigate = …`/`window.saveAdminSettings
  = …` por outro módulo. Mude a fonte onde o comportamento é definido; ao passar por um remendo
  existente, prefira absorvê-lo na fonte e apagá-lo.
- **HTML dinâmico** passa por `src/lib/sanitize.ts` / `html-security.ts`. Nunca `innerHTML` cru;
  em React, sem `dangerouslySetInnerHTML` ([[seguranca]]).
- Tela ou feature nova = **React** em `src/modulos/<nome>/`, nada novo em `src/modules/` nem em
  `src/analises/` ([[nova-tela-react]], [[codigo-legado]]).
- **Arquivo gerado se edita na fonte** e se regenera com o script (`public/data/*.json`,
  `src/modules/aya-conhecimento-gerado.js`, `src/styles/icones-lucide.css` de `npm run icones`);
  nunca à mão ([[scripts-e-checagens]]).
- **Link, caminho ou bucket de planilha só em `src/lib/planilhas.ts`**; o consumidor importa de lá
  (`tests/planilhas.test.js` falha se aparecer em outro arquivo). Ver [[planilhas]].
- **CSS segue `DESIGN.md`**: token em vez de hex, sem `!important`/`#id` novos, sem arquivo
  `*-fix.css` novo ([[css]], [[design-e-tokens]]).
- **Interface sem textos genéricos** ([[textos-da-interface]]).
- Nomenclatura de banco no padrão MAD; skill `mad-ddl-review` ([[nomenclatura-mad]]).
- Nova tentativa automática de chamada ao Supabase só pela regra única de
  `src/lib/novas-tentativas.ts` (`esperaAntesDaTentativa`); nada de laço próprio de repetição em
  tela ([[logica-em-src-lib]]).
- Nome de robô, tarefa ou horário de agenda não se escreve à mão na tela: vem do catálogo do banco
  e do `cron.job` ([[robos-e-agenda]]).

## Não fazer

- Não commitar `.env`/`.env.local`.
- Não editar `dist/`.
- Não adicionar dependência sem necessidade (`check:bundle-size` mede os pacotes).
- **Nada em `public/` que não deva ser publicado**: tudo ali vai para o site (e para a Vercel).
- Não rodar script de banco contra produção sem pedido explícito.
- Nunca `supabase db push`; nunca editar migration aplicada ([[banco-e-migrations]]).

## Relacionadas

- [[codigo-legado]] — o legado sai quando a mudança é confirmada
- [[fluxo-git-e-prs]] — branch, commit e PR
- [[testes]] — bug corrigido ganha teste que falharia antes
