# MONITORA

Aplicação de monitoramento dos processos seletivos da AgSUS, separada por **área** (Saúde
Indígena, SEDE e Projetos): mapas da saúde indígena, editais e cronogramas, análises
curriculares, seleção, entrevistas, recursos e lista de aprovados. O cliente é compilado pelo
Vite (telas novas em React, o restante em JavaScript modular); os dados e a autenticação ficam no
Supabase; um servidor web pequeno, em TypeScript, entrega as páginas. Detalhes do servidor:
[docs/servidor.md](docs/servidor.md).

## Stack

- Vite 7 + React 19 (`src/modulos/`, `src/app/`, `src/ui/` e componentes compartilhados em
  `src/componentes/`) e JavaScript modular legado (`src/modules/`), HTML e CSS
- Supabase: Postgres com RLS, RPCs, login Google e rotinas agendadas (`pg_cron`)
- Funções serverless na Vercel (`api/`): Node e uma em Python (`anexos-do-edital.py`, que lê o
  PDF de anexos do edital com pdfplumber; dependências em `requirements.txt`)
- Apps Script nas planilhas do Google, que enviam análises, seleção e entrevistas ao Supabase
  (`apps-script/`)
- Servidor web em TypeScript (`server/servidor.ts`), rodando direto no Node 24, sem dependências;
  a Vercel continua como caminho estático
- Python nos jobs da Empregare, conferências e pré-classificação, com biblioteca comum em
  `python/monitora/`; guia em [docs/python-no-monitora.md](docs/python-no-monitora.md)
- Vitest e Playwright nos testes do front; Ruff e pytest nas verificações de Python

## Áreas e módulos

Cada edital pertence a uma área, e cada pessoa vê só as áreas e os módulos que o seu grupo de
acesso libera. O menu lateral mostra, por área, as abas ativas (catálogo em `TB_ABA`, ligado à
área em `RL_ABA_AREA`). Módulos e abas podem ser desligados ou postos em manutenção em
**Configurações → Módulos e abas**, sem deploy.

| Módulo               | Onde                                               | O que faz                                                                                                 |
| -------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Visão geral e mapas  | `index.html`                                       | terras indígenas, DSEIs e editais no mapa                                                                 |
| Editais              | `index.html` (`src/modulos/editais/`)              | cadastro do edital e do cronograma; importa cronograma e quadro de vagas do PDF de anexos                 |
| Cronograma           | `index.html` (`src/modulos/cronograma/`)           | calendário das etapas de todos os editais                                                                 |
| Análises             | `index.html` (`src/modulos/analises/`)             | análises curriculares vindas das planilhas: filtros, KPIs, gráficos, pendências, fila e gaveta de detalhe |
| Seleção              | `index.html` (`src/modulos/selecao/`)              | funil por vaga (inscritos, aptos, eliminados)                                                             |
| Entrevistas          | `index.html` (`src/modulos/entrevistas/`)          | resultados, condução (roteiro, convocação, banca, notas) e roteiros                                       |
| Recursos             | `index.html` (`src/modulos/recursos/`)             | recursos dos candidatos: fila, gaveta com etapas, resposta e anexos                                       |
| Avaliação documental | `index.html` (`src/modulos/avaliacao-documental/`) | regra, equipe, pré-classificação e fila de fichas                                                         |
| Classificação        | `index.html` (`src/modulos/classificacao/`)        | regras por edital, listas, sorteio, exportação e publicação na Lista de aprovados                         |
| Lista de aprovados   | `index.html` (`src/modulos/aprovados/`)            | aprovados e convocação                                                                                    |
| Mensagens            | cabeçalho (`src/modulos/chat/`)                    | conversas, anexos, respostas, menções, busca e compartilhamento de telas e fichas                         |
| Aya                  | painel lateral (`src/modulos/aya/`)                | assistência e orientação contextual com a base de `docs/aya/`                                             |
| Acessos              | `index.html` (`src/modulos/acessos/`)              | convites, grupos, contas desativadas e reativação                                                         |

Em **Conduzir entrevistas** aparecem só os editais na janela da entrevista pelo cronograma (de 7
dias antes a 15 dias depois das etapas de entrevista), os liberados pelo administrador global e os
que ainda têm convocado sem parecer.

## Abrir o projeto

### 1. Requisitos

| Ferramenta | Versão                  | Para quê                                            |
| ---------- | ----------------------- | --------------------------------------------------- |
| Git        | qualquer recente        | clonar                                              |
| Node.js    | **24**                  | obrigatório em todos os caminhos                    |
| npm        | o que vem com o Node 24 | dependências                                        |
| Docker     | com Compose             | só para o caminho D (container)                     |
| Python     | 3.12 com `pdfplumber`   | só para testar `api/anexos-do-edital.py` na máquina |

