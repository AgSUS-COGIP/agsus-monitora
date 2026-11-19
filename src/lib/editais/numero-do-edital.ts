/*
  O número do edital num texto, como private."FC_NUMERO_EDITAL" do banco: o
  primeiro "N/AAAA", sem zeros à esquerda. Uma regra só para quem compara
  editais pelo número (anexos do edital, encerramento, ritmo da análise e
  visão geral da área).
*/

/** "Edital nº 091/2026 - Projetos" → "91/2026"; "" sem número. */
export function numeroDoEdital(valor: unknown): string {
  const texto =
    typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
  const m = texto.match(/(\d{1,4})\s*\/\s*(\d{4})/);
  return m ? `${Number(m[1])}/${m[2]}` : "";
}

/**
 * O mesmo número, como está escrito (para mostrar, não para comparar):
 * "Edital nº 03/2025 - DSEI" → "03/2025"; "" sem número.
 */
export function numeroComoEscrito(valor: unknown): string {
  const texto =
    typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
  const m = texto.match(/(\d{1,4})\s*\/\s*(\d{4})/);
  return m ? `${m[1]}/${m[2]}` : "";
}

/**
 * Ordem dos editais pelo número, a das listas e filtros: do mais recente para
 * o mais antigo, pelo ano e depois pelo número ("12/2026", "3/2026",
 * "95/2025", "94/2025"); sem número, no fim. Não compara o texto: como texto,
 * "94/2025" vinha antes de "94/2026" e de "95/2025".
 */
export function compararNumeroDoEdital(a: unknown, b: unknown): number {
  const partes = (valor: unknown): [number, number] | null => {
    const n = numeroDoEdital(valor);
    if (!n) return null;
    const [numero = "0", ano = "0"] = n.split("/");
    return [Number(ano), Number(numero)];
  };
  const pa = partes(a);
  const pb = partes(b);
  if (!pa || !pb) return pa ? -1 : pb ? 1 : 0;
  return pb[0] - pa[0] || pb[1] - pa[1];
}
