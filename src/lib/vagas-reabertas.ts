/*
  VAGAS REABERTAS (pedido de 16/11/2026)

  O mesmo DSEI abre vários processos seletivos para a mesma vaga: o edital
  termina com vagas sem contratação (deserto, sem aprovados, desistência) e o
  posto volta num edital novo. Somar as vagas dos dois editais conta a mesma
  vaga duas vezes. A regra:

    Uma vaga que ficou sem contratação num edital com resultado e volta num
    edital mais novo da mesma unidade, com o mesmo cargo, iniciado depois do
    fim do anterior, conta só no edital novo.

  - O edital antigo perde só as vagas sem contratação (`vagas_reabertas`); as
    contratadas continuam nele. Assim a conta dos indicadores fecha:
    Vagas = Contratadas + Em seleção + Ociosas.
  - Quanto o edital novo reabre: até as vagas dele nos cargos em comum, pelo
    quadro de vagas; sem quadro, até o total do edital. O que um edital novo
    já reabriu não reabre de novo em outro antigo.
  - Do edital antigo mais recente para o mais velho (o posto reaberto é o do
    último edital que o ofereceu).
  - Mesmo cargo: pelo cargo oficial (`co_cargo`, TD_CARGO pela grafia, só na
    Saúde Indígena) quando os dois lados o têm — "AISAN" e "Agente Indígena de
    Saneamento" são o mesmo cargo, e cargos oficiais diferentes nunca casam;
    senão (SEDE, Projetos, grafia sem casamento), pelo texto (`chaveDoCargo`).
  - Sem cargo conhecido num dos dois (sem vagas na Seleção nem quadro), não há
    reabertura: na dúvida, a vaga conta como nova.
  - Não pega a reposição de quem foi contratado e saiu (é contratação nova) nem
    o mesmo cargo em outra unidade.
  - Cancelado não reabre nem é reaberto.

  Os cargos vêm de listar_vagas_por_cargo_da_visao_geral (vagas da Seleção e
  quadro de vagas de cada edital; sem dado pessoal). O código da vaga não
  serve: a Empregare dá código novo a cada edital.
*/

import {
  contratadasImediatas,
  ehCancelado,
  temResultado,
} from "./indicadores-do-monitoramento.ts";
import type { LinhaDoMonitoramento } from "../modulos/visao-geral/tipos.ts";

/** Um cargo do edital: o oficial (se casou), o texto e as vagas do quadro (nulo: sem quadro). */
export interface CargoDoEdital {
  codigo: string | null;
  texto: string;
  vagas: number | null;
}
/** Os cargos de um edital, por "c:<co_cargo>" ou, sem cargo oficial, "t:<texto>". */
export type CargosDoEdital = ReadonlyMap<string, CargoDoEdital>;

export interface Reabertura {
  edital: string;
  vagas: number;
}

export interface ReaberturasDoEdital {
  /** Vagas deste edital, sem contratação, que um edital mais novo reabriu. */
  reabertas: number;
  /** Os editais mais novos que reabriram vagas deste. */
  reabertasEm: Reabertura[];
  /** Os editais anteriores de que este reabre vagas. */
  reabre: Reabertura[];
}

type LinhaComReabertura = LinhaDoMonitoramento;

const txt = (valor: unknown) => String(valor ?? "").trim();
const num = (valor: unknown) => {
  const n = Number(valor || 0);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};
const registros = (valor: unknown): Record<string, unknown>[] =>
  Array.isArray(valor)
    ? valor.filter(
        (x): x is Record<string, unknown> =>
          !!x && typeof x === "object" && !Array.isArray(x),
      )
    : [];

const PALAVRAS_VAZIAS = new Set([
  "a",
  "o",
  "e",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
]);

/**
 * O cargo para comparar entre editais: só a parte antes do primeiro traço
 * ("Enfermeiro - PPP" → enfermeiro), sem o que está entre parênteses, sem a
 * carga horária, sem acento, sem "cadastro reserva" e sem artigos e
 * preposições ("Analista Técnico em Saúde" = "Analista Técnico de Saúde").
 */
