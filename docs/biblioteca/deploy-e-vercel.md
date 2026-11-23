---
tipo: guia
area: operacao
atualizado: 2026-11-18
---

# Git, deploy e Vercel

`main` é produção. Toda mudança entra por branch e Pull Request, e **o merge em `main` publica**
na Vercel. O front é estático (`dist/` do Vite), com as funções serverless de `api/`; há também um
servidor opcional em container ([[servidor-web]]).

## Branch e PR

- **`main` protegida:** só entra por PR com o check "Arquitetura, qualidade, build e smoke" verde
  ([[ci-e-qualidade]]).
- **Português** em nomes de branch, commits e descrição do PR, como no código.
- Um assunto por PR. Trabalho em paralelo é comum: **não mova arquivos ou pastas em massa** sem
  combinar (gera conflito com quem trabalha ao lado; por isso a migração para `src/modulos/` é
  módulo a módulo e o legado não muda de pasta aos poucos).
- Duas PRs em paralelo já escolheram o mesmo horário de migration: confira o timestamp antes de
  abrir a PR (`npm run check:migrations`; [[banco-e-migrations]]).
- No mesmo PR da mudança: o contrato de RPC ([[rpc-e-contrato]]), o retrato
  `supabase/esquema-atual.sql` (depois de aplicar a migration), a novidade em
  `src/lib/base/novidades.ts` quando muda algo para quem usa (abaixo) e a nota da biblioteca do assunto
  ([[documentacao]]).
- Nenhum segredo no diff ([[seguranca]]); não commitar `.env`/`.env.local` nem `dist/`.
- Mudança confirmada pelo usuário → o legado que ela substituiu sai ([[nova-tela-e-legado]]).
- Bug corrigido ganha teste que falharia antes ([[testes]]).

## Do PR à produção

1. PR com o CI verde e revisão.
2. Migrations: aplicadas **antes** do merge quando o front novo depende delas, **depois** da
   publicação quando removem algo que o front atual ainda usa.
3. Merge em `main` → a Vercel publica. As outras branches não geram prévia: `git.deploymentEnabled`
   (`"**": false`, `"main": true`) nem cria a publicação, e o `ignoreCommand` fica como segunda
   proteção. O plano gratuito tem limite de publicações por dia, e a publicação cancelada pelo
   `ignoreCommand` foi criada (em 19/11/2026 o limite estourou e o `main` ficou dias sem publicar).
   O que depende de `/api` só é testado depois do merge, ou no `npm run dev:frontend` local.

**Checklist de publicação:** CI verde; migrations ensaiadas, aplicadas na ordem certa e
registradas; login e solicitação de acesso funcionando; telas afetadas conferidas na versão
publicada; nenhum segredo no diff; novidade registrada quando muda algo para quem usa.

## Endereços

- **`https://yeende.vercel.app`** é o endereço do sistema desde 12/11/2026 (o nome Yeendé).
- **`https://agsus-monitora.vercel.app`** continua no mesmo projeto e na mesma produção, sem
  redirecionar: os robôs, o Apps Script e os painéis externos chamam `/api/...` por ele. Passar a
  redirecionar só depois de trocar o endereço nesses clientes.
- O código não guarda o endereço: o login volta para a origem da página
  (`getOAuthCallbackUrl`, `src/lib/sessao/auth-flow.ts`) e as funções comparam a origem com o próprio
  host. Domínio novo pede só duas configurações: o domínio na Vercel (Settings › Domains) e a URL
  `/auth/callback.html` dele em Redirect URLs do Supabase Auth ([[seguranca]]).
- Sessão e preferências do navegador são por endereço: no domínio novo, cada pessoa entra de novo
  e começa com a Aya, o mapa e as colunas no padrão.

## Configuração da Vercel

- `vercel.json` guarda os cabeçalhos de segurança (também lidos pelo servidor), os `rewrites` que
  entregam o `index.html` nas rotas das telas e a configuração de cada função (`maxDuration`,
  `includeFiles`/`excludeFiles`).
