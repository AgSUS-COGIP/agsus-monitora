# `api/` — funções serverless (Vercel)

Quatro arquivos, cada um é um endpoint `/api/<nome>`:

A Aya responde no navegador pela base de conhecimento (`src/lib/busca-da-aya.ts`);
o endpoint de IA e o bridge local foram retirados.

- `funai-geodata.js` — proxy do GeoServer OWS da FUNAI (polígonos de terras indígenas).
- `funai-wms.js` — proxy do WMS da FUNAI (camada `Funai:tis_poligonais`).
- `anexos-do-edital.py` — Python (pdfplumber, `requirements.txt` na raiz): lê o PDF de anexos do
  edital e devolve cronograma (Anexo I) e quadro de vagas (Anexo II) em JSON. Só usuário logado
  (Bearer conferido em `/auth/v1/user`); não grava nada. Quem usa: `src/lib/anexos-do-edital.ts`.
  Com `?tipo=retificacao`, lê a retificação do cronograma (nº, edital, SEI, assinatura, "Onde se lê"
  e "Leia-se", com as linhas em negrito e os avisos das datas); quem usa:
  `src/lib/retificacao-do-cronograma.ts` (tela `src/modulos/editais/lancar-retificacao.tsx`).

- `editais.js` — `GET /api/editais`: os editais do monitoramento (unidade, edital, status, etapa,
  vagas, contratados, ociosas, risco e o link do edital; sem anexos) e os totais. Sem login: o outro sistema manda
  `Bearer <EDITAIS_API_CHAVE>` (chave fixa, variável da Vercel); a função lê
  `listar_monitoramento_operacional` com `SUPABASE_SERVICE_ROLE_KEY` (as linhas ativas de todas as
  áreas). As duas variáveis só existem na Vercel, nunca no front. Filtros: `?edital=&unidade=` (contém), `?status=&etapa=&risco=` (igual).
  Formato em `src/lib/editais-da-api.js`.

Regras:

- Os dois proxies validam a origem com `src/lib/origem-da-requisicao.js` (`origemDeTerceiro`).
  Não remover: sem isso o endpoint vira proxy aberto.
- Não expor chave ou URL interna na resposta. Segredo vem de variável de ambiente da Vercel.
- Código compartilhado com o front vem de `src/`; não duplicar lógica aqui.
- O servidor `server/servidor.ts` não tem essas rotas: `/api/*` só existe na Vercel.

Testes: `npx vitest run tests/funai-geodata-proxy.test.js`, `tests/editais-api.test.js`, `tests/aya-*.test.js`;
`python -m pytest tests/python/test_anexos_do_edital.py tests/python/test_retificacao_do_cronograma.py`
(anexos e retificação do cronograma, com PDFs sintéticos).
