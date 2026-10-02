/*
  Números da classificação em pt-BR, sem surpresa.

  O Apps Script antigo lia "12,5" como 0 (Number("12,5") é NaN e virava zero)
  e o candidato caía para o fim da lista sem aviso. Aqui:
  - `numeroBR` aceita "12,5", "12.5", "1.234,5", " 13 ", 7 e devolve `null`
    (nunca 0) para o que não é número — quem chama decide o aviso;
  - as comparações são feitas em inteiros na escala das casas publicadas
    (`escalar`), para que 52,005 e 52,00 não "empatem" por acaso de ponto
    flutuante, e o empate seja o da nota que sai na lista.
*/

const MILHAR = /^-?\d{1,3}(\.\d{3})+$/;

/** "12,5" → 12.5; "1.234,5" → 1234.5; "abc", "", null → null. */
export function numeroBR(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "bigint") return Number(valor);
  const texto = String(valor ?? "")
    .trim()
    .replace(/\s+/g, "");
  if (!texto) return null;
  let normal = texto;
  if (texto.includes(",") && texto.includes(".")) {
    // O separador que vem por último é o decimal.
    normal =
      texto.lastIndexOf(",") > texto.lastIndexOf(".")
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto.replace(/,/g, "");
  } else if (texto.includes(",")) {
    if ((texto.match(/,/g) || []).length > 1) return null;
    normal = texto.replace(",", ".");
  } else if (MILHAR.test(texto) && (texto.match(/\./g) || []).length > 1) {
    normal = texto.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null;
  const numero = Number(normal);
  return Number.isFinite(numero) ? numero : null;
}

export const ARREDONDAMENTOS = Object.freeze([
  ["MEIO_PARA_CIMA", "Arredondar (0,5 para cima)"],
  ["TRUNCAR", "Truncar"],
  ["NENHUM", "Sem arredondamento"],
]);

/*
  Arredonda na escala de `casas` decimais. O épsilon relativo corrige a
  representação binária (1,005 é 1,00499… em ponto flutuante).
*/
export function arredondar(valor, casas = 2, modo = "MEIO_PARA_CIMA") {
  if (valor === null || valor === undefined || !Number.isFinite(valor))
    return null;
  if (modo === "NENHUM") return valor;
  const fator = 10 ** Math.max(0, Math.min(6, Math.trunc(casas)));
  const escalado = valor * fator;
  const ajuste = Math.abs(escalado) * Number.EPSILON * 8;
  const inteiro =
    modo === "TRUNCAR"
      ? Math.trunc(escalado + Math.sign(escalado) * ajuste)
      : Math.sign(escalado) * Math.round(Math.abs(escalado) + ajuste);
  return inteiro / fator + 0;
}

/** O valor em inteiro na escala das casas (para comparar). `null` fica `null`. */
export function escalar(valor, casas = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(valor))
    return null;
  const fator = 10 ** Math.max(0, Math.min(6, Math.trunc(casas)));
  return Math.round(valor * fator + Math.sign(valor) * 1e-9);
}

/** 52 → "52,00" (casas fixas); null → "—". */
export function formatarNota(valor, casas = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(valor))
    return "—";
  const c = Math.max(0, Math.min(6, Math.trunc(casas)));
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: c,
    maximumFractionDigits: c,
    useGrouping: false,
  });
}

/** 1 → "1º". */
export function ordinal(posicao) {
  return Number.isFinite(posicao) ? `${posicao}º` : "—";
}

/*
  Data em "AAAA-MM-DD" (ou ISO com hora, ou "DD/MM/AAAA") → { ano, mes, dia }.
  Inválida → null. Sem `Date` para não depender do fuso.
*/
export function lerData(valor) {
  const texto = String(valor ?? "").trim();
  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let ano;
  let mes;
  let dia;
  if (m) [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (dia > diasNoMes) return null;
  return { ano, mes, dia };
}

/** Idade em anos completos na data de corte (aniversário no dia conta). */
export function idadeNaData(nascimento, corte) {
  const n = lerData(nascimento);
  const c = lerData(corte);
  if (!n || !c) return null;
  let idade = c.ano - n.ano;
  if (c.mes < n.mes || (c.mes === n.mes && c.dia < n.dia)) idade -= 1;
  return idade;
}

/** Dias de vida na data de corte (para "maior idade"). */
export function diasDeVida(nascimento, corte) {
  const n = lerData(nascimento);
  const c = lerData(corte);
  if (!n || !c) return null;
  const dias =
    (Date.UTC(c.ano, c.mes - 1, c.dia) - Date.UTC(n.ano, n.mes - 1, n.dia)) /
    86400000;
  return dias >= 0 ? dias : null;
}

/** "2026-07-20" → "20/07/2026". */
export function dataBR(valor) {
  const d = lerData(valor);
  if (!d) return "";
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(d.dia)}/${dois(d.mes)}/${d.ano}`;
}
