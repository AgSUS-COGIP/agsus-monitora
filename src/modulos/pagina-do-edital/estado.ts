/*
  Estado da página do edital, fora do React (este arquivo não importa React):
  o cronograma de cada edital aberto (`get_monitoramento_cronograma`: estado,
  etapas e histórico) e o acompanhamento da área (o mesmo da Visão geral:
  listas de aprovados, desistentes, vagas reabertas). As linhas do
  monitoramento não moram aqui: são de src/componentes/dados-do-monitoramento.ts.

  Na aba "Vagas e cargos", o quadro de vagas com o vínculo de cada vaga
  (`obter_quadro_de_vagas`, lido quando a aba abre). Os avisos de conferência
  são os da central (src/modulos/conferencias/estado.ts), lidos pela área e
  recortados pelo edital na tela.

  Cada abertura da página (`renovar`) relê o cronograma: quem salvou em
  Editais vê a mudança ao voltar. O acompanhamento usa a leitura com versão
  da Visão geral: sem mudança, o banco responde só "inalterado".
*/

import { exigirSessao } from "../../lib/sessao/sessao";
import { acompanhamentoDaResposta } from "../../lib/visao-geral/visao-geral.ts";
import type { CronogramaLido } from "../editais/estado.ts";
import type { EstadoDosAvisos } from "../conferencias/tipos.ts";
import type {
  Acompanhamento,
  BuscaDoAcompanhamento,
} from "../visao-geral/tipos.ts";

