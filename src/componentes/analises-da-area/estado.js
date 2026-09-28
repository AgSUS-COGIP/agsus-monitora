/*
  Estado do painel de Análises por área, fora do React: a carga da área e da
  situação escolhidas, o cache e o detalhe de cada análise. O que é só da tela
  (filtros, linhas à vista, detalhe aberto) fica no componente. Este arquivo
  não importa React.

  CUSTO DE REDE — ler antes de mexer.
    get_analises_da_area(p_area, p_scope)  → todas as análises da área, sem o
                                             texto da análise (Saúde Indígena,
                                             ativas: ~6,7 mil linhas, ~2,9 MB
                                             antes do gzip, ~180 ms no banco)
    get_analise_detalhe_da_area(p_id)      → uma análise, com o texto

  Nada é pedido antes de a página abrir (`abrir()`, chamado pelo `render()` do
  controlador): trocar de área no menu sem abrir Análises não custa nada. Cada
  par área × situação fica 60 s em cache; voltar à página ou à área dentro
  desse tempo desenha na hora. Resposta que chega depois de a pessoa já ter
  trocado de área é descartada.
*/

import { exigirSessao } from "../../lib/sessao.js";
import { linhasDoPayload } from "../../lib/analises-da-area.js";

const RPC_ANALISES = "get_analises_da_area";
const RPC_DETALHE = "get_analise_detalhe_da_area";

const CACHE_TTL_MS = 60_000;

const ESTADO_INICIAL = Object.freeze({
  aberto: false,
  area: "",
  escopo: "ativo",
  linhas: Object.freeze([]),
  editais: Object.freeze([]),
  /** Área e situação a que `linhas` pertencem. */
  chave: "",
  carregando: false,
  carregado: false,
  erro: "",
});

const chaveDe = (area, escopo) => `${area}|${escopo}`;

/* Mensagem para a pessoa; o detalhe técnico fica no console. */
function mensagemDoErro(erro) {
  if (erro?.code === "42501")
    return "Seu perfil não tem acesso às análises desta área.";
  return "Não foi possível carregar as análises. Verifique a conexão e tente de novo.";
}

export function criarEstadoDasAnalises({
  supabase = null,
  relogio = () => Date.now(),
} = {}) {
  let estado = ESTADO_INICIAL;
  const cache = new Map();
  const detalhes = new Map();
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function buscar(area, escopo) {
    await exigirSessao(supabase);
    const { data, error } = await supabase.rpc(RPC_ANALISES, {
      p_area: area,
      p_scope: escopo,
    });
    if (error) throw error;
    return {
      linhas: linhasDoPayload(data),
      editais: Array.isArray(data?.editais) ? data.editais : [],
    };
  }

  async function carregar(forcar = false) {
    const { area, escopo, aberto } = estado;
    if (!aberto || !area) return;
    if (!supabase) {
      publicar({ erro: "Supabase indisponível.", carregando: false });
      return;
    }
    const chave = chaveDe(area, escopo);
    const guardado = cache.get(chave);
    if (!forcar && guardado && relogio() - guardado.em < CACHE_TTL_MS) {
      publicar({
        chave,
        linhas: guardado.linhas,
        editais: guardado.editais,
        carregando: false,
        carregado: true,
        erro: "",
      });
      return;
    }

    publicar({ carregando: true, erro: "" });
    try {
      const resultado = await buscar(area, escopo);
      cache.set(chave, { ...resultado, em: relogio() });
      // A pessoa trocou de área ou de situação enquanto o pedido voava.
      if (chaveDe(estado.area, estado.escopo) !== chave) return;
      publicar({
        chave,
        ...resultado,
        carregando: false,
        carregado: true,
      });
    } catch (erro) {
      if (chaveDe(estado.area, estado.escopo) !== chave) return;
      console.warn("Análises da área indisponíveis:", erro);
      publicar({
        chave,
        linhas: [],
        editais: [],
        carregando: false,
        carregado: true,
        erro: mensagemDoErro(erro),
      });
    }
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    /** A página abriu (render do controlador): a partir daqui, carrega. */
    abrir() {
      if (!estado.aberto) publicar({ aberto: true });
      return carregar();
    },
    /** A área do menu mudou. */
    definirArea(area) {
      const proxima = String(area ?? "").trim();
      if (proxima === estado.area) return undefined;
      publicar({ area: proxima });
      return carregar();
    },
    /** Situação: ativo, inativo ou todos. */
    definirEscopo(escopo) {
      if (escopo === estado.escopo) return undefined;
      publicar({ escopo });
      return carregar();
    },
    recarregar: () => carregar(true),
    /*
      O texto da análise e os campos que a lista não traz. Fica guardado: abrir
      o mesmo detalhe de novo não repete o pedido.
    */
    async detalhe(id) {
      if (detalhes.has(id)) return detalhes.get(id);
      await exigirSessao(supabase);
      const { data, error } = await supabase.rpc(RPC_DETALHE, { p_id: id });
      if (error) throw error;
      detalhes.set(id, data || null);
      return data || null;
    },
  };
}
