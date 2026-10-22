# MONITORA

Sistema web da AgSUS para acompanhar os processos seletivos, do edital à lista de aprovados.
Cada edital pertence a uma **área** (Projetos, Saúde Indígena ou SEDE), e cada pessoa vê só as
áreas e os módulos que o seu grupo de acesso libera. Módulos e abas podem ser desligados ou postos
em manutenção em **Configurações → Módulos e abas**, sem deploy.

## Módulos

| Módulo                  | O que faz                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visão geral e mapas     | editais, terras indígenas, DSEIs e mapa de Projetos                                                                                                                                                                                       |
| Editais e Cronograma    | cadastro do edital e do cronograma (importa cronograma e quadro de vagas do PDF de anexos); calendário das etapas                                                                                                                         |
| Seleção                 | funil por vaga (inscritos, aptos, eliminados)                                                                                                                                                                                             |
| Avaliação documental    | análise curricular feita no sistema: regra do edital, equipe, pré-classificação e lote, fila de fichas, pendências, espelho de nota em PDF (ou ZIP em massa) com modelo editável, relatório de motivos e motivo padronizado na reabertura |
| Painel das análises     | leitura das análises (fichas publicadas da Avaliação documental e planilhas legadas): filtros, indicadores, ritmo da análise e medalhas do dia, detalhe com nota declarada × após a análise                                               |
| Classificação           | regras por edital, listas, desempate e sorteio, agenda das entrevistas, exportação (XLSX, SEI/DOCX) e publicação na Lista de aprovados                                                                                                    |
| Lista de aprovados      | aprovados, convocação e cartas de convocação                                                                                                                                                                                              |
| Entrevistas             | painel de resultados e condução (roteiro, convocação, banca, notas e parecer)                                                                                                                                                             |
| Recursos                | recursos dos candidatos: fila, etapas, parecer, resposta com modelos, anexos e ajuste de pontuação                                                                                                                                        |
| Conferências            | avisos diários de inconsistência entre análises, entrevistas, classificação, aprovados e cargas                                                                                                                                           |
| Aya                     | assistente lateral com base de conhecimento local (`docs/aya/`), sem IA externa; abre chamado ao suporte pelo Gmail                                                                                                                       |
| Acessos e Configurações | convites, solicitações de acesso, grupos, coordenações, contas desativadas; marca, painéis externos, status das atualizações e robôs                                                                                                      |

**Análises:** o edital 114/2026 é analisado no próprio sistema (Avaliação documental → fichas
publicadas no Painel das análises). As planilhas do Google com Apps Script (`apps-script/`) seguem
só para editais antigos e áreas que ainda as usam.

## Arquitetura

```text
Navegador (Vite + React 19 + TypeScript, PWA)
   │  login Google (Supabase Auth) · dados só por RPC, sob RLS
   ▼
Supabase: Postgres + RLS + RPCs + pg_cron/pg_net + Vault
   │  agenda e "Rodar agora" → workflow_dispatch
   ▼
GitHub Actions: robôs em Python/Node ── gravam pelo service_role ──► Supabase

Vercel: front estático (dist/) + funções serverless em api/ (FUNAI, PDF de anexos do edital)
Planilhas legadas: Apps Script → Supabase
```

- **Front:** Vite 7 e React 19; telas novas em TypeScript/TSX, legado em JavaScript modular
  (`src/modules/`, só encolhe). Alvo e regras em [docs/arquitetura-react.md](docs/arquitetura-react.md).
- **Servidor opcional:** `server/servidor.ts` (Node 24, sem dependências) serve o mesmo `dist/`
  em container, com os cabeçalhos do `vercel.json` ([docs/servidor.md](docs/servidor.md)).
- **Robôs** (`.github/workflows/`): robô da Empregare (carga de inscritos, modo "só anexos"),
  pré-classificação, leitura dos arquivos dos candidatos, conferências e sincronização das
  planilhas de seleção e entrevistas. O banco os dispara pelo pg_cron ou a pedido da tela
  ([docs/agenda-dos-robos.md](docs/agenda-dos-robos.md)); editais com **inscrições congeladas**
  ficam fora da carga e da pré-classificação, salvo pedido do administrador global com motivo.
  Guias: [docs/robo-empregare.md](docs/robo-empregare.md),
  [docs/python-no-monitora.md](docs/python-no-monitora.md).
- **TypeScript:** cerca de 59% dos arquivos de `src/` (362 `.ts`/`.tsx` × 252 `.js`/`.jsx` em
  21/10/2026); estado por módulo em [docs/typescript-no-frontend.md](docs/typescript-no-frontend.md).

## Rodar localmente

