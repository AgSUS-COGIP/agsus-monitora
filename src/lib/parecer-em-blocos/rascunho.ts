/* Parecer em blocos: o rascunho e os blocos (o que o banco guardaria em cada versão) (API pública em ../parecer-em-blocos.ts). */

import { TEMPOS_MINIMOS } from "./catalogos.ts";
import type { MotivoDaFormacao, NivelDaVaga, OpcaoDoPcd } from "./catalogos.ts";
import { REFERENCIAS_PADRAO } from "./etapas-e-referencias.ts";
import type {
  EtapaDoParecer,
  ReferenciasDoEdital,
} from "./etapas-e-referencias.ts";

// ── O rascunho (o que o banco guardaria em cada versão) ──────────────────

export type CodigoDoBloco =
  | "requisitos"
  | "formacao"
  | "experiencia"
  | "pcd"
  | "indigena"
  | "quilombola"
  | "heteroidentificacao";

export interface DefinicaoDoBloco {
  codigo: CodigoDoBloco;
  etapa: EtapaDoParecer;
  rotulo: string;
  /** O simulador deixa excluir (os requisitos eliminatórios ficam sempre). */
  removivel: boolean;
}

/** O catálogo de blocos por etapa, na ordem em que entram no texto. */
export const CATALOGO_DE_BLOCOS: readonly DefinicaoDoBloco[] = Object.freeze([
  {
    codigo: "requisitos",
    etapa: "avaliacao",
    rotulo: "Requisitos eliminatórios",
    removivel: false,
  },
  {
    codigo: "formacao",
    etapa: "avaliacao",
    rotulo: "Formação acadêmica complementar",
    removivel: true,
  },
  {
    codigo: "experiencia",
    etapa: "avaliacao",
    rotulo: "Experiência profissional, estágio e atuação comunitária",
    removivel: true,
  },
  {
    codigo: "pcd",
    etapa: "avaliacao",
    rotulo: "Avaliação documental de laudo médico (PcD)",
    removivel: true,
  },
  {
    codigo: "indigena",
    etapa: "avaliacao",
    rotulo: "Pertencimento étnico indígena",
    removivel: true,
  },
  {
    codigo: "quilombola",
    etapa: "avaliacao",
    rotulo: "Pertencimento étnico quilombola",
    removivel: true,
  },
  {
    codigo: "heteroidentificacao",
    etapa: "avaliacao",
    rotulo: "Heteroidentificação (pretos e pardos)",
    removivel: true,
  },
]);

export const blocosDaEtapa = (etapa: EtapaDoParecer) =>
  CATALOGO_DE_BLOCOS.filter((b) => b.etapa === etapa);

export interface BlocoDeRequisitos {
  codigo: "requisitos";
  atendeu: boolean;
  identificacao: boolean;
  identificacao_desacordo: boolean;
  diploma: boolean;
  experiencia_minima: boolean;
  experiencia_documentacao: boolean;
  tempo_minimo: string;
  tempo_minimo_documentacao: string;
}

export interface BlocoDeFormacao {
  codigo: "formacao";
  situacao: "comprovada" | "nao_apresentada" | "invalidada";
  nivel: NivelDaVaga;
  titulos: string[];
  motivo: MotivoDaFormacao;
  adicional: string;
}

export interface ExperienciaDoParecer {
  id: string;
  atende: boolean;
  empresa: string;
  inicio: string;
  fim: string;
  criterios: string[];
  quadro_relacao: string;
  quadro_nivel: string;
  empresa_nivel: string;
  cargo_nivel: string;
  nivel_exigido: string;
  experiencias_anteriores: string;
  documento_indigena: "estágios" | "atividades de extensão";
  /** O motivo da ficha, só para quem escreve (não entra no texto). */
  motivo_da_ficha?: string;
}

export interface BlocoDeExperiencia {
  codigo: "experiencia";
  itens: ExperienciaDoParecer[];
  adicional: string;
}

export interface BlocoDePcd {
  codigo: "pcd";
  marcado: boolean;
  opcao: OpcaoDoPcd;
  adicional: string;
}

export interface BlocoIndigena {
  codigo: "indigena";
  sem_documento: boolean;
  no_recurso: boolean;
  no_recurso_acatada: boolean;
  no_recurso_pontos: string;
  aldeia: boolean;
  documento_aldeia: number;
  condisi: boolean;
  razao_condisi: string;
  adicional: string;
}

export interface BlocoQuilombola {
  codigo: "quilombola";
  marcado: boolean;
  documento: number;
  adicional: string;
}

export interface BlocoDeHeteroidentificacao {
  codigo: "heteroidentificacao";
  marcado: boolean;
  parcial: boolean;
  autodeclaracao: boolean;
  foto: boolean;
  video: boolean;
  adicional: string;
}

export type BlocoDoParecer =
  | BlocoDeRequisitos
  | BlocoDeFormacao
  | BlocoDeExperiencia
  | BlocoDePcd
  | BlocoIndigena
  | BlocoQuilombola
  | BlocoDeHeteroidentificacao;

export type Decisao = "INDEFERIMENTO" | "DEFERIMENTO" | "DEFERIMENTO PARCIAL";

export interface Assinatura {
  nome: string;
  cargo: string;
  /** As linhas da lotação embaixo do cargo. */
  lotacao: string[];
  /** "De acordo." antes da assinatura (o segundo gestor). */
  de_acordo: boolean;
}

