import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CarregadorDeMunicipios,
  EscolhaDoMapa,
  ResultadoDosMunicipios,
} from "./tipos.ts";
/*
  A CARGA DOS LUGARES DAS VAGAS (mapa de Projetos), sem React.

  Resultado: `{ municipios, indisponivel, erro }`. Um pedido por área de cada
  vez (RPC `listar_municipios_das_vagas_da_area`), pequeno (uma linha por
  lugar), guardado por CACHE_TTL_MS: reabrir a página, filtrar ou trocar de
  área e voltar não repete o pedido enquanto o cache está fresco; erro não
  fica guardado. O banco ainda sem a função (PGRST202) não é erro da página:
  `indisponivel` e o resto segue normal.

  O carregador vive enquanto a Visão geral vive (um por montagem) e guarda
  também a escolha da lista (projeto e "Agrupar por projeto"): trocar de área
  desmonta o mapa, e voltar a Projetos mantém a escolha.

  `corrigirCoordenada(lugar, latitude, longitude)`: o editor de coordenadas
  gravou a posição de um lugar; o cache passa a ter a nova (sem novo pedido).
*/
import { aplicarCoordenada } from "../../lib/coordenadas-dos-projetos.js";
import { exigirSessao } from "../../lib/sessao.js";
import { municipiosDaResposta } from "../../lib/visao-geral-da-area.ts";

export const RPC_DOS_MUNICIPIOS = "listar_municipios_das_vagas_da_area";
export const CACHE_TTL_MS = 5 * 60_000;

export const ESCOLHA_INICIAL: EscolhaDoMapa = Object.freeze({
  projeto: "",
  agrupar: false,
});

/**
 * @param {{obterSupabase?: () => import("@supabase/supabase-js").SupabaseClient | null, relogio?: () => number}} [opcoes]
 */
export function criarCarregadorDeMunicipios({
  obterSupabase = () => null,
  relogio = () => Date.now(),
}: {
  obterSupabase?: () => SupabaseClient | null;
  relogio?: () => number;
} = {}): CarregadorDeMunicipios {
  const guardados = new Map<
    string,
    { em: number; resultado: ResultadoDosMunicipios }
  >();
  const emVoo = new Map<string, Promise<ResultadoDosMunicipios>>();
  let escolha = ESCOLHA_INICIAL;

  const emCache = (area: string) => {
    const guardado = guardados.get(area);
    return guardado && relogio() - guardado.em < CACHE_TTL_MS
      ? guardado.resultado
      : null;
  };

  async function buscar(area: string): Promise<ResultadoDosMunicipios> {
    const supabase = obterSupabase();
    if (!supabase)
      return { municipios: [], indisponivel: false, erro: "Sem conexão." };
    try {
      await exigirSessao(supabase);
      const { data, error } = await supabase.rpc(RPC_DOS_MUNICIPIOS, {
        p_area: area,
      });
      if (error?.code === "PGRST202")
        return { municipios: [], indisponivel: true, erro: "" };
      if (error) throw error;
      const resultado = {
        municipios: municipiosDaResposta(data),
        indisponivel: false,
        erro: "",
      };
      guardados.set(area, { em: relogio(), resultado });
      return resultado;
    } catch (erro) {
      return {
        municipios: [],
        indisponivel: false,
        erro:
          erro &&
          typeof erro === "object" &&
          "message" in erro &&
          typeof erro.message === "string"
            ? erro.message
            : "Não foi possível carregar os municípios.",
      };
    }
  }

  return {
    emCache,
    carregar(area) {
      const guardado = emCache(area);
      if (guardado) return Promise.resolve(guardado);
      const pendente = emVoo.get(area);
      if (pendente) return pendente;
      const promessa = buscar(area).finally(() => emVoo.delete(area));
      emVoo.set(area, promessa);
      return promessa;
    },
    corrigirCoordenada(lugar, latitude, longitude) {
      for (const [area, guardado] of guardados)
        guardados.set(area, {
          ...guardado,
          resultado: {
            ...guardado.resultado,
            municipios: aplicarCoordenada(
              guardado.resultado.municipios,
              lugar,
              latitude,
              longitude,
            ),
          },
        });
    },
    obterEscolha: () => escolha,
    guardarEscolha(nova) {
      escolha = { ...escolha, ...nova };
    },
  };
}
