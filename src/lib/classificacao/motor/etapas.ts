/* Motor da classificação: etapas eliminatórias e nota composta (API pública em ../motor.ts). */

import type {
  CandidatoDoMotor,
  ComposicaoDaNota,
  ContextoDoMotor,
  RegraDoMotor,
} from "../tipos-do-motor.ts";
import { SITUACOES_AGUARDANDO_ANALISE, semAcento } from "../catalogo.ts";
import { arredondar, escalar, formatarNota } from "../numeros.ts";
import { nivelDaVaga } from "../vagas.ts";

/* ── Etapas ─────────────────────────────────────────────────────────── */

function situacaoApta(c: CandidatoDoMotor, regra: RegraDoMotor) {
  const aptas = regra.documental.situacoes_aptas.map(semAcento);
  if (!aptas.length) return true;
  return [c.status, c.etapa].some((s) => s && aptas.includes(semAcento(s)));
}

/*
  Ainda sem resultado na avaliação documental (ficha Pendente, Em análise ou
  em Revisar): não é eliminado nem entra nas listas — aguarda a análise.
  Uma situação apta (status ou etapa) prevalece.
*/
export function aguardandoAnalise(
  c: Pick<CandidatoDoMotor, "status" | "etapa">,
  regra: RegraDoMotor,
) {
  if (!regra.etapas.documental) return false;
  const aptas = regra.documental.situacoes_aptas.map(semAcento);
  const situacoes = [c.status, c.etapa]
    .filter(Boolean)
    .map((s) => semAcento(s).trim());
  if (situacoes.some((s) => aptas.includes(s))) return false;
  return situacoes.some((s) => SITUACOES_AGUARDANDO_ANALISE.includes(s));
}

/** A eliminação na documental, ou null. Avisos de nível desconhecido vão por vaga. */
export function eliminacaoDocumental(
  c: CandidatoDoMotor,
  regra: RegraDoMotor,
  ctx: ContextoDoMotor,
) {
  if (!regra.etapas.documental) return null;
  if (!situacaoApta(c, regra)) {
    // Reprovado na análise E abaixo da nota mínima: a publicação diz os dois.
    const minimo = regra.documental.nota_minima;
    const abaixo =
      minimo !== null &&
      c.notaDocumental !== null &&
      (escalar(c.notaDocumental, 4) ?? 0) < (escalar(minimo, 4) ?? 0);
    return {
      motivo: "NAO_HABILITADO",
      detalhe: `Situação na análise: ${c.status || c.etapa || "não informada"}.${
        abaixo
          ? ` Nota ${formatarNota(c.notaDocumental, ctx.casas)}, abaixo do mínimo de ${formatarNota(minimo, ctx.casas)}.`
          : ""
      }`,
    };
  }
  if (c.notaDocumental === null)
    return { motivo: "SEM_NOTA_DOCUMENTAL", detalhe: "" };
  const porNivel = regra.documental.nota_minima_por_nivel;
  let minimo = regra.documental.nota_minima;
  let nivel = null;
  if (Object.keys(porNivel).length) {
    nivel = nivelDaVaga(c, regra);
    if (nivel && porNivel[nivel] !== undefined)
      minimo = porNivel[nivel] ?? null;
    else if (!nivel) ctx.nivelDesconhecido.add(c.vaga);
  }
  if (
    minimo !== null &&
    (escalar(c.notaDocumental, 4) ?? 0) < (escalar(minimo, 4) ?? 0)
  )
    return {
      motivo: "ABAIXO_NOTA_MINIMA_DOCUMENTAL",
      detalhe: `Nota ${formatarNota(c.notaDocumental, ctx.casas)}; mínimo ${formatarNota(minimo, ctx.casas)}${nivel ? ` (${nivel})` : ""}.`,
    };
  return null;
}

