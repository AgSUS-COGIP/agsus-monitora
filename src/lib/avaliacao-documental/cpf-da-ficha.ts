/*
  O CPF que o candidato informou no questionário da Empregare, no cabeçalho
  da ficha (obter_ficha_analise → cpf_informado, 20261015050000): a resposta
  como veio, formatada 000.000.000-00. Pedido da COREs para a identificação.
  Com 11 dígitos, formatado; outra coisa (o candidato escreveu errado), o
  texto como veio, cortado; vazio, null (o cabeçalho não mostra nada).
*/

/** "12345678909" ou "123.456.789-09" → "123.456.789-09"; vazio → null. */
export function cpfDaFicha(valor: unknown): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) return null;
  const digitos = texto.replace(/\D/g, "");
  if (digitos.length === 11)
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
  return texto.slice(0, 20);
}
