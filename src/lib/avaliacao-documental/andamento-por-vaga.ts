/*
  O bloco "Por vaga" do andamento da Fila, sem DOM e sem React: o cargo curto
  ("CARGO 1: QUÍMICO - Análise da Água (Nível Superior)" vira "QUÍMICO -
  Análise da Água"), a ordem da lista (a do banco, por progresso ou por
  pendentes), o resumo da linha recolhida e o aberto/fechado lembrado por
  usuário neste navegador. As contas vêm de andamentoDaFila (fila.ts).
*/

export type AndamentoDaVaga = {
  codigo: string;
  cargo: string;
  lotacao?: string;
  lote: number;
  concluidas: number;
  em_analise: number;
  revisao: number;
  pendentes: number;
};

export type OrdemPorVaga = "banco" | "vaga" | "progresso" | "pendentes";

const PREFIXO_DO_CARGO = /^\s*cargo\s*\d+\s*[:\-–—.]\s*/i;
const NIVEL_NO_FIM = /\s*\((n[ií]vel|nivel)[^)]*\)\s*$/i;

/** O cargo sem "CARGO n:" na frente nem "(Nível …)" no fim. */
export function cargoCurto(cargo: string | null | undefined): string {
  const texto = String(cargo ?? "").trim();
  const curto = texto.replace(PREFIXO_DO_CARGO, "").replace(NIVEL_NO_FIM, "");
  return curto.trim() || texto;
}

const progresso = (v: AndamentoDaVaga) => (v.lote ? v.concluidas / v.lote : 1);

/** A lista na ordem pedida; "banco" mantém a do edital. Empate: a ordem do edital. */
export function ordenarPorVaga(
  vagas: readonly AndamentoDaVaga[],
  ordem: OrdemPorVaga,
): AndamentoDaVaga[] {
  const lista = vagas.map((v, i) => ({ v, i }));
  const comparar: Record<
    OrdemPorVaga,
    (a: AndamentoDaVaga, b: AndamentoDaVaga) => number
  > = {
    banco: () => 0,
    vaga: (a, b) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }),
    progresso: (a, b) => progresso(a) - progresso(b),
    pendentes: (a, b) => b.pendentes - a.pendentes,
  };
  const f = comparar[ordem] ?? comparar.banco;
  return lista.sort((a, b) => f(a.v, b.v) || a.i - b.i).map((x) => x.v);
}

/** "30 vagas · 26 com pendências · 2 concluídas" — a linha do bloco recolhido. */
export function resumoPorVaga(vagas: readonly AndamentoDaVaga[]): string {
  const comPendencia = vagas.filter((v) => v.pendentes > 0).length;
  const concluidas = vagas.filter(
    (v) => v.lote > 0 && v.concluidas === v.lote,
  ).length;
  return [
    `${vagas.length} ${vagas.length === 1 ? "vaga" : "vagas"}`,
    comPendencia ? `${comPendencia} com pendências` : "nenhuma com pendências",
    concluidas
      ? `${concluidas} ${concluidas === 1 ? "concluída" : "concluídas"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

const CHAVE = "monitora.avaliacao-documental.por-vaga-aberto";
const chave = (usuario: string | null | undefined) =>
  `${CHAVE}:${usuario || "anonimo"}`;

/** Aberto ou fechado na última vez (deste usuário, neste navegador). Fechado por padrão. */
export function lerPorVagaAberto(usuario: string | null | undefined): boolean {
  try {
    return globalThis.localStorage?.getItem(chave(usuario)) === "1";
  } catch {
    return false;
  }
}

export function gravarPorVagaAberto(
  usuario: string | null | undefined,
  aberto: boolean,
): void {
  try {
    if (aberto) globalThis.localStorage?.setItem(chave(usuario), "1");
    else globalThis.localStorage?.removeItem(chave(usuario));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}
