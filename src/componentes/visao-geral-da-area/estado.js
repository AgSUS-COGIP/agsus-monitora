/*
  Estado da Visão geral da SEDE e de Projetos, fora do React: os municípios
  do mapa, por área. Os editais não passam por aqui — já vêm carregados pelo
  legado (`dados-do-monitoramento.js`). Este arquivo não importa React.

  CUSTO DE REDE: um pedido por área com mapa, pequeno (uma linha por
  município), guardado por CACHE_TTL_MS. Reabrir a tela ou trocar de área e
  voltar não repete o pedido enquanto o cache está fresco.

  O banco ainda sem a função (PGRST202, migration 20260929090000 não aplicada)
  não é erro da tela: o mapa diz que depende da atualização do banco e o resto
  da página segue normal.
*/

import { exigirSessao } from "../../lib/sessao.js";
import {
  municipiosDaResposta,
  temMapaDeMunicipios,
} from "../../lib/visao-geral-da-area.js";

const RPC_MUNICIPIOS = "listar_municipios_das_vagas_da_area";
const CACHE_TTL_MS = 5 * 60_000;

const MAPA_VAZIO = Object.freeze({
  municipios: Object.freeze([]),
  carregando: false,
  carregado: false,
  indisponivel: false,
  erro: "",
});

export function criarEstadoDaVisaoGeral({
  supabase = null,
  relogio = () => Date.now(),
} = {}) {
  let estado = { mapas: {} };
  const carregadoEm = new Map();
  const emVoo = new Map();
  const ouvintes = new Set();

  function publicarMapa(area, mudancas) {
    const atual = estado.mapas[area] || MAPA_VAZIO;
    estado = {
      ...estado,
      mapas: { ...estado.mapas, [area]: { ...atual, ...mudancas } },
    };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function carregarMunicipios(area, forcar = false) {
    if (!temMapaDeMunicipios(area)) return;
    const fresco = relogio() - (carregadoEm.get(area) || 0) < CACHE_TTL_MS;
    if (!forcar && fresco && estado.mapas[area]?.carregado) return;
    if (emVoo.has(area)) return emVoo.get(area);
    if (!supabase) {
      publicarMapa(area, { erro: "Supabase indisponível." });
      return;
    }

    publicarMapa(area, { carregando: true, erro: "" });
    const pedido = (async () => {
      try {
        await exigirSessao(supabase);
        const { data, error } = await supabase.rpc(RPC_MUNICIPIOS, {
          p_area: area,
        });
        if (error?.code === "PGRST202") {
          publicarMapa(area, {
            carregando: false,
            carregado: true,
            indisponivel: true,
          });
          return;
        }
        if (error) throw error;
        carregadoEm.set(area, relogio());
        publicarMapa(area, {
          municipios: municipiosDaResposta(data),
          carregando: false,
          carregado: true,
          indisponivel: false,
        });
      } catch (erro) {
        publicarMapa(area, {
          carregando: false,
          erro: erro?.message || "Não foi possível carregar os municípios.",
        });
      } finally {
        emVoo.delete(area);
      }
    })();
    emVoo.set(area, pedido);
    return pedido;
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    mapaDaArea: (area) => estado.mapas[area] || MAPA_VAZIO,
    carregarMunicipios,
  };
}