O Node 24 executa o servidor TypeScript direto, sem etapa de compilação. Não há PHP nem Composer.
O Python não é preciso para abrir o frontend e o servidor estático. Para as funções e os jobs,
instale as dependências do componente correspondente; a Vercel instala o `requirements.txt` da
raiz no deploy das funções. Consulte [docs/python-no-monitora.md](docs/python-no-monitora.md).

### 2. Clonar e instalar

```bash
git clone https://github.com/AgSUS-COGIP/agsus-monitora.git
cd agsus-monitora
npm ci
```

Use `npm ci` em vez de `npm install`: ele instala exatamente o que está no `package-lock.json`.

### 3. Configurar o Supabase

Copie o modelo e preencha a chave publicável:

```powershell
# PowerShell
Copy-Item .env.example .env.local
```

```bash
# Bash
cp .env.example .env.local
```

```bash
VITE_SUPABASE_URL=https://gnudtaxhjfgtvwkwpsel.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=cole_aqui_a_chave_publicavel_do_supabase
```

A chave publicável fica no painel do Supabase, em **Project Settings → API Keys**. Peça a quem
administra o projeto, se você não tiver acesso. `VITE_SUPABASE_ANON_KEY` ainda é aceita como
alternativa, mas use `VITE_SUPABASE_PUBLISHABLE_KEY` em ambiente novo.

**Nunca** use a chave `service_role` / secreta: tudo que começa com `VITE_` vai para o navegador.
Os arquivos `.env` e `.env.*` já estão no `.gitignore`.

Sem essas variáveis, o sistema abre, mas informa que a conexão com o Supabase não está configurada.

### 4. Rodar

Escolha o caminho conforme o que você vai fazer:

| Caminho                              | Comando                              | Endereço              | Quando usar                                                                    |
| ------------------------------------ | ------------------------------------ | --------------------- | ------------------------------------------------------------------------------ |
| **A. Tela, com recarga instantânea** | `npm run dev:frontend`               | http://localhost:5173 | editar tela, CSS ou módulo JS; o navegador atualiza sozinho                    |
| **B. Front + servidor juntos**       | `npm run dev`                        | http://127.0.0.1:8000 | ver a mudança no servidor de produção, com os cabeçalhos reais; F5 após editar |
| **C. Build de produção**             | `npm run build` e depois `npm start` | http://127.0.0.1:8000 | conferir exatamente o que vai para produção, com todas as checagens            |
| **D. Docker**                        | `docker compose up --build -d`       | http://127.0.0.1:8000 | subir como em produção, isolado da máquina                                     |

As páginas existem em todos os caminhos: `/` (painel principal) e `/auth/callback.html` (retorno
do login).

As rotas `/api/*` (AYA, proxies da FUNAI e leitura do PDF de anexos) **só existem na Vercel**.
Nos caminhos A a D elas respondem 404, e a tela avisa que o recurso só funciona na versão
publicada.

Observações sobre cada caminho:

- **A** usa o servidor do Vite, e não o servidor do MONITORA: não tem os cabeçalhos de segurança
  de produção. Ele escuta em `0.0.0.0`, então outros aparelhos da mesma rede alcançam a máquina
  pelo IP dela, o que é útil para testar no celular.
- **B** roda `vite build --watch` e `server/servidor.ts` no mesmo terminal. A cada edição o front
  recompila em segundos e o servidor já entrega a versão nova: é só dar F5. Não roda as checagens
  do build. `Ctrl+C` encerra os dois.
- **C:** o `npm run build` roda antes as checagens (tipos do servidor, auth, contrato de RPC,
  segurança do HTML, orçamento de bundles). Se uma falhar, o build para e diz qual regra foi violada.
  O `npm start` só serve o `dist/` que já existe.
- **D:** o Compose lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do arquivo **`.env`** da
  raiz, e **não** do `.env.local`. As variáveis entram no build da imagem: depois de mudar o código
  ou o `.env`, rode o mesmo comando de novo. Para encerrar: `docker compose down`.

B, C e D usam a mesma porta, 8000: rode um de cada vez.

### 5. Entrar no sistema

O login é com Google. Depois de autenticar, o Google devolve para `<endereço atual>/auth/callback.html`,
e esse endereço precisa estar autorizado no Supabase, em **Authentication → URL Configuration →
Redirect URLs** (por exemplo, `http://localhost:5173/auth/callback.html`). Se o login cair em outro
endereço ou der erro de redirect, peça a quem administra o Supabase para incluir o endereço local.

