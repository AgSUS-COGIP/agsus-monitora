/*
  Concluir e reabrir a ficha de entrevista (20261117050000), como a ficha da
  Avaliação documental: concluída, a ficha é só leitura; a coordenação do
  edital reabre com um motivo desta lista (escolha obrigatória, complemento
  opcional; "Outro" pede a descrição). O banco confere os mesmos códigos e
  rótulos em private."FC_MOTIVO_REABERTURA_ENTREVISTA"
  (tests/entrevistas-e-aprovados.test.ts (bloco reabertura-da-entrevista) compara com a migration) e as
  mesmas regras do texto da Avaliação documental (validarReabertura).
*/
import {
  MOTIVO_OUTRO,
  type MotivoDaReabertura,
  type ReaberturaInvalida,
  type ReaberturaValida,
  validarReabertura,
} from "../avaliacao-documental/motivos-da-reabertura.ts";

const motivo = (codigo: string, rotulo: string): MotivoDaReabertura =>
  Object.freeze({ codigo, rotulo, blocos: Object.freeze([]) });

export const MOTIVOS_DA_REABERTURA_DA_ENTREVISTA: readonly MotivoDaReabertura[] =
  Object.freeze([
    motivo("NOTA", "Correção de nota"),
    motivo("COMPARECIMENTO", "Correção do comparecimento"),
    motivo("BANCA", "Correção da banca ou dos avaliadores"),
    motivo("JUSTIFICATIVA", "Correção da justificativa da banca"),
    motivo("RECURSO", "Recurso deferido"),
    motivo(MOTIVO_OUTRO, "Outro"),
  ]);

/** Confere a escolha como o banco confere; os argumentos de reabrir_entrevista. */
export function validarReaberturaDaEntrevista(
  codigo: unknown,
  complemento: unknown,
): ReaberturaValida | ReaberturaInvalida {
  return validarReabertura(
    codigo,
    complemento,
    MOTIVOS_DA_REABERTURA_DA_ENTREVISTA,
  );
}

/** A entrevista está concluída (só leitura)? */
export function entrevistaConcluida(
  convocado: { concluida_em?: string | null } | null | undefined,
): boolean {
  return Boolean(convocado?.concluida_em);
}

/**
 * Pode concluir: quem edita, a entrevista aberta, sem alteração por salvar e
 * com o resultado definido (comparecimento e, com presença, todas as notas).
 * O banco confere de novo (concluir_entrevista).
 */
export function podeConcluirAEntrevista({
  podeEditar,
  concluida,
  sujo,
  pendencia,
  compareceu,
}: {
  podeEditar: boolean;
  concluida: boolean;
  sujo: boolean;
  pendencia: string;
  compareceu: string | null | undefined;
}): boolean {
  return (
    podeEditar &&
    !concluida &&
    !sujo &&
    !pendencia &&
    (compareceu === "S" || compareceu === "N")
  );
}
