/*
  A página própria do edital (`/<área>/edital/<número-ano>`), sem DOM: qual
  edital o endereço pede, o endereço de um edital, a situação das vagas e dos
  candidatos e a linha do tempo das etapas. A tela é
  src/modulos/pagina-do-edital/.

  O endereço usa o número do edital ("105-2026"), que é o que a pessoa lê e
  compartilha. Dois editais de mesmo número na área (raro, mas acontece entre
  unidades) não cabem num endereço só: o de cada um passa a ser o id do
  monitoramento, e o número abre a escolha entre eles.
*/

import { numeroDoEdital } from "../editais/numero-do-edital.ts";
import { situacaoNaLinhaDoTempo } from "../cronograma/cronograma-do-edital.ts";
import {
  contratacoesDoCadastroReserva,
  contratadasImediatas,
  vagasEfetivas,
} from "../visao-geral/indicadores-do-monitoramento.ts";
import type {
  DadosDaEtapa,
  RegistroDoHistoricoDoCronograma,
} from "../cronograma/cronograma-do-edital.ts";

/** O que a página usa de uma linha do monitoramento (`TB_MONITORAMENTO_INDIGENA`). */
export interface LinhaDoEdital {
  [campo: string]: unknown;
  id?: string | number | undefined;
  edital?: string | undefined;
  unidade?: string | undefined;
  vagas_total?: number | string | undefined;
  vagas_reabertas?: number | undefined;
  contratados?: number | string | undefined;
  /** Pessoas na lista de aprovados vigente; nulo sem lista. */
  aprovados?: number | null | undefined;
  /** Aprovados da lista vigente ainda sem status; nulo sem lista. */
  cadastro_reserva?: number | null | undefined;
  desistentes?: number | undefined;
}

/** O que o endereço pede: um edital, a escolha entre vários, ou nenhum. */
export type EditalDoEndereco<T> =
  | { tipo: "um"; linha: T }
  | { tipo: "varios"; linhas: T[] }
  | { tipo: "nenhum" };

const txt = (valor: unknown) => String(valor ?? "").trim();
const num = (valor: unknown) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const NUMERO_NO_ENDERECO = /^(\d{1,4})-(\d{4})$/;

/** "105/2026" → "105-2026" (o pedaço do endereço); "" sem número. */
export function numeroNoEndereco(edital: unknown): string {
  return numeroDoEdital(edital).replace("/", "-");
}

/**
 * O edital que o endereço pede, entre as linhas da área: pelo id do
 * monitoramento ou pelo número ("105-2026", "091-2026" vale como "91/2026").
 */
export function editalDoEndereco<T extends LinhaDoEdital>(
  pedaco: unknown,
  linhas: readonly T[] | null | undefined,
): EditalDoEndereco<T> {
  const pedido = txt(pedaco);
  const lista = Array.isArray(linhas) ? linhas : [];
  if (!pedido) return { tipo: "nenhum" };
  const peloId = lista.find((linha) => txt(linha.id) === pedido);
  if (peloId) return { tipo: "um", linha: peloId };
  const partes = pedido.match(NUMERO_NO_ENDERECO);
  if (!partes) return { tipo: "nenhum" };
  const numero = `${Number(partes[1])}/${partes[2]}`;
  const doNumero = lista.filter(
    (linha) => numeroDoEdital(linha.edital) === numero,
  );
  if (doNumero.length === 1) return { tipo: "um", linha: doNumero[0]! };
  if (doNumero.length > 1) return { tipo: "varios", linhas: doNumero };
  return { tipo: "nenhum" };
}

/**
 * O pedaço do endereço de um edital: o número, se só ele tem esse número na
 * área; senão (ou sem número), o id do monitoramento.
 */
