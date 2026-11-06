/* Motor da classificação: ordenação e empate (API pública em ../motor.ts). */

import type {
  BlocoDeEmpate,
  CandidatoDoMotor,
  ContextoDoMotor,
  CriterioDoMotor,
  DesempateDoMotor,
  LinhaDoMotor,
  RegraDoMotor,
} from "../tipos-do-motor.ts";
import { CRITERIO_POR_CODIGO } from "../catalogo.ts";
import {
  dataBR,
  escalar,
  formatarNota,
  horaBR,
  HORA_SEM_CERTIDAO,
  numeroBR,
} from "../numeros.ts";
import { chaveDoGrupo } from "../sorteio.ts";
import { comparaNome, exigir } from "./comum.ts";

/* ── Ordenação e empate ─────────────────────────────────────────────── */

export function valorDoCriterio(
  c: CandidatoDoMotor,
  criterio: string,
  ctx: ContextoDoMotor,
) {
  const v = CRITERIO_POR_CODIGO[criterio]?.ler(c, ctx);
  return v === undefined ? null : v;
}

/* Nulo perde sempre (vai depois), qualquer que seja a direção. */
export function compararValores(
  a: number | boolean | null,
  b: number | boolean | null,
  direcao: string,
) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const x = typeof a === "boolean" ? Number(a) : a;
  const y = typeof b === "boolean" ? Number(b) : b;
  if (Math.abs(x - y) < 1e-9) return 0;
  const maiorPrimeiro =
    direcao === "SIM_PRIMEIRO" || direcao === "MAIOR_PRIMEIRO";
  return maiorPrimeiro ? (y > x ? 1 : -1) : x > y ? 1 : -1;
}

/*
  O valor de um critério na explicação. "Maior idade" mostra a data de
  nascimento e, quando as duas pessoas nasceram no mesmo dia, a hora da
  certidão (sem certidão, 23h59min59s — itens 6.11.5 e 6.11.6 do 93/2026).
*/
export function descreverValor(
  valor: number | boolean | null,
  criterio: string,
  c: CandidatoDoMotor,
  outro: CandidatoDoMotor,
) {
  if (valor === null) return "sem dado";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (criterio === "MAIOR_IDADE" && c) {
    if (outro?.dataNascimento !== c.dataNascimento)
      return `nasc. ${dataBR(c.dataNascimento)}`;
    return c.horaNascimento
      ? `${horaBR(c.horaNascimento)} pela certidão`
      : `${horaBR(HORA_SEM_CERTIDAO)}, sem certidão`;
  }
  if (criterio === "EXP_PROFISSIONAL_TEMPO")
    return `${formatarNota(valor, 0)} dias`;
  return formatarNota(valor, Number.isInteger(valor) ? 0 : 2);
}

/*
  Os pares do grupo de empate que chegam à "maior idade" com a MESMA data de
  nascimento: só a hora da certidão os separa (sem certidão, 23:59:59).
*/
export function paresNaMesmaData(
  grupo: CandidatoDoMotor[],
  criterios: CriterioDoMotor[],
  ctx: ContextoDoMotor,
): [CandidatoDoMotor, CandidatoDoMotor][] {
  const i = criterios.findIndex((d) => d.criterio === "MAIOR_IDADE");
  if (i < 0) return [];
  const antes = criterios.slice(0, i);
  const pares: [CandidatoDoMotor, CandidatoDoMotor][] = [];
  for (let x = 0; x < grupo.length; x += 1)
    for (let y = x + 1; y < grupo.length; y += 1) {
      const a = exigir(grupo[x]),
        b = exigir(grupo[y]);
      if (!a.dataNascimento || a.dataNascimento !== b.dataNascimento) continue;
      if (primeiroQueSepara(a, b, antes, ctx)) continue;
      pares.push([a, b]);
    }
  return pares;
}

/** O primeiro critério que separa a e b: `{ criterio, direcao, va, vb, sinal }` ou null. */
export function primeiroQueSepara(
  a: CandidatoDoMotor,
  b: CandidatoDoMotor,
  criterios: CriterioDoMotor[],
  ctx: ContextoDoMotor,
) {
  for (const { criterio, direcao } of criterios) {
    const va = valorDoCriterio(a, criterio, ctx);
    const vb = valorDoCriterio(b, criterio, ctx);
    const sinal = compararValores(va, vb, direcao);
    if (sinal !== 0) return { criterio, direcao, va, vb, sinal };
  }
  return null;
}

function codigoDeInscricao(c: CandidatoDoMotor) {
  const n = numeroBR(c.codigo);
  return n === null ? null : n;
}

