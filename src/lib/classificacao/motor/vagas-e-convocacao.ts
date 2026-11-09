/* Motor da classificação: modalidades, acúmulo, vagas e convocação (API pública em ../motor.ts). */

import type {
  AlocacaoDoMotor,
  BlocoDeEmpate,
  CandidatoDoMotor,
  ContextoDoMotor,
  LinhaDoMotor,
  RegraDoMotor,
} from "../tipos-do-motor.ts";
import type { VagaMontada } from "../tipos-das-vagas.ts";
import { semAcento } from "../catalogo.ts";
import { formatarNota } from "../numeros.ts";
import { exigir } from "./comum.ts";

/* ── Modalidades, acúmulo e vagas ───────────────────────────────────── */

export function modalidadesNaLista(
  c: CandidatoDoMotor,
  tipo: string,
  regra: RegraDoMotor,
  ordemDoUniverso: {
    posicaoEm: (c: CandidatoDoMotor, codigo: string) => number;
  } | null,
) {
  const conhecidas = new Set(regra.modalidades.map((m) => m.codigo));
  let cods = c.modalidades.filter((m) => conhecidas.has(m) || m === "AC");
  if (tipo !== "FINAL" || regra.cotas.acumulo === "TODAS") return cods;
  const cotas = cods.filter((m) => m !== "AC");
  if (cotas.length < 2) return cods;
  const pct = (m: string) =>
    regra.modalidades.find((x) => x.codigo === m)?.percentual ?? 0;
  const melhor = (lista: string[]) =>
    [...lista].sort(
      (a, b) =>
        pct(b) - pct(a) ||
        (ordemDoUniverso?.posicaoEm(c, a) ?? 0) -
          (ordemDoUniverso?.posicaoEm(c, b) ?? 0),
    )[0];
  let ficam;
  if (regra.cotas.acumulo === "PCD_MAIS_UMA") {
    const outras = cotas.filter((m) => m !== "PCD");
    ficam = [
      ...(cotas.includes("PCD") ? ["PCD"] : []),
      ...(outras.length ? [melhor(outras)] : []),
    ];
  } else ficam = [melhor(cotas)];
  return cods.filter((m) => m === "AC" || ficam.includes(m));
}

export function naGeral(c: CandidatoDoMotor, regra: RegraDoMotor) {
  if ((c.modalidadesNaLista ?? []).includes("AC")) return true;
  return (c.modalidadesNaLista ?? []).some(
    (m) =>
      regra.modalidades.find((x) => x.codigo === m)?.aparece_na_geral !== false,
  );
}

/*
  Quem fica dentro das vagas na lista final: a ampla com os primeiros da geral;
  cada reserva com os primeiros da modalidade que ainda não entraram; reserva
  que sobra vai para o destino da regra (remanejar_para) e, por fim, para a
  ampla. Devolve analiseId → { situacao, modalidade }.
*/
export function alocarVagas(
  vaga: VagaMontada,
  geral: LinhaDoMotor[],
  porModalidade: Record<string, LinhaDoMotor[]>,
  regra: RegraDoMotor,
  ctx: ContextoDoMotor,
): Map<string, AlocacaoDoMotor> {
  const resultado = new Map<string, AlocacaoDoMotor>();
  if (!vaga.porModalidade) return resultado;
  const lugares = { ...vaga.porModalidade };
  const ocupados = new Set();
  const ocupar = (linhas: LinhaDoMotor[], codigo: string, quantos: number) => {
    let usados = 0;
    let i = 0;
    while (i < linhas.length && usados < quantos) {
      const { c, bloco } = exigir(linhas[i]);
      if (ocupados.has(c.analiseId)) {
        i += 1;
        continue;
      }
      const empatados = linhas.filter(
        (l) => l.bloco === bloco && !ocupados.has(l.c.analiseId),
      );
      if (empatados.length > quantos - usados && empatados.length > 1)
        ctx.avisos.push({
          codigo: "EMPATE_NO_LIMITE",
          tom: "warning",
          vaga: vaga.chave,
          texto: `Vaga ${vaga.codigo || vaga.cargo}: empate sem desempate no limite das vagas (${codigo}); resolva o empate antes de publicar.`,
        });
      ocupados.add(c.analiseId);
      resultado.set(c.analiseId, { situacao: "VAGA", modalidade: codigo });
      usados += 1;
      i += 1;
    }
    return quantos - usados;
  };
  const sobra: Record<string, number> = {};
  sobra.AC = ocupar(geral, "AC", lugares.AC || 0);
  for (const m of regra.modalidades) {
    if (m.codigo === "AC") continue;
    sobra[m.codigo] = ocupar(
      porModalidade[m.codigo] || [],
      m.codigo,
      lugares[m.codigo] || 0,
    );
  }
  // Remanejamento: o que sobrou de uma reserva vai para o próximo destino com candidato.
  for (let passo = 0; passo < regra.modalidades.length + 1; passo += 1) {
    let mexeu = false;
    for (const m of regra.modalidades) {
      if (m.codigo === "AC" || !((sobra[m.codigo] ?? 0) > 0)) continue;
      const destinos = [...m.remanejar_para, "AC"];
      for (const destino of destinos) {
        if (!((sobra[m.codigo] ?? 0) > 0)) break;
        const linhas = destino === "AC" ? geral : porModalidade[destino] || [];
        const restante = ocupar(linhas, destino, sobra[m.codigo] ?? 0);
        if (restante !== sobra[m.codigo]) mexeu = true;
        sobra[m.codigo] = restante;
      }
    }
    if (!mexeu) break;
  }
  for (const linhas of [geral, ...Object.values(porModalidade)])
    for (const { c } of linhas)
      if (!resultado.has(c.analiseId))
        resultado.set(c.analiseId, { situacao: "CR", modalidade: null });
  return resultado;
}