export function chaveDoCargo(valor: unknown): string {
  const cargo = txt(valor)
    .replace(/^\s*\d+\s*\|\s*/, "")
    .replace(/^\s*cargo\s*\d+\s*:\s*/i, "")
    .split(/\s+[-–‐|]\s+/)[0]!
    .replace(/\s*[-–‐]\s*$/, "")
    .replace(/\([^)]*\)?/g, " ");
  return cargo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bcadastro\s+reserva\b/g, " ")
    .replace(/\b\d+\s*h(oras)?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p))
    .join(" ");
}

/* O cargo oficial (inteiro positivo); outro valor vira nulo. */
function codigoDoCargo(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? String(n) : null;
}

/**
 * Os cargos de cada edital pela resposta de
 * listar_vagas_por_cargo_da_visao_geral: os das vagas da Seleção (sem
 * quantidade) e os do quadro (com as vagas imediatas somadas por cargo), pelo
 * cargo oficial (`co_cargo`) quando há, senão pelo texto.
 */
export function cargosDaResposta(
  bruto: unknown,
): Map<string, Map<string, CargoDoEdital>> {
  const origem =
    bruto && typeof bruto === "object" && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)
      : {};
  const porEdital = new Map<string, Map<string, CargoDoEdital>>();
  const acrescentar = (
    registro: Record<string, unknown>,
    textoBruto: unknown,
    vagas: number | null,
  ) => {
    const id = txt(registro.monitoramento_id);
    const texto = chaveDoCargo(textoBruto);
    if (!id || !texto || /^\d+$/.test(texto)) return;
    const codigo = codigoDoCargo(registro.co_cargo);
    const chave = codigo ? `c:${codigo}` : `t:${texto}`;
    let cargos = porEdital.get(id);
    if (!cargos) porEdital.set(id, (cargos = new Map()));
    const atual = cargos.get(chave);
    if (!atual) cargos.set(chave, { codigo, texto, vagas });
    else if (vagas !== null) atual.vagas = (atual.vagas ?? 0) + vagas;
  };
  for (const q of registros(origem.quadro))
    acrescentar(q, q.cargo, num(q.vagas));
  for (const v of registros(origem.vagas))
    acrescentar(v, v.cargo || v.vaga, null);
  return porEdital;
}

/** Mesmo cargo: pelo oficial quando os dois têm; senão, pelo texto. */
export const mesmoCargo = (a: CargoDoEdital, b: CargoDoEdital): boolean =>
  a.codigo && b.codigo ? a.codigo === b.codigo : a.texto === b.texto;

