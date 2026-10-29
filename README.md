# MONITORA

Sistema web da Agência Brasileira de Apoio à Gestão do SUS (AgSUS) para acompanhar os processos
seletivos, do edital à contratação: análise curricular (avaliação documental), classificação,
convocação, entrevistas, recursos, lista de aprovados e contratação, com painéis por área.

Cada edital pertence a uma **área** (Saúde Indígena, Projetos ou SEDE), e cada pessoa vê só as
áreas e os módulos que o seu grupo de acesso libera. Módulos e abas podem ser desligados ou postos
em manutenção em **Configurações → Módulos e abas**, sem deploy.

**Sumário:** [Módulos](#módulos) · [Arquitetura](#arquitetura) · [Mapa de pastas](#mapa-de-pastas)
· [Rodar localmente](#rodar-localmente) · [Qualidade e CI](#qualidade-e-ci) ·
[Banco e migrations](#banco-e-migrations) · [Segurança](#segurança) · [Operação](#operação) ·
[Publicar](#publicar) · [Documentação](#documentação)

## Módulos

| Módulo                  | O que faz                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visão geral e mapas     | editais, terras indígenas, DSEIs e mapa de Projetos                                                                                                               |
| Editais e Cronograma    | cadastro do edital e do cronograma (importa cronograma e quadro de vagas do PDF de anexos); calendário das etapas                                                 |
| Seleção                 | funil por vaga (inscritos, aptos, eliminados)                                                                                                                     |
| Avaliação documental    | análise curricular no sistema: regra do edital, equipe, triagem e lote, fila de fichas, pendências, espelho de nota em PDF/ZIP, relatório de motivos e reabertura |
| Painel das análises     | leitura das análises (fichas publicadas e planilhas legadas): filtros, indicadores, ritmo da análise, nota declarada × após a análise                             |
| Classificação           | regras por edital, listas, desempate e sorteio, agenda das entrevistas, exportação (XLSX, SEI/DOCX) e publicação na Lista de aprovados                            |
| Lista de aprovados      | aprovados, convocação, cartas de convocação e acompanhamento da contratação                                                                                       |
| Entrevistas             | painel de resultados e condução (roteiro, convocação, banca, notas e parecer)                                                                                     |
| Recursos                | recursos dos candidatos: fila, etapas, parecer, resposta com modelos, anexos e ajuste de pontuação                                                                |
| Conferências            | avisos diários de inconsistência entre análises, entrevistas, classificação, aprovados e cargas                                                                   |
| Aya                     | assistente lateral com base de conhecimento local (`docs/aya/`), sem IA externa; abre chamado ao suporte por e-mail                                               |
| Acessos e Configurações | convites, solicitações de acesso, grupos, coordenações, contas desativadas; marca, painéis externos, status das atualizações e robôs                              |

Os editais novos são analisados no próprio sistema (Avaliação documental → fichas publicadas no
Painel das análises). As planilhas do Google com Apps Script (`apps-script/`) seguem só para
editais antigos e áreas que ainda as usam.

## Arquitetura

```text
Navegador (Vite + React 19 + TypeScript, PWA)            ── hospedado na Vercel
   │  login Google (Supabase Auth) · dados só por RPC, sob RLS
   ▼
Supabase: PostgreSQL + RLS + RPCs SECURITY DEFINER + pg_cron/pg_net + Vault
   │  agenda e "Rodar agora" → workflow_dispatch
   ▼
GitHub Actions: cálculo pesado em Python (e robôs em Node) ── gravam por RPC ──► Supabase

Vercel: front estático (dist/) + funções serverless em api/ (FUNAI, PDF de anexos do edital)
Planilhas (legado): Apps Script → Supabase
```

- **Front:** Vite 7 e React 19, hospedado na Vercel. Código novo só em TypeScript/TSX.
- **Migração em curso:**
  - **JavaScript → TypeScript:** cerca de 70% dos arquivos de `src/` já são `.ts`/`.tsx` (441 ×
    190 `.js`/`.jsx` em 26/10/2026). O legado em `src/modules/` só encolhe (o CI barra
    crescimento). Estado por módulo em
    [docs/typescript-no-frontend.md](docs/typescript-no-frontend.md).
  - **Casca para React:** a página de entrada (`index.html`; a casca do app já é React em `src/app/casca/`)
    está sendo substituída, tela por tela, por um único app React com rotas por área e visual
    único em `src/ui/`. Alvo, regras e ordem em [docs/arquitetura-react.md](docs/arquitetura-react.md).
- **Banco:** Supabase (PostgreSQL). RLS ligada em todas as tabelas; o navegador não lê tabela,
  só chama RPCs (`SECURITY DEFINER`, `search_path` fixado), conferidas pelo contrato em
  `src/lib/rpc-contrato.js`. Modelo em [docs/banco-de-dados.md](docs/banco-de-dados.md).
- **Cálculo pesado em Python** (`python/monitora/`), rodando no GitHub Actions: triagem,
  classificação, leitura dos arquivos dos candidatos, conferências e contratação dos aprovados. O
  banco guarda o resultado e valida; os robôs são disparados pelo `pg_cron` ou pela tela
  ([docs/python-no-monitora.md](docs/python-no-monitora.md),
  [docs/agenda-dos-robos.md](docs/agenda-dos-robos.md)).
- **Robô da Empregare** (carga de inscritos) e sincronização das planilhas de seleção e
  entrevistas, também no Actions ([docs/robo-empregare.md](docs/robo-empregare.md)). Editais com
  **inscrições congeladas** ficam fora da carga e da triagem.
- **Apps Script** (`apps-script/`): código das planilhas de análise da Saúde Indígena (e das de
  Projetos e SEDE que ainda existem), colado no Google ([apps-script/LEIA-ME.md](apps-script/LEIA-ME.md)).
- **Servidor opcional:** `server/servidor.ts` (Node 24, sem dependências) serve o mesmo `dist/`
  em container, com os cabeçalhos do `vercel.json` ([docs/servidor.md](docs/servidor.md)).

## Mapa de pastas

```text
index.html            raiz da página: <head>, tela de acesso e skeleton (a casca é src/app/casca/)
src/app/              base do app React: entrada, sessão, layout, montagem dos módulos
src/modulos/          telas em React/TypeScript, uma pasta por tela
src/componentes/      componentes compartilhados entre telas
src/ui/               design system (Topo, Filtros, Kpi, Tabela, Gaveta, Modal…)
src/lib/              lógica pura e testável (regras, contratos, formatos)
src/modules/          LEGADO em JavaScript: só encolhe
src/styles/           CSS do app
api/                  funções serverless da Vercel
server/               servidor web em TypeScript (container)
python/monitora/      cálculo em lote (Python) executado no GitHub Actions
scripts/              checagens do CI, robôs em Node, geradores e utilitários de banco
supabase/migrations/  mudanças de schema (código do banco)
supabase/ensaios/     ensaio de cada migration (begin; … rollback;)
supabase/rollback/    reversão de cada migration
supabase/correcoes/   SQL de dados de uso único
apps-script/          código das planilhas do Google
tests/                Vitest, Playwright e pytest
public/               ícones e dados geográficos estáticos (gerados por scripts/)
docs/                 arquitetura, banco, robôs, decisões e base da Aya
.github/workflows/    CI e robôs agendados
```

Cada pasta relevante tem um `CLAUDE.md` com o mapa detalhado e as regras para mexer nela.

## Rodar localmente

**Requisitos:** Git e Node.js **24** (com npm). Python 3.12 só para os robôs e os testes Python;
Docker só para o container.

```bash
git clone https://github.com/AgSUS-COGIP/agsus-monitora.git
cd agsus-monitora
npm ci
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
```

Variáveis do `.env.local` (os valores vêm de quem administra o ambiente e nunca vão para o
repositório):

| Variável                         | Uso                                                                       |
| -------------------------------- | ------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`              | endereço do projeto Supabase                                              |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | chave **publicável** do Supabase (vai para o navegador)                   |
| `GOOGLE_APPLICATION_CREDENTIALS` | opcional: caminho do JSON da conta de serviço, só para cargas de planilha |
| `PORT`, `HOST`, `DIST`           | opcionais: porta, interface e pasta servidas pelo `server/servidor.ts`    |

Tudo que começa com `VITE_` vai para o navegador: **nunca** coloque ali a chave `service_role`.

| Comando                        | Endereço              | Para quê                                              |
| ------------------------------ | --------------------- | ----------------------------------------------------- |
| `npm run dev:frontend`         | http://localhost:5173 | editar telas, com recarga instantânea                 |
| `npm run dev`                  | http://127.0.0.1:8000 | build em watch + servidor TypeScript (F5 após editar) |
| `npm run build` e `npm start`  | http://127.0.0.1:8000 | conferir o build de produção, com todas as checagens  |
| `docker compose up --build -d` | http://127.0.0.1:8000 | container (lê o `.env` da raiz, não o `.env.local`)   |

O login volta para `<endereço>/auth/callback.html`, que precisa estar nas **Redirect URLs** do
Supabase. As rotas `/api/*` só existem na Vercel; localmente respondem 404.

## Qualidade e CI

```bash
npm run typecheck                        # tsc do front e do servidor
npm run lint && npm run format:check     # ESLint e Prettier nos arquivos alterados
npm run check:architecture               # regras de arquitetura (veja abaixo)
npm test                                 # Vitest (rede bloqueada)
npm run test:smoke                       # smoke no navegador (Playwright)
python -m pip install -r python/requirements-dev.txt -r scripts/robo-empregare/requirements.txt
python -m pytest && python -m ruff check . && python -m ruff format --check .
```

Todo Pull Request para `main` roda `.github/workflows/build-and-smoke.yml`:

- **Arquitetura, qualidade, build e smoke** (obrigatório): auth, contrato de RPC, sem
  `MutationObserver` novo, sem camadas de remendo, legado só encolhe; lint e formatação; Vitest
  com cobertura; `npm run build` (inclui `typecheck`, segurança do HTML e orçamento de bundles);
  smoke no Playwright, no servidor TypeScript e na imagem Docker.
- **Python:** Ruff (lint e formatação) e pytest.
- **Contrato de RPC contra o banco de desenvolvimento**, quando o segredo existe.

**Limitações conhecidas:** os testes de banco são **estáticos** (leem o texto das migrations,
rollbacks e ensaios); o CI não sobe um PostgreSQL nem executa as migrations. O comportamento no
banco é conferido pelo ensaio antes de aplicar. A cobertura mínima configurada é baixa e não
comprova cobertura dos fluxos críticos.

## Banco e migrations

Toda mudança de schema é composta por três arquivos com o mesmo nome:

1. `supabase/migrations/AAAAMMDDHHMMSS_descricao.sql`: a mudança;
2. `supabase/ensaios/…`: a mesma mudança dentro de `begin; … rollback;`, com as conferências;
3. `supabase/rollback/…`: como desfazer.

A aplicação é **manual** (SQL Editor ou `psql`), feita por quem opera o banco depois da aprovação
do PR, e fica registrada em `public.migracoes_aplicadas` (caminho + sha256; `npm run db:estado`
mostra o que falta). **Não se usa `supabase db push`.** Migration aplicada não se edita: cria-se
outra. `supabase/migrations-historicas/` (já aplicadas) e `supabase/descartadas/` (nunca aplicar)
ficam só como registro.

- Nomes no Padrão Institucional de Nomenclatura da AgSUS (MAD/PDTIC 2026–2027: `TB_`, `TA_`,
  `TH_`, `RL_`, `TL_`, colunas com prefixo tipológico, `COMMENT ON` em tudo).
- Mudou uma RPC → atualize `src/lib/rpc-contrato.js` (o build confere).

Processo completo em [supabase/migrations/README.md](supabase/migrations/README.md).

## Segurança

- **Acesso só por convite:** login com Google em conta do domínio institucional; conta nova entra
  por convite ou por solicitação aprovada por um administrador, que define grupo e permissões.
- **RLS ligada em todas as tabelas**; o navegador só chama RPCs. Funções `SECURITY DEFINER` com
  `search_path` fixado.
- **Nenhum segredo no repositório** (`.env*` no `.gitignore`). O repositório é público: secret
  scanning com push protection, CodeQL e Dependabot estão ligados, e os robôs só imprimem
  contagens e códigos nos logs (`python/monitora/mascaramento.py`).
- **Chaves só em secrets:** a chave `service_role` e as credenciais dos robôs ficam nos segredos
  do GitHub Actions; o token que dispara os robôs fica no Vault do Supabase. Na Vercel, só as
  variáveis `VITE_*` públicas.
- `main` protegida: só entra por Pull Request com o check "Arquitetura, qualidade, build e smoke"
  verde.
- Cabeçalhos de segurança (HSTS, CSP, etc.) no `vercel.json`, usados também pelo servidor
  TypeScript.

## Operação

- **Correções de dados em massa:** antes de limpezas ou correções, exporte o que vai mudar.
- **Logs:** os logs operacionais têm rotinas de limpeza para não estourar a cota; a última
  execução de cada carga é preservada.
- **Monitoramento:** **Configurações → Status das atualizações** mostra a última execução e o
  atraso de cada carga e robô; as **Conferências** geram avisos diários; disparos sem resposta do
  GitHub são sinalizados pelo banco.

## Publicar

- O merge em `main` publica em produção na Vercel. As outras branches não geram prévia
  (`ignoreCommand` no `vercel.json`); o que depende de `/api` só é testado depois do merge.
- Migrations são aplicadas **antes** do merge quando o front novo depende delas, e **depois** da
  publicação quando removem algo que o front atual ainda usa.
- Cada build publica `/versao.json`; quem está com o sistema aberto vê a faixa "Há uma versão nova
  do MONITORA" (`src/app/aviso-de-versao.ts`). Mudanças visíveis para quem usa entram no topo de
  `NOVIDADES` em `src/lib/novidades.ts`, no mesmo PR.

**Checklist:** CI verde; migrations ensaiadas, aplicadas na ordem certa e registradas; login e
solicitação de acesso funcionando; telas afetadas conferidas na versão publicada; nenhum segredo
no diff; novidade registrada quando muda algo para quem usa.

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
