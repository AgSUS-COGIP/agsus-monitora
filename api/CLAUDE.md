# `api/` — funções serverless (Vercel)

Três arquivos, cada um é um endpoint `/api/<nome>`:

- `aya.js` — assistente AYA. Valida o usuário no Supabase, monta o prompt a partir de
  `src/modules/aya-knowledge.js` (`buildAyaSystemPrompt`, `curatedAnswerForQuestion`,
  `sanitizeAyaContext`) e encaminha ao bridge local do Ollama (`scripts/aya-local-bridge.mjs`), cujo
  endereço vem da RPC `obter_bridge_aya`. Ver `docs/aya-ollama-local.md`.
- `funai-geodata.js` — proxy do GeoServer OWS da FUNAI (polígonos de terras indígenas).
- `funai-wms.js` — proxy do WMS da FUNAI (camada `Funai:tis_poligonais`).

Regras:
- Os dois proxies validam a origem com `src/lib/origem-da-requisicao.js` (`origemDeTerceiro`).
  Não remover: sem isso o endpoint vira proxy aberto.
- Não expor chave ou URL interna na resposta. Segredo vem de variável de ambiente da Vercel.
- Código compartilhado com o front vem de `src/`; não duplicar lógica aqui.
- O servidor `server/servidor.ts` não tem essas rotas: `/api/*` só existe na Vercel.

Testes: `npx vitest run tests/funai-geodata-proxy.test.js`, `tests/aya-*.test.js`.