/* "AAAA-MM-DD…" → dia em número; sem data, nulo. */
function dia(valor: unknown): number | null {
  const achado = txt(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return achado
    ? Date.UTC(Number(achado[1]), Number(achado[2]) - 1, Number(achado[3]))
    : null;
}

/* A unidade do edital (o DSEI na Saúde Indígena). */
const chaveDaUnidade = (linha: LinhaComReabertura) =>
  txt(linha.id_unidade) ||
  txt(linha.sigla_unidade || linha.unidade)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/* As vagas que o edital novo oferece nos cargos que tem em comum com o antigo. */
function vagasEmComum(
  novo: CargosDoEdital,
  antigo: CargosDoEdital,
  totalDoNovo: number,
): number {
  let comQuadro = 0;
  let algumEmComum = false;
  let algumSemQuadro = false;
  const doAntigo = [...antigo.values()];
  for (const cargo of novo.values()) {
    if (!doAntigo.some((outro) => mesmoCargo(cargo, outro))) continue;
    algumEmComum = true;
    if (cargo.vagas === null) algumSemQuadro = true;
    else comQuadro += cargo.vagas;
  }
  if (!algumEmComum) return 0;
  return algumSemQuadro ? totalDoNovo : Math.min(comQuadro, totalDoNovo);
}

/**
 * As reaberturas de cada edital (por id), das linhas de uma área já com a
 * `fase`. Edital sem reabertura não entra no mapa.
 */
export function calcularReaberturas(
  linhas: readonly LinhaComReabertura[],
  cargosPorEdital: ReadonlyMap<string, CargosDoEdital> | null | undefined,
): Map<string, ReaberturasDoEdital> {
  const resultado = new Map<string, ReaberturasDoEdital>();
  if (!cargosPorEdital?.size) return resultado;
  const doEdital = (id: string) => {
    let r = resultado.get(id);
    if (!r)
      resultado.set(id, (r = { reabertas: 0, reabertasEm: [], reabre: [] }));
    return r;
  };

  type Edital = {
    id: string;
    nome: string;
    linha: LinhaComReabertura;
    inicio: number;
    fim: number | null;
    cargos: CargosDoEdital;
  };
  const porUnidade = new Map<string, Edital[]>();
  for (const linha of Array.isArray(linhas) ? linhas : []) {
    const id = txt(linha?.id);
    const unidade = chaveDaUnidade(linha);
    const inicio = dia(linha.data_inicio);
    const cargos = cargosPorEdital.get(id);
    if (!id || !unidade || inicio === null || !cargos?.size) continue;
    if (ehCancelado(linha)) continue;
    const lista = porUnidade.get(unidade) || [];
    lista.push({
      id,
      nome: txt(linha.edital) || id,
      linha,
      inicio,
      fim: dia(linha.data_fim),
      cargos,
    });
    porUnidade.set(unidade, lista);
  }

  for (const editais of porUnidade.values()) {
    editais.sort((a, b) => a.inicio - b.inicio || a.nome.localeCompare(b.nome));
    // Vagas sem contratação de cada edital ainda não reabertas.
    const sobra = new Map<string, number>();
    for (const e of editais)
      sobra.set(
        e.id,
        temResultado(e.linha)
          ? num(e.linha.vagas_total) - contratadasImediatas(e.linha)
          : 0,
      );
    for (const novo of editais) {
      let capacidade = num(novo.linha.vagas_total);
      const anteriores = editais
        .filter((e) => e !== novo && e.fim !== null && e.fim <= novo.inicio)
        .sort((a, b) => (b.fim as number) - (a.fim as number));
      for (const antigo of anteriores) {
        if (capacidade <= 0) break;
        const resta = sobra.get(antigo.id) ?? 0;
        if (resta <= 0) continue;
        const limite = vagasEmComum(novo.cargos, antigo.cargos, capacidade);
        const vagas = Math.min(resta, limite, capacidade);
        if (vagas <= 0) continue;
        sobra.set(antigo.id, resta - vagas);
        capacidade -= vagas;
        const r = doEdital(antigo.id);
        r.reabertas += vagas;
        r.reabertasEm.push({ edital: novo.nome, vagas });
        doEdital(novo.id).reabre.push({ edital: antigo.nome, vagas });
      }
    }
  }
  return resultado;
}

/** "12 vagas reabertas no edital 79/2026" / "Reabre 12 vagas do edital 78/2025". */
export function textoDaReabertura(
  lista: readonly Reabertura[] | null | undefined,
  sentido: "reabertas" | "reabre",
): string {
  if (!lista?.length) return "";
  const total = lista.reduce((s, r) => s + r.vagas, 0);
  const vagas = total === 1 ? "1 vaga" : `${total} vagas`;
  const editais = lista.map((r) => r.edital);
  const nomes =
    editais.length === 1
      ? `do edital ${editais[0]}`
      : `dos editais ${editais.slice(0, -1).join(", ")} e ${editais.at(-1)}`;
  if (sentido === "reabre") return `Reabre ${vagas} ${nomes}`;
  const reaberta = total === 1 ? "reaberta" : "reabertas";
  return `${vagas} ${reaberta} ${nomes.replace(/^do/, "no")}`;
}

/** O que a linha da Visão geral recebe: as vagas reabertas e as frases da gaveta. */
export interface ReaberturaDaLinha {
  reabertas: number;
  textos: string[];
}

/**
 * A conta pronta para a Visão geral, pela resposta de
 * listar_vagas_por_cargo_da_visao_geral: devolve a função que, das linhas da
 * área (com a `fase`), diz as reabertas e as frases de cada edital. Este
 * módulo chega sob demanda (import dinâmico no estado da Visão geral), fora
 * do pacote de entrada.
 */
export function reaberturasDosCargos(
  bruto: unknown,
): (linhas: readonly LinhaDoMonitoramento[]) => Map<string, ReaberturaDaLinha> {
  const cargos = cargosDaResposta(bruto);
  return (linhas) => {
    const porEdital = new Map<string, ReaberturaDaLinha>();
    for (const [id, r] of calcularReaberturas(linhas, cargos))
      porEdital.set(id, {
        reabertas: r.reabertas,
        textos: [
          textoDaReabertura(r.reabertasEm, "reabertas"),
          textoDaReabertura(r.reabre, "reabre"),
        ].filter(Boolean),
      });
    return porEdital;
  };
}
