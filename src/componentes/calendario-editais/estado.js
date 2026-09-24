/*
  Estado do Calendário de Editais, fora do React: as etapas carregadas e o
  estado do carregamento. O que é só da tela (mês à vista, filtros, dia aberto)
  fica no componente. Este arquivo não importa React.

  Esta tela não escreve nada. Ela apenas reorganiza, por data, as etapas que já
  existem em `nucleo-cronograma.js`. Quem edita continua a ser a Equipe Núcleo.

  CUSTO DE REDE — ler antes de mexer no carregamento.
  Há duas fontes possíveis:

    listar_etapas_do_cronograma()                     → todas as etapas dos editais
                                                          ativos, num pedido só
    get_nucleo_cronograma_resumo()                     → 1 linha por edital, sem etapas
    get_monitoramento_cronograma(p_monitoramento_id)   → etapas de UM edital

  A primeira (migration 20260924170000) substitui 1 + N chamadas por 2: era o
  padrão antigo, ~118 pedidos de ~300 ms cada, seis a sete segundos com a tela
  bloqueada. Se o banco ainda não tiver a função (PGRST202, versão anterior
  ainda em produção), cai de volta ao caminho por edital — limite de
  concorrência e tudo. O cache por TTL evita repetir qualquer um dos dois a
  cada abertura. O resto da tela não precisa de saber de onde vieram as etapas.
*/

import { exigirSessao } from "../../lib/sessao.js";
import {
  comLimite,
  editaisComCronograma,
  montarEtapasDosEditais,
} from "../../lib/calendario-editais.js";

const RPC_RESUMO = "get_nucleo_cronograma_resumo";
const RPC_CRONOGRAMA = "get_monitoramento_cronograma";
/** Todas as etapas num pedido só (migration 20260924170000). */
const RPC_TODAS_AS_ETAPAS = "listar_etapas_do_cronograma";

/*
  Pedidos simultâneos ao Supabase. Acima disto o navegador enfileira à toa.
  Só entra em jogo no caminho antigo, por edital (banco sem RPC_TODAS_AS_ETAPAS).
*/
const CONCORRENCIA = 6;
/** Enquanto fresco, reabrir a tela não repete as N chamadas. */
const CACHE_TTL_MS = 60_000;

const ESTADO_INICIAL = Object.freeze({
  etapas: Object.freeze([]),
  editais: Object.freeze([]),
  carregando: false,
  carregado: false,
  erro: "",
});

export function criarEstadoDoCalendario({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  relogio = () => Date.now(),
} = {}) {
  let estado = ESTADO_INICIAL;
  let carregadoEm = 0;
  let emVoo = null;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  /*
    Um pedido para todas as etapas; eram 118, um por edital (6 a 7 s). Com o
    banco ainda sem a função nova (PGRST202), volta ao pedido por edital.
    Devolve um bloco de etapas por edital, na ordem de `editais`.
  */
  async function buscarEtapasDosEditais(editais) {
    const todas = await supabase.rpc(RPC_TODAS_AS_ETAPAS);
    if (!todas.error) {
      const porEdital = new Map(editais.map((edital) => [String(edital.id), []]));
      for (const etapa of Array.isArray(todas.data) ? todas.data : []) {
        porEdital.get(String(etapa.monitoramento_id))?.push(etapa);
      }
      return editais.map((edital) => porEdital.get(String(edital.id)));
    }
    if (todas.error.code !== "PGRST202") throw todas.error;
    return comLimite(editais, CONCORRENCIA, async (edital) => {
      const resposta = await supabase.rpc(RPC_CRONOGRAMA, {
        p_monitoramento_id: edital.id,
      });
      if (resposta.error) throw resposta.error;
      return Array.isArray(resposta.data?.etapas) ? resposta.data.etapas : [];
    });
  }

  async function buscar() {
    await exigirSessao(supabase);
    const { data, error } = await supabase.rpc(RPC_RESUMO);
    if (error) throw error;

    const editais = editaisComCronograma(data);
    const blocos = await buscarEtapasDosEditais(editais);
    return montarEtapasDosEditais(editais, blocos);
  }

  async function carregar(forcar = false) {
    const fresco = relogio() - carregadoEm < CACHE_TTL_MS;
    if (!forcar && fresco && estado.etapas.length) return;
    if (emVoo) return emVoo;
    if (!supabase) {
      publicar({ erro: "Supabase indisponível." });
      return;
    }

    publicar({ carregando: true, erro: "" });
    emVoo = (async () => {
      try {
        const { etapas, editais, falhas } = await buscar();
        carregadoEm = relogio();
        publicar({ etapas, editais, carregando: false, carregado: true });
        if (falhas)
          toast(
            `${falhas} edital(is) não puderam ser lidos. O calendário está incompleto.`,
            "warn",
          );
      } catch (erro) {
        publicar({
          carregando: false,
          erro: erro?.message || "Não foi possível carregar os cronogramas.",
        });
      } finally {
        emVoo = null;
      }
    })();
    return emVoo;
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    carregar,
    /* O cronograma mudou noutra tela: o que está aqui ficou velho. */
    invalidar() {
      carregadoEm = 0;
    },
  };
}
