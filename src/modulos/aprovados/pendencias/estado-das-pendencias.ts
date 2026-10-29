import type {
  PendenciaDoEdital,
  RascunhoDaDecisao,
} from "../../../lib/pendencias-do-edital.ts";
import {
  chamadaDaDecisao,
  normalizarResposta,
} from "../../../lib/pendencias-do-edital.ts";
import { hojeEmBrasilia } from "../../../lib/carta-de-convocacao.ts";

/*
  Estado da aba Pendências (sem React): as pendências da área
  (`listar_pendencias_do_edital`), a pendência aberta no modal e a decisão,
  que vai pela RPC da migration 20261026190000 (cada uma valida a permissão e
  o motivo de novo e grava o histórico). Decidiu: recarrega as pendências e
  avisa a tela (`aoDecidir`) para recarregar a lista de aprovados — o status,
  a posição ou a remoção mudaram lá.

  A mesma peça entra depois na jornada por edital: `carregar(area)` e o filtro
  de edital da tela bastam.

  Na abertura da Lista de aprovados as pendências chegam junto
  (`abrir_lista_aprovados`, por `receber`): o selo da aba aparece sem outra
  chamada, e a aba só lê sozinha quando é aberta sem elas.
*/

interface Resposta {
  data: unknown;
  error: unknown;
}
export interface ClienteDasPendencias {
  rpc: (
    nome: string,
    argumentos?: Record<string, unknown>,
  ) => PromiseLike<Resposta>;
}

export interface SnapshotDasPendencias {
  area: string;
  carregado: boolean;
  carregando: boolean;
  erro: string;
  pendencias: readonly PendenciaDoEdital[];
  /** A pendência do modal de decisão (`abertura` muda a cada abertura). */
  modal: { pendenciaId: string; abertura: number } | null;
  /** A decisão em curso. */
  decidindo: boolean;
  /** O erro da decisão, para o modal. */
  erroDaDecisao: string;
}

export interface OpcoesDasPendencias {
  supabase?: ClienteDasPendencias | null;
  toast?: (mensagem: string, tipo?: string) => void;
  aoDecidir?: () => void;
  hoje?: () => string;
}

const INICIAL: SnapshotDasPendencias = Object.freeze({
  area: "",
  carregado: false,
  carregando: false,
  erro: "",
  pendencias: Object.freeze([]) as readonly PendenciaDoEdital[],
  modal: null,
  decidindo: false,
  erroDaDecisao: "",
});

function mensagemDe(erro: unknown) {
  if (erro && typeof erro === "object" && "message" in erro)
    return String((erro as { message: unknown }).message || "");
  return String(erro || "");
}

export function criarEstadoDasPendencias({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  aoDecidir = () => {},
  hoje = () => hojeEmBrasilia(),
}: OpcoesDasPendencias = {}) {
  let estado: SnapshotDasPendencias = INICIAL;
  let aberturas = 0;
  let pedido = 0;
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<SnapshotDasPendencias>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  async function carregar(area: string) {
    if (!supabase || !area) return;
    const meu = ++pedido;
    publicar({
      area,
      carregando: true,
      ...(area !== estado.area ? { carregado: false, pendencias: [] } : {}),
    });
    let data: unknown = null;
    let error: unknown = null;
    try {
      ({ data, error } = (await supabase.rpc("listar_pendencias_do_edital", {
        p_area: area,
      })) || { data: null, error: "Sem resposta." });
    } catch (erro) {
      error = erro;
    }
    if (meu !== pedido) return;
    if (error) {
      publicar({
        carregando: false,
        erro: mensagemDe(error) || "Erro ao carregar as pendências.",
      });
      return;
    }
    try {
      publicar({
        carregando: false,
        carregado: true,
        erro: "",
        pendencias: normalizarResposta(data).pendencias,
      });
    } catch (erro) {
      publicar({ carregando: false, erro: mensagemDe(erro) });
    }
  }

  /** As pendências da área que vieram na abertura da Lista de aprovados. */
  function receber(area: string, dados: unknown) {
    if (!area) return;
    ++pedido; // uma leitura em curso, mais velha, não sobrescreve
    try {
      publicar({
        area,
        carregando: false,
        carregado: true,
        erro: "",
        pendencias: normalizarResposta(dados).pendencias,
      });
    } catch (erro) {
      publicar({ area, carregando: false, erro: mensagemDe(erro) });
    }
  }

  function abrir(pendenciaId: string) {
    aberturas += 1;
    publicar({
      modal: { pendenciaId, abertura: aberturas },
      erroDaDecisao: "",
    });
  }

  function fechar() {
    if (estado.decidindo) return;
    publicar({ modal: null, erroDaDecisao: "" });
  }

  async function decidir(
    pendencia: PendenciaDoEdital,
    rascunho: RascunhoDaDecisao,
  ) {
    if (!supabase || estado.decidindo) return false;
    const montada = chamadaDaDecisao(pendencia, rascunho, hoje());
    if (!montada.chamada) {
      publicar({ erroDaDecisao: montada.erro });
      return false;
    }
    publicar({ decidindo: true, erroDaDecisao: "" });
    let error: unknown = null;
    try {
      ({ error } = (await supabase.rpc(
        montada.chamada.rpc,
        montada.chamada.argumentos,
      )) || { error: "Sem resposta." });
    } catch (erro) {
      error = erro;
    }
    if (error) {
      publicar({
        decidindo: false,
        erroDaDecisao: mensagemDe(error) || "Erro ao gravar a decisão.",
      });
      return false;
    }
    publicar({ decidindo: false, modal: null });
    toast("Decisão registrada.", "success");
    aoDecidir();
    await carregar(estado.area);
    return true;
  }

  return {
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    obter: () => estado,
    carregar,
    receber,
    abrir,
    fechar,
    decidir,
  };
}

export type EstadoDasPendencias = ReturnType<typeof criarEstadoDasPendencias>;
