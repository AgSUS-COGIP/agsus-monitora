# `api/` — funções serverless (Vercel)

Três arquivos, cada um é um endpoint `/api/<nome>`:

A Aya responde no navegador pela base de conhecimento (`src/lib/busca-da-aya.js`);
o endpoint de IA e o bridge local foram retirados.

- `funai-geodata.js` — proxy do GeoServer OWS da FUNAI (polígonos de terras indígenas).
- `funai-wms.js` — proxy do WMS da FUNAI (camada `Funai:tis_poligonais`).
- `anexos-do-edital.py` — Python (pdfplumber, `requirements.txt` na raiz): lê o PDF de anexos do
  edital e devolve cronograma (Anexo I) e quadro de vagas (Anexo II) em JSON. Só usuário logado
  (Bearer conferido em `/auth/v1/user`); não grava nada. Quem usa: `src/lib/anexos-do-edital.js`.

Regras:
- Os dois proxies validam a origem com `src/lib/origem-da-requisicao.js` (`origemDeTerceiro`).
  Não remover: sem isso o endpoint vira proxy aberto.
- Não expor chave ou URL interna na resposta. Segredo vem de variável de ambiente da Vercel.
- Código compartilhado com o front vem de `src/`; não duplicar lógica aqui.
- O servidor `server/servidor.ts` não tem essas rotas: `/api/*` só existe na Vercel.

Testes: `npx vitest run tests/funai-geodata-proxy.test.js`, `tests/aya-*.test.js`;
`python -m unittest discover -s tests/python` (anexos do edital).
