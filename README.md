# MONITORA

Sistema web da Agência Brasileira de Apoio à Gestão do SUS (AgSUS) para acompanhar os processos
seletivos, do edital à contratação: análise curricular (avaliação documental), classificação,
convocação, entrevistas, recursos, lista de aprovados e contratação, com painéis por área.

Cada edital pertence a uma **área** (Saúde Indígena, Projetos ou SEDE), e cada pessoa vê só as
áreas e os módulos que o seu grupo de acesso libera. Módulos e abas podem ser desligados ou postos
em manutenção em **Configurações → Módulos e abas**, sem deploy.

**Documentação:** comece pelo [CLAUDE.md](CLAUDE.md), o índice das notas de
[`docs/biblioteca/`](docs/biblioteca/).

## Módulos

| Módulo                  | O que faz                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Visão geral e mapas     | editais, terras indígenas, DSEIs e mapa de Projetos                                                                                                                                        |
| Cronograma              | calendário das etapas dos editais, nas vistas Mês, Semana e Lista, com a legenda como filtro de tipo                                                                                       |
| Editais                 | cadastro do edital e do cronograma (importa cronograma e quadro de vagas do PDF de anexos) e **Regras do edital**: uma página por edital com as regras de cada etapa, na ordem do processo |
| Seleção                 | funil por vaga (inscritos, aptos, eliminados)                                                                                                                                              |
| Triagem                 | regras próprias por edital e abas Resumo, Por vaga, Eliminados e Listas oficiais                                                                                                           |
| Avaliação documental    | análise curricular no sistema: equipe, lote, fila de fichas, documentos, pendências, espelho de nota em PDF/ZIP, relatório de motivos e reabertura                                         |
| Painel das análises     | leitura das análises (fichas publicadas e planilhas legadas): filtros, indicadores, ritmo da análise, nota declarada × após a análise                                                      |
| Recursos                | recursos dos candidatos: fila, etapas, parecer, resposta com modelos, anexos e ajuste de pontuação                                                                                         |
| Entrevistas             | painel de resultados e condução (roteiro, convocação, banca, notas e parecer)                                                                                                              |
| Classificação           | listas, desempate e sorteio, agenda das entrevistas, exportação (XLSX, SEI/DOCX) e publicação na Lista de aprovados                                                                        |
| Lista de aprovados      | aprovados, convocação, cartas de convocação e acompanhamento da contratação                                                                                                                |
| Conferências            | avisos diários de inconsistência entre análises, entrevistas, classificação, aprovados e cargas                                                                                            |
| Aya                     | assistente lateral com base de conhecimento local (`docs/aya/`), sem IA externa; abre chamado ao suporte por e-mail                                                                        |
| Acessos e Configurações | convites, solicitações de acesso, grupos, coordenações, contas desativadas; marca, painéis externos, módulos e abas, status das atualizações e robôs                                       |

Os editais novos são analisados no próprio sistema (Avaliação documental → fichas publicadas no
Painel das análises). As planilhas do Google com Apps Script (`apps-script/`) seguem só para
editais antigos e áreas que ainda as usam.

O menu é o mesmo em todas as áreas: **Acompanhar** (Visão geral, painéis e Cronograma),
**Processo seletivo** na ordem do fluxo (Editais, Triagem, Avaliação documental, Recursos,
Entrevistas, Classificação, Lista de aprovados) e **Administração** (Aparência, Pessoas e acessos,
Sistema). A área e a tela ficam no endereço (`/saude-indigena/cronograma`,
`/sede/classificacao/<edital>`, `/administracao/configuracoes/<seção>`), com voltar, avançar e F5
funcionando e link que se compartilha.

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

## Rodar localmente

Requisitos: Git e Node.js **24**; Python 3.12 só para os robôs e os testes Python.

```bash
git clone https://github.com/AgSUS-COGIP/agsus-monitora.git
cd agsus-monitora
npm ci
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev:frontend         # http://localhost:5173
```

Variáveis, outros modos de rodar (servidor TypeScript, Docker) e os comandos de teste e qualidade:
[docs/biblioteca/comandos-e-ambiente.md](docs/biblioteca/comandos-e-ambiente.md).

## Documentação

A documentação é um vault do Obsidian com a raiz do repositório como vault. O ponto de entrada é o
**[CLAUDE.md](CLAUDE.md)**: o projeto em poucas linhas, as regras que não podem faltar e o índice
das notas de [`docs/biblioteca/`](docs/biblioteca/), uma por assunto. Para abrir no Obsidian:
"Open folder as vault" na pasta do repositório (veja
[docs/biblioteca/documentacao.md](docs/biblioteca/documentacao.md)).

| Assunto                         | Nota                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arquitetura do front            | [arquitetura-do-front](docs/biblioteca/arquitetura-do-front.md), [nova-tela-react](docs/biblioteca/nova-tela-react.md)                                       |
| Banco, migrations e RPCs        | [banco-e-migrations](docs/biblioteca/banco-e-migrations.md), [rpc-e-contrato](docs/biblioteca/rpc-e-contrato.md)                                             |
| Segurança                       | [seguranca](docs/biblioteca/seguranca.md), [dados-pessoais](docs/biblioteca/dados-pessoais.md)                                                               |
| Qualidade e CI                  | [ci-e-qualidade](docs/biblioteca/ci-e-qualidade.md), [testes](docs/biblioteca/testes.md)                                                                     |
| Publicar e operar               | [deploy-e-vercel](docs/biblioteca/deploy-e-vercel.md), [robos-e-agenda](docs/biblioteca/robos-e-agenda.md), [python-e-jobs](docs/biblioteca/python-e-jobs.md) |
| Interface                       | [DESIGN.md](DESIGN.md), [design-e-tokens](docs/biblioteca/design-e-tokens.md)                                                                                |
