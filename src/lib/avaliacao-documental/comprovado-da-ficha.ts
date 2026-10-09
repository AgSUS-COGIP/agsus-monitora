/*
  O que os itens lançados na ficha COMPROVAM, em texto, ao lado do que o
  candidato declarou: o tempo de experiência (dos vínculos aceitos), os
  cursos (quantos e quantas horas) e os títulos. Só leitura do que a conta já
  fez: o tempo vem de `avaliacao.experiencia` (apurarExperiencia, em
  pontuacao.js: união dos vínculos aceitos, emenda do dia seguinte, dias ÷
  dias_por_mes, só os meses inteiros), então o texto muda a cada vínculo ou
  aceite e nunca diverge dos pontos. A divisão "além do mínimo → períodos →
  pontos" repete a fórmula de apurarExperiencia só para explicar a conta.
*/
import { anosMesesDias, doNivel, tetoDoBloco } from "./pontuacao.js";

type ExperienciaApurada = {
  dias_total: number;
  meses: number;
  meses_estagio: number;
  meses_considerados: number;
  pontos: number;
  abaixo_do_minimo: boolean;
};

type BlocoDeVinculos = {
  tipo: string;
  minimo_meses?: number | null;
  desconta_minimo?: boolean;
  pontuacao?: string;
  periodo_meses?: number | null;
  pontos_por_periodo?: number | null;
  pontos_por_mes?: number | null;
  teto?: number | null;
  por_nivel?: Record<string, unknown>;
  minimo_conta_estagio?: boolean;
  efeito_minimo?: string;
  item_minimo?: string;
  item_edital?: string;
};

export type Comprovado = {
  /** "Comprovado: 2 anos, 7 meses e 27 dias (32 meses)". */
  texto: string;
  /** A conta dos pontos, quando o bloco pontua ("Além do mínimo…"). */
  detalhe: string | null;
  /** Abaixo do mínimo exigido pela regra (pede atenção). */
  abaixoDoMinimo: boolean;
};

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;
const horasBr = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pontosBr = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${n === 1 ? "ponto" : "pontos"}`;

function juntar(partes: string[]) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/** "2 anos, 7 meses e 27 dias" (anos de 365 e meses de 30, como o desempate). */
export function textoDoTempo(dias: number): string {
  const t = anosMesesDias(dias) as {
    anos: number;
    meses: number;
    dias: number;
  };
  const partes = [
    t.anos ? plural(t.anos, "ano", "anos") : "",
    t.meses ? plural(t.meses, "mês", "meses") : "",
    t.dias ? plural(t.dias, "dia", "dias") : "",
  ].filter(Boolean);
  return partes.length ? juntar(partes) : "0 dias";
}

/** Os meses que o mínimo confere (com ou sem o estágio, como na conta). */
export function mesesDoMinimo(
  bloco: BlocoDeVinculos,
  experiencia: ExperienciaApurada,
): number {
  return bloco.minimo_conta_estagio
    ? experiencia.meses_considerados
    : experiencia.meses;
}

/** O tempo comprovado pelos vínculos aceitos e a conta dos pontos. */
export function comprovadoDaExperiencia(
  bloco: BlocoDeVinculos,
  experiencia: ExperienciaApurada | null | undefined,
  nivel: string | null | undefined,
): Comprovado {
  const exp: ExperienciaApurada = experiencia ?? {
    dias_total: 0,
    meses: 0,
    meses_estagio: 0,
    meses_considerados: 0,
    pontos: 0,
    abaixo_do_minimo: numero(bloco.minimo_meses) > 0,
  };
  const estagio =
    exp.meses_considerados > exp.meses && exp.meses_estagio > 0
      ? ` + ${plural(exp.meses_estagio, "mês", "meses")} de estágio`
      : "";
  const texto = exp.dias_total
    ? `Comprovado: ${textoDoTempo(exp.dias_total)} (${plural(exp.meses, "mês", "meses")})${estagio}`
    : `Comprovado: 0 meses${estagio}`;
  const minimo = numero(bloco.minimo_meses);
  const desconta = Boolean(bloco.desconta_minimo) && minimo > 0;
  const queContam = Math.max(
    0,
    exp.meses_considerados - (desconta ? minimo : 0),
  );
  const base = desconta
    ? `Além do mínimo de ${plural(minimo, "mês", "meses")}: ${plural(queContam, "mês", "meses")}`
    : plural(queContam, "mês", "meses");
  const doNivelDaVaga = doNivel(bloco, nivel) as BlocoDeVinculos;
  const teto = tetoDoBloco(bloco, nivel) as number | null;
  let conta: string;
  let bruto: number;
  if ((bloco.pontuacao ?? "POR_MES") === "POR_PERIODO") {
    const periodo = numero(bloco.periodo_meses || 1);
    const periodos = Math.floor(queContam / periodo);
    bruto = periodos * numero(doNivelDaVaga.pontos_por_periodo);
    conta = `${plural(periodos, "período", "períodos")} de ${plural(periodo, "mês", "meses")}`;
  } else {
    bruto = queContam * numero(doNivelDaVaga.pontos_por_mes);
    conta = "";
  }
  const noTeto = teto !== null && bruto > teto;
  const detalhe = exp.abaixo_do_minimo
    ? `Abaixo do mínimo de ${plural(minimo, "mês", "meses")}${bloco.item_minimo ? ` (item ${bloco.item_minimo})` : ""}`
    : [base, conta, `${pontosBr(exp.pontos)}${noTeto ? " (teto)" : ""}`]
        .filter(Boolean)
        .join(" → ");
  return { texto, detalhe, abaixoDoMinimo: exp.abaixo_do_minimo };
}

type CursoLancado = { horas?: number | string | null; aceito?: boolean };
type TituloLancado = { titulo?: string; aceito?: boolean };

/** "Comprovado: 3 cursos, 140 h" (só os aceitos). */
export function comprovadoDosCursos(
  cursos: CursoLancado[] | null | undefined,
): Comprovado {
  const aceitos = (cursos ?? []).filter((c) => c && c.aceito !== false);
  const horas = aceitos.reduce((soma, c) => soma + numero(c.horas), 0);
  return {
    texto: aceitos.length
      ? `Comprovado: ${plural(aceitos.length, "curso", "cursos")}, ${horasBr(horas)} h`
      : "Comprovado: nenhum curso aceito",
    detalhe: null,
    abaixoDoMinimo: false,
  };
}

/** "Comprovado: 1 título (Mestrado)" (só os aceitos, com o rótulo da regra). */
export function comprovadoDosTitulos(
  titulos: TituloLancado[] | null | undefined,
  rotulos: Record<string, string> = {},
): Comprovado {
  const aceitos = (titulos ?? []).filter((t) => t && t.aceito !== false);
  const nomes = [
    ...new Set(aceitos.map((t) => rotulos[t.titulo ?? ""] || t.titulo || "")),
  ].filter(Boolean);
  return {
    texto: aceitos.length
      ? `Comprovado: ${plural(aceitos.length, "título", "títulos")}${nomes.length ? ` (${nomes.join(", ")})` : ""}`
      : "Comprovado: nenhum título aceito",
    detalhe: null,
    abaixoDoMinimo: false,
  };
}
