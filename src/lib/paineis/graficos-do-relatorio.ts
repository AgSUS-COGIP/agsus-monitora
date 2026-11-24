import type { LinhaDaVisaoGeral } from "../../modulos/visao-geral/tipos.ts";
import type {
  CelulaDaPlanilha,
  PlanilhaDaClassificacao,
} from "../classificacao/tipos-dos-documentos.ts";
import type { AprovadoDaDiretoria } from "./relatorio-da-diretoria.ts";
import { faseDoEdital, FASES } from "../visao-geral/fases-do-processo.ts";
import { contratadasImediatas } from "../visao-geral/indicadores-do-monitoramento.ts";

/*
  OS GRÁFICOS DO MONTADOR DE RELATÓRIO (24/11/2026: "e se quiser montar os
  relatórios com gráficos")

  Quatro gráficos, todos do mesmo recorte do relatório (área, filtros, busca
  e atalho):
    - Vagas × contratadas por unidade: barras deitadas por DSEI ou unidade,
      vagas imediatas e contratadas dentro delas (o "Contratadas" da Visão
      geral), com o preenchimento na tabela;
    - Editais por fase: barras com as fases em andamento, como o "Em
      andamento, por fase" da Visão geral (Inscrições a Resultado sempre;
      Edital e Contratação quando têm edital);
    - Contratações por mês: linha com as admissões conciliadas com o RH dos
      aprovados contratados (Contratado ou Migração), mês a mês, sem pular
      mês vazio;
    - Situação dos aprovados: barras empilhadas por edital com Contratado,
      Convocado, Desistente e Reserva (sem status: ainda não chamado) e, só
      quando houver, Outra situação (Contratado em outra lista, Documentação
      Rejeitada).
  Os dois últimos saem dos aprovados de exportar_aprovados_da_diretoria (a
  RPC da seção Aprovados, que registra o download): só para quem tem o
  recurso `aprovados`.

  Aqui, sem DOM: as séries de cada gráfico e a aba do Excel. O desenho
  (Chart.js na prévia e a imagem do PDF) fica em
  src/modulos/paineis-de-dados/graficos-do-relatorio.tsx.
*/

export type GraficoDoRelatorio =
  | "vagas-por-unidade"
  | "editais-por-fase"
  | "contratacoes-por-mes"
  | "situacao-dos-aprovados";

export const GRAFICOS_DO_RELATORIO: readonly {
  id: GraficoDoRelatorio;
  rotulo: string;
  /** Sai dos aprovados (nome e status): só com o recurso `aprovados`. */
  comAprovados: boolean;
}[] = Object.freeze([
  {
    id: "vagas-por-unidade",
    rotulo: "Vagas × contratadas por unidade",
    comAprovados: false,
  },
  { id: "editais-por-fase", rotulo: "Editais por fase", comAprovados: false },
  {
    id: "contratacoes-por-mes",
    rotulo: "Contratações por mês",
    comAprovados: true,
  },
  {
    id: "situacao-dos-aprovados",
    rotulo: "Situação dos aprovados",
    comAprovados: true,
  },
]);

const IDS = GRAFICOS_DO_RELATORIO.map((g) => g.id);

/** Os gráficos que a pessoa pode gerar: os dos aprovados só com o recurso. */
export function graficosPermitidos(
  podeAprovados: boolean,
): readonly GraficoDoRelatorio[] {
  return GRAFICOS_DO_RELATORIO.filter(
    (g) => podeAprovados || !g.comAprovados,
  ).map((g) => g.id);
}

/** Algum dos escolhidos precisa dos aprovados (a RPC que registra o download). */
export function precisaDosAprovados(
  graficos: readonly GraficoDoRelatorio[],
): boolean {
  return GRAFICOS_DO_RELATORIO.some(
    (g) => g.comAprovados && graficos.includes(g.id),
  );
}