export function enderecoDoEdital(
  linha: LinhaDoEdital,
  linhasDaArea: readonly LinhaDoEdital[] | null | undefined,
): string {
  const numero = numeroDoEdital(linha.edital);
  const id = txt(linha.id);
  if (!numero) return id;
  const iguais = (linhasDaArea || []).filter(
    (outra) => numeroDoEdital(outra.edital) === numero,
  ).length;
  return iguais <= 1
    ? numero.replace("/", "-")
    : id || numero.replace("/", "-");
}

// ── Vagas e candidatos ───────────────────────────────────────────────────

export interface SituacaoDasVagas {
  /** Vagas imediatas publicadas no edital. */
  imediatas: number;
  /** Contratações dentro das vagas imediatas. */
  preenchidas: number;
  /** Vagas sem contratação reabertas depois em edital mais novo. */
  reabertas: number;
  /** Vagas imediatas ainda sem contratação (sem as reabertas). */
  abertas: number;
  /** Contratações acima das vagas imediatas (cadastro reserva). */
  cadastroReserva: number;
  /** "0 de 70 preenchidas". */
  texto: string;
}

/** As vagas do edital, com as mesmas contas da Visão geral. */
export function situacaoDasVagas(linha: LinhaDoEdital): SituacaoDasVagas {
  const imediatas = num(linha.vagas_total);
  const preenchidas = contratadasImediatas(linha);
  return {
    imediatas,
    preenchidas,
    reabertas: Math.max(0, imediatas - vagasEfetivas(linha)),
    abertas: Math.max(0, vagasEfetivas(linha) - preenchidas),
    cadastroReserva: contratacoesDoCadastroReserva(linha),
    texto: `${preenchidas} de ${imediatas} preenchida${imediatas === 1 ? "" : "s"}`,
  };
}

export interface SituacaoDosCandidatos {
  /** Há lista de aprovados vigente (sem ela, só os contratados). */
  temLista: boolean;
  aprovados: number;
  contratados: number;
  /** Aprovados ainda sem status (não chamados). */
  aguardando: number;
  desistentes: number;
  /** Os outros status (convocado, em contratação, eliminado…). */
  demais: number;
}

/** Os candidatos da lista vigente, pelo acompanhamento da Visão geral. */
export function situacaoDosCandidatos(
  linha: LinhaDoEdital,
): SituacaoDosCandidatos {
  const contratados = num(linha.contratados);
  const temLista =
    linha.aprovados !== null &&
    linha.aprovados !== undefined &&
    Number.isFinite(Number(linha.aprovados));
  if (!temLista)
    return {
      temLista,
      aprovados: 0,
      contratados,
      aguardando: 0,
      desistentes: 0,
      demais: 0,
    };
  const aprovados = num(linha.aprovados);
  const aguardando = Math.min(aprovados, num(linha.cadastro_reserva));
  const desistentes = num(linha.desistentes);
  return {
    temLista,
    aprovados,
    contratados,
    aguardando,
    desistentes,
    demais: Math.max(0, aprovados - aguardando - contratados - desistentes),
  };
}

// ── Linha do tempo ───────────────────────────────────────────────────────

export type MarcaDaEtapa = "concluida" | "atual" | "prevista";

export const ROTULOS_DAS_MARCAS: Readonly<Record<MarcaDaEtapa, string>> =
  Object.freeze({
    concluida: "Concluída",
    atual: "Etapa atual",
    prevista: "Prevista",
  });

export interface EtapaNaLinhaDoTempo {
  chave: string;
  atividade: string;
  inicio: string;
  fim: string;
  observacao: string;
  marca: MarcaDaEtapa;
  /** A primeira prevista (a próxima a começar). */
  proxima: boolean;
}

/**
 * As etapas com a marca de cada uma, só pelas datas de hoje (Brasília), como a
 * linha do tempo de Editais: concluída, etapa atual ou prevista.
 */
