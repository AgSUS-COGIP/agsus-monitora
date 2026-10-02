# MONITORA (`agsus-monitora/`)

App de monitoramento: mapas da saúde indígena, editais, análises e lista de aprovados.
Vite + React + Supabase (RPC) + servidor web em TypeScript (`server/`). O front está migrando,
tela por tela, para **um único app React** (rotas por área, visual único em `src/ui/`); o alvo, as
regras e a ordem estão em **`docs/arquitetura-react.md`** — leia antes de criar ou migrar tela.
Front em JavaScript — JSX nos componentes React; só o servidor é TypeScript. **Português** em nomes
de arquivo, funções e commits.

Cada diretório relevante tem o próprio `CLAUDE.md`. Leia o do diretório onde vai
trabalhar; **não rode `find`/`ls`/`tree` para descobrir a estrutura** — ela está aqui.

## Mapa

```
index.html              entrada principal (68 KB — só grep -n + sed -n)
analises.html           entrada do painel de análises
auth/callback.html      callback OAuth (JS em src/auth/callback.js)
DESIGN.md               guia de interface: tokens, componentes, contraste, plano de migração
api/                    funções serverless Vercel (proxy FUNAI, AYA)          → api/CLAUDE.md
src/lib/                lógica pura e testável                                → src/lib/CLAUDE.md
src/app/                base do app React: montarModulo, ErrorBoundary         → docs/arquitetura-react.md
src/ui/                 design system: Topo, Filtros, Kpi, Gráfico, Tabela, Gaveta, Modal… (ui.css)
src/componentes/        telas React (alvo: src/modulos/<nome>/, módulo a módulo) → src/componentes/CLAUDE.md
src/modulos/            destino dos módulos React (vazio por enquanto; ver README)
src/modules/            LEGADO: só encolhe, nada novo (check-legado-so-encolhe) → src/modules/CLAUDE.md
src/styles/             CSS do app principal (ordem de import em main.js)     → src/styles/CLAUDE.md
src/main.js             bootstrap: importa CSS e instala módulos, em ordem
supabase/               migrations/ e correcoes/ (SQL de dados)               → supabase/CLAUDE.md
apps-script/            código das planilhas de análises (colado no Google)   → apps-script/LEIA-ME.md
public/                 copiado para o site: assets/ e data/ (JSON GERADO por scripts/)
scripts/                checagens, pipeline geográfico, AYA, banco            → scripts/CLAUDE.md
tests/                  Vitest (*.test.js) e Playwright (*.spec.js)           → tests/CLAUDE.md
server/servidor.ts      servidor web (TypeScript, Node 24, sem dependências)  → server/CLAUDE.md
docs/                   decisões, auditorias e base de conhecimento da AYA    → docs/CLAUDE.md
```

## Índice por assunto (vá direto ao arquivo)

