---
tipo: regra
area: front
atualizado: 2026-11-17
---

# Regras do código

As regras que valem para todo o repositório, a lógica pura em `src/lib/` e o TypeScript. As mais
importantes estão resumidas no `CLAUDE.md` da raiz; várias são guardadas por checagens que quebram
o build e o CI ([[ci-e-qualidade]]).

## Gerais

- ES Modules; **português** em nomes de arquivo (kebab-case), funções, commits e PRs.
- **Dados só por RPC do Supabase.** Mudou assinatura de RPC → `src/lib/rpc-contrato.ts`
  (`check:rpc-contract` quebra o build). Ver [[rpc-e-contrato]].
- **Auth só pelos módulos de sessão** (`check:auth-architecture` bloqueia `createClient` avulso).
  Ver [[seguranca]].
- **Nenhum `MutationObserver` novo** (`scripts/check-no-new-mutation-observer.mjs`).
- **Nenhum remendo novo** (`scripts/check-no-new-patch-layers.mjs`): nada de arquivo `*-fix`,
  `*-refinement`, `*-enhancements`, `post-N…` nem `window.navigate = …`/`window.saveAdminSettings
  = …` por outro módulo. Mude a fonte onde o comportamento é definido; ao passar por um remendo
  existente, prefira absorvê-lo na fonte e apagá-lo.
- **HTML dinâmico** passa por `src/lib/seguranca/sanitize.ts` / `html-security.ts`. Nunca `innerHTML` cru;
  em React, sem `dangerouslySetInnerHTML` ([[seguranca]]).
- Tela ou feature nova = **React** em `src/modulos/<nome>/`, nada novo em `src/modules/` nem em
  `src/analises/` ([[nova-tela-e-legado]]).
- **Arquivo gerado se edita na fonte** e se regenera com o script (`public/data/*.json`,
  `src/modules/aya-conhecimento-gerado.js`, `src/styles/icones-lucide.css` de `npm run icones`);
  nunca à mão ([[ci-e-qualidade]]).
- **Link, caminho ou bucket de planilha só em `src/lib/base/planilhas.ts`**; o consumidor importa de lá
  (`tests/planilhas.test.js` falha se aparecer em outro arquivo). Ver [[planilhas]].
- **CSS segue as regras de ouro** ([[design-e-tokens]]): token em vez de hex, sem
  `!important`/`#id` novos, sem arquivo `*-fix.css` novo ([[css]]).
- **Interface sem textos genéricos** ([[textos-da-interface]]).
- Nomenclatura de banco no padrão MAD; skill `mad-ddl-review` ([[banco-e-migrations]]).
- Nova tentativa automática de chamada ao Supabase só pela regra única de
  `src/lib/sessao/novas-tentativas.ts` (`esperaAntesDaTentativa`); nada de laço próprio de repetição em
  tela.
- Nome de robô, tarefa ou horário de agenda não se escreve à mão na tela: vem do catálogo do banco
  e do `cron.job` ([[robos-e-agenda]]).

## Não fazer

- Não commitar `.env`/`.env.local`.
- Não editar `dist/`.
- Não adicionar dependência sem necessidade (`check:bundle-size` mede os pacotes).
- **Nada em `public/` que não deva ser publicado**: tudo ali vai para o site (e para a Vercel).
- Não rodar script de banco contra produção sem pedido explícito.
- Nunca `supabase db push`; nunca editar migration aplicada ([[banco-e-migrations]]).

## Lógica em `src/lib/`

`src/lib/` é a lógica pura e testável: **sem DOM e sem estado global**, entrada → saída, com teste
em `tests/<nome>.test.ts` (ou `tests/lib/`). Arquivo novo: nome em português, kebab-case, com teste
junto. A UI pertence a `src/modulos/` (e, no legado, a `src/modules/`).

**Fronteiras (não afrouxar):**

- `rpc-contrato.ts` — contrato das RPCs; mudou no banco, muda aqui.
- `sessao.ts`, `session-lifecycle.ts`, `supabaseClient.ts`, `auth-flow.ts` — único caminho de auth;
  `novas-tentativas.ts` — regra única de nova tentativa.
- `sanitize.ts`, `html-security.ts`, `csv-security.ts` — fronteira de segurança ([[seguranca]]).
- `copia-da-sessao.ts` — quando a cópia guardada pode abrir a tela; afrouxar expõe dado a quem
  perdeu acesso ([[arquitetura-do-front]]).
- `env.ts` — leitura de variáveis; nunca chave escrita no código.

**Regras de negócio que o banco ou o robô repetem** (mudou aqui, muda lá):