/** Do armazenamento: só os que existem, na ordem da lista (pode ser nenhum). */
export function normalizarGraficos(bruto: unknown): GraficoDoRelatorio[] {
  const lista = Array.isArray(bruto) ? bruto.map(String) : [];
  return IDS.filter((id) => lista.includes(id));
}

/** Cor da série: a chave da paleta dos gráficos (lida dos tokens no desenho). */
export type TomDaSerie = "blue" | "ok" | "review" | "bad" | "warn" | "neutro";

export interface SerieDoGrafico {
  rotulo: string;
  valores: readonly number[];
  tom: TomDaSerie;
}

export interface DadosDoGrafico {
  id: GraficoDoRelatorio;
  titulo: string;
  tipo: "barra" | "linha";
  /** Barras deitadas (rótulos longos, como o nome do DSEI). */
  deitado: boolean;
  empilhado: boolean;
  /** O nome da primeira coluna da tabela ("Unidade", "Fase", "Mês", "Edital"). */
  item: string;
  rotulos: readonly string[];
  series: readonly SerieDoGrafico[];
  /** Colunas só da tabela (o preenchimento, em %), uma por rótulo. */
  extras?: readonly { rotulo: string; valores: readonly number[] }[];
  /** A linha "Fonte:" embaixo do gráfico. */
  fonte: string;
  vazio: string;
}

const txt = (valor: unknown) => String(valor ?? "").trim();
const num = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};
const inteiro = (n: number) => n.toLocaleString("pt-BR");

/* Mais itens do que cabem: os maiores ficam, o resto vira uma barra só. */
function cortar<T extends { total: number }>(
  itens: readonly T[],
  limite: number,
  juntar: (resto: readonly T[]) => T,
): T[] {
  if (itens.length <= limite) return [...itens];
  const ordenados = [...itens].sort((a, b) => b.total - a.total);
  const ficam = new Set(ordenados.slice(0, limite - 1));
  const resto = itens.filter((i) => !ficam.has(i));
  return [...itens.filter((i) => ficam.has(i)), juntar(resto)];
}

const pctDe = (parte: number, todo: number) =>
  todo > 0 ? Math.round((parte / todo) * 100) : 0;

// ── 1. Vagas × contratadas por unidade ─────────────────────────────────

export const LIMITE_DE_UNIDADES = 40;

export function vagasPorUnidade(
  linhas: readonly LinhaDaVisaoGeral[],
  limite = LIMITE_DE_UNIDADES,
): DadosDoGrafico {
  const porUnidade = new Map<
    string,
    { unidade: string; vagas: number; contratadas: number; total: number }
  >();
  for (const linha of linhas) {
    const unidade = txt(linha.unidade) || "Sem unidade";
    const atual = porUnidade.get(unidade) || {
      unidade,
      vagas: 0,
      contratadas: 0,
      total: 0,
    };
    atual.vagas += num(linha.vagas_total);
    atual.contratadas += contratadasImediatas(linha);
    atual.total = atual.vagas;
    porUnidade.set(unidade, atual);
  }
  const ordenadas = [...porUnidade.values()].sort(
    (a, b) => b.vagas - a.vagas || a.unidade.localeCompare(b.unidade, "pt-BR"),
  );
  const itens = cortar(ordenadas, limite, (resto) => {
    const vagas = resto.reduce((s, u) => s + u.vagas, 0);
    return {
      unidade: `Outras ${resto.length} unidades`,
      vagas,
      contratadas: resto.reduce((s, u) => s + u.contratadas, 0),
      total: vagas,
    };
  });
  const vagas = itens.reduce((s, u) => s + u.vagas, 0);
  const contratadas = itens.reduce((s, u) => s + u.contratadas, 0);
  return {
    id: "vagas-por-unidade",
    titulo: "Vagas × contratadas por unidade",
    tipo: "barra",
    deitado: true,
    empilhado: false,
    item: "Unidade",
    rotulos: itens.map((u) => u.unidade),
    series: [
      {
        rotulo: "Vagas imediatas",
        valores: itens.map((u) => u.vagas),
        tom: "blue",
      },
      {
        rotulo: "Contratadas",
        valores: itens.map((u) => u.contratadas),
        tom: "ok",
      },
    ],
    extras: [
      {
        rotulo: "Preenchimento (%)",
        valores: itens.map((u) => pctDe(u.contratadas, u.vagas)),
      },
    ],
    fonte: `Fonte: monitoramento dos editais do recorte. ${inteiro(contratadas)} de ${inteiro(vagas)} vagas imediatas contratadas (${pctDe(contratadas, vagas)}%); contratação além das vagas fora da conta.`,
    vazio: "Nenhuma vaga no recorte.",
  };
}

