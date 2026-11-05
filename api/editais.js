/*
  GET /api/editais — os editais do monitoramento: unidade, edital, status,
  etapa, vagas, contratados, ociosas, risco e o link do edital (formato em
  src/lib/editais-da-api.js).

  Acesso: sem login. Quem chama manda a chave fixa da API
  (`Authorization: Bearer <EDITAIS_API_CHAVE>`). A função lê
  `listar_monitoramento_operacional` com a chave de servidor do Supabase
  (SUPABASE_SERVICE_ROLE_KEY), que nunca sai daqui, e devolve as linhas
  ativas de todas as áreas. Trocar a chave = mudar EDITAIS_API_CHAVE na Vercel
  e fazer um novo deploy; a chave antiga para de valer.

  Variáveis na Vercel (Settings › Environment Variables):
    VITE_SUPABASE_URL           já existe (a do app)
    SUPABASE_SERVICE_ROLE_KEY   chave de servidor do Supabase (secreta)
    EDITAIS_API_CHAVE           a chave que se entrega ao outro sistema
                                (gere uma longa e aleatória, ex.:
                                `openssl rand -hex 32`)

  Filtros opcionais na query: ?edital=&unidade= (contém) e ?status=&etapa=&risco=
  (igual, sem caixa nem acento).

  COMO USAR EM OUTRA APLICAÇÃO

  1. A chamada (JavaScript), com a chave que o MONITORA entregou:

       const resposta = await fetch(
         "https://agsus-monitora.vercel.app/api/editais?risco=alto",
         { headers: { Authorization: `Bearer ${CHAVE_DA_API}` } },
       );
       const { editais, totais } = await resposta.json();

     Pela linha de comando:

       curl -H "Authorization: Bearer <chave>" \
         "https://agsus-monitora.vercel.app/api/editais?unidade=yanomami"

     Guarde a chave no servidor da outra aplicação (variável de ambiente), não
     no código do navegador: quem tem a chave lê os editais.

  2. A resposta (200, JSON):

       {
         "editais": [
           { "id": 1, "unidade": "DSEI Yanomami", "edital": "001/2026",
             "status": "Em andamento", "etapa": "Análise curricular",
             "vagas": 10, "contratados": 4, "ociosas": 6, "risco": "Alto",
             "link": "https://.../edital-001-2026.pdf" }
         ],
         "totais": { "linhas": 1, "vagas": 10, "contratados": 4, "ociosas": 6 }
       }

     vagas, contratados e ociosas são sempre números (0 quando vazio); os
     textos vêm "" quando o campo está vazio no MONITORA. "link" é o
     endereço do edital publicado; os anexos não vêm na API.

  3. Erros (JSON { "erro": "<código>" }):
       401 chave_invalida       sem Bearer, ou chave diferente da combinada
       405 metodo_nao_permitido só GET
       500 configuracao_ausente faltam as variáveis acima na Vercel
       502 falha_na_leitura     o banco não respondeu; tente de novo

  A rota só existe no site publicado na Vercel (não no `npm run dev`). A
  resposta não é guardada em cache (Cache-Control: private, no-store).
*/

import { createHash, timingSafeEqual } from "node:crypto";
import {
  RPC_DOS_EDITAIS,
  editaisDaApi,
  filtrosDaApi,
  totaisDaApi,
} from "../src/lib/editais-da-api.js";

const ESPERA_MS = 15_000;

function configuracao() {
  const base = String(process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const servidor = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  const chaveDaApi = String(process.env.EDITAIS_API_CHAVE || "");
  return base && servidor && chaveDaApi ? { base, servidor, chaveDaApi } : null;
}

function tokenDoPedido(req) {
  const cabecalho = String(req.headers?.authorization || "");
  const achado = /^Bearer\s+(\S+)$/i.exec(cabecalho);
  return achado ? achado[1] : "";
}

/* Compara pelo hash, em tempo constante (o tamanho da chave não vaza). */
function mesmaChave(recebida, esperada) {
  const a = createHash("sha256").update(recebida).digest();
  const b = createHash("sha256").update(esperada).digest();
  return timingSafeEqual(a, b);
}

function responder(res, status, corpo) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(JSON.stringify(corpo));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    responder(res, 405, { erro: "metodo_nao_permitido" });
    return;
  }

  const config = configuracao();
  if (!config) {
    responder(res, 500, { erro: "configuracao_ausente" });
    return;
  }

  const token = tokenDoPedido(req);
  if (!token || !mesmaChave(token, config.chaveDaApi)) {
    responder(res, 401, { erro: "chave_invalida" });
    return;
  }

  try {
    const resposta = await fetch(
      `${config.base}/rest/v1/rpc/${RPC_DOS_EDITAIS}`,
      {
        method: "POST",
        headers: {
          apikey: config.servidor,
          // A chave antiga (JWT) também vai no Authorization; a nova (sb_secret_…) só no apikey.
          ...(config.servidor.startsWith("eyJ")
            ? { Authorization: `Bearer ${config.servidor}` }
            : {}),
          "Content-Type": "application/json",
        },
        body: "{}",
        signal: AbortSignal.timeout(ESPERA_MS),
      },
    );
    if (!resposta.ok) {
      responder(res, 502, { erro: "falha_na_leitura" });
      return;
    }

    const payload = await resposta.json();
    const editais = editaisDaApi(payload, filtrosDaApi(req.query));
    responder(res, 200, { editais, totais: totaisDaApi(editais) });
  } catch {
    responder(res, 502, { erro: "falha_na_leitura" });
  }
}