export function eliminacaoEntrevista(
  c: CandidatoDoMotor,
  regra: RegraDoMotor,
  ctx: ContextoDoMotor,
) {
  if (!regra.etapas.entrevista) return null;
  const e = c.entrevista;
  const ent = regra.entrevista;
  if (!e) return { motivo: "SEM_ENTREVISTA", detalhe: "" };
  if (ent.exige_comparecimento && e.compareceu === "N")
    return { motivo: "AUSENTE", detalhe: "" };
  if (ent.inapto_elimina && e.parecer === "INAPTO")
    return { motivo: "INAPTO_ENTREVISTA", detalhe: "" };
  if (ent.so_parecer)
    return e.parecer === "APTO"
      ? null
      : { motivo: "SEM_PARECER_ENTREVISTA", detalhe: "" };
  if (e.nota === null) return { motivo: "SEM_NOTA_ENTREVISTA", detalhe: "" };
  if (
    ent.nota_minima !== null &&
    (escalar(e.nota, 4) ?? 0) < (escalar(ent.nota_minima, 4) ?? 0)
  )
    return {
      motivo: "ABAIXO_NOTA_MINIMA_ENTREVISTA",
      detalhe: `Nota ${formatarNota(e.nota, ctx.casas)}; mínimo ${formatarNota(ent.nota_minima, ctx.casas)}.`,
    };
  const exigeCompetencia =
    ent.nota_minima_competencia !== null ||
    ent.nota_eliminatoria_ate !== null ||
    ent.competencias.some((x) => x.minimo !== null);
  if (exigeCompetencia && !e.notas.some((n) => n.nota !== null))
    ctx.avisos.push({
      codigo: "SEM_NOTAS_COMPETENCIA",
      tom: "warning",
      vaga: c.vaga,
      analiseId: c.analiseId,
      texto: `${c.nome}: a entrevista não tem as notas por competência; o mínimo por competência não foi conferido.`,
    });
  for (const n of e.notas) {
    if (n.nota === null) continue;
    const comp = ent.competencias.find((x) => x.ordem === n.ordem);
    const nome = comp?.nome || n.criterio || `Competência ${n.ordem}`;
    if (
      ent.nota_eliminatoria_ate !== null &&
      (escalar(n.nota, 4) ?? 0) <= (escalar(ent.nota_eliminatoria_ate, 4) ?? 0)
    )
      return {
        motivo: "COMPETENCIA_ELIMINATORIA",
        detalhe: `${nome}: ${formatarNota(n.nota, ctx.casas)} (elimina até ${formatarNota(ent.nota_eliminatoria_ate, ctx.casas)}).`,
      };
    const minimo = comp?.minimo ?? ent.nota_minima_competencia;
    if (
      minimo !== null &&
      (escalar(n.nota, 4) ?? 0) < (escalar(minimo, 4) ?? 0)
    )
      return {
        motivo: "COMPETENCIA_ABAIXO_MINIMO",
        detalhe: `${nome}: ${formatarNota(n.nota, ctx.casas)} (mínimo ${formatarNota(minimo, ctx.casas)}).`,
      };
  }
  return null;
}

/** A nota final pela composição da regra (pesos e arredondamento). */
export function notaComposta(
  c: Pick<CandidatoDoMotor, "notaDocumental" | "notaEntrevista" | "notaArt">,
  regra: RegraDoMotor,
): ComposicaoDaNota {
  const { componentes, casas, arredondamento } = regra.composicao;
  const valores: Record<string, number | null | undefined> = {
    DOCUMENTAL: c.notaDocumental,
    ENTREVISTA: c.notaEntrevista,
    ART: c.notaArt,
  };
  let soma = 0;
  const partes = [];
  const faltando = [];
  for (const { codigo, peso } of componentes) {
    const v = valores[codigo];
    if (v === null || v === undefined) {
      faltando.push(codigo);
      continue;
    }
    soma += v * peso;
    partes.push({ codigo, valor: v, peso });
  }
  return { nota: arredondar(soma, casas, arredondamento), partes, faltando };
}
