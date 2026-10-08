/*
  O parecer da entrevista em TEXTO PRONTO, para copiar (SEI, e-mail), como a
  ficha da Avaliação documental faz: quem, onde, o roteiro e a banca, a nota
  de cada competência com o mínimo, o total e o parecer com o motivo. Sem DOM;
  as notas e o parecer vêm de `calcularEntrevista` (as mesmas regras do
  banco) — nada é recalculado aqui.
*/

export type CompetenciaDoParecer = {
  nome: string;
  nota: number | null;
  maximo: number;
  minimo: number | null;
};

export type EntradaDoParecer = {
  candidato: string;
  codigo?: string | null;
  edital?: string | null;
  vaga?: string | null;
  cargo?: string | null;
  roteiro?: string | null;
  versao?: string | null;
  avaliadores: { nome?: string | null; origem?: string | null }[];
  competencias: CompetenciaDoParecer[];
  total: number | null;
  maxima: number;
  minimoTotal: number | null;
  parecer: string;
  motivos: string[];
  faltou: boolean;
  ausenciaElimina?: boolean;
};

const texto = (valor: unknown) => String(valor ?? "").trim();
const numero = (valor: number | null | undefined) =>
  valor === null || valor === undefined
    ? "—"
    : Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const PARECER: Record<string, string> = {
  APTO: "APTO",
  INAPTO: "INAPTO",
};

/** O parecer está pronto para copiar: compareceu (ou faltou) e tem parecer. */
export function parecerPronto(parecer: string, pendencia: string): boolean {
  return !pendencia && Boolean(PARECER[parecer]);
}

/** O texto do parecer, uma informação por linha. */
export function textoDoParecerDaEntrevista(e: EntradaDoParecer): string {
  const linhas: string[] = [];
  const quem = texto(e.candidato) || "Candidato";
  linhas.push(
    `Parecer da entrevista — ${quem}${texto(e.codigo) ? ` (cód. ${texto(e.codigo)})` : ""}`,
  );
  const onde = [
    texto(e.edital) ? `Edital ${texto(e.edital)}` : "",
    texto(e.vaga) ? `Vaga ${texto(e.vaga)}` : "",
    texto(e.cargo),
  ].filter(Boolean);
  if (onde.length) linhas.push(onde.join(" · "));
  if (texto(e.roteiro))
    linhas.push(
      `Roteiro: ${texto(e.roteiro)}${texto(e.versao) ? ` · ${texto(e.versao)}` : ""}`,
    );
  const banca = e.avaliadores
    .map(
      (a) =>
        `${texto(a.nome) || "Sem nome"}${texto(a.origem) ? ` (${texto(a.origem)})` : ""}`,
    )
    .filter(Boolean);
  if (banca.length) linhas.push(`Banca: ${banca.join(", ")}`);
  linhas.push("");

  if (e.faltou) {
    linhas.push("O candidato não compareceu à entrevista.");
    linhas.push(
      e.ausenciaElimina === false
        ? `Parecer: ${PARECER[e.parecer] || e.parecer} — neste roteiro a ausência não elimina; total 0.`
        : `Parecer: ${PARECER[e.parecer] || e.parecer} — a ausência elimina neste roteiro.`,
    );
    return linhas.join("\n");
  }

  linhas.push("Notas por competência (média da banca):");
  e.competencias.forEach((c, i) => {
    linhas.push(
      `${i + 1}. ${texto(c.nome)}: ${numero(c.nota)} de ${numero(c.maximo)}${c.minimo !== null ? ` (mínimo ${numero(c.minimo)})` : ""}`,
    );
  });
  linhas.push(
    `Total: ${numero(e.total)} de ${numero(e.maxima)}${e.minimoTotal !== null ? ` (mínimo ${numero(e.minimoTotal)})` : ""}`,
  );
  linhas.push("");
  const motivo =
    e.parecer === "APTO"
      ? e.minimoTotal !== null || e.competencias.some((c) => c.minimo !== null)
        ? "atingiu os mínimos do roteiro."
        : "notas lançadas por toda a banca."
      : e.motivos.length
        ? e.motivos.map((m) => m.replace(/\.$/, "")).join("; ") + "."
        : "não atingiu os mínimos do roteiro.";
  linhas.push(`Parecer: ${PARECER[e.parecer] || e.parecer} — ${motivo}`);
  return linhas.join("\n");
}