| Assunto                                                                                                                                           | Arquivos                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessão / auth                                                                                                                                     | `src/lib/sessao.js`, `session-lifecycle.js`, `auth-flow.js`, `supabaseClient.js`, `src/modules/auth-storage.js`                                                                                                                                                                                                              |
| Carga da entrada (consultas em paralelo, cópia da sessão no navegador)                                                                            | `loadInitialData`/`atualizarCopiaDaSessao` em `legacy-app.js`, `src/lib/copia-da-sessao.js` (regras), `src/modules/copia-da-sessao-indexeddb.js` (IndexedDB)                                                                                                                                                                 |
| Carregamento sem tela de carregamento (skeleton da entrada, barra do "Atualizar dados")                                                           | `src/modules/carregamento.js`, `src/lib/esqueleto-da-entrada.js` (formato), `src/styles/carregamento.css`, marcação `.esqueleto-da-entrada` e script `marcarSessaoGuardada` no `index.html`                                                                                                                                  |
| Permissões e perfis                                                                                                                               | `src/lib/access-roles.js` (o que cada perfil pode, páginas e seções liberadas), `permissoes-recursos.js` (módulos e níveis)                                                                                                                                                                                                  |
| **Acessos** (React: grupos de permissões + permissões individuais, coordenações, teto do coordenador, "como a pessoa vê", pedidos de acesso)      | `src/componentes/acessos/`, `src/lib/matriz-de-acessos.js`, `teto-de-acessos.js`, `grupos-e-coordenacoes.js`, `ver-como.js`, `solicitacao-de-acesso.js` (+ `src/modules/solicitacao-de-acesso.js`); banco em `supabase/migrations/20260929121000`–`121300` e `190000`–`190200`; o legado abre por `window.acessosController` |
| Contrato de RPC                                                                                                                                   | `src/lib/rpc-contrato.js` + `scripts/check-rpc-contract.mjs`                                                                                                                                                                                                                                                                 |
| Mapa (Leaflet)                                                                                                                                    | `src/lib/fabrica-do-leaflet.js`, `mapa-render.js`, `brasil-bounds.js`, `src/modules/map-*.js`                                                                                                                                                                                                                                |
| Filtros do mapa/tabela                                                                                                                            | `src/lib/filtros-do-mapa.js` (lógica pura) · estado em `legacy-app.js` (`filterState`, `dseiSelecionado`, `applyFilters`) · evento `agsus:filtros-alterados`                                                                                                                                                                 |
| Terras indígenas                                                                                                                                  | `src/modules/indigenous-territories-layer.js`, `api/funai-*.js`, `scripts/compilar-terras-indigenas.mjs`                                                                                                                                                                                                                     |
| Coordenadas / lotação                                                                                                                             | `reconciliacao-unidades.js`, `src/modules/lotacoes-geograficas-transport.js`, `docs/auditoria-geografica.md`, `docs/auditoria-oficial-das-coordenadas-2026-10-01.md`                                                                                                                                                         |
| **Editais / Núcleo** (React: tabela, alertas, formulário com cronograma, linha do tempo)                                                          | `src/componentes/nucleo/`, `src/lib/editais-do-nucleo.js`, `cronograma-do-edital.js`, `responsavel-do-edital.js`, `etapas-de-edital.js`, `editais-das-linhas.js`; o legado abre por `window.nucleoController`                                                                                                                |
| **Seleção** (módulo do app, sem iframe: montarSelecao na `#page-selecao`; funil por vaga da planilha Auditoria; carga diária pelo GitHub Actions) | `src/modulos/selecao/`, `src/lib/selecao-do-painel.js`, `selecao-da-planilha.js`, `scripts/sincronizar-selecao.mjs`, `supabase/migrations/20261001090000_selecao.sql`, `docs/sincronizacao-das-planilhas.md`                                                                                                                 |
| Status das atualizações (Configurações, só admin global: última execução e atraso de cada carga)                                                  | `src/componentes/saude-das-cargas/`, `src/lib/saude-das-cargas.js`, `supabase/migrations/20261001120000_saude_das_cargas.sql`                                                                                                                                                                                                |
| Calendário de editais (React)                                                                                                                     | `src/componentes/calendario-editais/`, `src/lib/calendario-editais.js`                                                                                                                                                                                                                                                       |
| Linhas do monitoramento e unidades para o React                                                                                                   | `src/componentes/dados-do-monitoramento.js` (o legado publica em `loadData`/`loadUnidades`)                                                                                                                                                                                                                                  |
| **Lista de aprovados** (React: aprovados, convocação, modais)                                                                                     | `src/componentes/lista-aprovados/`, `src/lib/lista-aprovados-rules.js`, `aprovados-import.js`, `lista-convocacao-rules.js`, `configuracao-de-convocacao.js`, `modelo-de-convocacao.js`, `anexos-do-candidato.js` (PDFs do candidato); o legado abre por `window.aprovadosController`                                         |
| Assistente AYA                                                                                                                                    | `src/modulos/aya/` (painel e contexto), `src/lib/busca-da-aya.js` (base sem rede), `src/modules/aya-memoria.js`, `docs/aya/`, `scripts/compilar-conhecimento-aya.mjs`; sem IA local ou túnel                                                                                                                                                                                            |
| Branding / acesso                                                                                                                                 | `src/lib/access-branding*.js`, `src/modules/sidebar-branding.js`, `access-request-ui.js`                                                                                                                                                                                                                                     |
| **Barra lateral** (React: áreas, trilho, rodapé)                                                                                                  | `src/componentes/barra-lateral/`, `src/lib/menu-lateral.js` (catálogo e estado do flutuante), `src/lib/eventos-da-barra-lateral.js`, `src/styles/barra-lateral.css`; o legado alimenta por `buildNav`/`setActiveNav`                                                                                                         |
| Ícones (Lucide)                                                                                                                                   | `src/modules/icones.js` (registro único) e `src/componentes/icone.jsx`; o resto do app ainda usa Font Awesome                                                                                                                                                                                                                |
| **Arquitetura React** (alvo, regras, ordem, como criar módulo)                                                                                    | `docs/arquitetura-react.md`, `src/app/montar-modulo.jsx`, `src/app/ErrorBoundary.jsx`                                                                                                                                                                                                                                        |
| **Design system** (componentes visuais padrão)                                                                                                    | `src/ui/index.js`, `src/ui/ui.css` (só tokens); `Modal` em `src/ui/modal.jsx` (`src/componentes/modal.jsx` só reexporta)                                                                                                                                                                                                     |
| Seleção múltipla (React)                                                                                                                          | `src/componentes/multi-select-busca.jsx`                                                                                                                                                                                                                                                                                     |
| Busca global (Ctrl+K, React)                                                                                                                      | `src/componentes/busca-global/`, `src/lib/busca-global.js`; a escolha vai ao legado pelo evento `agsus:busca-global-escolhida`                                                                                                                                                                                               |
| Configurações (todas as seções em React: Marca, Página inicial, Tela de acesso, Aparência, Painéis externos, Operação)                            | `src/componentes/configuracoes/`, `src/lib/publicacao-de-configuracoes.js`, `src/lib/apresentacao-das-configuracoes.js`, `src/lib/marca-da-barra-lateral.js`, `src/lib/paineis-externos-das-configuracoes.js`, `src/modules/config-secoes.js` (as seções da página)                                                          |
| **Recursos** (módulo do app, sem iframe: montarRecursos na `#page-recursos`, área e tema do app)                                                  | `src/modulos/recursos/`, `src/lib/recursos-dos-candidatos.js`; o legado abre por `window.recursosController`                                                                                                                                                                                                                 |
| **Entrevistas** (módulo do app, sem iframe: montarEntrevistas na `#page-entrevistas`, área e tema do app)                                         | `src/modulos/entrevistas/`; o legado abre por `window.entrevistasController`. `src/ui/no-quadro.jsx` fica enquanto a Seleção estiver no iframe                                                                                                                                                                               |
| **Planilhas** (links, modelo, bucket)                                                                                                             | **`src/lib/planilhas.js`** — único lugar com endereço de planilha                                                                                                                                                                                                                                                            |
| Visual / CSS                                                                                                                                      | **`DESIGN.md` (seção 0 primeiro)**, `src/styles/tokens.css`, `src/styles/CLAUDE.md`                                                                                                                                                                                                                                          |
| **Análises curriculares** (módulo do app, sem iframe: montarAnalises na `#page-analises`)                                                         | `src/modulos/analises/`, `src/lib/analises-curriculares.js`                                                                                                                                                                                                                                                                  |

