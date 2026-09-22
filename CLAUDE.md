# MONITORA (`agsus-monitora/`)

App de monitoramento: mapas da saúde indígena, editais, análises e lista de aprovados.
Vite + JavaScript modular (sem framework) + Supabase (RPC) + servidor web em TypeScript (`server/`).
Front em JavaScript, sem React; só o servidor é TypeScript. **Português** em nomes de arquivo, funções e commits.

Cada diretório relevante tem o próprio `CLAUDE.md`. Leia o do diretório onde vai
trabalhar; **não rode `find`/`ls`/`tree` para descobrir a estrutura** — ela está aqui.

## Mapa

```
index.html              entrada principal (90 KB — só grep -n + sed -n)
analises.html           entrada do painel de análises
auth/callback.html      callback OAuth (JS em src/auth/callback.js)
DESIGN.md               guia de interface: tokens, componentes, contraste, plano de migração
api/                    funções serverless Vercel (proxy FUNAI, AYA)          → api/CLAUDE.md
src/lib/                lógica pura e testável                                → src/lib/CLAUDE.md
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
bench/                  protótipos HTML isolados (fora do build)
```

## Índice por assunto (vá direto ao arquivo)

| Assunto | Arquivos |
|---|---|
| Sessão / auth | `src/lib/sessao.js`, `session-lifecycle.js`, `auth-flow.js`, `supabaseClient.js`, `src/modules/auth-storage.js` |
| Permissões e perfis | `src/lib/perfis-de-acesso.js`, `access-roles.js` |
| Contrato de RPC | `src/lib/rpc-contrato.js` + `scripts/check-rpc-contract.mjs` |
| Mapa (Leaflet) | `src/lib/fabrica-do-leaflet.js`, `mapa-render.js`, `brasil-bounds.js`, `src/modules/map-*.js` |
| Terras indígenas | `src/modules/indigenous-territories-layer.js`, `api/funai-*.js`, `scripts/compilar-terras-indigenas.mjs` |
| Coordenadas / lotação | `src/lib/localizacoes-validadas.js`, `reconciliacao-unidades.js`, `src/modules/lotacoes-geograficas-transport.js`, `docs/auditoria-geografica.md` |
| Editais / cronograma | `src/lib/etapas-de-edital.js`, `editais-das-linhas.js`, `responsavel-do-edital.js`, `src/modules/nucleo-cronograma*.js`, `calendario-editais.js` |
| Lista de aprovados | `src/lib/lista-aprovados-rules.js`, `aprovados-import.js`, `src/modules/lista-aprovados.js`, `multi-select-busca.js` |
| Assistente AYA | `src/modules/aya-*.js`, `api/aya.js`, `docs/aya/`, `scripts/aya-*.mjs` |
| Branding / acesso | `src/lib/access-branding*.js`, `src/modules/sidebar-branding.js`, `access-request-ui.js` |
| **Planilhas** (links, modelo, bucket) | **`src/lib/planilhas.js`** — único lugar com endereço de planilha |
| Visual / CSS | **`DESIGN.md` (seção 0 primeiro)**, `src/styles/CLAUDE.md` |
| Análises | `src/analises/main.js` → `analises-*.js` |

## Não ler por inteiro (grep -n → sed -n 'A,Bp')

| Arquivo | Tamanho | Observação |
|---|---|---|
| `public/data/*.json` | até 2,3 MB | gerados |
| `src/modules/legacy-app.js` | 402 KB | legado, não crescer |
| `src/lib/localizacoes-validadas-gerado.js` | 201 KB | gerado por `scripts/recompilar-vereditos.mjs` |
| `supabase/migrations/20260918160000_padronizacao_nomenclatura_tabelas.sql` | 148 KB | renomeação em massa |
| `src/styles/app.css` | 110 KB | CSS base |
| `index.html` | 90 KB | |
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
- Feature nova = arquivo novo em `src/modules/` (+ lógica em `src/lib/` + teste). Não crescer `legacy-app.js`.
- Arquivo gerado se edita **na fonte** e se regenera com o script (ver `scripts/CLAUDE.md`).
- Link, caminho ou bucket de planilha só em `src/lib/planilhas.js`; o consumidor importa de lá
  (`tests/planilhas.test.js` falha se aparecer em outro arquivo).
- CSS segue `DESIGN.md`: token em vez de hex, sem `!important`/`#id` novos, sem arquivo `*-fix.css` novo.
- Nomenclatura de banco: padrão MAD (`padrao_nomenclatura_tabelas_agsus.pdf`); skill `mad-ddl-review`.

## Não fazer

Não commitar `.env`/`.env.local`. Não editar `dist/`. Não adicionar dependência sem
necessidade (`check:bundle-size`). Não converter o front para TypeScript/React sem pedido explícito.
**Nada em `public/` que não deva ser publicado**: tudo ali vai para o site (e para a Vercel).
