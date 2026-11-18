/*
  A página própria do edital (`/<área>/edital/<número-ano>`), sem DOM: a
  situação das vagas e dos candidatos, a linha do tempo das etapas, as abas,
  o quadro de vagas e as fontes. A tela é src/modulos/pagina-do-edital/; o
  endereço (qual edital ele pede) fica em ./endereco-do-edital.ts.
*/

import { situacaoNaLinhaDoTempo } from "../cronograma/cronograma-do-edital.ts";
import {
  contratacoesDoCadastroReserva,
  contratadasImediatas,
  vagasEfetivas,
} from "../visao-geral/indicadores-do-monitoramento.ts";
import { filaDoQuadro } from "../editais/vinculos-do-quadro.ts";
import type { FilaDoQuadro } from "../editais/vinculos-do-quadro.ts";
import type {
  DadosDaEtapa,
  RegistroDoHistoricoDoCronograma,
} from "../cronograma/cronograma-do-edital.ts";

export {
  editalDoEndereco,
  enderecoDoEdital,
  numeroNoEndereco,
} from "./endereco-do-edital.ts";
export type { EditalDoEndereco, LinhaDoEdital } from "./endereco-do-edital.ts";
import type { LinhaDoEdital } from "./endereco-do-edital.ts";

const txt = (valor: unknown) => String(valor ?? "").trim();
const num = (valor: unknown) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

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

// ── Abas ─────────────────────────────────────────────────────────────────

export type AbaDaPagina =
  "resumo" | "vagas" | "etapas" | "candidatos" | "fontes";

export const ABAS_DA_PAGINA: readonly { id: AbaDaPagina; rotulo: string }[] =
  Object.freeze([
    { id: "resumo", rotulo: "Resumo" },
    { id: "vagas", rotulo: "Vagas e cargos" },
    { id: "etapas", rotulo: "Etapas" },
    { id: "candidatos", rotulo: "Candidatos" },
    { id: "fontes", rotulo: "Fontes e histórico" },
  ]);

/** A aba existe? (a da URL que não existe fica no Resumo) */
export const ehAbaDaPagina = (aba: string): aba is AbaDaPagina =>
  ABAS_DA_PAGINA.some((item) => item.id === aba);

/** A etapa atual e a próxima prevista, para o Resumo. */
export function andamentoDasEtapas(etapas: readonly EtapaNaLinhaDoTempo[]): {
  atuais: EtapaNaLinhaDoTempo[];
  proxima: EtapaNaLinhaDoTempo | null;
} {
  return {
    atuais: etapas.filter((etapa) => etapa.marca === "atual"),
    proxima: etapas.find((etapa) => etapa.proxima) ?? null,
  };
}

// ── As telas da seleção, já no edital ────────────────────────────────────

/**
 * Como a tela recebe o edital: pelo id do monitoramento (a navegação o leva
 * à tela, `abrirEdital`) ou pelo número, num pedido de filtro
 * (src/app/pedido-de-filtro.ts), nas telas que recortam pelo rótulo.
 */
export type ComoAbreOEdital = "id" | "numero";

export interface TelaDoEdital {
  view: string;
  rotulo: string;
  icone: string;
  como: ComoAbreOEdital;
}

/** As telas da seleção, na ordem do processo, que abrem já no edital. */
export const TELAS_DO_EDITAL: readonly TelaDoEdital[] = Object.freeze([
  { view: "selecao", rotulo: "Seleção", icone: "fa-filter", como: "numero" },
  {
    view: "pre-classificacao",
    rotulo: "Triagem",
    icone: "fa-list-check",
    como: "id",
  },
  {
    view: "avaliacao-documental",
    rotulo: "Avaliação documental",
    icone: "fa-file-circle-check",
    como: "id",
  },
  {
    view: "conduzir-entrevistas",
    rotulo: "Entrevistas",
    icone: "fa-comments",
    como: "id",
  },
  {
    view: "classificacao",
    rotulo: "Classificação",
    icone: "fa-ranking-star",
    como: "id",
  },
  {
    view: "approved",
    rotulo: "Lista de aprovados",
    icone: "fa-user-check",
    como: "numero",
  },
]);