## Não ler por inteiro (grep -n → sed -n 'A,Bp')

| Arquivo                                                                    | Tamanho    | Observação            |
| -------------------------------------------------------------------------- | ---------- | --------------------- |
| `public/data/*.json`                                                       | até 2,3 MB | gerados               |
| `src/modules/legacy-app.js`                                                | 394 KB     | legado, não crescer   |
| `supabase/migrations/20260918160000_padronizacao_nomenclatura_tabelas.sql` | 148 KB     | renomeação em massa   |
| `src/styles/app.css`                                                       | 110 KB     | CSS base              |
| `index.html`                                                               | 68 KB      |                       |
| `src/modules/indigenous-territories-layer.js`                              | 53 KB      |                       |
| `src/modules/aya-conhecimento-gerado.js`                                   | 27 KB      | gerado de `docs/aya/` |
| `package-lock.json`, `dist/`, `node_modules/`                              |            | nunca                 |

## Comandos (rode o mais barato que responda a pergunta)

```bash
npx vitest run tests/<arquivo>.test.js   # 1 teste — padrão ao editar
npm run lint                             # só arquivos alterados
npm run check:architecture               # auth + rpc + MutationObserver + remendos + legado só encolhe
npm test                                 # Vitest completo (lento)
npm run typecheck                        # tipos do servidor (server/*.ts)
npm run dev                              # vite build --watch + servidor em 127.0.0.1:8000
npm run build                            # checagens + vite build (lento, só antes de entregar)
npm run test:e2e                         # Playwright (muito lento, só se pedido)
```