- Variáveis: só as `VITE_*` públicas e as das funções (`EDITAIS_API_CHAVE`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SIGEPSI_API_TOKEN`, que nunca vão para o front). A antiga
  `GITHUB_DISPATCH_TOKEN` pode ser apagada: o disparo dos robôs passou para o banco
  ([[robos-e-agenda]]).

## Funções (`api/`)

Cada arquivo de `api/` é um endpoint `/api/<nome>`; o que começa com `_` não é rota (a Vercel o
ignora). As rotas existem na Vercel e, as em TypeScript, também no `npm run dev:frontend`
(`scripts/servir-api-no-vite.mjs` carrega `api/<nome>.ts` pelo Vite, com as variáveis do
`.env.local`); o `server/servidor.ts` não as tem (404). As em Python (`.py`) só rodam na Vercel. A
Aya responde no navegador; o endpoint de IA e o bridge local foram retirados.

- `funai-geodata.ts` e `funai-wms.ts` — proxies do GeoServer OWS e do WMS da FUNAI (polígonos de
  terras indígenas, camada `Funai:tis_poligonais`; [[mapas-e-leaflet]]).
- `anexos-do-edital.py` — Python (pdfplumber): lê o PDF de anexos do edital e devolve cronograma
  (Anexo I) e quadro de vagas (Anexo II) em JSON; não grava nada. Quem usa:
  `src/lib/editais/anexos-do-edital.ts`. Com `?tipo=retificacao`, lê a retificação do cronograma (nº,
  edital, SEI, assinatura, "Onde se lê" e "Leia-se", com as linhas em negrito e os avisos das
  datas); quem usa: `src/lib/cronograma/retificacao-do-cronograma.ts` (tela
  `src/modulos/editais/lancar-retificacao.tsx`). Só usuário logado: Bearer conferido em
  `/auth/v1/user` (sem token ou token recusado → 401; Auth fora do ar, lento ou variável faltando →
  503, para quem está logado não ler "entre no MONITORA").
- `editais.ts`, `aprovados.ts`, `cronograma.ts` — **API para outro sistema, sem login**: o outro
  sistema manda `Bearer <EDITAIS_API_CHAVE>` (chave fixa, a mesma nas três) e a função lê o banco
  com `SUPABASE_SERVICE_ROLE_KEY`. A parte comum (chave em tempo constante, chamada à RPC, erros)
  fica em `_rota-com-chave.ts`.
  - `/api/editais`: `listar_editais_da_api` (migration `20261105170000`; unidade, edital, status,
    etapa, vagas, contratados, ociosas, risco, link e área; sem anexos), formato em
    `src/lib/editais/editais-da-api.ts`.
  - `/api/aprovados` e `/api/cronograma`: `listar_aprovados_da_api` e `listar_cronograma_da_api` (só
    `service_role`; migration `20261105150000`), formato em
    `src/lib/aprovados/aprovados-e-cronograma-da-api.ts`. Aprovados tem dados pessoais (nome, matrícula;
    [[dados-pessoais]]).
  - As três trazem `area` (Saúde Indígena, SEDE, Projetos; migration `20261105190000`) e aceitam
    `?area=`. Como o outro sistema usa: comentário do topo de cada rota.
- `dseis.ts` — **sede, polos base, CASAIs e unidades de lotação de cada DSEI, do SIGEPSI**, para o
  [[modulo-mapa-saude-indigena]]. Só para quem está logado (token da sessão conferido em
  `/auth/v1/user`); a função lê `https://sigepsi.agenciasus.org.br/api/mapa-dseis/localizacoes/todas`
  com `Bearer <SIGEPSI_API_TOKEN>`. Cada polo leva também o acesso da unidade (`meios`,
  `acessibilidade`, `localidade`, `floresta`, das colunas `TP_MEIO_ACESSO`,
  `TP_ACESSIBILIDADE_GEOGRAFICA`, `TP_CATEGORIA_LOCALIDADE` e `ST_FLORESTA`); auditoria (`AU_*`) e
  `DS_OBSERVACAO` não saem da função. Responde `{ dseis: { <chave>: { nome, polos, sede } },
casaisNacionais, lidoEm }` (a lista de DSEIs do mapa e as CASAIs nacionais, localizações 131 e 132) já agrupado por `chaveDoDsei`
  (`src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.ts`), guarda 10 min na instância e só em
  cache privado. Sem a variável: 500 com `faltam`; SIGEPSI recusando: 502 com `status_do_sigepsi`.
- `territorio-dos-dseis.ts` — **território e CNES dos DSEIs, do SIGEPSI**, para o
  [[modulo-mapa-saude-indigena]]. O mesmo molde de `dseis.ts` (só GET, sessão conferida em
  `/auth/v1/user`, `SIGEPSI_API_TOKEN` só no servidor). Lê duas rotas, cada uma por si:
  `territorio` (`/api/mapa-dseis/territorio`: população indígena, aldeias e terras de cada DSEI) e
  `cnes` (`/api/mapa-dseis/rede`). Responde 200 com `{ territorio, cnes, lidoEm }`, e cada fonte é
  `{ ok: true, dados, linhas, campos }` (`campos`: só os nomes dos campos, para o diagnóstico) ou
  `{ ok: false, status, motivo }` (401/403: "a chave do Yeendé não lê esta rota"). **Em
  19/11/2026 as duas respondem 401 ao token** (só aceitam sessão de usuário do SIGEPSI): falta a
  liberação da equipe do SIGEPSI. Nunca lê `/api/mapa-dseis` (força de trabalho, dado pessoal) e
  só repassa os campos que `src/lib/mapas/mapa-saude-indigena/territorio-do-sigepsi.ts` copia.
  Fonte lida fica 10 min na instância; negada, 1 min. O acesso das unidades não passa por aqui:
  vem da `/localizacoes/todas`, em `dseis.ts`.

### Regras das funções

- Os dois proxies validam a origem com `src/lib/seguranca/origem-da-requisicao.ts` (`origemDeTerceiro`). Não
  remover: sem isso o endpoint vira proxy aberto.
- Não expor chave ou URL interna na resposta. Segredo vem de variável de ambiente da Vercel.
- Código compartilhado com o front vem de `src/`; não duplicar lógica aqui.
- **Pacote enxuto** (plano Hobby, limite de "Function Storage"): toda função `api/*.py` leva no
  `vercel.json` o `excludeFiles` `{!(api)/**,.*/**,*,api/!(*.py)}` — sem ele a Vercel empacota o
  repositório inteiro. Se importar `python/monitora`, use `includeFiles` (vale mais que o
  `excludeFiles`). Dependências no `pyproject.toml` da raiz; Pillow e pypdfium2 ficam fora por
  `override-dependencies` (o pdfplumber só os usa em `to_image`, que não chamamos). Guarda:
  `tests/repositorio-e-banco.test.js` (bloco `funcoes-da-vercel-leves`).
- Limites do plano Hobby: `maxDuration: 30`, corpo de ~4,5 MB. O que pode demorar é job no GitHub
  Actions ([[python-e-jobs]]).
- Testes: `tests/repositorio-e-banco.test.js` (bloco `funai-geodata-proxy`), `tests/editais-cargas-e-paineis.test.js` (bloco `editais-api`),
  `tests/entrevistas-e-aprovados.test.js` (bloco `aprovados-e-cronograma-api`), `tests/demais-regras.test.ts` (bloco `lib/localizacoes-do-sigepsi`); em
  Python, `tests/python/test_anexos_do_edital.py` e `test_retificacao_do_cronograma.py` (PDFs
  sintéticos).

## Versão nova e novidades

- Cada build publica `/versao.json`. Quem está com o sistema aberto vê a faixa "Há uma versão nova
  do MONITORA" (`src/app/aviso-de-versao.ts`, componente `src/componentes/aviso-de-versao/`).
- **Mudança visível para quem usa entra no topo de `NOVIDADES` em `src/lib/base/novidades.ts`, no mesmo
  PR.** Entrada nova: `id` único (data + assunto), `data` (AAAA-MM-DD), `texto` curto, sem ponto
  final, em minúscula ("motivo padronizado na reabertura"), e `visivel: true` só quando a mudança
  importa para quem usa (correção interna fica `false`).
- O build copia as novidades com `visivel: true` para o `versao.json` (`vite.config.js`), e a
  página antiga lê de lá; o aviso mostra a mais recente que a versão aberta ainda não tem (sem
  nenhuma, só "Há uma versão nova").
- `src/lib/base/versao-do-sistema.ts` lê o `versao.json`, escolhe a novidade e dá o sinal de "tela
  antiga" (PGRST202 / "recarregue a página"). Tela sob demanda baixada com a versão velha recarrega
  uma vez (`importarComRecarga`); outro pedaço que não baixa (`vite:preloadError`) vira "Atualize
  para continuar". Com service worker, a aba aberta nem chega a isso: os pedaços da versão anterior
  ficam no cache ([[pwa-e-modo-offline]], "Aba aberta durante a publicação").

## Depois de publicar

- **Configurações → Status das atualizações** mostra a última execução e o atraso de cada carga e
  robô ([[robos-e-agenda]]); as **Conferências** geram avisos diários ([[modulo-conferencias]]);
  disparos sem resposta do GitHub são sinalizados pelo banco.
- Os logs operacionais têm rotinas de limpeza para não estourar a cota; a última execução de cada
  carga é preservada.

## Relacionadas

- [[ci-e-qualidade]] — o check obrigatório do PR
- [[banco-e-migrations]] — aplicar e registrar a migration na ordem certa
- [[comandos-e-ambiente]] — os comandos e conferir o build de produção na máquina
- [[servidor-web]] — o servidor em container, sem as rotas `/api`
- [[seguranca]] — chaves, origem e cabeçalhos
- [[modulo-editais]] — quem usa os anexos do edital