// ── 2. Editais por fase ─────────────────────────────────────────────────

/* As fases em andamento; as do meio sempre, Edital e Contratação só com edital. */
const FASES_SEMPRE = new Set([
  "Inscrições",
  "Análise curricular",
  "Recursos",
  "Entrevistas",
  "Resultado",
]);
const FASES_EM_ANDAMENTO = FASES.filter((f) => f !== "Cronograma encerrado");

export function editaisPorFase(
  linhas: readonly LinhaDaVisaoGeral[],
): DadosDoGrafico {
  const contagem = new Map<string, number>();
  for (const linha of linhas) {
    const fase = linha.fase || faseDoEdital(linha);
    contagem.set(fase, (contagem.get(fase) || 0) + 1);
  }
  const fases = FASES_EM_ANDAMENTO.filter(
    (f) => FASES_SEMPRE.has(f) || (contagem.get(f) || 0) > 0,
  );
  const valores = fases.map((f) => contagem.get(f) || 0);
  const emAndamento = valores.reduce((s, v) => s + v, 0);
  return {
    id: "editais-por-fase",
    titulo: "Editais em andamento, por fase",
    tipo: "barra",
    deitado: false,
    empilhado: false,
    item: "Fase",
    rotulos: fases,
    series: [{ rotulo: "Editais", valores, tom: "blue" }],
    fonte: `Fonte: cronograma dos editais do recorte. ${inteiro(emAndamento)} de ${inteiro(linhas.length)} editais em andamento; encerrados, concluídos e cancelados fora do gráfico.`,
    vazio: "Nenhum edital em andamento no recorte.",
  };
}

// ── Aprovados ───────────────────────────────────────────────────────────

const CONTRATADO = new Set(["Contratado", "Migração"]);

/* Só os aprovados dos editais do recorte. */
function doRecorte(
  aprovados: readonly AprovadoDaDiretoria[],
  linhas: readonly LinhaDaVisaoGeral[],
) {
  const ids = new Set(linhas.map((l) => txt(l.id)).filter(Boolean));
  return aprovados.filter((a) => ids.has(a.monitoramentoId));
}

// ── 3. Contratações por mês ─────────────────────────────────────────────

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-03" → "mar/26". */
export function rotuloDoMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  return `${MESES[Number(mes) - 1] ?? mes}/${String(ano).slice(-2)}`;
}