/** As telas que o perfil abre (`permitida(view)`), na ordem do processo. */
export function telasDoEdital(
  permitida: (view: string) => boolean,
): TelaDoEdital[] {
  return TELAS_DO_EDITAL.filter((tela) => permitida(tela.view));
}

// ── Fontes ───────────────────────────────────────────────────────────────

const ORIGENS_DO_CRONOGRAMA: Readonly<Record<string, string>> = Object.freeze({
  MANUAL: "digitado em Editais",
  PDF: "importado do PDF de anexos",
  PLANILHA: "da planilha",
  TREINAMENTO: "edital de treinamento",
});

/** "Importado do PDF de anexos" / "digitado em Editais" (ou o código, se for outro). */
export function origemDoCronograma(origem: unknown): string {
  const codigo = txt(origem).toUpperCase();
  if (!codigo) return "";
  return ORIGENS_DO_CRONOGRAMA[codigo] || codigo.toLowerCase();
}

export interface RegistroDoHistorico {
  chave: string;
  tipo: "retificacao" | "alteracao";
  titulo: string;
  quando: string;
  motivo: string;
  quem: string;
  alteracoes: number;
}

/** O histórico inteiro do cronograma (alterações e retificações), do mais recente ao mais antigo. */
export function historicoDoCronograma(
  historico: readonly RegistroDoHistoricoDoCronograma[] | null | undefined,
): RegistroDoHistorico[] {
  return (Array.isArray(historico) ? historico : [])
    .map((item, indice) => {
      const errata = txt(item.acao) === "errata";
      return {
        chave: `${txt(item.created_at)}:${indice}`,
        tipo: errata ? ("retificacao" as const) : ("alteracao" as const),
        titulo:
          txt(item.numero_errata) || (errata ? "Retificação" : "Alteração"),
        quando: txt(item.created_at),
        motivo: txt(item.motivo),
        quem: txt(item.created_by_email),
        alteracoes: num(item.total_alteracoes),
      };
    })
    .sort((a, b) => (a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0));
}

// ── Quadro de vagas ──────────────────────────────────────────────────────

export interface LinhaDoQuadroDaPagina {
  id: string;
  cargo: string;
  lotacao: string;
  imediatas: number;
  cadastroReserva: boolean;
  /** Vagas por modalidade (Ampla, PcD, Negros, Indígenas…), como o PDF trouxe. */
  modalidades: { nome: string; valor: string }[];
}

export interface QuadroDaPagina {
  linhas: LinhaDoQuadroDaPagina[];
  origem: { tipo: string; arquivo: string; gravadoEm: string } | null;
  fila: FilaDoQuadro;
}

const registro = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};

/** A resposta de `obter_quadro_de_vagas`, sem confiar no formato. */
export function quadroDaPagina(dados: unknown): QuadroDaPagina {
  const bruto = registro(dados);
  const linhas = (Array.isArray(bruto.linhas) ? bruto.linhas : []).flatMap(
    (item, indice) => {
      const linha = registro(item);
      const cargo = txt(linha.cargo);
      if (!cargo) return [];
      const modalidades = Object.entries(registro(linha.modalidades))
        .filter(([, valor]) => valor !== null && valor !== "")
        .map(([nome, valor]) => ({ nome, valor: txt(valor) }));
      return [
        {
          id: txt(linha.id) || String(indice),
          cargo,
          lotacao: txt(linha.lotacao),
          imediatas: num(linha.vagas_imediatas),
          cadastroReserva: linha.cadastro_reserva === true,
          modalidades,
        },
      ];
    },
  );
  const origem = registro(bruto.origem);
  return {
    linhas,
    origem:
      bruto.origem && (txt(origem.tipo) || txt(origem.arquivo))
        ? {
            tipo: txt(origem.tipo),
            arquivo: txt(origem.arquivo),
            gravadoEm: txt(origem.gravado_em),
          }
        : null,
    fila: filaDoQuadro(dados),
  };
}
