import type {
  EditalComCronograma,
  EstadoDoCalendario,
  OpcoesDoEstadoDoCalendario,
  SnapshotDoCalendario,
} from "./tipos.ts";
/*
  Estado do Calendário de Editais, fora do React: as etapas carregadas e o
  estado do carregamento. O que é só da tela (mês à vista, filtros, dia aberto)
  fica no componente. Este arquivo não importa React.

  As etapas não são escritas aqui: a tela reorganiza, por data, as que já
  existem nos cronogramas de Editais (src/modulos/editais/), quem edita. As
  demandas internas vêm no mesmo carregamento e são escritas pela tela
  (demandas-internas.tsx), que devolve a demanda salva por guardarDemanda.

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

import { exigirSessao } from "../../lib/sessao";
import {
  comDemanda,
  LISTA_DE_DEMANDAS_VAZIA,
  lerDemandasInternas,
} from "../../lib/demandas-internas.ts";
import type { ListaDeDemandas } from "../../lib/demandas-internas.ts";
import {
  comLimite,
  editaisComCronograma,
  montarEtapasDosEditais,
  registroDoCalendario,
} from "../../lib/calendario-editais.ts";

const RPC_RESUMO = "get_nucleo_cronograma_resumo";
const RPC_CRONOGRAMA = "get_monitoramento_cronograma";
/** Todas as etapas num pedido só (migration 20260924170000). */
const RPC_TODAS_AS_ETAPAS = "listar_etapas_do_cronograma";
/** Demandas internas (migration 20261104120000), no mesmo carregamento. */
const RPC_DEMANDAS = "listar_demandas_internas";

/*
  Pedidos simultâneos ao Supabase. Acima disto o navegador enfileira à toa.
  Só entra em jogo no caminho antigo, por edital (banco sem RPC_TODAS_AS_ETAPAS).
*/
const CONCORRENCIA = 6;
/** Enquanto fresco, reabrir a tela não repete as N chamadas. */
const CACHE_TTL_MS = 60_000;

const ESTADO_INICIAL: SnapshotDoCalendario = Object.freeze({
  etapas: Object.freeze([]),
  editais: Object.freeze([]),
  carregando: false,
  carregado: false,
  /** Quando a última carga chegou (ISO), para a data discreta do topo. */
  carregadoEm: "",
  erro: "",
  demandas: Object.freeze([]),
  podeCriarEm: Object.freeze([]),
  recorte: "",
});

export function criarEstadoDoCalendario({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  relogio = () => Date.now(),
}: OpcoesDoEstadoDoCalendario = {}): EstadoDoCalendario {
  let estado = ESTADO_INICIAL;
  let carregadoEm = 0;
  /* Sobe a cada invalidar(): a carga que começou antes não marca os dados como frescos. */
  let versao = 0;
  let emVoo: Promise<void> | null = null;
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<SnapshotDoCalendario>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  /*
    Um pedido para todas as etapas; eram 118, um por edital (6 a 7 s). Com o
    banco ainda sem a função nova (PGRST202), volta ao pedido por edital.
    Devolve um bloco de etapas por edital, na ordem de `editais`. `todas` é
    a resposta de RPC_TODAS_AS_ETAPAS, pedida junto com o resumo (`buscar`).
  */
  async function buscarEtapasDosEditais(
    editais: readonly EditalComCronograma[],
    todas: { data: unknown; error: unknown },
  ): Promise<(readonly unknown[] | null)[]> {
    if (!supabase) throw new Error("Supabase indisponível.");
    if (!todas.error) {
      const porEdital = new Map<string, unknown[]>(
        editais.map((edital) => [String(edital.id), []]),
      );
      const etapas: readonly unknown[] = Array.isArray(todas.data)
        ? todas.data
        : [];
      for (const etapa of etapas) {
        const id = registroDoCalendario(etapa).monitoramento_id;
        if (typeof id !== "string" && typeof id !== "number") continue;
        porEdital.get(String(id))?.push(etapa);
      }
      return editais.map((edital) => porEdital.get(String(edital.id)) || []);
    }
    if (registroDoCalendario(todas.error).code !== "PGRST202")
      throw todas.error;
    return comLimite(editais, CONCORRENCIA, async (edital) => {
      const resposta = await supabase.rpc(RPC_CRONOGRAMA, {
        p_monitoramento_id: edital.id,
      });
      if (resposta.error) throw resposta.error;
      const etapas = registroDoCalendario(resposta.data).etapas;
      return Array.isArray(etapas) ? etapas : [];
    });
  }

  /*
    As demandas internas são um extra: banco sem a RPC (PGRST202), sem
    permissão ou qualquer falha deixam o calendário só com as etapas.
  */
  async function buscarDemandas(): Promise<ListaDeDemandas> {
    try {
      const resposta = await supabase!.rpc(RPC_DEMANDAS);
      return resposta.error
        ? LISTA_DE_DEMANDAS_VAZIA
        : lerDemandasInternas(resposta.data);
    } catch {
      return LISTA_DE_DEMANDAS_VAZIA;
    }
  }

  async function buscar() {
    if (!supabase) throw new Error("Supabase indisponível.");
    await exigirSessao(supabase);
    // O resumo, as etapas e as demandas não dependem um do outro: saem juntos.
    const [resumo, todas, demandas] = await Promise.all([
      supabase.rpc(RPC_RESUMO),
      supabase.rpc(RPC_TODAS_AS_ETAPAS),
      buscarDemandas(),
    ]);
    if (resumo.error) throw resumo.error;

    const editais = editaisComCronograma(resumo.data);
    const blocos = await buscarEtapasDosEditais(editais, todas);
    return { ...montarEtapasDosEditais(editais, blocos), ...demandas };
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
    const versaoDaCarga = versao;
    emVoo = (async () => {
      try {
        const { etapas, editais, falhas, demandas, podeCriarEm } =
          await buscar();
        // Invalidado no meio: mostra o que chegou, mas a próxima abertura relê.
        carregadoEm = versaoDaCarga === versao ? relogio() : 0;
        publicar({
          etapas,
          editais,
          demandas,
          podeCriarEm,
          carregando: false,
          carregado: true,
          carregadoEm: new Date(relogio()).toISOString(),
        });
        if (falhas)
          toast(
            `${falhas} edital(is) não puderam ser lidos. O calendário está incompleto.`,
            "warn",
          );
      } catch (erro) {
        const mensagem = registroDoCalendario(erro).message;
        publicar({
          carregando: false,
          erro:
            typeof mensagem === "string" && mensagem
              ? mensagem
              : "Não foi possível carregar os cronogramas.",
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
      versao += 1;
      carregadoEm = 0;
    },
    guardarDemanda(demanda) {
      publicar({ demandas: comDemanda(estado.demandas, demanda) });
    },
    definirRecorte(recorte) {
      if (estado.recorte !== recorte) publicar({ recorte });
    },
    tirarDemanda(id) {
      publicar({
        demandas: estado.demandas.filter((demanda) => demanda.id !== id),
      });
    },
  };
}
