# MONITORA (`agsus-monitora/`)

App de monitoramento: mapas da saúde indígena, editais, análises e lista de aprovados.
Vite + JavaScript modular + React (migração em andamento: barra lateral, Núcleo, Calendário e
Lista de aprovados já são React) + Supabase
(RPC) + servidor web em TypeScript (`server/`). Front em JavaScript — JSX nos componentes React de
`src/componentes/`; só o servidor é TypeScript. **Português** em nomes de arquivo, funções e commits.

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
src/componentes/        componentes React (barra, Núcleo, calendário, aprovados) → src/componentes/CLAUDE.md
src/modules/            features de UI, 1 arquivo por feature                 → src/modules/CLAUDE.md
src/styles/             CSS do app principal (ordem de import em main.js)     → src/styles/CLAUDE.md
src/analises/           app de análises, JS + CSS próprios                    → src/analises/CLAUDE.md
src/main.js             bootstrap: importa CSS e instala módulos, em ordem
supabase/               migrations/ e correcoes/ (SQL de dados)               → supabase/CLAUDE.md
public/                 copiado para o site: assets/ e data/ (JSON GERADO por scripts/)
scripts/                checagens, pipeline geográfico, AYA, banco            → scripts/CLAUDE.md
tests/                  Vitest (*.test.js) e Playwright (*.spec.js)           → tests/CLAUDE.md
server/servidor.ts      servidor web (TypeScript, Node 24, sem dependências)  → server/CLAUDE.md
docs/                   decisões, auditorias e base de conhecimento da AYA    → docs/CLAUDE.md
```

## Índice por assunto (vá direto ao arquivo)

| Assunto | Arquivos |
|---|---|
| Sessão / auth | `src/lib/sessao.js`, `session-lifecycle.js`, `auth-flow.js`, `supabaseClient.js`, `src/modules/auth-storage.js` |
| Permissões e perfis | `src/lib/access-roles.js` (o que cada perfil pode), `permissoes-recursos.js` (permissões por recurso) |
| Contrato de RPC | `src/lib/rpc-contrato.js` + `scripts/check-rpc-contract.mjs` |
| Mapa (Leaflet) | `src/lib/fabrica-do-leaflet.js`, `mapa-render.js`, `brasil-bounds.js`, `src/modules/map-*.js` |
| Filtros do mapa/tabela | `src/lib/filtros-do-mapa.js` (lógica pura) · estado em `legacy-app.js` (`filterState`, `dseiSelecionado`, `applyFilters`) · evento `agsus:filtros-alterados` |
| Terras indígenas | `src/modules/indigenous-territories-layer.js`, `api/funai-*.js`, `scripts/compilar-terras-indigenas.mjs` |
| Coordenadas / lotação | `src/lib/localizacoes-validadas.js`, `reconciliacao-unidades.js`, `src/modules/lotacoes-geograficas-transport.js`, `docs/auditoria-geografica.md` |
| **Editais / Núcleo** (React: tabela, alertas, formulário com cronograma, linha do tempo) | `src/componentes/nucleo/`, `src/lib/editais-do-nucleo.js`, `cronograma-do-edital.js`, `responsavel-do-edital.js`, `etapas-de-edital.js`, `editais-das-linhas.js`; o legado abre por `window.nucleoController` |
| Calendário de editais (React) | `src/componentes/calendario-editais/`, `src/lib/calendario-editais.js` |
| Linhas do monitoramento e unidades para o React | `src/componentes/dados-do-monitoramento.js` (o legado publica em `loadData`/`loadUnidades`) |
| **Lista de aprovados** (React: aprovados, convocação, modais) | `src/componentes/lista-aprovados/`, `src/lib/lista-aprovados-rules.js`, `aprovados-import.js`, `lista-convocacao-rules.js`, `configuracao-de-convocacao.js`, `modelo-de-convocacao.js`; o legado abre por `window.aprovadosController` |
| Assistente AYA | `src/modules/aya-*.js`, `api/aya.js`, `docs/aya/`, `scripts/aya-*.mjs` |
| Branding / acesso | `src/lib/access-branding*.js`, `src/modules/sidebar-branding.js`, `access-request-ui.js` |
| **Barra lateral** (React: áreas, trilho, rodapé) | `src/componentes/barra-lateral/`, `src/lib/menu-lateral.js` (catálogo e estado do flutuante), `src/lib/eventos-da-barra-lateral.js`, `src/styles/barra-lateral.css`; o legado alimenta por `buildNav`/`setActiveNav` |
| Ícones (Lucide) | `src/modules/icones.js` (registro único) e `src/componentes/icone.jsx`; o resto do app ainda usa Font Awesome |
| Modal e seleção múltipla (React) | `src/componentes/modal.jsx`, `src/componentes/multi-select-busca.jsx` |
| **Planilhas** (links, modelo, bucket) | **`src/lib/planilhas.js`** — único lugar com endereço de planilha |
| Visual / CSS | **`DESIGN.md` (seção 0 primeiro)**, `src/styles/tokens.css`, `src/styles/CLAUDE.md` |
| Análises | `src/analises/main.js` → `analises-*.js` |

## Não ler por inteiro (grep -n → sed -n 'A,Bp')

| Arquivo | Tamanho | Observação |
|---|---|---|
| `public/data/*.json` | até 2,3 MB | gerados |
| `src/modules/legacy-app.js` | 394 KB | legado, não crescer |
| `src/lib/localizacoes-validadas-gerado.js` | 201 KB | gerado por `scripts/recompilar-vereditos.mjs` |
| `supabase/migrations/20260918160000_padronizacao_nomenclatura_tabelas.sql` | 148 KB | renomeação em massa |
| `src/styles/app.css` | 110 KB | CSS base |
| `index.html` | 68 KB | |
| `src/analises/analises-app.js` | 59 KB | |
| `src/modules/indigenous-territories-layer.js` | 53 KB | |
| `src/modules/aya-conhecimento-gerado.js` | 27 KB | gerado de `docs/aya/` |
| `package-lock.json`, `dist/`, `node_modules/` | | nunca |

## Comandos (rode o mais barato que responda a pergunta)

```bash
npx vitest run tests/<arquivo>.test.js   # 1 teste — padrão ao editar
npm run lint                             # só arquivos alterados
npm run check:architecture               # auth + rpc + MutationObserver
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
- HTML dinâmico passa por `src/lib/sanitize.js` / `html-security.js`. Nunca `innerHTML` cru.
- Feature nova = arquivo novo em `src/modules/` (+ lógica em `src/lib/` + teste). Não crescer
  `legacy-app.js`; a cada parte migrada, ele encolhe (ver "Código legado" abaixo).
- O front está migrando para React, por componente, com pedido. Componente React mora em
  `src/componentes/` (lógica pura segue em `src/lib/`); o legado fala com ele por estado externo e
  eventos, nunca pelo DOM dele (ver `src/componentes/CLAUDE.md`).
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