export function etapasNaLinhaDoTempo(
  etapas: readonly DadosDaEtapa[] | null | undefined,
  hoje: string,
): EtapaNaLinhaDoTempo[] {
  const lista = Array.isArray(etapas) ? etapas : [];
  return lista.map((etapa, indice) => {
    const situacao = situacaoNaLinhaDoTempo(etapa, indice, lista, hoje);
    const inicio = txt(etapa.data_inicio).slice(0, 10);
    return {
      chave: `${txt(etapa.ordem) || indice}:${indice}`,
      atividade: txt(etapa.atividade) || "Etapa sem nome",
      inicio,
      fim: txt(etapa.data_fim).slice(0, 10) || inicio,
      observacao: txt(etapa.observacao),
      marca:
        situacao === "done"
          ? "concluida"
          : situacao === "current"
            ? "atual"
            : "prevista",
      proxima: situacao === "next",
    };
  });
}

/** Quantas etapas há em cada marca. */
export function contagemDasMarcas(
  etapas: readonly EtapaNaLinhaDoTempo[],
): Record<MarcaDaEtapa, number> {
  const contagem = { concluida: 0, atual: 0, prevista: 0 };
  for (const etapa of etapas) contagem[etapa.marca] += 1;
  return contagem;
}

// ── Retificações ─────────────────────────────────────────────────────────

export interface Retificacao {
  chave: string;
  /** "Errata nº 2" (o número que a equipe gravou) ou "Retificação". */
  titulo: string;
  quando: string;
  motivo: string;
  alteracoes: number;
}

/**
 * As retificações do cronograma (`TH_CRONOGRAMA_MONIT_INDIG`, ação
 * "errata"), da mais recente para a mais antiga. As outras alterações do
 * histórico ficam de fora (elas só contam).
 */
export function retificacoesDoHistorico(
  historico: readonly RegistroDoHistoricoDoCronograma[] | null | undefined,
): { retificacoes: Retificacao[]; outrasAlteracoes: number } {
  const lista = Array.isArray(historico) ? historico : [];
  const erratas = lista.filter((item) => txt(item.acao) === "errata");
  const retificacoes = erratas
    .map((item, indice) => ({
      chave: `${txt(item.created_at)}:${indice}`,
      titulo: txt(item.numero_errata) || "Retificação",
      quando: txt(item.created_at),
      motivo: txt(item.motivo),
      alteracoes: num(item.total_alteracoes),
    }))
    .sort((a, b) => (a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0));
  return { retificacoes, outrasAlteracoes: lista.length - erratas.length };
}

// ── Situação excepcional ─────────────────────────────────────────────────

export interface SituacaoExcepcional {
  /** "Suspenso", "Paralisado" ou "Cancelado". */
  status: string;
  motivo: string;
  /** Data da decisão (AAAA-MM-DD) ou "". */
  data: string;
  /** Retomada prevista (AAAA-MM-DD) ou "". */
  retomada: string;
}

const EXCEPCIONAIS = ["Suspenso", "Paralisado", "Cancelado"] as const;

/**
 * A situação excepcional do edital: a gravada no cronograma (status
 * digitado, com motivo) ou, sem ela, a do status da linha.
 */
export function situacaoExcepcional(
  monitoramento:
    | {
        status_override?: string | null;
        status_override_motivo?: string | null;
        status_override_data?: string | null;
        status_override_previsao_retomada?: string | null;
      }
    | null
    | undefined,
  statusDaLinha: unknown,
): SituacaoExcepcional | null {
  const doStatus = (valor: unknown) => {
    const texto = txt(valor).toLowerCase();
    return (
      EXCEPCIONAIS.find((status) =>
        texto.includes(status.slice(0, 6).toLowerCase()),
      ) || ""
    );
  };
  const gravado = doStatus(monitoramento?.status_override);
  const status = gravado || doStatus(statusDaLinha);
  if (!status) return null;
  return {
    status,
    motivo: gravado ? txt(monitoramento?.status_override_motivo) : "",
    data: gravado ? txt(monitoramento?.status_override_data).slice(0, 10) : "",
    retomada: gravado
      ? txt(monitoramento?.status_override_previsao_retomada).slice(0, 10)
      : "",
  };
}
