# MONITORA (`agsus-monitora/`)

Sistema da AgSUS para acompanhar os processos seletivos, do edital à contratação (triagem,
avaliação documental, recursos, entrevistas, classificação, lista de aprovados), com mapas da Saúde
Indígena e painéis por área (Saúde Indígena, SEDE, Projetos). Vite + React 19 + TypeScript na
Vercel; Supabase (PostgreSQL, só por RPC, sob RLS); cálculo pesado em Python no GitHub Actions;
servidor web opcional em TypeScript (`server/`). O front migra, tela por tela, para **um único app
React** (rotas por área, visual único em `src/ui/`). **Português** em arquivos, funções e commits.

**Esta é a nota central da documentação.** Cada `[[nome]]` abaixo é `docs/biblioteca/<nome>.md`
(vault do Obsidian na raiz do repositório; como funciona em [[documentacao]]). Leia a nota do
assunto antes de mexer; **não rode `find`/`ls`/`tree` para descobrir a estrutura**: ela está em
[[mapa-do-repositorio]]. Cada pasta com regra local tem um `CLAUDE.md` curto.

## Regras que não podem faltar

- Dados só por **RPC do Supabase**; mudou assinatura de RPC → `src/lib/rpc-contrato.ts`
  (`check:rpc-contract` quebra o build). Auth só pelos módulos de sessão (nada de `createClient`
  avulso).
- Tela ou feature nova = **React** em `src/modulos/<nome>/`, rota em `src/app/telas.tsx`, visual de
  `src/ui/` com tokens, lógica pura em `src/lib/` com teste. **Nada novo em `src/modules/`** (o
  legado só encolhe; `check-legado-so-encolhe` quebra o build e o CI).
- O legado fala com o React por estado externo e eventos, nunca pelo DOM dele. Ao migrar: levante
  tudo o que a tela antiga faz, cumpra com testes, confira no navegador e só então apague o legado.
- **Código legado sai quando a mudança é confirmada** pelo usuário: módulos, marcação, funções em
  `window`, CSS e testes antigos e as referências nos docs. Sem camada de compatibilidade; confirme
  com `grep` antes e rode testes e `npm run build` depois.
- Nenhum `MutationObserver` novo; nenhum remendo novo (`*-fix`, `*-refinement`, `post-N…`,
  `window.navigate = …` por outro módulo): mude a fonte.
- HTML dinâmico só por `src/lib/sanitize.ts` / `html-security.ts`; nunca `innerHTML` cru.
- CSS segue as regras de ouro de [[design-e-tokens]]: token em vez de hex, sem `!important`/`#id` novos.
- Interface sem textos genéricos: explicação é com a Aya (`docs/aya/`); data de atualização
  discreta e uma vez só.
- Arquivo gerado se edita na fonte e se regenera com o script. Endereço de planilha só em
  `src/lib/planilhas.ts`. Banco no padrão MAD (skill `mad-ddl-review`).
- Migration: aplicada à mão e registrada, **nunca `supabase db push`**, nunca editar a aplicada; as
  aplicadas saíram do repositório (o código vigente está em `supabase/esquema-atual.sql`).

**Não fazer:** commitar `.env`/`.env.local`; editar `dist/`; adicionar dependência sem necessidade
(`check:bundle-size`); converter o front para TypeScript sem pedido explícito; pôr em `public/` o
que não deva ser publicado (tudo ali vai para o site); rodar script de banco contra produção sem
pedido explícito.

## Rode o mínimo

```bash
npx vitest run tests/<arquivo>.test.ts   # 1 teste — padrão ao editar
npm run lint && npm run format:check     # só arquivos alterados
npm run check:architecture               # auth + rpc + MutationObserver + remendos + legado + docs
npm run check:docs                       # links e notas órfãs da biblioteca
npm test                                 # Vitest completo (lento)
npm run typecheck                        # tipos do front, do servidor e dos testes
npm run dev                              # vite build --watch + servidor em 127.0.0.1:8000
npm run build                            # checagens + vite build (lento, só antes de entregar)
npm run test:e2e                         # Playwright (muito lento, só se pedido)
```

## Biblioteca

**Arquitetura e front**
- [[arquitetura-do-front]] · [[nova-tela-react]] · [[legado-fala-com-react]] · [[codigo-legado]]
- [[regras-do-codigo]] · [[typescript-no-front]] · [[logica-em-src-lib]] · [[mapa-do-repositorio]]
- [[carga-da-entrada]] · [[areas-do-sistema]] · [[aya-base-de-conhecimento]]
- Visual: [[design-e-tokens]] · [[componentes-padrao]] · [[css]] · [[textos-da-interface]] ·
  [[acessibilidade]] · [[mobile]] · [[icones]] (norma: `docs/design-system-agsus.md`)
- Mapas: [[mapas-e-leaflet]] · [[terras-indigenas]] · [[coordenadas]]

**Banco**
- [[banco-e-migrations]] · [[rollback-de-migration]] · [[rpc-e-contrato]] · [[nomenclatura-mad]] ·
  [[python-e-jobs]]

**Segurança**
- [[seguranca]] · [[sessao-e-auth]] · [[permissoes-e-perfis]] · [[dados-pessoais]]

**Testes e qualidade**
- [[testes]] · [[testes-de-navegador]] · [[ci-e-qualidade]] · [[scripts-e-checagens]]

**Operação**
- [[comandos-e-ambiente]] · [[fluxo-git-e-prs]] · [[deploy-e-vercel]] · [[funcoes-da-vercel]] ·
  [[servidor-web]]
- [[robos-e-agenda]] · [[cargas-de-planilha]] · [[planilhas]] · [[documentacao]]

**Módulos e telas**
- Acompanhar: [[modulo-visao-geral]] · [[modulo-mapa-saude-indigena]] ·
  [[modulo-mapa-de-projetos]] · [[modulo-editor-de-coordenadas]] · [[modulo-cronograma]] ·
  [[modulo-analises]] · [[modulo-resumo-do-dia]] · [[modulo-conferencias]] ·
  [[modulo-paineis-externos]]
- Processo seletivo: [[modulo-editais]] · [[modulo-regras-do-edital]] · [[modulo-selecao]] ·
  [[modulo-triagem]] · [[modulo-avaliacao-documental]] · [[modulo-recursos]] ·
  [[modulo-entrevistas]] · [[modulo-classificacao]] · [[modulo-aprovados]] ·
  [[modulo-encerramento-do-edital]]
- Administração: [[modulo-configuracoes]] · [[modulo-acessos]] · [[modulo-modulos-e-abas]] ·
  [[modulo-automacao]] · [[modulo-status-das-atualizacoes]]
- Moldura: [[modulo-barra-lateral]] · [[modulo-busca-global]] · [[modulo-aya]] ·
  [[modulo-comemoracao]]

## Documentos longos de referência (`docs/`)

Leia só a seção do assunto: `docs/arquitetura-react.md` (alvo
do front, raiz única e rotas), `docs/banco-de-dados.md` (modelo e história do banco), `docs/design-system-agsus.md`
(norma visual), `docs/python-no-monitora.md`, `docs/agenda-dos-robos.md`,
`docs/robo-empregare.md`, `docs/leitura-dos-arquivos.md`, `docs/sincronizacao-das-planilhas.md`,
`docs/typescript-no-frontend.md`, `docs/analises-no-monitora/regras-dos-editais-recentes.md` e `docs/historias-de-usuario/`.
Lista completa em `docs/CLAUDE.md`; o que saiu de uso fica em `docs/_arquivo/`.
