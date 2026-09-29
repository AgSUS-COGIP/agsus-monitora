/*
  Busca o que a lista enxuta não traz (20260928200000 e 20260929150000). Regras
  puras em `src/lib/textos-do-painel-de-analises.js` e
  `src/lib/lista-do-painel-de-analises.js`.

  - `buscarDetalheDaLinha(id)`: o detalhamento de um registro (parecer,
    pontuações, experiências, links, datas), ao abri-lo. Guardado por id: abrir
    de novo o mesmo registro não consulta outra vez.
  - `buscarParecerDaLinha(id)`: só o parecer; vem do que o CSV/busca já trouxe
    ou do detalhamento.
  - `buscarTextosDoEscopo(escopo)`: parecer, link do PDF e experiência de todas
    as linhas da área e escopo, para o CSV e para a busca geral. Guardado por
    área + escopo até o "Atualizar".
*/
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { parametroDeAreaDaRpc } from "../lib/area-do-painel-de-analises.js";
import {
  mapaDosTextos,
  parecerDoDetalhe,
} from "../lib/textos-do-painel-de-analises.js";
import { AREA_DO_PAINEL } from "./analises-area.js";

const RPC_DETALHE = "get_analise_detalhe_do_painel";
const RPC_TEXTOS = "get_analises_texto_do_painel";

const detalhesPorId = new Map();
const pareceresPorId = new Map();
const textosPorEscopo = new Map();

function cliente() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Conexão com o Supabase indisponível.");
  return client;
}

/** O detalhamento da linha (objeto ou null). Rejeita se a consulta falhar. */
export function buscarDetalheDaLinha(id) {
  const chave = String(id ?? "").trim();
  if (!chave) return Promise.resolve(null);
  if (detalhesPorId.has(chave)) return detalhesPorId.get(chave);

  const promessa = (async () => {
    const { data, error } = await cliente().rpc(RPC_DETALHE, { p_id: chave });
    if (error) throw error;
    const detalhe = Array.isArray(data) ? data[0] : data;
    return detalhe && typeof detalhe === "object" ? detalhe : null;
  })();
  detalhesPorId.set(chave, promessa);
  promessa.catch(() => detalhesPorId.delete(chave));
  return promessa;
}

/** O parecer da linha (string ou null). Rejeita se a consulta falhar. */
export function buscarParecerDaLinha(id) {
  const chave = String(id ?? "").trim();
  if (!chave) return Promise.resolve(null);
  if (pareceresPorId.has(chave)) return pareceresPorId.get(chave);
  return buscarDetalheDaLinha(chave).then(parecerDoDetalhe);
}

/** Map(id → { analise, link_pdf, … }) de todas as linhas da área no escopo. */
export function buscarTextosDoEscopo(escopo) {
  const escopoPedido = String(escopo || "ativo").toLowerCase();
  const chave = `${AREA_DO_PAINEL}|${escopoPedido}`;
  if (textosPorEscopo.has(chave)) return textosPorEscopo.get(chave);

  const promessa = (async () => {
    const { data, error } = await cliente().rpc(RPC_TEXTOS, {
      p_scope: escopoPedido,
      ...parametroDeAreaDaRpc(AREA_DO_PAINEL),
    });
    if (error) throw error;
    const mapa = mapaDosTextos(Array.isArray(data) ? data[0] : data);
    mapa.forEach((campos, id) =>
      pareceresPorId.set(id, Promise.resolve(campos.analise ?? null)),
    );
    return mapa;
  })();
  textosPorEscopo.set(chave, promessa);
  promessa.catch(() => textosPorEscopo.delete(chave));
  return promessa;
}

/* "Atualizar" traz dados novos: o que foi guardado pode ter mudado. */
export function esquecerTextos() {
  detalhesPorId.clear();
  pareceresPorId.clear();
  textosPorEscopo.clear();
}

if (typeof document !== "undefined") {
  document.addEventListener("agsus:analises-cache-cleared", esquecerTextos);
}