## Regras do código

- ES Modules, nomes em português (kebab-case em arquivo).
- Dados só por **RPC do Supabase**. Mudou assinatura de RPC → `src/lib/rpc-contrato.js`
  (`check:rpc-contract` quebra o build).
- Auth só pelos módulos de sessão (`check:auth-architecture` bloqueia `createClient` avulso).
- Nenhum `MutationObserver` novo (`check-no-new-mutation-observer.mjs`).
- Nenhum remendo novo (`check-no-new-patch-layers.mjs`): nada de arquivo `*-fix`, `*-refinement`, `*-enhancements`, `post-N…` nem `window.navigate = …`/`window.saveAdminSettings = …` por outro módulo. Mude a fonte onde o comportamento é definido; ao passar por um remendo existente, prefira absorvê-lo na fonte e apagá-lo.
- HTML dinâmico passa por `src/lib/sanitize.js` / `html-security.js`. Nunca `innerHTML` cru.
- Tela ou feature nova = **React**: módulo em `src/componentes/<nome>/` (destino final
  `src/modulos/<nome>/`), montado por `montarModulo` (`src/app/`), visual com os componentes de
  `src/ui/` e tokens, lógica pura em `src/lib/` + teste. **Nada novo em `src/modules/` nem em
  `src/analises/`** (`scripts/check-legado-so-encolhe.mjs` quebra o build e o CI); não crescer
  `legacy-app.js` — a cada parte migrada, ele encolhe (ver "Código legado" abaixo).
- O legado fala com o React por estado externo e eventos, nunca pelo DOM dele (ver
  `src/componentes/CLAUDE.md`). Ao migrar uma tela: levante tudo o que a antiga faz (checklist),
  cumpra com testes, confira no navegador e só então apague o legado.
- Interface sem textos genéricos: nada de parágrafo de ajuda, subtítulo que descreve o óbvio, dica
  longa nem selo "Somente consulta" (quem só lê não vê os controles). Explicação é com a assistente
  AYA (`docs/aya/`). Ficam rótulos, erros, confirmações, estados vazios curtos e avisos que pedem ação.
  Data de atualização: discreta e uma vez só.
- Arquivo gerado se edita **na fonte** e se regenera com o script (ver `scripts/CLAUDE.md`).
- Link, caminho ou bucket de planilha só em `src/lib/planilhas.js`; o consumidor importa de lá
  (`tests/planilhas.test.js` falha se aparecer em outro arquivo).
- CSS segue `DESIGN.md`: token em vez de hex, sem `!important`/`#id` novos, sem arquivo `*-fix.css` novo.
- Nomenclatura de banco: padrão MAD (PDTIC 2026–2027; o PDF fica fora do repositório, resumo em `docs/padronizacao_nomenclatura_*.md`); skill `mad-ddl-review`.

## Código legado: sai quando a mudança é confirmada

O sistema **ainda está em desenvolvimento**. Quando o usuário confirmar que uma mudança está ok
(por exemplo, uma página migrada para React), **remova todo o código legado que ela substituiu**:

- módulos de `src/modules/`, trechos de `legacy-app.js`, marcação do `index.html` e funções expostas
  em `window` que só o código antigo usava;
- CSS sem seletor vivo, testes do comportamento antigo e arquivos ou pastas sem uso (build antigo,
  workflow temporário, protótipo abandonado);
- as referências nos docs e nos `CLAUDE.md`.

Não deixe camada de compatibilidade "por via das dúvidas". Antes de apagar, confirme com `grep` que
nada mais usa; depois, rode os testes afetados e o `npm run build`. O histórico do git guarda o que
saiu.

## Não fazer

Não commitar `.env`/`.env.local`. Não editar `dist/`. Não adicionar dependência sem
necessidade (`check:bundle-size`). Não converter o front para TypeScript sem pedido explícito.
**Nada em `public/` que não deva ser publicado**: tudo ali vai para o site (e para a Vercel).
