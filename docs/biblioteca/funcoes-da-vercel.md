---
tipo: referencia
area: operacao
atualizado: 2026-11-10
---

# Funções da Vercel (`api/`)

Cada arquivo de `api/` é um endpoint `/api/<nome>`; o que começa com `_` não é rota (a Vercel o
ignora). As rotas `/api/*` só existem na Vercel: o `server/servidor.ts` não as tem e, localmente,
respondem 404. A Aya responde no navegador; o endpoint de IA e o bridge local foram retirados.

## As funções

- `funai-geodata.ts` — proxy do GeoServer OWS da FUNAI (polígonos de terras indígenas).
- `funai-wms.ts` — proxy do WMS da FUNAI (camada `Funai:tis_poligonais`). Ver [[terras-indigenas]].
- `anexos-do-edital.py` — Python (pdfplumber): lê o PDF de anexos do edital e devolve cronograma
  (Anexo I) e quadro de vagas (Anexo II) em JSON. Só usuário logado (Bearer conferido em
  `/auth/v1/user`: sem token ou token recusado → 401; Auth fora do ar, lento ou variável faltando →
  503, para quem está logado não ler "entre no MONITORA"); não grava nada. Quem usa: `src/lib/anexos-do-edital.ts`. Com
  `?tipo=retificacao`, lê a retificação do cronograma (nº, edital, SEI, assinatura, "Onde se lê" e
  "Leia-se", com as linhas em negrito e os avisos das datas); quem usa:
  `src/lib/retificacao-do-cronograma.ts` (tela `src/modulos/editais/lancar-retificacao.tsx`).
- `editais.ts`, `aprovados.ts`, `cronograma.ts` — **API para outro sistema, sem login**: o outro
  sistema manda `Bearer <EDITAIS_API_CHAVE>` (chave fixa, variável da Vercel, a mesma nas três) e a
  função lê o banco com `SUPABASE_SERVICE_ROLE_KEY`; as duas só existem na Vercel, nunca no front. A
  parte comum (chave em tempo constante, chamada à RPC, erros) fica em `_rota-com-chave.ts`.
  - `/api/editais`: `listar_editais_da_api` (migration `20261105170000`; unidade, edital, status,
    etapa, vagas, contratados, ociosas, risco, link e área; sem anexos), formato em
    `src/lib/editais-da-api.ts`.
  - `/api/aprovados` e `/api/cronograma`: `listar_aprovados_da_api` e `listar_cronograma_da_api` (só
    `service_role`; migration `20261105150000`), formato em
    `src/lib/aprovados-e-cronograma-da-api.ts`. Aprovados tem dados pessoais (nome, matrícula).
  - As três trazem `area` (Saúde Indígena, SEDE, Projetos; migration `20261105190000`) e aceitam
    `?area=`. Como o outro sistema usa: comentário do topo de cada rota.

## Regras

- Os dois proxies validam a origem com `src/lib/origem-da-requisicao.ts` (`origemDeTerceiro`). Não
  remover: sem isso o endpoint vira proxy aberto.
- Não expor chave ou URL interna na resposta. Segredo vem de variável de ambiente da Vercel.
- Código compartilhado com o front vem de `src/`; não duplicar lógica aqui.
- **Pacote enxuto** (plano Hobby, limite de "Function Storage"): toda função `api/*.py` leva no
  `vercel.json` o `excludeFiles` `{!(api)/**,.*/**,*,api/!(*.py)}` — sem ele a Vercel empacota o
  repositório inteiro. Se importar `python/monitora`, use `includeFiles` (vale mais que o
  `excludeFiles`). Dependências no `pyproject.toml` da raiz; Pillow e pypdfium2 ficam fora por
  `override-dependencies` (o pdfplumber só os usa em `to_image`, que não chamamos). Guarda:
  `tests/funcoes-da-vercel-leves.test.js`.
- Limites do plano Hobby: `maxDuration: 30`, corpo de ~4,5 MB. O que pode demorar é job no GitHub
  Actions ([[python-e-jobs]]).

## Testes

`npx vitest run tests/funai-geodata-proxy.test.js tests/editais-api.test.js
tests/aprovados-e-cronograma-api.test.js`; `python -m pytest tests/python/test_anexos_do_edital.py
tests/python/test_retificacao_do_cronograma.py` (PDFs sintéticos).

## Relacionadas

- [[deploy-e-vercel]] — publicação e variáveis
- [[seguranca]] — chaves e origem
- [[modulo-editais]] — quem usa os anexos do edital
- [[dados-pessoais]] — a API de aprovados