Conta sem perfil entra no fluxo de **solicitação de acesso**. Um administrador precisa aprovar e
configurar as permissões antes de a pessoa ver os painéis.

## Build e implantação

### O que o `npm run build` faz

Sete etapas, em ordem. Se qualquer uma falhar, o build para e a mensagem diz qual regra foi violada:
corrija o código, não a checagem.

| #   | Etapa                       | Script                    | O que barra                                                                            |
| --- | --------------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Base de conhecimento da AYA | `aya:conhecimento`        | gera `src/modules/aya-conhecimento-gerado.js` a partir de `docs/aya/*.md`              |
| 2   | Tipos do servidor           | `typecheck`               | erro de tipo em `server/*.ts`                                                          |
| 3   | Arquitetura de autenticação | `check:auth-architecture` | cliente Supabase criado fora de `src/lib/supabaseClient.js`, fluxo OAuth implícito     |
| 4   | Contrato de RPC             | `check:rpc-contract`      | `.rpc("nome")` que não está em `src/lib/rpc-contrato.js`, ou RPC declarada e não usada |
| 5   | Compilação                  | `vite build`              | erro de sintaxe ou de import; gera o `dist/`                                           |
| 6   | Segurança do HTML           | `check:dist-security`     | Supabase por CDN, recurso `http://` inseguro no HTML gerado                            |
| 7   | Orçamento de bundles        | `check:bundle-size`       | JS ou CSS acima do limite (maior JS: 2.500 KB bruto / 700 KB gzip)                     |

Leva poucos segundos. Os limites do orçamento podem ser ajustados por variável de ambiente
(`BUNDLE_MAX_*`), mas subir o limite exige justificativa no PR.

### O que sai em `dist/`

```text
dist/
├── index.html,
│   auth/callback.html   as páginas (entradas do Vite)
├── assets/          JS e CSS com hash no nome + tudo de public/assets/
├── data/            JSON geográfico de public/data/ (terras indígenas)
├── icons/, manifest.webmanifest, offline.html, sw.js, sw-policy.js   PWA
```

- O JS é dividido por página (`main`) e pacotes de terceiros (`vendor-supabase`,
  `vendor-react`, `vendor-charts` e `vendor`), definidos em `vite.config.js`.
- **Tudo em `public/` é copiado como está e fica público.** Não coloque ali nada que não possa ser
  baixado por qualquer pessoa.
- **As variáveis `VITE_*` ficam gravadas no JS gerado.** Mudou o `.env`, precisa de novo build.
  Por isso nunca use chave secreta num `VITE_*`.
- Os dados de `public/data/` **não** são regenerados
  pelo build. Se a fonte mudou, rode antes o script correspondente (`scripts/CLAUDE.md`).

### Servir o build