/* ── Convocação ─────────────────────────────────────────────────────── */

/** As casas que o múltiplo precisa no texto (1,5 → 1; 3 → 0): o documento não arredonda a regra. */
function casasDoMultiplo(multiplo: number): number {
  for (let casas = 0; casas < 4; casas++) {
    const escalado = multiplo * 10 ** casas;
    if (Math.abs(escalado - Math.round(escalado)) < 1e-9) return casas;
  }
  return 4;
}

export function limiteDaConvocacao(
  vaga: Pick<VagaMontada, "cargo" | "total">,
  regra: RegraDoMotor,
) {
  const conv = regra.convocacao;
  const cargo = semAcento(vaga.cargo);
  const excecao = conv.excecoes.find((e) =>
    e.termos.some((t) => cargo.includes(semAcento(t))),
  );
  const multiplo = excecao?.multiplo_vagas ?? conv.multiplo_vagas;
  const posicaoCr = excecao?.posicao_max_cr ?? conv.posicao_max_cr;
  const total = vaga.total;
  if (total !== null && total > 0 && multiplo !== null)
    return {
      // O desconto absorve o erro do float: 2,2 × 25 dá 55,000…01 e subiria a 56.
      limite: Math.ceil(multiplo * total - 1e-9),
      origem: `${formatarNota(multiplo, casasDoMultiplo(multiplo))} × ${total} vaga(s)${excecao ? " (exceção do cargo)" : ""}`,
    };
  if (posicaoCr !== null)
    return {
      limite: Math.trunc(posicaoCr),
      origem: `até a ${Math.trunc(posicaoCr)}ª posição${excecao ? " (exceção do cargo)" : ""}`,
    };
  return { limite: null, origem: "sem limite na regra" };
}

export function convocar(
  linhas: LinhaDoMotor[],
  limite: number | null,
  incluirEmpatados: boolean,
  ctx: ContextoDoMotor,
  vaga: VagaMontada,
  avisar = true,
): Set<string> {
  if (limite === null) return new Set(linhas.map((l) => l.c.analiseId));
  const convocados = new Set<string>();
  const blocos: { bloco: BlocoDeEmpate; linhas: LinhaDoMotor[] }[] = [];
  for (const l of linhas) {
    if (blocos.at(-1)?.bloco !== l.bloco)
      blocos.push({ bloco: l.bloco, linhas: [] });
    exigir(blocos.at(-1)).linhas.push(l);
  }
  let contados = 0;
  for (const { linhas: membros } of blocos) {
    if (contados >= limite) break;
    if (contados + membros.length <= limite || incluirEmpatados) {
      for (const l of membros) convocados.add(l.c.analiseId);
    } else {
      if (avisar)
        ctx.avisos.push({
          codigo: "EMPATE_NO_LIMITE",
          tom: "warning",
          vaga: vaga.chave,
          texto: `Vaga ${vaga.codigo || vaga.cargo}: empate no limite da convocação; a regra não inclui os empatados — só entra quem cabe (ordem alfabética).`,
        });
      for (const l of membros.slice(0, limite - contados))
        convocados.add(l.c.analiseId);
    }
    contados += membros.length;
  }
  return convocados;
}
