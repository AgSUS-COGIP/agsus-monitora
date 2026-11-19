/*
  /api/territorio-dos-dseis — território, acesso e CNES dos DSEIs, lidos do
  SIGEPSI. O mesmo molde de `api/dseis.ts`:

  1. só GET;
  2. só para quem está logado no Yeendé (`Authorization: Bearer <token da
     sessão do Supabase>`, conferido em `/auth/v1/user`);
  3. lê o SIGEPSI com `SIGEPSI_API_TOKEN`, que nunca sai da função;
  4. três fontes, cada uma por si (uma rota negada não derruba as outras):
       territorio  /api/mapa-dseis/territorio     população, aldeias, terras
       acesso      /api/mapa-dseis/localizacoes   meio de acesso, floresta…
       cnes        /api/mapa-dseis/rede           CNES dos estabelecimentos
     Cada uma responde `{ ok: true, dados, linhas, campos }` ou
     `{ ok: false, status, motivo }` (401/403 = "a chave do Yeendé não lê
     esta rota"). `campos` são os nomes dos campos que a rota trouxe, nunca
     valores: é o diagnóstico de formato.

  Nunca lê `/api/mapa-dseis` (a força de trabalho pessoa a pessoa, dado
  pessoal): as rotas são só as de `ROTAS_DO_TERRITORIO`, e a resposta só leva
  os campos que `territorio-do-sigepsi.ts` copia.

  Cache na instância: fonte lida fica CACHE_MS; fonte negada, ESPERA_DA_FALHA
  (não martela o SIGEPSI, mas a liberação aparece logo). Cache do navegador
  privado (a rota exige login).
*/

import {
  ROTAS_DO_TERRITORIO,
  acessoDasUnidades,
  camposDasLinhas,
  estabelecimentosDoCnes,
  motivoDaFalha,
  territorioPorDsei,
} from "../src/lib/mapas/mapa-saude-indigena/territorio-do-sigepsi.js";
import type {
  FonteDoTerritorio,
  FonteLida,
} from "../src/lib/mapas/mapa-saude-indigena/territorio-do-sigepsi.js";
import type { PedidoDaVercel, RespostaDaVercel } from "./_tipos-da-vercel.js";
import {
  CACHE_MS,
  configuracao,
  sessaoValida,
  tokenDoPedido,
} from "./dseis.js";

export const BASE_DO_SIGEPSI = "https://sigepsi.agenciasus.org.br";
const ESPERA_MS = 15_000;
export const ESPERA_DA_FALHA = 60_000;

const CONVERTER: Record<FonteDoTerritorio, (linhas: unknown[]) => unknown> = {
  territorio: territorioPorDsei,
  acesso: acessoDasUnidades,
  cnes: estabelecimentosDoCnes,
};

const FONTES = Object.keys(ROTAS_DO_TERRITORIO) as FonteDoTerritorio[];

const guardado = new Map<
  FonteDoTerritorio,
  { em: number; fonte: FonteLida<unknown> }
>();

/** Só para os testes: esquece as respostas guardadas. */
export function esquecerCache() {
  guardado.clear();
}

function responder(
  res: RespostaDaVercel,
  status: number,
  corpo: unknown,
): void {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    status < 400 ? "private, max-age=600" : "private, no-store",
  );
  res.end(JSON.stringify(corpo));
}

async function lerFonte(
  fonte: FonteDoTerritorio,
  token: string,
): Promise<FonteLida<unknown>> {
  try {
    const resposta = await fetch(
      `${BASE_DO_SIGEPSI}${ROTAS_DO_TERRITORIO[fonte]}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(ESPERA_MS),
      },
    );
    if (!resposta.ok) {
      console.error(`[api] territorio-dos-dseis: ${fonte} ${resposta.status}`);
      return {
        ok: false,
        status: resposta.status,
        motivo: motivoDaFalha(resposta.status),
      };
    }
    const linhas: unknown = await resposta.json();
    if (!Array.isArray(linhas))
      return {
        ok: false,
        status: resposta.status,
        motivo: "resposta do SIGEPSI em formato inesperado",
      };
    return {
      ok: true,
      dados: CONVERTER[fonte](linhas),
      linhas: linhas.length,
      campos: camposDasLinhas(linhas),
    };
  } catch (falha) {
    // A mensagem fica no log da função, não na resposta.
    console.error(`[api] territorio-dos-dseis: ${fonte}`, falha);
    return { ok: false, status: null, motivo: motivoDaFalha(null) };
  }
}

async function fonteGuardada(
  fonte: FonteDoTerritorio,
  token: string,
  agora: number,
): Promise<{ em: number; fonte: FonteLida<unknown> }> {
  const antes = guardado.get(fonte);
  const validade = antes?.fonte.ok ? CACHE_MS : ESPERA_DA_FALHA;
  if (antes && agora - antes.em < validade) return antes;
  const nova = { em: agora, fonte: await lerFonte(fonte, token) };
  guardado.set(fonte, nova);
  return nova;
}

export default async function handler(
  req: PedidoDaVercel,
  res: RespostaDaVercel,
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return responder(res, 405, { erro: "metodo_nao_permitido" });
  }

  const config = configuracao();
  if (config.faltam.length) {
    return responder(res, 500, {
      erro: "configuracao_ausente",
      faltam: config.faltam,
    });
  }

  const token = tokenDoPedido(req);
  try {
    if (!token || !(await sessaoValida(config.base, config.publicavel, token)))
      return responder(res, 401, { erro: "sessao_invalida" });
  } catch (falha) {
    console.error("[api] territorio-dos-dseis: sessão", falha);
    return responder(res, 502, { erro: "falha_na_sessao" });
  }

  const agora = Date.now();
  const lidas = await Promise.all(
    FONTES.map((fonte) => fonteGuardada(fonte, config.tokenDoSigepsi, agora)),
  );
  const corpo: Record<string, unknown> = {};
  FONTES.forEach((fonte, i) => {
    corpo[fonte] = lidas[i]!.fonte;
  });
  corpo.lidoEm = new Date(Math.min(...lidas.map((l) => l.em))).toISOString();
  // Cada fonte diz se veio; a resposta é 200 mesmo com fonte negada.
  return responder(res, 200, corpo);
}