**Requisitos:** Git, Node.js **24** (com npm). Python 3.12 só para os robôs e testes Python;
Docker só para o container.

```bash
git clone https://github.com/AgSUS-COGIP/agsus-monitora.git
cd agsus-monitora
npm ci
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
```

Preencha o `.env.local`:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=cole_aqui_a_chave_publicavel_do_supabase
```

A URL e a chave publicável vêm de quem administra o Supabase. **Nunca** use a chave
`service_role`: tudo que começa com `VITE_` vai para o navegador.

| Comando                        | Endereço              | Para quê                                              |
| ------------------------------ | --------------------- | ----------------------------------------------------- |
| `npm run dev:frontend`         | http://localhost:5173 | editar telas, com recarga instantânea                 |
| `npm run dev`                  | http://127.0.0.1:8000 | build em watch + servidor TypeScript (F5 após editar) |
| `npm run build` e `npm start`  | http://127.0.0.1:8000 | conferir o build de produção, com todas as checagens  |
| `docker compose up --build -d` | http://127.0.0.1:8000 | container (lê o `.env` da raiz, não o `.env.local`)   |

O login volta para `<endereço>/auth/callback.html`, que precisa estar nas **Redirect URLs** do
Supabase. As rotas `/api/*` só existem na Vercel; localmente respondem 404.

**Testar:**

```bash
npx vitest run tests/<arquivo>.test.js   # um teste
npm test                                 # Vitest completo (rede bloqueada)
npm run test:smoke                       # smoke no navegador (Playwright)
npm run lint && npm run check:architecture
python -m pip install -r python/requirements-dev.txt -r scripts/robo-empregare/requirements.txt
python -m pytest && python -m ruff check . && python -m ruff format --check .
```

## Banco e migrations

- Mudanças de schema em `supabase/migrations/AAAAMMDDHHMMSS_descricao.sql`, **aplicadas à mão**
  (SQL Editor ou `psql`) por quem opera o banco e registradas em `public.migracoes_aplicadas`
  (caminho + sha256; `npm run db:estado`). **Não use `supabase db push`.**
- Cada migration tem rollback (`supabase/rollback/`) e ensaio em `begin; … rollback;`
  (`supabase/ensaios/`). Migration aplicada não se edita: cria-se outra.
- `supabase/migrations-historicas/` (já aplicadas, não reaplicar) e `supabase/descartadas/`
  (nunca aplicar) ficam só como registro.
- Nomes no Padrão Institucional de Nomenclatura da AgSUS (MAD/PDTIC 2026–2027: `TB_`, `TA_`,
  `TH_`, `RL_`, `TL_`, colunas com prefixo tipológico, `COMMENT ON` em tudo).
- Mudou uma RPC → atualize `src/lib/rpc-contrato.js` (o build confere).

Processo completo em [supabase/migrations/README.md](supabase/migrations/README.md); modelo de
dados em [docs/banco-de-dados.md](docs/banco-de-dados.md).

## Segurança

- Login só com Google; conta nova entra por **convite** ou por **solicitação aprovada** por um
  administrador, que define grupo e permissões.
- **RLS ligada em todas as tabelas**; o navegador só chama RPCs. Funções `SECURITY DEFINER` com
  `search_path` fixado.
- Nenhum segredo no repositório (`.env*` no `.gitignore`). O repositório é público: secret
  scanning com push protection, CodeQL e Dependabot estão ligados, e os robôs só imprimem
  contagens e códigos nos logs (`python/monitora/mascaramento.py`).
- Chave `service_role` e credenciais dos robôs só nos segredos do GitHub Actions; o token que
  dispara os robôs fica no Vault do Supabase. Na Vercel, só as variáveis `VITE_*` públicas.
- `main` protegida: só entra por Pull Request com o check "Arquitetura, qualidade, build e smoke"
  verde.
- Cabeçalhos de segurança (HSTS, CSP em modo report-only, etc.) no `vercel.json`, usados também
  pelo servidor TypeScript.

## Operação

- **Supabase no plano FREE:** 500 MB de banco e **sem backup automático**. Antes de limpezas ou
  correções de dados em massa, exporte o que vai mudar.
- **Logs:** os logs operacionais têm rotinas de limpeza (`limpar_logs_operacionais`, limpeza
  mensal dos acessos) para não estourar a cota; a última execução de cada carga é preservada.
- **Monitoramento:** **Configurações → Status das atualizações** mostra a última execução e o
  atraso de cada carga e robô; as **Conferências** geram avisos diários; disparos sem resposta do
  GitHub são sinalizados pelo banco.

## Qualidade e CI

Todo Pull Request para `main` roda `.github/workflows/build-and-smoke.yml`:

- **Arquitetura, qualidade, build e smoke** (obrigatório): checagens de arquitetura (auth,
  contrato de RPC, sem `MutationObserver` novo, sem remendos, legado só encolhe), lint e formatação
  dos arquivos alterados, Vitest com cobertura, `npm run build` (inclui `typecheck`, segurança do
  HTML e orçamento de bundles), smoke no Playwright, smoke no servidor TypeScript e na imagem
  Docker.
- **Python:** Ruff (lint e formatação) e pytest.
- **Contrato de RPC contra o banco de desenvolvimento**, quando o segredo existe.

**Limitações conhecidas:** os testes de banco são **estáticos** (leem o texto das migrations,
rollbacks e ensaios); o CI não sobe um Postgres real nem executa as migrations. O comportamento
no banco é conferido pelo ensaio manual antes de aplicar. A cobertura mínima configurada é 1% e
não comprova cobertura dos fluxos críticos.

## Publicar

- O merge em `main` publica em produção na Vercel. O `vercel.json` ignora o build das outras
  branches (`ignoreCommand`): a Vercel comenta no PR, mas **não gera prévia**; o que depende de
  `/api` só é testado depois do merge.
- Migrations são aplicadas depois da aprovação do PR: **antes** do merge quando o front novo
  depende delas; **depois** da publicação quando removem algo que o front atual ainda usa.
- Nova versão publicada: quem está com o sistema aberto vê a faixa "Há uma versão nova do
  MONITORA" (veja abaixo).

**Checklist:** CI verde; migrations ensaiadas, aplicadas na ordem certa e registradas; login
Google e solicitação de acesso funcionando; telas afetadas conferidas na versão publicada; nenhum
segredo no diff; novidade registrada quando muda algo para quem usa.

## Aviso de versão nova e novidades

Cada build publica `/versao.json` (sem cache). A tela aberta confere a cada 5 minutos e, se a
versão mudou, mostra a faixa com "Atualizar agora"; nada recarrega à força
(`src/app/aviso-de-versao.ts`).

Para anunciar uma mudança, no mesmo PR, ponha uma entrada no topo de `NOVIDADES` em
`src/lib/novidades.ts`:

```ts
{
  id: "2026-10-21-motivo-da-reabertura", // único: data + assunto
  data: "2026-10-21",
  texto: "motivo padronizado na reabertura", // curto, minúsculo, sem ponto final
  visivel: true, // só o que importa para quem usa
},
```

## Documentação

| Assunto                                | Onde                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mapa do código e regras para mexer     | `CLAUDE.md` da raiz e de cada pasta                                                                                                                                                                                            |
| Arquitetura do front (React)           | [docs/arquitetura-react.md](docs/arquitetura-react.md), [docs/arquitetura.md](docs/arquitetura.md)                                                                                                                             |
| TypeScript no front                    | [docs/typescript-no-frontend.md](docs/typescript-no-frontend.md)                                                                                                                                                               |
| Banco, RPCs e nomenclatura             | [docs/banco-de-dados.md](docs/banco-de-dados.md), `docs/padronizacao_nomenclatura_*.md`                                                                                                                                        |
| Migrations                             | [supabase/migrations/README.md](supabase/migrations/README.md)                                                                                                                                                                 |
| Servidor web e container               | [docs/servidor.md](docs/servidor.md)                                                                                                                                                                                           |
| Robôs, agenda e Python                 | [docs/agenda-dos-robos.md](docs/agenda-dos-robos.md), [docs/robo-empregare.md](docs/robo-empregare.md), [docs/leitura-dos-arquivos.md](docs/leitura-dos-arquivos.md), [docs/python-no-monitora.md](docs/python-no-monitora.md) |
| Planilhas (cargas e Apps Script)       | [docs/sincronizacao-das-planilhas.md](docs/sincronizacao-das-planilhas.md), [apps-script/LEIA-ME.md](apps-script/LEIA-ME.md)                                                                                                   |
| Análises no sistema (desenho e regras) | [docs/analises-no-monitora/](docs/analises-no-monitora/README.md), `docs/historias-de-usuario/`                                                                                                                                |
| Aya (base de conhecimento)             | [docs/aya/README.md](docs/aya/README.md), [docs/aya-sem-ia-local.md](docs/aya-sem-ia-local.md)                                                                                                                                 |
| Interface                              | [DESIGN.md](DESIGN.md)                                                                                                                                                                                                         |
| Plano de evolução                      | [docs/arquitetura-evolucao.md](docs/arquitetura-evolucao.md)                                                                                                                                                                   |