/** O cliente Supabase no que a página usa (o do app ou um falso nos testes). */
export interface ClienteDaPaginaDoEdital {
  rpc(
    nome: "get_monitoramento_cronograma",
    parametros: { p_monitoramento_id: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
  rpc(
    nome: "obter_quadro_de_vagas",
    parametros: { p_edital: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
  auth?: unknown;
}

/** Uma leitura: carregando, pronta (com os dados) ou com erro. */
export type Carga<T> =
  | { status: "carregando" }
  | { status: "pronto"; dados: T }
  | { status: "erro"; mensagem: string; semPermissao?: boolean };

export interface AcompanhamentoDaPagina {
  area: string;
  /** As linhas para as quais foi lido (outra carga das linhas lê de novo). */
  linhas: readonly unknown[];
  carga: Carga<Acompanhamento | null>;
}

export interface SnapshotDaPaginaDoEdital {
  /** id do monitoramento → o cronograma lido. */
  cronogramas: Readonly<Record<string, Carga<CronogramaLido>>>;
  /** id do monitoramento → o quadro de vagas com os vínculos (resposta da RPC). */
  quadros: Readonly<Record<string, Carga<unknown>>>;
  acompanhamento: AcompanhamentoDaPagina | null;
  /**
   * Conta as aberturas (`renovar`): a tela relê quando ele muda. Sem ele, a
   * abertura que caía no mesmo ciclo das primeiras leituras devolvia o estado
   * inicial idêntico, o React não via mudança e nada era relido (as leituras
   * a caminho já tinham sido descartadas): esqueleto para sempre.
   */
  abertura: number;
}

export interface OpcoesDoEstadoDaPagina {
  supabase: ClienteDaPaginaDoEdital | null;
  buscarAcompanhamento?: BuscaDoAcompanhamento | null;
  /** Os avisos de conferência (o estado da central); sem ele, o bloco some. */
  avisos?: EstadoDosAvisos | null;
}

const ESTADO_INICIAL: SnapshotDaPaginaDoEdital = Object.freeze({
  cronogramas: Object.freeze({}),
  quadros: Object.freeze({}),
  acompanhamento: null,
  abertura: 0,
});

const mensagemDe = (erro: unknown) =>
  (erro as { message?: string } | null)?.message || String(erro);
/* 42501: o perfil não tem o recurso que a RPC pede (o quadro é de Editais, Cronograma ou Entrevistas). */
const semPermissao = (erro: unknown) =>
  (erro as { code?: string } | null)?.code === "42501";

export function criarEstadoDaPaginaDoEdital({
  supabase,
  buscarAcompanhamento = null,
  avisos = null,
}: OpcoesDoEstadoDaPagina) {
  let estado = ESTADO_INICIAL;
  /* Muda a cada `renovar`/`esquecer`: resposta de antes não entra. */
  let geracao = 0;
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<SnapshotDaPaginaDoEdital>) {
    estado = Object.freeze({ ...estado, ...mudancas });
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  function guardarCronograma(id: string, carga: Carga<CronogramaLido>) {
    publicar({ cronogramas: { ...estado.cronogramas, [id]: carga } });
  }

  /** Lê o cronograma do edital (uma vez por abertura; `forcar` relê). */
  async function carregarCronograma(id: string, { forcar = false } = {}) {
    if (!id) return;
    if (!forcar && estado.cronogramas[id]) return;
    const minha = geracao;
    guardarCronograma(id, { status: "carregando" });
    try {
      if (!supabase) throw new Error("Sem conexão com o banco.");
      await exigirSessao(supabase as Parameters<typeof exigirSessao>[0]);
      const { data, error } = await supabase.rpc(
        "get_monitoramento_cronograma",
        { p_monitoramento_id: id },
      );
      if (error) throw error;
      if (minha !== geracao) return;
      // A fronteira com o banco: a resposta da RPC.
      guardarCronograma(id, {
        status: "pronto",
        dados: (data || {}) as CronogramaLido,
      });
    } catch (erro) {
      if (minha !== geracao) return;
      guardarCronograma(id, { status: "erro", mensagem: mensagemDe(erro) });
    }
  }

  /** Lê o quadro de vagas do edital com os vínculos (uma vez por abertura). */
  async function carregarQuadro(id: string, { forcar = false } = {}) {
    if (!id) return;
    if (!forcar && estado.quadros[id]) return;
    const minha = geracao;
    const guardar = (carga: Carga<unknown>) =>
      publicar({ quadros: { ...estado.quadros, [id]: carga } });
    guardar({ status: "carregando" });
    try {
      if (!supabase) throw new Error("Sem conexão com o banco.");
      await exigirSessao(supabase as Parameters<typeof exigirSessao>[0]);
      const { data, error } = await supabase.rpc("obter_quadro_de_vagas", {
        p_edital: id,
      });
      if (error) throw error;
      if (minha !== geracao) return;
      guardar({ status: "pronto", dados: data ?? {} });
    } catch (erro) {
      if (minha !== geracao) return;
      guardar({
        status: "erro",
        mensagem: mensagemDe(erro),
        semPermissao: semPermissao(erro),
      });
    }
  }

  /*
    O acompanhamento da área (listas, desistentes, cargos para as vagas
    reabertas), para as linhas desta carga. Falhar não impede a página: os
    números das listas ficam sem valor.
  */
  async function carregarAcompanhamento(
    area: string,
    linhas: readonly unknown[],
    editais: readonly string[],
  ) {
    const atual = estado.acompanhamento;
    if (!area || !buscarAcompanhamento) return;
    if (atual && atual.area === area && atual.linhas === linhas) return;
    const minha = geracao;
    publicar({
      acompanhamento: { area, linhas, carga: { status: "carregando" } },
    });
    try {
      const resposta = await buscarAcompanhamento(area, editais);
      const acompanhamento = acompanhamentoDaResposta(resposta);
      const cargos = (resposta as { vagas_por_cargo?: unknown } | null)
        ?.vagas_por_cargo;
      // As vagas reabertas: o módulo chega sob demanda, como na Visão geral.
      if (acompanhamento && cargos)
        acompanhamento.reaberturas =
          await import("../../lib/visao-geral/vagas-reabertas.ts").then(
            (modulo) => modulo.reaberturasDosCargos(cargos),
            () => undefined,
          );
      if (minha !== geracao || estado.acompanhamento?.linhas !== linhas) return;
      publicar({
        acompanhamento: {
          area,
          linhas,
          carga: { status: "pronto", dados: acompanhamento },
        },
      });
    } catch (erro) {
      if (minha !== geracao || estado.acompanhamento?.linhas !== linhas) return;
      publicar({
        acompanhamento: {
          area,
          linhas,
          carga: { status: "erro", mensagem: mensagemDe(erro) },
        },
      });
    }
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    carregarCronograma,
    carregarQuadro,
    carregarAcompanhamento,
    avisos,
    /** Nova abertura da página: o cronograma e o acompanhamento são relidos. */
    renovar() {
      geracao += 1;
      publicar({ ...ESTADO_INICIAL, abertura: estado.abertura + 1 });
    },
  };
}

export type EstadoDaPaginaDoEdital = ReturnType<
  typeof criarEstadoDaPaginaDoEdital
>;
