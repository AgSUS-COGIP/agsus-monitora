/*
  Comprovante da eliminação na triagem, ANTES da análise documental.
  Não reutiliza montarEspelho(ficha): sem ficha concluída, não existe nota
  apurada pela comissão. Reutiliza apenas o contrato/diagramação Espelho.
*/
import type { Espelho, LinhaDoEspelho } from "./espelho-de-nota.ts";
import {
  TEXTOS_PADRAO_DO_ESPELHO,
  type TextosDoEspelho,
} from "./modelo-do-espelho.ts";

export interface InscritoEliminadoDaPre {
  codigo: string;
  nome: string;
  vaga: string;
  cargo?: string | null;
  edital: string;
  unidade?: string | null;
  modalidade?: string | null;
  situacao: string;
  motivo: string | null;
  motivo_codigo?: string | null;
  /** Item expressamente cadastrado na regra do edital, nunca presumido. */
  item_edital?: string | null;
  art?: number | null;
  declarada?: number | null;
  /** Nota da ordenação provisória, nunca é nota apurada pela comissão. */
  nota?: number | null;
  origem_nota?: string | null;
}

const texto = (v: unknown) => String(v ?? "").trim();
const nota = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })
    : "Não disponível";

/**
 * Modelo único de comunicação de decisão de triagem.
 * Rejeita candidatos de outra situação e motivo ausente; não transforma
 * ausência de nota em zero. Não consulta banco nem altera classificação.
 */
export function espelhoDaEliminacaoPreAnalise(
  candidato: InscritoEliminadoDaPre,
  textos: TextosDoEspelho = TEXTOS_PADRAO_DO_ESPELHO,
): Espelho {
  if (candidato.situacao !== "ELIMINADO")
    throw new Error("Somente eliminados na triagem.");
  if (!texto(candidato.codigo) || !texto(candidato.edital))
    throw new Error("Código de candidato e edital são obrigatórios.");
  if (!texto(candidato.motivo))
    throw new Error(
      "Eliminação sem justificativa registrada: verificar antes de emitir.",
    );

  const dados: LinhaDoEspelho[] = [
    { rotulo: "Edital", valor: texto(candidato.edital) },
    ...(texto(candidato.unidade)
      ? [{ rotulo: "Unidade", valor: texto(candidato.unidade) }]
      : []),
    { rotulo: "Candidato(a)", valor: texto(candidato.nome) },
    { rotulo: "Código do candidato", valor: texto(candidato.codigo) },
    {
      rotulo: "Vaga",
      valor: [candidato.vaga, candidato.cargo].filter(Boolean).join(" - "),
    },
    ...(texto(candidato.modalidade)
      ? [
          {
            rotulo: "Modalidade de concorrência",
            valor: texto(candidato.modalidade),
          },
        ]
      : []),
    { rotulo: "Etapa", valor: "Triagem da inscrição" },
    { rotulo: "Situação", valor: "Eliminado(a) antes da análise documental" },
  ];
  const notasAdministrativas = new Set([
    "QUESTIONARIO",
    "CANCELADO",
    "REPROVADO_EMPREGARE",
  ]);
  const exibirNotas = !notasAdministrativas.has(texto(candidato.motivo_codigo));
  const notas: LinhaDoEspelho[] = [
    ...(exibirNotas && candidato.art != null
      ? [
          {
            rotulo: "Nota ART informada na inscrição (não apurada)",
            valor: nota(candidato.art),
          },
        ]
      : []),
    ...(exibirNotas && candidato.declarada != null
      ? [
          {
            rotulo: "Nota declarada/recalculada da inscrição (não apurada)",
            valor: nota(candidato.declarada),
          },
        ]
      : []),
    {
      rotulo: "Nota da análise documental",
      valor: "Não se aplica — análise não realizada",
    },
  ];
  return {
    modelo: "ELIMINADO",
    titulo: "Comunicado de eliminação na triagem",
    candidato: texto(candidato.nome) || "candidato(a)",
    dados,
    notas,
    criterios: [],
    justificativas: [
      texto(candidato.motivo),
      ...(texto(candidato.item_edital)
        ? [
            `Fundamento cadastrado na regra do edital: item ${texto(candidato.item_edital)}`,
          ]
        : []),
    ],
    nomeDoArquivo: `Comunicado de eliminação ${texto(candidato.codigo)}`,
    codigoDoCandidato: texto(candidato.codigo),
    codigoDaVaga: texto(candidato.vaga),
    textos: {
      ...textos,
      subtitulo: "Registro da decisão anterior à análise documental",
      abertura:
        "A inscrição foi eliminada na triagem. Não houve análise documental nem atribuição de nota pela comissão avaliadora. Quando exibidas, as notas da inscrição são apenas informativas.",
      secao_notas: "Notas da inscrição (informativas)",
      secao_justificativas: "Motivo da eliminação registrado no sistema",
      rodape:
        "Documento informativo gerado a partir da triagem registrada para o edital. Não substitui a publicação oficial ou o procedimento de recurso previsto no edital.",
    },
  };
}
