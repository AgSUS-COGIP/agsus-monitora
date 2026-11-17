# Yeendé (`agsus-monitora/`, antes MONITORA)

Sistema da AgSUS para os processos seletivos, do edital à contratação, nas áreas Saúde Indígena,
SEDE e Projetos. Vite + React 19 + TypeScript na Vercel; Supabase (PostgreSQL, só por RPC, sob
RLS); cálculo pesado em Python no GitHub Actions; servidor web opcional em `server/`. O front
migra, tela por tela, para **um único app React** (rotas por área, visual de `src/ui/`).
**Português** em arquivos, funções e commits.

**Esta é a nota central da documentação.** Cada `[[nome]]` é `docs/biblioteca/<nome>.md` (vault
do Obsidian na raiz; como funciona em [[documentacao]]). Leia a nota do assunto antes de mexer;
**não rode `find`/`ls`/`tree`**: a estrutura está em [[mapa-do-repositorio]]. Pasta com regra
local tem um `CLAUDE.md` curto.

## Regras que não podem faltar

- Dados só por **RPC do Supabase**; mudou assinatura de RPC → `src/lib/rpc-contrato.ts`
  (`check:rpc-contract` quebra o build). Auth só pelos módulos de sessão (nada de `createClient`
  avulso).
- Tela nova = **React** em `src/modulos/<nome>/`, rota em `src/app/telas.tsx`, visual de `src/ui/`
  com tokens, lógica pura em `src/lib/` com teste. **Nada novo em `src/modules/`** (o legado só
  encolhe; `check-legado-so-encolhe` quebra o build). O legado fala com o React por estado externo
  e eventos, nunca pelo DOM.
- **Legado sai quando a mudança é confirmada** pelo usuário (módulos, marcação, funções em
  `window`, CSS, testes e referências nos docs), sem camada de compatibilidade: `grep` antes,
  testes e `npm run build` depois.
- Nenhum `MutationObserver` novo nem remendo (`*-fix`, `*-refinement`, `post-N…`,
  `window.navigate = …`): mude a fonte.
- HTML dinâmico só por `src/lib/sanitize.ts` / `html-security.ts`; nunca `innerHTML` cru.
- CSS pelas regras de ouro de [[design-e-tokens]]: token em vez de hex, sem `!important`/`#id`.
- Interface sem texto explicativo: quem explica é a Aya (`docs/aya/`); data de atualização
  discreta e uma vez só.
- Arquivo gerado se edita na fonte e se regenera com o script. Endereço de planilha só em
  `src/lib/planilhas.ts`. Banco no padrão MAD (skill `mad-ddl-review`).
- Migration aplicada à mão e registrada, **nunca `supabase db push`** nem edição da aplicada; o
  código vigente do banco está em `supabase/esquema-atual.sql`.

**Não fazer:** commitar `.env`/`.env.local`; editar `dist/`; dependência sem necessidade
(`check:bundle-size`); converter o front para TypeScript sem pedido; pôr em `public/` o que não
deva ser publicado; rodar script de banco contra produção sem pedido explícito.

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

**Transversal (código e operação)**
- Front: [[arquitetura-do-front]] · [[nova-tela-e-legado]] · [[regras-do-codigo]] ·
  [[mapa-do-repositorio]]
- Visual: [[design-e-tokens]] · [[componentes-padrao]] · [[css]] · [[textos-da-interface]] ·
  [[acessibilidade-e-mobile]] (norma: `docs/design-system-agsus.md`)
- Banco: [[banco-e-migrations]] · [[rpc-e-contrato]] · Segurança: [[seguranca]] ·
  [[dados-pessoais]]
- Qualidade: [[testes]] · [[ci-e-qualidade]] · Operação: [[comandos-e-ambiente]] ·
  [[deploy-e-vercel]] · [[servidor-web]] · [[pwa-e-modo-offline]] · [[documentacao]]
- Robôs e dados: [[python-e-jobs]] · [[robos-e-agenda]] · [[planilhas]]

**Telas comuns às três áreas** (a área é dado, não estrutura: [[arquitetura-do-front]])
- Acompanhar: [[modulo-visao-geral]] · [[modulo-cronograma]] · [[modulo-conferencias]] ·
  [[modulo-paineis-de-dados]] · [[modulo-paineis-externos]]
- Processo seletivo, na ordem: [[modulo-editais]] · [[modulo-selecao]] · [[modulo-triagem]] ·
  [[modulo-analises]] · [[modulo-avaliacao-documental]] ([[avaliacao-documental-regra]]) ·
  [[modulo-recursos]] · [[modulo-entrevistas]] · [[modulo-classificacao]]
  ([[classificacao-por-dentro]]) · [[modulo-aprovados]]
- Administração e moldura: [[modulo-configuracoes]] · [[modulo-acessos]] ·
  [[modulo-barra-lateral]] · [[modulo-aya]] ([[aya-base-de-conhecimento]]) · [[modulo-comemoracao]]

**Saúde Indígena** (só dela): [[modulo-mapa-saude-indigena]] · [[mapa-saude-indigena-contratos]] ·
[[coordenadas]] · [[mapas-e-leaflet]] (vale para os dois mapas); a Aya sobre SasiSUS e DSEIs em
`docs/aya/01…05`.
**Projetos** (só dele): [[modulo-mapa-de-projetos]]; a planilha de análises em
`apps-script/LEIA-ME.md`.
**SEDE**: nada próprio; usa as telas comuns, sem mapa.

Documentos longos (`docs/arquitetura-react.md`, `docs/banco-de-dados.md`,
`docs/design-system-agsus.md`, `docs/python-no-monitora.md`, os dos robôs e das planilhas):
leia só a seção do assunto; a lista está em `docs/CLAUDE.md`. O que saiu de uso fica em
`docs/_arquivo/`.