| Comando           | O que faz                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm start`       | serve o `dist/` existente com `server/servidor.ts`, em http://127.0.0.1:8000, com os cabeçalhos de produção |
| `npm run preview` | serve o `dist/` com o servidor do Vite, em http://localhost:4173, sem os cabeçalhos de produção             |

Variáveis do servidor: `PORT` (padrão 8000), `HOST` (padrão 127.0.0.1) e `DIST` (padrão `dist`).
Detalhes em [docs/servidor.md](docs/servidor.md).

### Implantar

**Vercel (estático).** Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em
**Project Settings → Environment Variables** (`VITE_SUPABASE_ANON_KEY` é aceita como alternativa).
O `vercel.json` só builda a branch `main` (`ignoreCommand`): **todo push em `main` vai para produção.**
A Vercel serve o `dist/` e as funções de `api/`, sem usar o `server/servidor.ts`, mas com os mesmos
cabeçalhos de segurança: o servidor os lê do próprio `vercel.json`. Depois de alterar variáveis,
faça um novo deploy. Como só a `main` é publicada, **não há preview por branch**: o que depende de
`/api` (como a leitura do PDF de anexos) só pode ser testado depois do merge.

**Container.** O `Dockerfile` roda o `npm run build` completo (com as sete etapas) e entrega uma
imagem só com `dist/`, `server/` e Node 24, sem `node_modules` e rodando como usuário sem privilégio:

```bash
docker build --build-arg VITE_SUPABASE_URL --build-arg VITE_SUPABASE_PUBLISHABLE_KEY -t monitora .
docker run -d -p 8000:8000 monitora
```

A imagem tem `HEALTHCHECK` em `/up`. Em produção, coloque um proxy HTTPS na frente e preserve o
domínio atual, para manter os endereços de retorno do login já autorizados.

**CI.** Todo Pull Request para `main` roda `.github/workflows/build-and-smoke.yml`: checagens de
arquitetura, lint, formatação, testes com cobertura, build, smoke no navegador, smoke contra o
servidor TypeScript e contra a imagem Docker. O job Python executa Ruff (lint e formatação) e
pytest. O contrato de RPC também é conferido contra o banco de desenvolvimento quando o segredo
`SUPABASE_DB_URL_DEV` está configurado; sem ele, essa verificação é ignorada, e a checagem estática
continua no build. O mínimo de cobertura configurado hoje é 1% para linhas, funções, instruções
e ramos; isso não comprova cobertura dos fluxos críticos.

## Problemas comuns

| Sintoma                                                          | Causa e solução                                                                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EADDRINUSE ... 8000` ao rodar `npm run dev` ou `npm start`      | A porta 8000 já está ocupada, em geral pelo container do caminho D. Rode `docker compose down` ou use outra porta: `PORT=8001 npm start`.                                          |
| A tela avisa que a conexão não está configurada                  | Falta `.env.local` (caminhos A/B/C) ou `.env` (caminho D) com as variáveis `VITE_SUPABASE_*`. Depois de criar, reinicie o comando.                                                 |
| O login volta para o endereço de produção ou dá erro de redirect | O endereço local não está nas Redirect URLs do Supabase (passo 5).                                                                                                                 |
| O Vite abriu em `5174` (ou outra porta) em vez de `5173`         | Há outra instância aberta, e o Vite pulou para a porta seguinte. Feche a outra: o login só volta para endereços autorizados no Supabase, e a porta nova pode não estar entre eles. |
| O `npm run build` falha numa checagem `check:*`                  | É uma regra de arquitetura. A mensagem diz qual; corrija o código, não o script.                                                                                                   |
| O container sobe, mas a página vem sem dados                     | As variáveis `VITE_*` entram no **build** da imagem. Ajuste o `.env` e rode `docker compose up --build -d` de novo.                                                                |

## Comandos úteis

```bash
npx vitest run tests/<arquivo>.test.js   # um teste (o mais rápido)
npm test                                 # todos os testes unitários (Vitest)
npm run lint                             # lint dos arquivos alterados
npm run check:architecture               # checagens de arquitetura sem build
npm run test:smoke                       # smoke no navegador (Playwright)
npm run test:e2e                         # todos os testes de navegador
npm run typecheck                        # tipos do servidor TypeScript
npm run test:smoke:servidor              # smoke no navegador contra o servidor TypeScript
python -m pip install -r python/requirements-dev.txt -r scripts/robo-empregare/requirements.txt
python -m pytest                         # testes Python (funções, jobs e regras)
python -m ruff check .                    # lint Python
python -m ruff format --check .           # formatação Python
```

Os testes unitários **bloqueiam a rede** (`tests/setup/rede-bloqueada.js`). Eles nunca falam com o
Supabase de verdade, mesmo com o `.env.local` preenchido.

## Estrutura

```text
.
├── index.html              painel principal
├── auth/callback.html      retorno do login
├── DESIGN.md               guia de interface (tokens, componentes, contraste)
├── src/
│   ├── main.js             entrada do painel principal
│   ├── lib/                lógica pura e testável
│   ├── app/                sessão, navegação, carga, configuração e montagem dos módulos
│   ├── ui/                 componentes visuais compartilhados
│   ├── componentes/        peças compartilhadas (barra lateral, busca global, pessoas online)
│   ├── modules/            funcionalidades de tela legadas, um arquivo por feature
│   ├── styles/             CSS do painel principal
│   ├── modulos/            telas e recursos React, uma pasta por módulo
│   ├── legado/             reservado à migração; hoje contém apenas README
│   └── auth/               callback do login
├── api/                    funções serverless da Vercel (AYA, proxies FUNAI, anexos do edital em Python)
├── requirements.txt        dependências das funções Python da Vercel
├── python/                 biblioteca comum dos jobs e regras Python
├── apps-script/            scripts das planilhas (saude-indigena/, sede/, projetos/); ver LEIA-ME.md
├── public/                 imagens e dados geográficos (gerados por scripts)
├── supabase/
│   ├── migrations/         mudanças de schema, versionadas
│   ├── rollback/           como desfazer cada migration (mesmo nome)
│   └── correcoes/          correções pontuais de dados
├── server/servidor.ts      servidor web (TypeScript)
├── scripts/                checagens do build e ferramentas
├── tests/                  Vitest (*.test.js), Playwright (*.spec.js), testes Python e fixtures compartilhadas
└── docs/                   decisões técnicas e auditorias
```

