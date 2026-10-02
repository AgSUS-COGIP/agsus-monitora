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
*/
import { exigirSessao } from "../../lib/sessao.js";
import { municipiosDaResposta } from "../../lib/visao-geral-da-area.js";

export const RPC_DOS_MUNICIPIOS = "listar_municipios_das_vagas_da_area";
export const CACHE_TTL_MS = 5 * 60_000;

export const ESCOLHA_INICIAL = Object.freeze({ projeto: "", agrupar: false });

export function criarCarregadorDeMunicipios({
  obterSupabase = () => null,
  relogio = () => Date.now(),
} = {}) {
  const guardados = new Map();
  const emVoo = new Map();
  let escolha = ESCOLHA_INICIAL;

  const emCache = (area) => {
    const guardado = guardados.get(area);
    return guardado && relogio() - guardado.em < CACHE_TTL_MS
      ? guardado.resultado
      : null;
  };

  async function buscar(area) {
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
        erro: erro?.message || "Não foi possível carregar os municípios.",
      };
    }
  }

  return {
    emCache,
    carregar(area) {
      const guardado = emCache(area);
      if (guardado) return Promise.resolve(guardado);
      if (!emVoo.has(area)) {
        emVoo.set(
          area,
          buscar(area).finally(() => emVoo.delete(area)),
        );
      }
      return emVoo.get(area);
    },
    obterEscolha: () => escolha,
    guardarEscolha(nova) {
      escolha = { ...escolha, ...nova };
    },
  };
}
