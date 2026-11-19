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