export function contratacoesPorMes(
  aprovados: readonly AprovadoDaDiretoria[],
  linhas: readonly LinhaDaVisaoGeral[],
): DadosDoGrafico {
  const contagem = new Map<string, number>();
  let semData = 0;
  for (const a of doRecorte(aprovados, linhas)) {
    if (!CONTRATADO.has(a.status)) continue;
    const mes = /^(\d{4})-(\d{2})/.exec(a.admissao);
    if (!mes) {
      semData += 1;
      continue;
    }
    const chave = `${mes[1]}-${mes[2]}`;
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }
  const chaves = [...contagem.keys()].sort();
  const meses: string[] = [];
  if (chaves.length) {
    let [ano, mes] = chaves[0]!.split("-").map(Number) as [number, number];
    const ultima = chaves[chaves.length - 1]!;
    for (;;) {
      const chave = `${ano}-${String(mes).padStart(2, "0")}`;
      meses.push(chave);
      if (chave >= ultima) break;
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
    }
  }
  const valores = meses.map((m) => contagem.get(m) || 0);
  const total = valores.reduce((s, v) => s + v, 0);
  return {
    id: "contratacoes-por-mes",
    titulo: "Contratações por mês",
    tipo: "linha",
    deitado: false,
    empilhado: false,
    item: "Mês",
    rotulos: meses.map(rotuloDoMes),
    series: [{ rotulo: "Admissões", valores, tom: "ok" }],
    fonte: `Fonte: admissão conciliada com o RH dos aprovados contratados (listas vigentes do recorte). ${inteiro(total)} admissões${semData ? `; ${inteiro(semData)} ${semData === 1 ? "contratado sem data de admissão fica" : "contratados sem data de admissão ficam"} fora` : ""}.`,
    vazio: "Nenhuma admissão conciliada no recorte.",
  };
}

// ── 4. Situação dos aprovados ───────────────────────────────────────────

export const LIMITE_DE_EDITAIS = 25;

const SITUACOES = [
  { rotulo: "Contratado", tom: "ok" },
  { rotulo: "Convocado", tom: "review" },
  { rotulo: "Desistente", tom: "bad" },
  { rotulo: "Reserva", tom: "neutro" },
  { rotulo: "Outra situação", tom: "warn" },
] as const;
type Situacao = (typeof SITUACOES)[number]["rotulo"];

/** A situação de um aprovado no gráfico (o status vindo do banco). */
export function situacaoDoAprovado(status: string): Situacao {
  if (CONTRATADO.has(status)) return "Contratado";
  if (status === "Convocado") return "Convocado";
  if (status === "Desistente") return "Desistente";
  if (!txt(status)) return "Reserva";
  return "Outra situação";
}

export function situacaoDosAprovados(
  aprovados: readonly AprovadoDaDiretoria[],
  linhas: readonly LinhaDaVisaoGeral[],
  limite = LIMITE_DE_EDITAIS,
): DadosDoGrafico {
  const porEdital = new Map<string, Record<Situacao, number>>();
  for (const a of doRecorte(aprovados, linhas)) {
    const conta =
      porEdital.get(a.monitoramentoId) ||
      (Object.fromEntries(SITUACOES.map((s) => [s.rotulo, 0])) as Record<
        Situacao,
        number
      >);
    conta[situacaoDoAprovado(a.status)] += 1;
    porEdital.set(a.monitoramentoId, conta);
  }
  const vistos = new Set<string>();
  const editais: {
    rotulo: string;
    conta: Record<Situacao, number>;
    total: number;
  }[] = [];
  for (const linha of linhas) {
    const id = txt(linha.id);
    const conta = porEdital.get(id);
    if (!conta || vistos.has(id)) continue;
    vistos.add(id);
    editais.push({
      rotulo: txt(linha.edital) || "Sem número",
      conta,
      total: Object.values(conta).reduce((s, v) => s + v, 0),
    });
  }
  const itens = cortar(editais, limite, (resto) => {
    const conta = Object.fromEntries(
      SITUACOES.map((s) => [
        s.rotulo,
        resto.reduce((soma, e) => soma + e.conta[s.rotulo], 0),
      ]),
    ) as Record<Situacao, number>;
    return {
      rotulo: `Outros ${resto.length} editais`,
      conta,
      total: resto.reduce((s, e) => s + e.total, 0),
    };
  });
  const series = SITUACOES.map((s) => ({
    rotulo: s.rotulo,
    valores: itens.map((e) => e.conta[s.rotulo]),
    tom: s.tom,
  })).filter(
    (s) => s.rotulo !== "Outra situação" || s.valores.some((v) => v > 0),
  );
  const total = itens.reduce((s, e) => s + e.total, 0);
  return {
    id: "situacao-dos-aprovados",
    titulo: "Situação dos aprovados, por edital",
    tipo: "barra",
    deitado: true,
    empilhado: true,
    item: "Edital",
    rotulos: itens.map((e) => e.rotulo),
    series,
    fonte: `Fonte: listas de aprovados vigentes do recorte (${inteiro(total)} aprovados). Reserva: sem status, ainda não chamado.`,
    vazio: "Nenhum aprovado nas listas vigentes do recorte.",
  };
}

