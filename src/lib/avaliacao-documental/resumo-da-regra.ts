/*
  O resumo de uma página da regra da avaliação documental, em linguagem
  simples: o que elimina, quanto vale cada item, as cotas, o corte e o lote,
  a nota declarada e os desempates. Sai em texto e em HTML (para o "Copiar
  para o SEI" e a impressão). Sem DOM e sem estado. Os números saem da regra
  (e da regra de classificação, para a nota mínima e o desempate).
*/
import {
  DESEMPATES_DA_PROVISORIA,
  NIVEIS,
  TITULOS_ACADEMICOS,
  rotuloDe,
} from "./catalogo.js";
import { rotuloDaVersao } from "../nome-da-versao.ts";
import { baseDaNota, textoDaPergunta } from "./regra.js";
import type {
  Bloco,
  EliminacaoAutomatica,
  Faixa,
  FaixasDeCursos,
  Nivel,
  PontosDeExperiencia,
  RegraAnalise,
} from "./tipos-da-regra.ts";

export type SecaoDoResumo = { titulo: string; itens: string[] };
export type ResumoDaRegra = {
  titulo: string;
  subtitulo: string;
  secoes: SecaoDoResumo[];
};

export type ContextoDoResumo = {
  edital?: string;
  versao?: number | null;
  /** Nome da versão (o resumo mostra "Nome · v7"; sem nome, "Versão 7"). */
  nome?: string | null;
  /** Nota mínima da regra de classificação. */
  notaMinima?: number | null;
  notaMinimaPorNivel?: Partial<Record<Nivel, number | null>>;
  /** Os critérios de desempate da classificação, já com o nome, na ordem. */
  desempateDaClassificacao?: string[];
};

