/* Motor da classificação: explicação de cada candidato (API pública em ../motor.ts). */

import type {
  BlocoDeEmpate,
  CandidatoDoMotor,
  ContextoDoMotor,
} from "../tipos-do-motor.ts";
import { CRITERIO_POR_CODIGO } from "../catalogo.ts";
import { formatarNota } from "../numeros.ts";
import { descreverValor, primeiroQueSepara } from "./ordenacao.ts";

/* ── Explicação ─────────────────────────────────────────────────────── */

export function explicar(
  c: CandidatoDoMotor,
  linhaGeral: { bloco?: BlocoDeEmpate },
  ctx: ContextoDoMotor,
  tipo: string,
) {
  const partes = [];
  const casas = ctx.casas;
  if (tipo === "FINAL" && c.composicao) {
    const detalhe = c.composicao.partes
      .map(
        (p) =>
          `${p.codigo === "DOCUMENTAL" ? "documental" : p.codigo === "ENTREVISTA" ? "entrevista" : "ART"} ${formatarNota(p.valor, casas)}${p.peso !== 1 ? ` × ${formatarNota(p.peso, 2)}` : ""}`,
      )
      .join(" + ");
    partes.push(
      `Nota ${formatarNota(c.nota, casas)}${detalhe ? ` (${detalhe})` : ""}.`,
    );
    if (c.composicao.faltando.length)
      partes.push(
        `Sem ${c.composicao.faltando.join(", ")}: não somou na nota.`,
      );
  } else partes.push(`Nota ${formatarNota(c.nota, casas)}.`);

  const grupo = (c.grupoDaNota || []).filter((x) => x !== c);
  if (grupo.length) {
    partes.push(
      `Empatado em ${formatarNota(c.nota, casas)} com ${grupo.length}.`,
    );
    const bloco = linhaGeral?.bloco;
    if (bloco?.resolucao === "MESMA_POSICAO_LISTA") {
      partes.push("Nesta lista o empate fica na mesma posição.");
    } else {
      const frases = [];
      for (const outro of grupo) {
        const s = primeiroQueSepara(c, outro, ctx.criterios, ctx);
        if (s) {
          const rotulo =
            CRITERIO_POR_CODIGO[s.criterio]?.rotuloCurto || s.criterio;
          frases.push(
            `${s.sinal < 0 ? "à frente de" : "atrás de"} ${outro.nome} por ${rotulo} (${descreverValor(s.va, s.criterio, c, outro)} × ${descreverValor(s.vb, s.criterio, outro, c)})`,
          );
        } else frases.push(`com ${outro.nome}: empate em todos os critérios`);
      }
      if (frases.length) partes.push(`Desempate: ${frases.join("; ")}.`);
      if (bloco?.resolucao === "SORTEIO")
        partes.push(
          `Empate final resolvido por sorteio (semente ${String(bloco.registro?.semente || "").slice(0, 12)}…).`,
        );
      else if (bloco?.resolucao === "MANUAL")
        partes.push(
          `Empate final por decisão manual: ${bloco.registro?.justificativa || ""}`,
        );
      else if (bloco?.resolucao === "INSCRICAO")
        partes.push(
          `Empate final pela ordem de inscrição (código ${c.codigo || "—"}).`,
        );
      else if (bloco?.resolucao === "MESMA_POSICAO")
        partes.push("Empate final: mesma posição.");
      else if (bloco?.resolucao === "PENDENTE")
        partes.push(
          bloco.metodo === "SORTEIO"
            ? "Empate final aguardando sorteio."
            : "Empate final aguardando decisão manual.",
        );
    }
  }
  return partes;
}

/* As parciais da documental que as publicações mostram (colunas). */
export function parciaisDe(c: CandidatoDoMotor): Record<string, number | null> {
  return {
    FORMACAO: c.pontuacaoFormacao,
    CURSOS: c.pontuacaoCursos,
    EXPERIENCIA: c.pontuacaoExperiencia,
    ETNICO: c.pontuacaoEtnica,
  };
}