// ── Todos ───────────────────────────────────────────────────────────────

/** Os gráficos escolhidos, na ordem da lista; os dos aprovados só com eles. */
export function dadosDosGraficos({
  graficos,
  linhas,
  aprovados = null,
}: {
  graficos: readonly GraficoDoRelatorio[];
  linhas: readonly LinhaDaVisaoGeral[];
  aprovados?: readonly AprovadoDaDiretoria[] | null;
}): DadosDoGrafico[] {
  const dados: DadosDoGrafico[] = [];
  for (const id of normalizarGraficos(graficos)) {
    if (id === "vagas-por-unidade") dados.push(vagasPorUnidade(linhas));
    else if (id === "editais-por-fase") dados.push(editaisPorFase(linhas));
    else if (!aprovados) continue;
    else if (id === "contratacoes-por-mes")
      dados.push(contratacoesPorMes(aprovados, linhas));
    else dados.push(situacaoDosAprovados(aprovados, linhas));
  }
  return dados;
}

/** O gráfico não tem nada para desenhar. */
export const graficoVazio = (dados: DadosDoGrafico) =>
  !dados.rotulos.length ||
  dados.series.every((s) => s.valores.every((v) => v === 0));

/** A tabela dos números: rótulo, uma coluna por série e as extras. */
export function tabelaDoGrafico(dados: DadosDoGrafico): {
  colunas: string[];
  linhas: (string | number)[][];
} {
  const extras = dados.extras || [];
  return {
    colunas: [
      dados.item,
      ...dados.series.map((s) => s.rotulo),
      ...extras.map((e) => e.rotulo),
    ],
    linhas: dados.rotulos.map((rotulo, i) => [
      rotulo,
      ...dados.series.map((s) => s.valores[i] ?? 0),
      ...extras.map((e) => e.valores[i] ?? 0),
    ]),
  };
}

const NOME_DA_ABA: Record<GraficoDoRelatorio, string> = {
  "vagas-por-unidade": "Gráfico - Vagas por unidade",
  "editais-por-fase": "Gráfico - Editais por fase",
  "contratacoes-por-mes": "Gráfico - Contratações por mês",
  "situacao-dos-aprovados": "Gráfico - Situação aprovados",
};

/*
  A aba do Excel de um gráfico: o título, o aviso de que a planilha leva só
  os números (o gerador de XLSX do sistema, src/lib/classificacao/exportacao.ts,
  escreve células, não desenha gráfico), a fonte e a tabela.
*/
export function planilhaDoGrafico(
  dados: DadosDoGrafico,
): PlanilhaDaClassificacao {
  const tabela = tabelaDoGrafico(dados);
  /*
    O texto numa célula só: o gerador grava "" como texto, e a célula vazia ao
    lado cortaria o texto longo (o Excel só transborda sobre célula em branco).
  */
  const linha = (texto: string): CelulaDaPlanilha[] => [texto];
  return {
    nome: NOME_DA_ABA[dados.id].slice(0, 31),
    linhas: [
      linha(dados.titulo),
      linha(
        "Os números do gráfico: o Excel do Yeendé não desenha gráfico; o desenho sai no PDF deste relatório.",
      ),
      linha(dados.fonte),
      [],
      tabela.colunas,
      ...(tabela.linhas.length ? tabela.linhas : [linha(dados.vazio)]),
    ],
    larguras: tabela.colunas.map((_, i) => (i === 0 ? 40 : 16)),
  };
}