- `anexos-do-candidato.ts` — PDF no banco em bytea; 2 MB, 5 por candidato ([[modulo-aprovados]]).
- `configuracao-de-convocacao.ts` — precedência do quadro: manual > total da vaga > padrão.
- `avaliacao-documental/datas-do-vinculo.ts` — nada antes de 1960 nem fim depois de hoje
  ([[modulo-avaliacao-documental]]).
- `status-da-analise.ts` — status sem decisão (Pendente, Em análise), comum ao KPI "Pendentes" e
  aos marcos.

**Lugar único de cada coisa** (reutilize, não reescreva):

- `fabrica-do-leaflet.ts` — único lugar que cria mapa Leaflet ([[mapas-e-leaflet]]).
- `menu-lateral.ts` — catálogo do menu; área ou página nova entra aqui ([[modulo-barra-lateral]]).
- `access-roles.ts`, `permissoes-recursos.ts` — matriz de permissão ([[modulo-acessos]]).
- `publicacao-de-configuracoes.ts`, `apresentacao-das-configuracoes.ts`,
  `marca-da-barra-lateral.ts` — Configurações ([[modulo-configuracoes]]); `contraste.ts` —
  contraste do aviso de branding.
- `planilhas.ts` — catálogo das planilhas, com `usadaEm` ([[planilhas]]).
- `agenda-do-cron.ts` e `catalogo-dos-robos.ts` — agenda do pg_cron e nomes dos robôs
  ([[robos-e-agenda]]).
- `novidades.ts` e `versao-do-sistema.ts` — aviso de versão nova ([[deploy-e-vercel]]).

As regras de cada tela estão na nota `modulo-<nome>` dela.

## TypeScript

A migração de JavaScript para TypeScript começou em 07/10/2026 e está concluída no front: em
17/11/2026 `src/` tem só dois `.js`, ambos dados (`src/modules/aya-conhecimento-gerado.js`, gerado,
e `src/lib/mapa-saude-indigena/contornos.js`, contornos do Brasil e das UFs). O servidor também é
TypeScript ([[servidor-web]]). O inventário da migração, módulo a módulo, ficou como histórico em
[typescript-no-frontend](../_arquivo/typescript-no-frontend.md).

- **Código novo só em TypeScript/TSX.** Não converter arquivo para TypeScript sem pedido explícito
  quando ele não está sendo mudado; o legado que precise mudar vira `.ts` (o
  `check-legado-so-encolhe` aceita `x.ts` no lugar de `x.js`, mas não arquivo novo).
- **Resposta de RPC e de cache entra como `unknown`** e passa por normalizador que verifica objetos
  e listas antes de ler campos: anotação TypeScript não valida JSON recebido. Os limites de cada
  módulo estão na nota dele.
- Contratos de dados e ações sem `any`, `@ts-ignore`/`@ts-nocheck` nem `as unknown as`. Casos de
  tipo compilados (usos válidos e rejeições esperadas) ficam em `tests/tipos/`.
- **Arquivo que o Node importa direto** (regras de `src/lib/` usadas pelos scripts de
  sincronização e de coordenadas em `scripts/`) usa só sintaxe apagável e imports relativos com
  extensão: o Node 24 remove os tipos sem compilar.
- O Leaflet não tem tipos instalados: cada arquivo declara só o mínimo que usa (por exemplo
  `MapaDaDica`; `window.L` como `unknown` nas guardas).
- `npm run typecheck` roda `typecheck:servidor` (`tsconfig.json`), `typecheck:frontend`
  (`tsconfig.frontend.json`: estrito, DOM, JSX do React, resolução do bundler) e
  `typecheck:testes` (`tsconfig.tests.json`, strict); o `npm run build` o chama, então erro de
  tipo bloqueia o build e o CI. `allowJs` está ligado e `checkJs` desligado. Configuração de DOM e
  JSX pertence ao front; o servidor fica com o seu `tsconfig.json`.
- O ESLint usa o parser TypeScript; tipos do React e o parser são dependências de desenvolvimento e
  não entram no bundle. Teste novo é `.ts` ([[testes]]).

## Relacionadas

- [[nova-tela-e-legado]] — onde fica o código novo e quando o legado sai
- [[arquitetura-do-front]] — o app React para onde tudo migra
- [[ci-e-qualidade]] — as checagens que guardam estas regras e onde o typecheck roda
- [[deploy-e-vercel]] — branch, commit e PR
- [[testes]] — bug corrigido ganha teste que falharia antes
- [[mapa-do-repositorio]] — as outras pastas