export interface RascunhoDoParecer {
  etapa: EtapaDoParecer;
  cabecalho: {
    processo: string;
    edital: string;
    unidade: string;
    candidato: string;
    codigo: string;
    vaga: string;
  };
  alegacoes: string;
  admissibilidade: {
    prazo_de: string;
    prazo_ate: string;
    envio_data: string;
    envio_hora: string;
    tempestivo: boolean;
    atende_periodo: boolean;
    admitido: boolean;
    atende_forma: boolean;
    fundamentacao_adequada: boolean;
  };
  blocos: BlocoDoParecer[];
  conclusao: {
    decisao: Decisao;
    retificar: boolean;
    nota_antiga: string;
    nota_nova: string;
  };
  assinaturas: Assinatura[];
  referencias: ReferenciasDoEdital;
  /** Pontos por mês de experiência (o simulador usa 0,2). */
  pontos_por_mes: number;
}

export const DECISOES: readonly Decisao[] = Object.freeze([
  "INDEFERIMENTO",
  "DEFERIMENTO",
  "DEFERIMENTO PARCIAL",
]);

/** Os cargos e lotações que o simulador traz; os nomes ficam para preencher (vêm da configuração da área em produção). */
export const ASSINATURAS_PADRAO: readonly Assinatura[] = Object.freeze([
  {
    nome: "[Nome do(a) primeiro(a) gestor(a)]",
    cargo:
      "Coordenadora de Conformidade dos Processos Seletivos Simplificados da Saúde Indígena",
    lotacao: [
      "Núcleo Especializado de Recrutamento e Seleção para a Saúde Indígena",
      "Unidade de Saúde Indígena",
      "Diretoria de Atenção Integral à Saúde",
    ],
    de_acordo: false,
  },
  {
    nome: "[Nome do(a) segundo(a) gestor(a)]",
    cargo:
      "Gestora do Núcleo Especializado de Recrutamento e Seleção para a Saúde Indígena",
    lotacao: [
      "Unidade de Saúde Indígena",
      "Diretoria de Atenção Integral à Saúde",
    ],
    de_acordo: true,
  },
]);

let sequencia = 0;
export const novoIdDeExperiencia = () =>
  `exp-${Date.now().toString(36)}-${++sequencia}`;

export function novaExperiencia(
  parcial: Partial<ExperienciaDoParecer> = {},
): ExperienciaDoParecer {
  return {
    id: novoIdDeExperiencia(),
    atende: false,
    empresa: "",
    inicio: "",
    fim: "",
    criterios: [],
    quadro_relacao: "Superior",
    quadro_nivel: "Superior",
    empresa_nivel: "",
    cargo_nivel: "",
    nivel_exigido: "Superior",
    experiencias_anteriores: "",
    documento_indigena: "estágios",
    ...parcial,
  };
}

/** Um bloco no estado inicial do simulador (tudo desmarcado). */
export function blocoVazio(codigo: CodigoDoBloco): BlocoDoParecer {
  switch (codigo) {
    case "requisitos":
      return {
        codigo,
        atendeu: true,
        identificacao: false,
        identificacao_desacordo: false,
        diploma: false,
        experiencia_minima: false,
        experiencia_documentacao: false,
        tempo_minimo: TEMPOS_MINIMOS[0]!,
        tempo_minimo_documentacao: TEMPOS_MINIMOS[0]!,
      };
    case "formacao":
      return {
        codigo,
        situacao: "comprovada",
        nivel: "superior",
        titulos: [],
        motivo: "frente_verso",
        adicional: "",
      };
    case "experiencia":
      return { codigo, itens: [novaExperiencia()], adicional: "" };
    case "pcd":
      return {
        codigo,
        marcado: false,
        opcao: "sem_deficiencia",
        adicional: "",
      };
    case "indigena":
      return {
        codigo,
        sem_documento: false,
        no_recurso: false,
        no_recurso_acatada: true,
        no_recurso_pontos: "16",
        aldeia: false,
        documento_aldeia: 0,
        condisi: false,
        razao_condisi: "",
        adicional: "",
      };
    case "quilombola":
      return { codigo, marcado: false, documento: 0, adicional: "" };
    case "heteroidentificacao":
      return {
        codigo,
        marcado: false,
        parcial: false,
        autodeclaracao: true,
        foto: false,
        video: false,
        adicional: "",
      };
  }
}

/** O rascunho em branco, como o simulador abre. */
export function rascunhoVazio(
  etapa: EtapaDoParecer = "avaliacao",
): RascunhoDoParecer {
  return {
    etapa,
    cabecalho: {
      processo: "",
      edital: "",
      unidade: "",
      candidato: "",
      codigo: "",
      vaga: "",
    },
    alegacoes: "",
    admissibilidade: {
      prazo_de: "",
      prazo_ate: "",
      envio_data: "",
      envio_hora: "",
      tempestivo: true,
      atende_periodo: true,
      admitido: true,
      atende_forma: true,
      fundamentacao_adequada: true,
    },
    blocos: blocosDaEtapa(etapa).map((b) => blocoVazio(b.codigo)),
    conclusao: {
      decisao: "INDEFERIMENTO",
      retificar: false,
      nota_antiga: "",
      nota_nova: "",
    },
    assinaturas: ASSINATURAS_PADRAO.map((a) => ({
      ...a,
      lotacao: [...a.lotacao],
    })),
    referencias: { ...REFERENCIAS_PADRAO },
    pontos_por_mes: 0.2,
  };
}

export function blocoDo<C extends CodigoDoBloco>(
  rascunho: RascunhoDoParecer,
  codigo: C,
): Extract<BlocoDoParecer, { codigo: C }> | undefined {
  return rascunho.blocos.find((b) => b.codigo === codigo) as
    Extract<BlocoDoParecer, { codigo: C }> | undefined;
}
