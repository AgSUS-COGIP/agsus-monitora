# `api/` — funções serverless (Vercel)

Cada arquivo é um endpoint `/api/<nome>`; o que começa com `_` não é rota (a Vercel o ignora):

A Aya responde no navegador pela base de conhecimento (`src/lib/busca-da-aya.ts`);
o endpoint de IA e o bridge local foram retirados.

- `funai-geodata.js` — proxy do GeoServer OWS da FUNAI (polígonos de terras indígenas).
- `funai-wms.js` — proxy do WMS da FUNAI (camada `Funai:tis_poligonais`).
- `anexos-do-edital.py` — Python (pdfplumber, `pyproject.toml` na raiz): lê o PDF de anexos do
  edital e devolve cronograma (Anexo I) e quadro de vagas (Anexo II) em JSON. Só usuário logado
  (Bearer conferido em `/auth/v1/user`); não grava nada. Quem usa: `src/lib/anexos-do-edital.ts`.
  Com `?tipo=retificacao`, lê a retificação do cronograma (nº, edital, SEI, assinatura, "Onde se lê"
  e "Leia-se", com as linhas em negrito e os avisos das datas); quem usa:
  `src/lib/retificacao-do-cronograma.ts` (tela `src/modulos/editais/lancar-retificacao.tsx`).

- `editais.js`, `aprovados.js`, `cronograma.js` — API para outro sistema, **sem login**: o outro
  sistema manda `Bearer <EDITAIS_API_CHAVE>` (chave fixa, variável da Vercel, a mesma nas três) e a
  função lê o banco com `SUPABASE_SERVICE_ROLE_KEY`; as duas só existem na Vercel, nunca no front.
  A parte comum (chave em tempo constante, chamada à RPC, erros) fica em `_rota-com-chave.js`.
  - `/api/editais`: `listar_editais_da_api` (migration `20261105170000`; unidade, edital, status, etapa, vagas,
    contratados, ociosas, risco, link e área; sem anexos), formato em `src/lib/editais-da-api.js`.
  - `/api/aprovados` e `/api/cronograma`: `listar_aprovados_da_api` e `listar_cronograma_da_api`
    (só service_role; migration `20261105150000`), formato em
    `src/lib/aprovados-e-cronograma-da-api.js`. Aprovados tem dados pessoais (nome, matrícula).
  As três trazem `area` (Saúde Indígena, SEDE, Projetos; migration `20261105190000`) e aceitam `?area=`.
  Como o outro sistema usa: comentário do topo de cada rota.

Regras:

- Os dois proxies validam a origem com `src/lib/origem-da-requisicao.js` (`origemDeTerceiro`).
  Não remover: sem isso o endpoint vira proxy aberto.
- Não expor chave ou URL interna na resposta. Segredo vem de variável de ambiente da Vercel.
- Código compartilhado com o front vem de `src/`; não duplicar lógica aqui.
- Pacote enxuto (plano Hobby, limite de "Function Storage"): toda função `api/*.py` leva no
  `vercel.json` o `excludeFiles` `{!(api)/**,.*/**,*,api/!(*.py)}` — sem ele a Vercel empacota o
  repositório inteiro na função. Se importar `python/monitora`, use `includeFiles` (vale mais que o
  `excludeFiles`). Dependências no `pyproject.toml`; Pillow e pypdfium2 ficam fora por
  `override-dependencies` (o pdfplumber só os usa em `to_image`, que não chamamos aqui).
  Guarda: `tests/funcoes-da-vercel-leves.test.js`.
- O servidor `server/servidor.ts` não tem essas rotas: `/api/*` só existe na Vercel.

Testes: `npx vitest run tests/funai-geodata-proxy.test.js`, `tests/editais-api.test.js`, `tests/aprovados-e-cronograma-api.test.js`, `tests/aya-*.test.js`;
`python -m pytest tests/python/test_anexos_do_edital.py tests/python/test_retificacao_do_cronograma.py`
(anexos e retificação do cronograma, com PDFs sintéticos).
