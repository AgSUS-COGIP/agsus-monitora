/*
  Texto mínimo dos motivos livres da Avaliação documental (20261021110000):
  barra sequências aleatórias ("dsdfsdfsfsa", "TERERTERTE", "dvdddddddd",
  "TESTE FDFDF") sem barrar textos curtos legítimos ("Nova distribuição.",
  "Erro na CTPS do candidato").

  Um texto "parece texto" quando:
    - nenhuma letra se repete 4 vezes seguidas; e
    - tem pelo menos N palavras DIFERENTES, palavra = sequência de 2 ou mais
      letras com até 3 letras (siglas: RG, CPF, PcD) ou com vogais em pelo
      menos 1 de cada 5 letras.
  Palavra sem vogal suficiente ("dsdfsdfsfsa", "FDFDF", "CTPS") não conta,
  mas também não reprova o texto. A regra é simples de propósito: uma única
  palavra aleatória com vogais ("xasdksajdhadja") passa como complemento;
  o que vale para auditoria é o código do motivo.

  O banco confere o mesmo em private."FC_MOTIVO_PARECE_TEXTO" (a lista de
  vogais e os limites são os mesmos; tests/motivos-da-reabertura-migration
  .test.js compara).
*/

/** Vogais (com acento) que contam para a palavra. */
export const VOGAIS = "aeiouáàâãéêíóôõúü";

/** Palavras diferentes que um motivo livre da fila pede (redistribuir, devolver, revisão, liberar). */
export const MINIMO_DE_PALAVRAS_DA_FILA = 2;

/** Tamanho mínimo e máximo do motivo livre da fila (o do banco). */
export const MOTIVO_DA_FILA = Object.freeze({ minimo: 10, maximo: 2000 });

const VOGAL = new RegExp(`[${VOGAIS}]`, "gu");
const LETRA_REPETIDA = /(\p{L})\1{3,}/u;

/** O texto como o banco o compara: NFC, sem espaços sobrando. */
export function textoLimpo(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function palavraConta(palavra: string): boolean {
  if (palavra.length < 2) return false;
  if (palavra.length <= 3) return true;
  return (palavra.match(VOGAL)?.length ?? 0) * 5 >= palavra.length;
}

/** Quantas palavras diferentes contam no texto (regra acima). */
export function palavrasDoMotivo(texto: unknown): number {
  const minusculo = textoLimpo(texto).toLowerCase();
  const palavras = minusculo.match(/\p{L}+/gu) ?? [];
  return new Set(palavras.filter(palavraConta)).size;
}

/** O texto parece escrito por gente (regra acima), com pelo menos `minimoDePalavras`. */
export function motivoPareceTexto(
  texto: unknown,
  minimoDePalavras = 1,
): boolean {
  const minusculo = textoLimpo(texto).toLowerCase();
  if (LETRA_REPETIDA.test(minusculo)) return false;
  return palavrasDoMotivo(minusculo) >= minimoDePalavras;
}

/**
 * O erro do motivo livre da fila (redistribuir, devolver à fila, mandar para
 * revisão, liberar a reserva de outra pessoa), ou "" quando vale.
 */
export function erroDoMotivoDaFila(texto: unknown): string {
  const limpo = textoLimpo(texto);
  if (
    limpo.length < MOTIVO_DA_FILA.minimo ||
    limpo.length > MOTIVO_DA_FILA.maximo
  )
    return "De 10 a 2.000 caracteres.";
  if (!motivoPareceTexto(limpo, MINIMO_DE_PALAVRAS_DA_FILA))
    return "Escreva o motivo com pelo menos 2 palavras.";
  return "";
}
