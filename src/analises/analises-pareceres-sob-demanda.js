/*
  Busca o parecer (`analise`) que o payload leve da lista não traz
  (20260928200000). Regras puras em `src/lib/textos-do-painel-de-analises.js`.

  - `buscarParecerDaLinha(id)`: um parecer, para o detalhamento. Guardado por
    id: abrir de novo o mesmo registro não consulta outra vez.
  - `buscarPareceresDoEscopo(escopo)`: todos os pareceres da área e escopo,
    para o CSV e para a busca geral. Guardado por área + escopo até o
    "Atualizar".
*/
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { parametroDeAreaDaRpc } from "../lib/area-do-painel-de-analises.js";
import {
  mapaDosPareceres,
  parecerDoDetalhe,
} from "../lib/textos-do-painel-de-analises.js";
import { AREA_DO_PAINEL } from "./analises-area.js";

const RPC_DETALHE = "get_analise_detalhe_do_painel";
const RPC_PARECERES = "get_analises_texto_do_painel";

const pareceresPorId = new Map();
const pareceresPorEscopo = new Map();

function cliente() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Conexão com o Supabase indisponível.");
  return client;
}

/** O parecer da linha (string ou null). Rejeita se a consulta falhar. */
export function buscarParecerDaLinha(id) {
  const chave = String(id ?? "").trim();
  if (!chave) return Promise.resolve(null);
  if (pareceresPorId.has(chave)) return pareceresPorId.get(chave);

  const promessa = (async () => {
    const { data, error } = await cliente().rpc(RPC_DETALHE, { p_id: chave });
    if (error) throw error;
    return parecerDoDetalhe(data);
  })();
  pareceresPorId.set(chave, promessa);
  promessa.catch(() => pareceresPorId.delete(chave));
  return promessa;
}

/** Map(id → parecer) de todas as linhas da área no escopo. */
export function buscarPareceresDoEscopo(escopo) {
  const chave = `${AREA_DO_PAINEL}|${String(escopo || "ativo").toLowerCase()}`;
  if (pareceresPorEscopo.has(chave)) return pareceresPorEscopo.get(chave);

  const promessa = (async () => {
    const { data, error } = await cliente().rpc(RPC_PARECERES, {
      p_scope: String(escopo || "ativo").toLowerCase(),
      ...parametroDeAreaDaRpc(AREA_DO_PAINEL),
    });
    if (error) throw error;
    const mapa = mapaDosPareceres(Array.isArray(data) ? data[0] : data);
    mapa.forEach((texto, id) => pareceresPorId.set(id, Promise.resolve(texto)));
    return mapa;
  })();
  pareceresPorEscopo.set(chave, promessa);
  promessa.catch(() => pareceresPorEscopo.delete(chave));
  return promessa;
}

/* "Atualizar" traz dados novos: os pareceres guardados podem ter mudado. */
export function esquecerPareceres() {
  pareceresPorId.clear();
  pareceresPorEscopo.clear();
}

if (typeof document !== "undefined") {
  document.addEventListener("agsus:analises-cache-cleared", esquecerPareceres);
  document.addEventListener("agsus:analises-force-refresh", esquecerPareceres);
}
