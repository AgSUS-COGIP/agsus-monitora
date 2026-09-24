/*
  Estado do Calendário de Editais, fora do React: as etapas carregadas e o
  estado do carregamento. O que é só da tela (mês à vista, filtros, dia aberto)
  fica no componente. Este arquivo não importa React.

  Esta tela não escreve nada. Ela apenas reorganiza, por data, as etapas que já
  existem em `nucleo-cronograma.js`. Quem edita continua a ser a Equipe Núcleo.

  CUSTO DE REDE — ler antes de mexer no carregamento.
  Não existe RPC que devolva as etapas de todos os editais de uma vez. O que há:

    get_nucleo_cronograma_resumo()                   → 1 linha por edital, sem etapas
    get_monitoramento_cronograma(p_monitoramento_id) → etapas de UM edital

  Então montar o calendário custa 1 + N chamadas. É o motivo de existirem aqui o
  limite de concorrência e o cache por TTL — sem eles a tela dispara uma rajada
  de pedidos a cada abertura. Se o número de editais crescer muito, a correção
  certa não é mexer nestes números: é criar um RPC que devolva tudo achatado e
  trocar `carregar` por uma chamada só. O resto da tela não precisa de saber de
  onde vieram as etapas.
*/

import { exigirSessao } from "../../lib/sessao.js";
import {
  comLimite,
  editaisComCronograma,
  montarEtapasDosEditais,
} from "../../lib/calendario-editais.js";

const RPC_RESUMO = "get_nucleo_cronograma_resumo";
const RPC_CRONOGRAMA = "get_monitoramento_cronograma";

/** Pedidos simultâneos ao Supabase. Acima disto o navegador enfileira à toa. */
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

  async function buscar() {
    await exigirSessao(supabase);
    const { data, error } = await supabase.rpc(RPC_RESUMO);
    if (error) throw error;

    const editais = editaisComCronograma(data);
    const blocos = await comLimite(editais, CONCORRENCIA, async (edital) => {
      const resposta = await supabase.rpc(RPC_CRONOGRAMA, {
        p_monitoramento_id: edital.id,
      });
      if (resposta.error) throw resposta.error;
      return Array.isArray(resposta.data?.etapas) ? resposta.data.etapas : [];
    });
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
