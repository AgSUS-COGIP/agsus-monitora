/*
  Motivos da reabertura de uma ficha concluída (20261021110000): lista fixa,
  escolha obrigatória, complemento opcional; "Outro" pede a descrição.

  A lista junta, por família, os blocos das regras vigentes da Avaliação
  documental (os códigos dos blocos variam por edital; os do motivo ficam
  estáveis) e os motivos gerais. O banco confere o código e a regra do
  "Outro" em reabrir_ficha (private."FC_MOTIVO_REABERTURA", com os mesmos
  códigos e rótulos; tests/motivos-da-reabertura-migration.test.js compara)
  e grava no histórico o rótulo legível ("Correção de experiência — <complemento>")
  no motivo e o código nas alterações.
*/
import { motivoPareceTexto, textoLimpo } from "./qualidade-do-motivo.ts";

export type MotivoDaReabertura = Readonly<{
  codigo: string;
  rotulo: string;
  /** Os blocos da regra que o motivo cobre (vazio nos motivos gerais). */
  blocos: readonly string[];
}>;

const motivo = (
  codigo: string,
  rotulo: string,
  blocos: string[] = [],
): MotivoDaReabertura =>
  Object.freeze({ codigo, rotulo, blocos: Object.freeze(blocos) });

export const MOTIVO_OUTRO = "OUTRO";

export const MOTIVOS_DA_REABERTURA: readonly MotivoDaReabertura[] =
  Object.freeze([
    motivo("EXPERIENCIA", "Correção de experiência", ["EXPERIENCIA"]),
    motivo("CURSOS", "Correção de cursos", ["CURSOS"]),
    motivo("FORMACAO", "Correção de formação/titulação", ["FORMACAO"]),
    motivo("REQUISITO", "Correção de escolaridade ou requisito do cargo", [
      "ESCOLARIDADE",
      "REQUISITO_DO_CARGO",
      "REGISTRO_CONSELHO",
    ]),
    motivo("IDENTIDADE", "Correção de documento de identificação", [
      "IDENTIDADE",
    ]),
    motivo("COTA", "Correção de cota (PP/PI/PQ/PcD)", [
      "COTA_PP",
      "COTA_PI",
      "COTA_PQ",
      "COTA_PCD",
      "MODALIDADE",
    ]),
    motivo("ETNICO", "Correção do critério étnico", ["ETNICO"]),
    motivo("DOCUMENTO_NOVO", "Documento novo da Empregare"),
    motivo("RECURSO", "Decisão de recurso"),
    motivo("COORDENACAO", "Pedido da coordenação ou revisão"),
    motivo("DIGITACAO", "Erro de digitação ou lançamento"),
    motivo(MOTIVO_OUTRO, "Outro"),
  ]);

/** Limites do texto (os do banco). */
export const COMPLEMENTO_DA_REABERTURA = Object.freeze({
  maximo: 500,
  minimoDoOutro: 15,
  palavrasDoOutro: 3,
});

export type ReaberturaValida = {
  ok: true;
  /** Os argumentos de reabrir_ficha além da ficha e da versão. */
  argumentos: { p_motivo: string; p_complemento: string | null };
  /** O motivo legível, como o banco grava no histórico. */
  texto: string;
};
export type ReaberturaInvalida = {
  ok: false;
  campo: "motivo" | "complemento";
  erro: string;
};

export function motivoDaReabertura(codigo: unknown): MotivoDaReabertura | null {
  return MOTIVOS_DA_REABERTURA.find((m) => m.codigo === codigo) ?? null;
}

/** O motivo legível: "Correção de experiência — <complemento>" ou "Outro — <descrição>". */
export function textoDaReabertura(
  codigo: string,
  complemento: unknown,
): string {
  const rotulo = motivoDaReabertura(codigo)?.rotulo ?? "";
  const extra = textoLimpo(complemento);
  return extra ? `${rotulo} — ${extra}` : rotulo;
}

/** Confere a escolha como o banco confere e devolve os argumentos para reabrir_ficha. */
export function validarReabertura(
  codigo: unknown,
  complemento: unknown,
): ReaberturaValida | ReaberturaInvalida {
  const escolhido = motivoDaReabertura(codigo);
  if (!escolhido)
    return {
      ok: false,
      campo: "motivo",
      erro: "Escolha o motivo da reabertura.",
    };
  const extra = textoLimpo(complemento);
  const { maximo, minimoDoOutro, palavrasDoOutro } = COMPLEMENTO_DA_REABERTURA;
  if (extra.length > maximo)
    return { ok: false, campo: "complemento", erro: "Até 500 caracteres." };
  if (escolhido.codigo === MOTIVO_OUTRO) {
    if (
      extra.length < minimoDoOutro ||
      !motivoPareceTexto(extra, palavrasDoOutro)
    )
      return {
        ok: false,
        campo: "complemento",
        erro: "Descreva o motivo com pelo menos 15 caracteres e 3 palavras.",
      };
  } else if (extra && !motivoPareceTexto(extra, 1)) {
    return {
      ok: false,
      campo: "complemento",
      erro: "Escreva o complemento com palavras ou deixe em branco.",
    };
  }
  return {
    ok: true,
    argumentos: { p_motivo: escolhido.codigo, p_complemento: extra || null },
    texto: textoDaReabertura(escolhido.codigo, extra),
  };
}