Cada pasta principal tem um `CLAUDE.md` com o mapa daquela área e as regras dela. Vale ler antes de
mexer, mesmo sem usar IA.

## Supabase

Mudanças de schema ficam em `supabase/migrations/`, com nome `AAAAMMDDHHMMSS_descricao.sql`. Nunca
edite uma migration já aplicada: crie outra. Cada migration nova vem com:

- o arquivo de desfazer em `supabase/rollback/`, com o mesmo nome;
- um ensaio antes de aplicar em produção (o SQL dentro de `begin; … rollback;`);
- o registro em `public.migracoes_aplicadas` (caminho e sha256 do arquivo), depois de aplicada;
- nomes no Padrão Institucional de Nomenclatura (`TB_`, `TA_`, `TH_`, `RL_`, `TL_`; colunas em
  maiúsculas com prefixo tipológico; `COMMENT ON` em tudo). Detalhes em `docs/banco-de-dados.md`.

Antes de alterar estrutura, permissões, autenticação ou regras de acesso, confira:

- quais tabelas e RPCs são afetadas (ao mudar uma RPC, atualize `src/lib/rpc-contrato.js`);
- quais perfis de usuário usam a funcionalidade;
- se há impacto em login, solicitação de acesso, aprovações ou painéis;
- se há políticas de RLS relacionadas.

Não coloque chaves secretas, tokens, senhas ou credenciais no repositório.

## Fluxo de trabalho

1. Criar uma branch a partir de `main`.
2. Implementar a alteração, com teste.
3. Rodar `npm run build` (inclui as sete etapas descritas em [Build e implantação](#build-e-implantação)).
4. Testar localmente (caminho A ou B): login, permissões, painéis e análises.
5. Se houver migration: ensaiar, revisar a compatibilidade com o frontend em produção e definir
   a ordem de aplicação e o rollback. Aplicar e registrar conforme essa sequência (seção [Supabase](#supabase)).
6. Abrir o Pull Request e esperar o CI.
7. Fazer o merge em `main` somente depois da validação: o merge publica em produção.

## Checklist antes de publicar em produção

- O build passou.
- `index.html` (com Análises curriculares, Entrevistas, Recursos e Seleção) abre corretamente.
- O login Google funciona para conta autorizada.
- Usuário sem perfil cai no fluxo de solicitação de acesso.
- As solicitações aparecem para a administração.
- O administrador consegue aprovar o usuário e configurar as permissões.
- As migrations novas foram aplicadas e registradas em `public.migracoes_aplicadas`.
- Os painéis externos que ainda restam carregam ou exibem mensagem clara de indisponibilidade.
- As variáveis do Supabase estão configuradas no ambiente correto.
- Nenhum segredo foi commitado.

## Entregar o projeto a outra coordenação

**Clonar** (recomendado): `git clone https://github.com/AgSUS-COGIP/agsus-monitora.git`. Depois, a
equipe segue a seção [Abrir o projeto](#abrir-o-projeto) e pede acesso à Vercel e ao Supabase.

**Baixar ZIP**: no GitHub, **Code → Download ZIP**, ou direto em
`https://github.com/AgSUS-COGIP/agsus-monitora/archive/refs/heads/main.zip` (exige acesso ao
repositório). O ZIP não leva variáveis de ambiente, credenciais, configuração da Vercel nem acesso
ao Supabase.

Junto com o código, conceda ou envie:

- acesso ao repositório no GitHub, ao projeto na Vercel e ao projeto no Supabase;
- as variáveis de ambiente usadas na Vercel;
- orientação sobre as contas autorizadas no login e as regras de aprovação de usuários;
- a lista de painéis externos usados pelo sistema;
- o histórico de decisões técnicas em `docs/arquitetura-evolucao.md`.

## Manutenção

- `main` é a branch de produção. Mudanças estruturais passam por Pull Request.
- Alterações no banco são versionadas em `supabase/migrations/`.
- Dados sensíveis e credenciais não vão para o GitHub.
- Prefira pequenas entregas validadas localmente e no CI. A configuração atual não publica
  previews por branch; registre a limitação dos fluxos que dependem de `/api/*`.
- Plano técnico de evolução: `docs/arquitetura-evolucao.md`. Padrão de interface: `DESIGN.md`.