/*
  A ordem de UMA vaga: blocos de quem fica na mesma posição. Cada bloco diz
  como foi resolvido (único, critérios, sorteio, manual, inscrição, mesma
  posição ou pendente).
*/
export function ordenarVaga(
  elegiveis: CandidatoDoMotor[],
  {
    usarCriterios,
    tipo,
    vaga,
    ctx,
    residualNaMesmaPosicao = false,
  }: {
    usarCriterios: boolean;
    tipo: string;
    vaga: string;
    ctx: ContextoDoMotor;
    residualNaMesmaPosicao?: boolean;
  },
) {
  const { criterios, regra, desempates } = ctx;
  const porNota = new Map<number | null, CandidatoDoMotor[]>();
  for (const c of elegiveis) {
    const k = escalar(c.nota, ctx.casas);
    if (!porNota.has(k)) porNota.set(k, []);
    exigir(porNota.get(k)).push(c);
  }
  const blocos: BlocoDeEmpate[] = [];
  for (const k of [...porNota.keys()].sort((a, b) => (b ?? 0) - (a ?? 0))) {
    const grupo = exigir(porNota.get(k)).sort(comparaNome);
    for (const c of grupo) c.grupoDaNota = grupo;
    if (grupo.length === 1) {
      blocos.push({ membros: grupo, resolucao: "UNICO" });
      continue;
    }
    if (!usarCriterios) {
      blocos.push({ membros: grupo, resolucao: "MESMA_POSICAO_LISTA" });
      continue;
    }
    const ordenado = [...grupo].sort((a, b) => {
      const s = primeiroQueSepara(a, b, criterios, ctx);
      return s ? s.sinal : comparaNome(a, b);
    });
    // Blocos de quem empata em todos os critérios.
    const subs: CandidatoDoMotor[][] = [];
    for (const c of ordenado) {
      const ultimo = subs.at(-1);
      if (ultimo && !primeiroQueSepara(exigir(ultimo[0]), c, criterios, ctx))
        ultimo.push(c);
      else subs.push([c]);
    }
    for (const sub of subs) {
      if (sub.length === 1) {
        blocos.push({ membros: sub, resolucao: "CRITERIOS" });
        continue;
      }
      if (residualNaMesmaPosicao) {
        blocos.push({ membros: sub, resolucao: "MESMA_POSICAO" });
        continue;
      }
      blocos.push(
        ...resolverEmpateFinal(sub, { tipo, vaga, regra, desempates, ctx }),
      );
    }
  }
  return blocos;
}

function resolverEmpateFinal(
  sub: CandidatoDoMotor[],
  {
    tipo,
    vaga,
    regra,
    desempates,
    ctx,
  }: {
    tipo: string;
    vaga: string;
    regra: RegraDoMotor;
    desempates: DesempateDoMotor[];
    ctx: ContextoDoMotor;
  },
): BlocoDeEmpate[] {
  const metodo = regra.empate_final.metodo;
  const ids = sub.map((c) => c.analiseId);
  const chave = chaveDoGrupo(tipo, vaga, ids);
  if (metodo === "MESMA_POSICAO")
    return [{ membros: sub, resolucao: "MESMA_POSICAO", chave }];
  if (metodo === "ORDEM_INSCRICAO") {
    const com = sub.filter((c) => codigoDeInscricao(c) !== null);
    const sem = sub.filter((c) => codigoDeInscricao(c) === null);
    for (const c of sem)
      ctx.avisos.push({
        codigo: "INSCRICAO_SEM_CODIGO",
        tom: "warning",
        vaga,
        analiseId: c.analiseId,
        texto: `${c.nome}: sem código de inscrição numérico; fica empatado depois dos que têm.`,
      });
    const blocos: BlocoDeEmpate[] = [];
    for (const c of com.sort(
      (a, b) =>
        (codigoDeInscricao(a) ?? 0) - (codigoDeInscricao(b) ?? 0) ||
        comparaNome(a, b),
    )) {
      const ultimo = blocos.at(-1);
      if (
        ultimo &&
        codigoDeInscricao(exigir(ultimo.membros[0])) === codigoDeInscricao(c)
      ) {
        ultimo.membros.push(c);
        ultimo.resolucao = "MESMA_POSICAO";
      } else blocos.push({ membros: [c], resolucao: "INSCRICAO", chave });
    }
    if (sem.length)
      blocos.push({
        membros: sem,
        resolucao: sem.length > 1 ? "MESMA_POSICAO" : "INSCRICAO",
        chave,
      });
    return blocos;
  }
  // Sorteio ou decisão manual: vale o registro do mesmo grupo (mesma chave).
  const metodoDoRegistro = metodo === "SORTEIO" ? "SORTEIO" : "MANUAL";
  const registro = desempates.find(
    (d) => d.chave === chave && d.metodo === metodoDoRegistro,
  );
  if (registro) {
    ctx.desempatesUsados.add(registro.id || chave);
    const ordem = registro.ordem.map(String);
    const membros = [...sub].sort(
      (a, b) => ordem.indexOf(a.analiseId) - ordem.indexOf(b.analiseId),
    );
    return membros.map((c) => ({
      membros: [c],
      resolucao: metodoDoRegistro,
      chave,
      registro,
    }));
  }
  return [
    { membros: sub, resolucao: "PENDENTE", chave, metodo: metodoDoRegistro },
  ];
}

/** Posições de uma lista (membros filtrados dos blocos), na numeração da regra. */
export function numerar(
  blocos: BlocoDeEmpate[],
  pertence: (c: CandidatoDoMotor) => boolean,
  numeracao: string,
): LinhaDoMotor[] {
  const linhas: LinhaDoMotor[] = [];
  let contador = 0;
  let antes = 0;
  for (const bloco of blocos) {
    const membros = bloco.membros.filter(pertence);
    if (!membros.length) continue;
    contador += 1;
    const posicao = numeracao === "SALTANDO" ? antes + 1 : contador;
    for (const c of membros)
      linhas.push({ c, posicao, bloco, empatados: membros.length });
    antes += membros.length;
  }
  return linhas;
}