export const numeroBr = (valor: unknown): string => {
  const n = Number(valor);
  if (valor === null || valor === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
};
const pontos = (valor: unknown) =>
  `${numeroBr(valor)} ${Number(valor) === 1 ? "ponto" : "pontos"}`;
const item = (b: { item_edital?: string | null }) =>
  b.item_edital ? ` (item ${b.item_edital})` : "";
const nivel = (n: string) => rotuloDe(NIVEIS, n).toLowerCase();
const titulo = (t: string) => rotuloDe(TITULOS_ACADEMICOS, t);
const teto = (valor: unknown) =>
  valor === null || valor === undefined ? "" : `, até ${pontos(valor)}`;

function horas(f: Faixa): string {
  if (f.max_horas === null || f.max_horas === undefined)
    return `${numeroBr(f.min_horas)} h ou mais`;
  return `${numeroBr(f.min_horas)} a ${numeroBr(f.max_horas)} h`;
}
const faixas = (alvo: FaixasDeCursos) =>
  `${(alvo.faixas ?? []).map((f) => `${horas(f)}: ${pontos(f.pontos)}`).join("; ")}${teto(alvo.teto)}`;

function elimina(b: Bloco): string | null {
  const efeitos = b.efeitos ?? {};
  const situacoes = [
    efeitos.NAO_ENVIADO === "ELIMINA" ? "não enviado" : null,
    efeitos.NAO_CONFORME === "ELIMINA" ? "não conforme" : null,
  ].filter(Boolean);
  const porMotivo = (b.motivos ?? []).filter((m) => m.efeito === "ELIMINA");
  if (!situacoes.length && !porMotivo.length) return null;
  const quando = situacoes.length
    ? `${situacoes.join(" ou ")} elimina`
    : "elimina pelos motivos do edital";
  return `${b.titulo}${item(b)}: ${quando}.`;
}

function eliminacaoAutomatica(e: EliminacaoAutomatica): string {
  const onde = e.coluna
    ? `coluna ${e.coluna}`
    : e.coluna_prefixo
      ? `colunas ${e.coluna_prefixo.trim()}…`
      : `pergunta "${textoDaPergunta(e.pergunta ?? "")}"`;
  const valores = (e.quando ?? []).length
    ? `= ${(e.quando ?? []).join(" ou ")}`
    : `diferente de ${(e.exceto ?? []).join(" ou ")}`;
  return `${e.motivo} (${onde} ${valores}).`;
}

function titulacao(b: Bloco): string[] {
  const porNivel = Object.entries(b.pontos_por_nivel ?? {});
  const forma = b.cumulativa ? "os títulos somam" : "vale o maior título";
  return [
    ...porNivel.map(
      ([n, lista]) =>
        `${b.titulo}, nível ${nivel(n)}: ${(lista ?? [])
          .map((t) => `${titulo(t.titulo)} ${numeroBr(t.pontos)}`)
          .join(", ")}.`,
    ),
    `${b.titulo}: ${forma}${teto(b.teto)}.`,
  ];
}

function cursos(b: Bloco): string[] {
  const linhas = [
    `${b.titulo}: ${faixas({ faixas: b.faixas ?? [], teto: b.teto })}.`,
  ];
  for (const [n, alvo] of Object.entries(b.por_nivel ?? {}))
    linhas.push(
      `${b.titulo}, nível ${nivel(n)}: ${faixas(alvo as FaixasDeCursos)}.`,
    );
  return linhas;
}

function experiencia(b: Bloco): string[] {
  const porPeriodo = b.pontuacao === "POR_PERIODO";
  const conta = (alvo: PontosDeExperiencia) =>
    porPeriodo
      ? `${pontos(alvo.pontos_por_periodo)} a cada ${numeroBr(b.periodo_meses)} meses${b.desconta_minimo ? " além do mínimo" : ""}${teto(alvo.teto)}`
      : `${pontos(alvo.pontos_por_mes)} por mês${b.desconta_minimo ? " além do mínimo" : ""}${teto(alvo.teto)}`;
  const linhas = [`${b.titulo}: ${conta(b as PontosDeExperiencia)}.`];
  for (const [n, alvo] of Object.entries(b.por_nivel ?? {}))
    linhas.push(
      `${b.titulo}, nível ${nivel(n)}: ${conta(alvo as PontosDeExperiencia)}.`,
    );
  if (b.estagio_indigena?.ativo)
    linhas.push(
      `Estágio de indígena sem experiência: horas ÷ ${numeroBr(b.estagio_indigena.horas_por_dia ?? 8)} ÷ ${numeroBr(b.estagio_indigena.dias_por_mes ?? 22)} meses.`,
    );
  return linhas;
}

function etnico(b: Bloco): string[] {
  return [
    `${b.titulo}${item(b)}: indígena ${pontos(b.indigena)}; mora em aldeia${b.lista_aldeias ? " da lista do DSEI" : ""} mais ${pontos(b.aldeia)}${teto(b.teto)}.`,
  ];
}

const ENCAMINHA: Record<string, string> = {
  ENCAMINHA_HETEROIDENTIFICACAO: "encaminha à heteroidentificação",
  ENCAMINHA_PERICIA: "encaminha à perícia",
  SO_REGISTRO: "só registra",
  SEGUE_AMPLA: "segue na ampla concorrência",
  ELIMINA: "elimina",
};
function cota(b: Bloco): string {
  const e = b.efeitos ?? {};
  const partes = [
    e.CONFORME ? `conforme ${ENCAMINHA[e.CONFORME] ?? e.CONFORME}` : null,
    e.NAO_CONFORME || e.NAO_ENVIADO
      ? `não conforme ou não enviado ${ENCAMINHA[e.NAO_CONFORME ?? e.NAO_ENVIADO ?? ""] ?? ""}`.trim()
      : null,
  ].filter(Boolean);
  return `${b.titulo}${item(b)}: ${partes.join("; ")}.`;
}

const PARCIAL: Record<string, string> = {
  ETNICO: "Critério étnico",
  FORMACAO: "Titulação",
  CURSOS: "Cursos",
  EXPERIENCIA: "Experiência",
};

/** O resumo da regra em seções de frases curtas. */
export function resumoDaRegra(
  regra: RegraAnalise,
  contexto: ContextoDoResumo = {},
): ResumoDaRegra {
  const blocos = regra.blocos ?? [];
  const secoes: SecaoDoResumo[] = [];

  const eliminam = [
    ...blocos.filter((b) => b.tipo === "DOCUMENTO").map(elimina),
    ...blocos
      .filter((b) => b.tipo === "VINCULOS" && Number(b.minimo_meses) > 0)
      .map(
        (b) =>
          `${b.titulo}: mínimo de ${numeroBr(b.minimo_meses)} meses${b.item_minimo ? ` (item ${b.item_minimo})` : ""}; abaixo disso ${b.efeito_minimo === "SO_REGISTRO" ? "só registra" : "elimina"}.`,
      ),
  ].filter((t): t is string => Boolean(t));
  const automaticas =
    regra.provisoria.eliminacao_automatica.map(eliminacaoAutomatica);
  secoes.push({
    titulo: "O que elimina",
    itens: [...eliminam, ...automaticas.map((t) => `Na inscrição: ${t}`)],
  });

  const valem: string[] = [];
  for (const b of blocos) {
    if (b.tipo === "PONTUACAO") valem.push(...etnico(b));
    if (b.tipo === "TITULOS") valem.push(...titulacao(b));
    if (b.tipo === "CURSOS") valem.push(...cursos(b));
    if (b.tipo === "VINCULOS") valem.push(...experiencia(b));
  }
  secoes.push({ titulo: "Quanto vale cada item", itens: valem });

  const cotas = blocos.filter((b) => b.tipo === "COTA").map(cota);
  if (cotas.length) secoes.push({ titulo: "Cotas", itens: cotas });

  const corte: string[] = [];
  const minima = contexto.notaMinima;
  const porNivel = Object.entries(contexto.notaMinimaPorNivel ?? {}).filter(
    ([, v]) => v !== null && v !== undefined,
  );
  corte.push(
    minima === null || minima === undefined
      ? "Nota mínima: sem nota mínima na regra de classificação."
      : `Nota mínima: ${pontos(minima)}${regra.corte.item_edital ? ` (item ${regra.corte.item_edital})` : ""}, da regra de classificação.`,
  );
  if (porNivel.length)
    corte.push(
      `Nota mínima por nível: ${porNivel.map(([n, v]) => `${nivel(n)} ${numeroBr(v)}`).join(", ")}.`,
    );
  const declarada = baseDaNota(regra.provisoria) === "DECLARADA";
  const pela = declarada
    ? "pela nota declarada na inscrição"
    : "pela ART da Empregare";
  const naOrdem = declarada
    ? "na ordem da nota declarada na inscrição"
    : "na ordem da ART da Empregare";
  const lote = regra.lote;
  if (lote.base === "NOTA_MINIMA")
    corte.push(
      `Lote: todos com pelo menos ${pontos(lote.nota_minima)} ${pela}${lote.item_edital ? ` (item ${lote.item_edital})` : ""}.`,
    );
  else if (lote.base === "FIXO")
    corte.push(`Lote: ${numeroBr(lote.fixo)} candidatos por vaga, ${naOrdem}.`);
  else
    corte.push(
      `Lote: ${numeroBr(lote.multiplo)} vezes as vagas imediatas${lote.inclui_cr ? " (o cadastro reserva conta como mais uma vaga)" : ""}, ${naOrdem}.`,
    );
  if (lote.inclui_empatados)
    corte.push("Quem empata com o último do lote também entra.");
  corte.push(
    lote.linha_anda
      ? "Quem sai do lote eliminado é reposto pelo próximo da lista."
      : "Quem sai do lote não é reposto.",
  );
  secoes.push({ titulo: "Corte e lote", itens: corte });

  const itensDeclarados = regra.provisoria.nota_declarada.map((d) => {
    const respostas = d.pontos_por_nivel
      ? Object.keys(d.pontos_por_nivel).map(nivel).join(", ")
      : null;
    const quantas = Object.keys(
      d.pontos ?? d.meses ?? Object.values(d.pontos_por_nivel ?? {})[0] ?? {},
    ).length;
    return `${PARCIAL[d.parcial] ?? d.parcial}: pergunta "${textoDaPergunta(d.pergunta)}", ${quantas} respostas com pontos${respostas ? ` (por nível: ${respostas})` : ""}${teto(d.teto)}.`;
  });
  if (itensDeclarados.length)
    secoes.push({
      titulo: "Nota declarada na inscrição",
      itens: itensDeclarados,
    });

  const desempate: string[] = [];
  const provisoria = regra.provisoria.desempate ?? [];
  if (provisoria.length)
    desempate.push(
      `Lista do lote (Provisória): ${provisoria
        .map(
          (d, i) =>
            `${i + 1}º ${rotuloDe(DESEMPATES_DA_PROVISORIA, d).split(" (")[0]}`,
        )
        .join("; ")}.`,
    );
  const classificacao = contexto.desempateDaClassificacao ?? [];
  if (classificacao.length)
    desempate.push(
      `Classificação: ${classificacao.map((d, i) => `${i + 1}º ${d}`).join("; ")}.`,
    );
  if (desempate.length) secoes.push({ titulo: "Desempate", itens: desempate });

  return {
    titulo: `Regra da ${regra.titulo_etapa}`,
    subtitulo: [
      regra.edital_rotulo || contexto.edital || "",
      contexto.versao
        ? rotuloDaVersao({ versao: contexto.versao, nome: contexto.nome })
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    secoes: secoes.filter((s) => s.itens.length),
  };
}

/** O resumo em texto simples. */
export function textoDoResumo(resumo: ResumoDaRegra): string {
  return [
    resumo.titulo,
    resumo.subtitulo,
    ...resumo.secoes.flatMap((s) => [
      "",
      s.titulo.toUpperCase(),
      ...s.itens.map((i) => `- ${i}`),
    ]),
  ]
    .filter((linha, i) => i > 1 || linha)
    .join("\n");
}

const escapar = (texto: string) =>
  texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** O resumo em HTML simples (títulos e listas), para colar no SEI. */
export function htmlDoResumo(resumo: ResumoDaRegra): string {
  return [
    `<p><strong>${escapar(resumo.titulo)}</strong>${resumo.subtitulo ? `<br>${escapar(resumo.subtitulo)}` : ""}</p>`,
    ...resumo.secoes.map(
      (s) =>
        `<p><strong>${escapar(s.titulo)}</strong></p><ul>${s.itens.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>`,
    ),
  ].join("\n");
}

/** A página inteira para imprimir (Salvar como PDF). */
export function paginaDoResumo(resumo: ResumoDaRegra): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(resumo.titulo)}</title><style>body{font:12pt/1.45 Arial,sans-serif;color:#000;margin:18mm}ul{margin:0 0 10pt 18pt;padding:0}li{margin:2pt 0}p{margin:10pt 0 4pt}</style></head><body>${htmlDoResumo(resumo)}</body></html>`;
}
