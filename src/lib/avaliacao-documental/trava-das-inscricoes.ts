/*
  Trava "inscrições congeladas" de um edital (migration
  20261020170000_inscricoes_congeladas.sql): com ela ligada, o robô da
  Empregare não exporta nem grava candidatos do edital e a pré-classificação
  não recalcula nem refaz o lote; o modo "Só anexos" continua. Liga e desliga
  a coordenação da avaliação do edital ou o administrador global, com motivo.
  Aqui só a leitura da resposta de obter_congelamento_inscricoes e as regras
  do motivo; a tela é src/modulos/avaliacao-documental/trava-das-inscricoes.tsx.
*/

export const RPC_OBTER_CONGELAMENTO = "obter_congelamento_inscricoes";
export const RPC_ALTERAR_CONGELAMENTO = "alterar_congelamento_inscricoes";
export const MOTIVO_DA_TRAVA = Object.freeze({ min: 10, max: 500 });

export type TipoDoEvento = "CONGELAR" | "DESCONGELAR" | "LIBERACAO";

export interface EventoDaTrava {
  tipo: TipoDoEvento;
  motivo: string;
  em: Date | null;
  por: string;
}

export interface TravaDasInscricoes {
  congelado: boolean;
  motivo: string;
  em: Date | null;
  por: string;
  podeAlterar: boolean;
  historico: EventoDaTrava[];
}

const TIPOS: readonly TipoDoEvento[] = ["CONGELAR", "DESCONGELAR", "LIBERACAO"];

const texto = (v: unknown): string =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";

const data = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const registro = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** A resposta do banco em formato seguro (campos ausentes viram vazio). */
export function lerTrava(entrada: unknown): TravaDasInscricoes {
  const r = registro(entrada);
  const historico = (Array.isArray(r.historico) ? r.historico : [])
    .map(registro)
    .filter((h) => TIPOS.includes(h.tipo as TipoDoEvento))
    .map((h) => ({
      tipo: h.tipo as TipoDoEvento,
      motivo: texto(h.motivo),
      em: data(h.em),
      por: texto(h.por),
    }));
  return {
    congelado: r.congelado === true,
    motivo: texto(r.motivo),
    em: data(r.em),
    por: texto(r.por),
    podeAlterar: r.pode_alterar === true,
    historico,
  };
}

/** "" quando o motivo serve; senão a frase curta do erro. */
export function erroDoMotivo(motivo: string): string {
  const n = motivo.trim().length;
  if (n < MOTIVO_DA_TRAVA.min || n > MOTIVO_DA_TRAVA.max)
    return `Informe o motivo (${MOTIVO_DA_TRAVA.min} a ${MOTIVO_DA_TRAVA.max} caracteres).`;
  return "";
}

/** Mostrar o cartão? Congelado, todos veem; liberado, só quem pode congelar. */
export const mostrarTrava = (t: TravaDasInscricoes | null): boolean =>
  Boolean(t && (t.congelado || t.podeAlterar));

const ROTULOS: Readonly<Record<TipoDoEvento, string>> = Object.freeze({
  CONGELAR: "Congelou",
  DESCONGELAR: "Liberou",
  LIBERACAO: "Forçou uma carga",
});

/** "Congelou em 20/10 por Fulano: motivo" — para o histórico. */
export function textoDoEvento(e: EventoDaTrava): string {
  const quando = e.em
    ? e.em.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : "";
  return [
    ROTULOS[e.tipo],
    quando ? `em ${quando}` : "",
    e.por ? `por ${e.por}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .concat(e.motivo ? `: ${e.motivo}` : "");
}

/** O erro do banco em frase curta (a função ausente = migration não aplicada). */
export function mensagemDoErroDaTrava(erro: unknown): string {
  const e = registro(erro);
  if (e.code === "PGRST202")
    return "O banco ainda não tem a trava das inscrições (migration 20261020170000).";
  return texto(e.message) || "Não consegui mudar a trava das inscrições.";
}
