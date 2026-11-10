/*
  Data de análise no futuro.

  A data vem digitada na planilha; um 29 no lugar de 28 vira uma análise
  "feita amanhã". O painel trata isso como dado a corrigir (pendência
  prioritária e ponto vermelho no gráfico), não como análise válida.
  Compara só a data do calendário, no fuso de quem abre o painel.
*/
export function dataDeAnaliseNoFuturo(
  data: unknown,
  agora: Date = new Date(),
): boolean {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return false;
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  return dia > hoje;
}

const texto = (valor: unknown) =>
  typeof valor === "string" ||
  typeof valor === "number" ||
  typeof valor === "boolean"
    ? String(valor).trim()
    : "";

const doisDigitos = (numero: number) => String(numero).padStart(2, "0");

/*
  O `new Date` "rola" o que não existe (31/02 vira 03/03, mês 13 vira janeiro
  do ano seguinte). Data impossível fica sem data, para aparecer como dado a
  corrigir em vez de virar outro dia válido.
*/
function diaDoCalendario(ano: number, mes: number, dia: number) {
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia
    ? data
    : null;
}

/*
  dd/mm/aaaa, aaaa-mm-dd ou data e hora ISO. Outro formato fica sem data (não
  adivinha mês/dia trocados).
*/
export function dataDaPlanilha(valor: unknown) {
  const bruto = texto(valor);
  if (!bruto) return null;
  let partes = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (partes)
    return diaDoCalendario(
      Number(partes[3]),
      Number(partes[2]),
      Number(partes[1]),
    );
  partes = bruto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (partes)
    return diaDoCalendario(
      Number(partes[1]),
      Number(partes[2]),
      Number(partes[3]),
    );
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(bruto)) {
    const data = new Date(bruto);
    return Number.isNaN(data.getTime()) ? null : data;
  }
  return null;
}

/**
 * O dia da data da análise como chave `aaaa-mm-dd` (no fuso do navegador, o
 * mesmo do rótulo do gráfico); "" sem data reconhecida. É o formato do
 * `<input type="date">`, então o clique no gráfico e o campo falam a mesma
 * língua.
 */
export function chaveDoDia(valor: unknown) {
  const data = dataDaPlanilha(valor);
  if (!data) return "";
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}
