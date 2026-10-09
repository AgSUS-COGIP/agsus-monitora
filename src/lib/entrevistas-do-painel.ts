/*
  Regras da tela de Entrevistas (src/modulos/entrevistas/), sem React e sem banco:
  o que chega de `get_entrevistas_da_area` (migration
  20260929235000_entrevistas.sql) vira a lista que o painel desenha — os
  filtros, os KPIs, os dados dos gráficos, as pendências e o CSV.

  Nesta fase o painel só lê: nada aqui escreve.

  O payload traz os critérios uma vez (`criterios`, textos longos como
  "HABILIDADE TÉCNICA INTERCULTURAL (Conhecimentos ...)") e, em cada
  entrevista, as notas como `[índice do critério, nota]`. O rótulo curto do
  critério é o texto antes do primeiro " (" — o texto inteiro fica no title.
*/
import { sanitizeCsvCell } from "./csv-security.js";
import { formatNumberBR } from "./formatters.js";

import type {
  EntrevistaDoPainel,
  AprovadoSemEntrevista,
  CriterioDoPainel,
  FiltrosDoPainel,
  OpcoesDosFiltros,
  DadosDoPainel,
  IndicadoresDoPainel,
  PendenciaDoPainel,
  GrupoDosSemEntrevista,
} from "../modulos/entrevistas/tipos-do-painel.ts";
import type { ItemDaAgenda } from "./painel-de-entrevistas.ts";

function registro(valor: unknown): Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}
const lista = (valor: unknown): readonly unknown[] =>
  Array.isArray(valor) ? valor : [];
const texto = (valor: unknown) => String(valor ?? "").trim();

const numero = (valor: unknown) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

export function normalizarBusca(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* Diferença tolerada entre a nota total e a soma das notas por critério. */
export const TOLERANCIA_DA_SOMA = 0.05;
export const NOTA_MAXIMA = 20;
export const NOTA_MAXIMA_DO_CRITERIO = 5;

export const PARECERES = Object.freeze([
  Object.freeze({ id: "APTO", rotulo: "Apto", badge: "aprovado" }),
  Object.freeze({ id: "INAPTO", rotulo: "Inapto", badge: "reprovado" }),
  Object.freeze({ id: "SEM_PARECER", rotulo: "Sem parecer", badge: "neutro" }),
]);

/* Comparecimento: "S", "N" e o não informado (`null` no banco, "NI" no filtro). */
export const COMPARECIMENTOS = Object.freeze([
  Object.freeze({ id: "S", rotulo: "Sim" }),
  Object.freeze({ id: "N", rotulo: "Não" }),
  Object.freeze({ id: "NI", rotulo: "Não informado" }),
]);

export const SITUACOES_DA_LIGACAO = Object.freeze([
  Object.freeze({ id: "ligado", rotulo: "Ligado à análise" }),
  Object.freeze({ id: "sem_analise", rotulo: "Sem análise" }),
  Object.freeze({ id: "sem_edital", rotulo: "Sem edital cadastrado" }),
  Object.freeze({ id: "divergente", rotulo: "Nota divergente" }),
]);

/*
  Andamento da entrevista (pendências do Painel de entrevistas): sem
  comparecimento registrado, compareceu sem nota e com nota sem parecer.
*/
export const ANDAMENTOS = Object.freeze([
  Object.freeze({ id: "sem_comparecimento", rotulo: "Sem comparecimento" }),
  Object.freeze({ id: "sem_nota", rotulo: "Compareceu, sem nota" }),
  Object.freeze({ id: "sem_parecer", rotulo: "Com nota, sem parecer" }),
]);

/** O andamento pendente da entrevista (um id de `ANDAMENTOS`) ou "". */
export function andamentoDaEntrevista(e: EntrevistaDoPainel) {
  if (!e.compareceu) return "sem_comparecimento";
  if (e.compareceu !== "S" || e.parecer !== "SEM_PARECER") return "";
  return e.nota === null ? "sem_nota" : "sem_parecer";
}

export const FAIXAS_DE_NOTA = Object.freeze([
  Object.freeze({ id: "0-5", rotulo: "0 a 5", de: 0, ate: 5 }),
  Object.freeze({ id: "5-10", rotulo: "5 a 10", de: 5, ate: 10 }),
  Object.freeze({ id: "10-15", rotulo: "10 a 15", de: 10, ate: 15 }),
  Object.freeze({ id: "15-20", rotulo: "15 a 20", de: 15, ate: 20 }),
]);

export const FILTROS_VAZIOS: FiltrosDoPainel = Object.freeze({
  busca: "",
  unidade: "",
  edital: "",
  vaga: "",
  cargo: "",
  parecer: "",
  comparecimento: "",
  modalidade: "",
  ligacao: "",
  andamento: "",
});

export const rotuloDoParecer = (id: string) =>
  PARECERES.find((p) => p.id === id)?.rotulo || "Sem parecer";
export const badgeDoParecer = (id: string) =>
  PARECERES.find((p) => p.id === id)?.badge || "neutro";
export const rotuloDoComparecimento = (valor: string | null) =>
  COMPARECIMENTOS.find((c) => c.id === (valor || "NI"))?.rotulo ||
  "Não informado";

/** "HABILIDADE TÉCNICA (Conhecimentos…)" → "HABILIDADE TÉCNICA". */
export function rotuloCurtoDoCriterio(criterio: unknown) {
  const completo = texto(criterio);
  const corte = completo.indexOf(" (");
  return (corte > 0 ? completo.slice(0, corte) : completo).trim();
}

function normalizarParecer(valor: unknown) {
  const id = texto(valor).toUpperCase();
  return PARECERES.some((p) => p.id === id) ? id : "SEM_PARECER";
}

function normalizarComparecimento(valor: unknown) {
  const id = texto(valor).toUpperCase();
  return id === "S" || id === "N" ? id : null;
}

const arredondar = (valor: number, casas = 2) => {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
};

/** Nota total diferente da soma das notas por critério (com notas lançadas). */
export function notaDivergente(
  nota: number | null,
  notas: readonly { nota: number }[],
) {
  if (nota === null || !notas.length) return false;
  const soma = notas.reduce((total, n) => total + n.nota, 0);
  return Math.abs(nota - soma) > TOLERANCIA_DA_SOMA;
}

function normalizarCriterios(valor: unknown): CriterioDoPainel[] {
  return lista(valor).map((criterio, indice) => ({
    indice,
    texto: texto(criterio),
    curto: rotuloCurtoDoCriterio(criterio) || `Critério ${indice + 1}`,
  }));
}

function normalizarEntrevista(
  valor: unknown,
  criterios: readonly CriterioDoPainel[],
): EntrevistaDoPainel {
  const bruta = registro(valor);
  const nota = numero(bruta?.nota);
  const notas = lista(bruta.notas)
    .map((par) => {
      const indice = Number(Array.isArray(par) ? par[0] : NaN);
      const valor = numero(Array.isArray(par) ? par[1] : null);
      const criterio = criterios[indice];
      if (!criterio || valor === null) return null;
      return {
        indice,
        criterio: criterio.texto,
        curto: criterio.curto,
        nota: valor,
      };
    })
    .filter((nota): nota is NonNullable<typeof nota> => nota !== null);
  const somaDasNotas = notas.length
    ? arredondar(notas.reduce((total, n) => total + n.nota, 0))
    : null;
  const dadosDaAnalise = registro(bruta.analise);
  const analise = bruta?.analise
    ? {
        id: dadosDaAnalise.id ?? null,
        ligacao: texto(dadosDaAnalise.ligacao) || null,
        nota: numero(dadosDaAnalise.nota),
        resultado: texto(dadosDaAnalise.resultado),
        etapa: texto(dadosDaAnalise.etapa),
        responsavel: texto(dadosDaAnalise.responsavel),
        ativo: dadosDaAnalise.ativo !== false,
      }
    : null;
  const entrevista: EntrevistaDoPainel = {
    busca: "",
    id: texto(bruta?.id),
    edital_id: bruta?.edital_id ?? null,
    edital: texto(bruta?.edital) || texto(bruta?.edital_planilha),
    edital_planilha: texto(bruta?.edital_planilha),
    unidade: texto(bruta?.unidade),
    vaga: texto(bruta?.vaga),
    cargo: texto(bruta?.cargo),
    candidato: texto(bruta?.candidato),
    codigo: texto(bruta?.codigo) || null,
    modalidade: texto(bruta?.modalidade) || null,
    nota,
    parecer: normalizarParecer(bruta?.parecer),
    compareceu: normalizarComparecimento(bruta?.compareceu),
    link: texto(bruta?.link) || null,
    notas,
    somaDasNotas,
    divergente: notaDivergente(nota, notas),
    semEdital: !bruta?.edital_id,
    analise,
  };
  entrevista.busca = normalizarBusca(
    [entrevista.candidato, entrevista.codigo].filter(Boolean).join(" "),
  );
  return entrevista;
}

function normalizarAprovado(valor: unknown): AprovadoSemEntrevista {
  const bruto = registro(valor);
  return {
    analise_id: bruto?.analise_id ?? null,
    candidato: texto(bruto?.candidato),
    codigo: texto(bruto?.codigo) || null,
    vaga: texto(bruto?.vaga),
    cargo: texto(bruto?.cargo),
    edital: texto(bruto?.edital),
    unidade: texto(bruto?.unidade),
    nota: numero(bruto?.nota),
    modalidade: texto(bruto?.modalidade) || null,
  };
}

/** O payload de `get_entrevistas_da_area` no formato do painel. */
export function normalizarPayload(valor: unknown): DadosDoPainel {
  const dados = registro(valor);
  const criterios = normalizarCriterios(dados?.criterios);
  const carga = dados.ultima_carga ? registro(dados.ultima_carga) : null;
  return {
    area: texto(dados?.area),
    geradoEm: dados?.gerado_em || null,
    ultimaCarga: carga
      ? {
          em: carga.em || null,
          linhas: numero(carga.linhas),
          ligadasAnalise: numero(carga.ligadas_analise),
          semAnalise: numero(carga.sem_analise),
          semEdital: numero(carga.sem_edital),
        }
      : null,
    criterios,
    entrevistas: lista(dados.entrevistas)
      .map((e) => normalizarEntrevista(e, criterios))
      .filter((e) => e.id || e.candidato),
    aprovadosSemEntrevista: lista(dados.aprovados_sem_entrevista).map(
      normalizarAprovado,
    ),
  };
}

/* ── Filtros ────────────────────────────────────────────────────────── */

export function situacoesDaLigacao(entrevista: EntrevistaDoPainel) {
  const lista = [];
  lista.push(entrevista.analise ? "ligado" : "sem_analise");
  if (entrevista.semEdital) lista.push("sem_edital");
  if (entrevista.divergente) lista.push("divergente");
  return lista;
}

export function filtrarEntrevistas(
  entrevistas: readonly EntrevistaDoPainel[],
  filtros: FiltrosDoPainel = FILTROS_VAZIOS,
) {
  const busca = normalizarBusca(filtros.busca);
  return entrevistas.filter((e) => {
    if (busca && !e.busca.includes(busca)) return false;
    if (filtros.unidade && e.unidade !== filtros.unidade) return false;
    if (filtros.edital && e.edital !== filtros.edital) return false;
    if (filtros.vaga && e.vaga !== filtros.vaga) return false;
    if (filtros.cargo && e.cargo !== filtros.cargo) return false;
    if (filtros.modalidade && (e.modalidade || "") !== filtros.modalidade)
      return false;
    if (filtros.parecer && e.parecer !== filtros.parecer) return false;
    if (
      filtros.comparecimento &&
      (e.compareceu || "NI") !== filtros.comparecimento
    )
      return false;
    if (filtros.ligacao && !situacoesDaLigacao(e).includes(filtros.ligacao))
      return false;
    if (filtros.andamento && andamentoDaEntrevista(e) !== filtros.andamento)
      return false;
    return true;
  });
}

/*
  Os aprovados na análise sem entrevista seguem os filtros que valem para eles
  (busca, unidade, edital, vaga, cargo e modalidade); parecer, comparecimento e
  ligação são da entrevista, que eles não têm.
*/
export function filtrarAprovadosSemEntrevista(
  aprovados: readonly AprovadoSemEntrevista[],
  filtros: FiltrosDoPainel = FILTROS_VAZIOS,
) {
  const busca = normalizarBusca(filtros.busca);
  return aprovados.filter((a) => {
    if (
      busca &&
      !normalizarBusca(`${a.candidato} ${a.codigo || ""}`).includes(busca)
    )
      return false;
    if (filtros.unidade && a.unidade !== filtros.unidade) return false;
    if (filtros.edital && a.edital !== filtros.edital) return false;
    if (filtros.vaga && a.vaga !== filtros.vaga) return false;
    if (filtros.cargo && a.cargo !== filtros.cargo) return false;
    if (filtros.modalidade && (a.modalidade || "") !== filtros.modalidade)
      return false;
    return true;
  });
}

const ordenarPt = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base" });

function valoresDistintos(
  lista: readonly EntrevistaDoPainel[],
  campo: keyof EntrevistaDoPainel,
) {
  return [...new Set(lista.map((item) => texto(item[campo])).filter(Boolean))]
    .sort(ordenarPt)
    .map((valor) => ({ valor, rotulo: valor }));
}

export function opcoesDosFiltros(
  entrevistas: readonly EntrevistaDoPainel[],
): OpcoesDosFiltros {
  return {
    unidades: valoresDistintos(entrevistas, "unidade"),
    editais: valoresDistintos(entrevistas, "edital"),
    vagas: valoresDistintos(entrevistas, "vaga"),
    cargos: valoresDistintos(entrevistas, "cargo"),
    modalidades: valoresDistintos(entrevistas, "modalidade"),
    pareceres: PARECERES.map((p) => ({ valor: p.id, rotulo: p.rotulo })),
    comparecimentos: COMPARECIMENTOS.map((c) => ({
      valor: c.id,
      rotulo: c.rotulo,
    })),
    ligacoes: SITUACOES_DA_LIGACAO.map((s) => ({
      valor: s.id,
      rotulo: s.rotulo,
    })),
    andamentos: ANDAMENTOS.map((a) => ({ valor: a.id, rotulo: a.rotulo })),
  };
}

/* ── KPIs ───────────────────────────────────────────────────────────── */

const chaveDoCandidato = (e: EntrevistaDoPainel) =>
  e.codigo ? `codigo:${e.codigo}` : `nome:${normalizarBusca(e.candidato)}`;

/** Média das notas finais de quem compareceu; `null` sem nenhuma nota. */
export function mediaDasNotas(entrevistas: readonly EntrevistaDoPainel[]) {
  const notas = entrevistas
    .filter((e) => e.compareceu === "S" && e.nota !== null)
    .flatMap((e) => (e.nota === null ? [] : [e.nota]));
  if (!notas.length) return null;
  return notas.reduce((total, n) => total + n, 0) / notas.length;
}

export function calcularIndicadores(
  entrevistas: readonly EntrevistaDoPainel[],
  aprovadosSemEntrevista: readonly AprovadoSemEntrevista[] = [],
): IndicadoresDoPainel {
  return {
    vagas: new Set(entrevistas.map((e) => e.vaga).filter(Boolean)).size,
    candidatos: new Set(entrevistas.map(chaveDoCandidato)).size,
    compareceram: entrevistas.filter((e) => e.compareceu === "S").length,
    aptos: entrevistas.filter((e) => e.parecer === "APTO").length,
    inaptos: entrevistas.filter((e) => e.parecer === "INAPTO").length,
    media: mediaDasNotas(entrevistas),
    semEntrevista: aprovadosSemEntrevista.length,
  };
}

/** Número com duas casas, em pt-BR; "—" sem valor. */
export function formatarNota(valor: unknown, casas = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor)))
    return "—";
  return formatNumberBR(Number(valor), {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

export function contagemPorParecer(entrevistas: readonly EntrevistaDoPainel[]) {
  return PARECERES.map((p) => ({
    id: p.id,
    rotulo: p.rotulo,
    valor: entrevistas.filter((e) => e.parecer === p.id).length,
  }));
}

export function contagemPorComparecimento(
  entrevistas: readonly EntrevistaDoPainel[],
) {
  return COMPARECIMENTOS.map((c) => ({
    id: c.id,
    rotulo: c.rotulo,
    valor: entrevistas.filter((e) => (e.compareceu || "NI") === c.id).length,
  }));
}

/* Faixas da nota final entre quem compareceu: a última inclui o 20. */
export function faixasDeNota(entrevistas: readonly EntrevistaDoPainel[]) {
  const contagem = FAIXAS_DE_NOTA.map((f) => ({ ...f, valor: 0 }));
  for (const e of entrevistas) {
    if (e.compareceu !== "S" || e.nota === null) continue;
    const nota = Math.min(Math.max(e.nota, 0), NOTA_MAXIMA);
    const indice = contagem.findIndex(
      (f, i) => nota >= f.de && (nota < f.ate || i === contagem.length - 1),
    );
    const faixa = contagem[indice];
    if (faixa) faixa.valor += 1;
  }
  return contagem;
}

/* Média de cada critério entre as notas lançadas (a ordem é a do payload). */
export function mediaPorCriterio(
  entrevistas: readonly EntrevistaDoPainel[],
  criterios: readonly CriterioDoPainel[],
) {
  return criterios
    .map((c) => {
      const notas = entrevistas.flatMap((e) =>
        e.notas.filter((n) => n.indice === c.indice).map((n) => n.nota),
      );
      return {
        indice: c.indice,
        rotulo: c.curto,
        texto: c.texto,
        quantidade: notas.length,
        media: notas.length
          ? notas.reduce((total, n) => total + n, 0) / notas.length
          : null,
      };
    })
    .filter((c) => c.quantidade > 0);
}

export function topUnidades(
  entrevistas: readonly EntrevistaDoPainel[],
  limite = 10,
) {
  const contagem = new Map<string, number>();
  for (const e of entrevistas) {
    const unidade = e.unidade || "Sem unidade";
    contagem.set(unidade, (contagem.get(unidade) || 0) + 1);
  }
  return [...contagem]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor || ordenarPt(a.rotulo, b.rotulo))
    .slice(0, limite);
}

/* ── Pendências ─────────────────────────────────────────────────────── */

/** Aprovados sem entrevista agrupados por edital e vaga. */
export function agruparAprovadosSemEntrevista(
  aprovados: readonly AprovadoSemEntrevista[],
) {
  const grupos = new Map<string, GrupoDosSemEntrevista>();
  for (const a of aprovados) {
    const chave = `${a.edital}\u0000${a.vaga}`;
    if (!grupos.has(chave))
      grupos.set(chave, {
        chave,
        edital: a.edital,
        vaga: a.vaga,
        cargo: a.cargo,
        unidade: a.unidade,
        candidatos: [],
      });
    grupos.get(chave)?.candidatos.push(a);
  }
  return [...grupos.values()].sort(
    (a, b) => ordenarPt(a.edital, b.edital) || ordenarPt(a.vaga, b.vaga),
  );
}

export function pendenciasDasEntrevistas(
  entrevistas: readonly EntrevistaDoPainel[],
  aprovadosSemEntrevista: readonly AprovadoSemEntrevista[],
): PendenciaDoPainel[] {
  return [
    {
      chave: "sem_entrevista",
      titulo: "Aprovados na análise sem entrevista registrada",
      subtitulo: "nas vagas que já têm entrevista",
      unidade: ["candidato", "candidatos"],
      valor: aprovadosSemEntrevista.length,
      severidade: "alta",
    },
    {
      chave: "sem_analise",
      titulo: "Entrevistas sem análise ligada",
      subtitulo: "sem candidato correspondente nas análises",
      unidade: ["entrevista", "entrevistas"],
      valor: entrevistas.filter((e) => !e.analise).length,
      severidade: "media",
    },
    {
      chave: "sem_edital",
      titulo: "Sem edital cadastrado",
      subtitulo: "o edital da planilha não foi encontrado",
      unidade: ["entrevista", "entrevistas"],
      valor: entrevistas.filter((e) => e.semEdital).length,
      severidade: "media",
    },
    {
      chave: "divergente",
      titulo: "Nota divergente",
      subtitulo: "a nota total difere da soma dos critérios",
      unidade: ["entrevista", "entrevistas"],
      valor: entrevistas.filter((e) => e.divergente).length,
      severidade: "alta",
    },
    {
      chave: "sem_comparecimento",
      campo: "andamento",
      titulo: "Sem comparecimento registrado",
      subtitulo: "convocados sem Compareceu ou Faltou",
      unidade: ["entrevista", "entrevistas"],
      valor: entrevistas.filter(
        (e) => andamentoDaEntrevista(e) === "sem_comparecimento",
      ).length,
      severidade: "media",
    },
    {
      chave: "sem_nota",
      campo: "andamento",
      titulo: "Compareceu, sem nota",
      subtitulo: "a ficha de notas ainda não foi lançada",
      unidade: ["entrevista", "entrevistas"],
      valor: entrevistas.filter((e) => andamentoDaEntrevista(e) === "sem_nota")
        .length,
      severidade: "alta",
    },
    {
      chave: "sem_parecer",
      campo: "andamento",
      titulo: "Com nota, sem parecer",
      subtitulo: "faltam notas de alguma competência ou avaliador",
      unidade: ["entrevista", "entrevistas"],
      valor: entrevistas.filter(
        (e) => andamentoDaEntrevista(e) === "sem_parecer",
      ).length,
      severidade: "media",
    },
  ];
}

/* ── Datas e CSV ────────────────────────────────────────────────────── */

/** "dd/mm/aaaa hh:mm" no fuso de quem usa; "" sem data válida. */
export function dataHoraBR(valor: unknown) {
  if (!valor) return "";
  const data = new Date(
    valor instanceof Date
      ? valor.getTime()
      : typeof valor === "string" || typeof valor === "number"
        ? valor
        : NaN,
  );
  if (Number.isNaN(data.getTime())) return "";
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()} ${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

const COLUNAS_DO_CSV: readonly (readonly [
  string,
  (e: EntrevistaDoPainel) => string,
])[] = Object.freeze([
  ["Candidato", (e) => e.candidato],
  ["Código", (e) => e.codigo || ""],
  ["Unidade", (e) => e.unidade],
  ["Edital", (e) => e.edital],
  ["Vaga", (e) => e.vaga],
  ["Cargo", (e) => e.cargo],
  ["Modalidade", (e) => e.modalidade || ""],
  ["Nota da entrevista", (e) => formatarNota(e.nota).replace("—", "")],
  ["Parecer", (e) => rotuloDoParecer(e.parecer)],
  ["Compareceu", (e) => rotuloDoComparecimento(e.compareceu)],
  [
    "Nota da análise",
    (e) => (e.analise ? formatarNota(e.analise.nota).replace("—", "") : ""),
  ],
  [
    "Resultado da análise",
    (e) => (e.analise ? e.analise.resultado : "Sem análise"),
  ],
  ["Ligação com a análise", (e) => (e.analise ? e.analise.ligacao || "" : "")],
  ["Nota divergente", (e) => (e.divergente ? "Sim" : "Não")],
]);

/** CSV com `;` (Excel pt-BR), BOM e células protegidas contra fórmula. */
export function csvDasEntrevistas(entrevistas: readonly EntrevistaDoPainel[]) {
  const celula = (valor: unknown) => {
    const seguro = sanitizeCsvCell(valor ?? "");
    return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  const linhas = [
    COLUNAS_DO_CSV.map(([titulo]) => celula(titulo)).join(";"),
    ...entrevistas.map((e) =>
      COLUNAS_DO_CSV.map(([, valor]) => celula(valor(e))).join(";"),
    ),
  ];
  return `\uFEFF${linhas.join("\r\n")}\r\n`;
}

/* ── Cópia guardada no navegador ────────────────────────────────────── */

/*
  O tipo de payload para src/lib/cache-de-payload.js (a mesma cópia
  "stale-while-revalidate" do painel de análises e da lista de aprovados): o
  payload da Saúde Indígena passa de 2 MB, e a tela abre com a cópia enquanto
  a versão nova chega.
*/
export const PAINEL_DE_ENTREVISTAS = Object.freeze({
  nome: "painel de entrevistas",
  chave: ({ area }: { area?: unknown }) =>
    `entrevistas:${String(area ?? "").trim()}`,
  esquema: (payload: unknown) => registro(payload).schema_version,
  esquemas: Object.freeze([1]),
  valido: (payload: unknown) => Array.isArray(registro(payload).entrevistas),
});

/* O payload mudou? `gerado_em` muda a cada leitura e não conta. */
export function payloadMudou(anterior: unknown, novo: unknown) {
  const semData = (payload: unknown) =>
    JSON.stringify({ ...registro(payload), gerado_em: null });
  return !anterior || !novo || semData(anterior) !== semData(novo);
}

/** Agenda externa: somente objetos e campos usados pela apresentação. */
export function normalizarAgendaDoPainel(valor: unknown): ItemDaAgenda[] {
  const dados = registro(valor);
  return lista(dados.itens)
    .filter(
      (item) =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    )
    .map((item) => {
      const dado = registro(item);
      const campo = (nome: string) =>
        typeof dado[nome] === "string" ? dado[nome] : null;
      return {
        analise_id: campo("analise_id"),
        nome: campo("nome"),
        vaga: campo("vaga"),
        cargo: campo("cargo"),
        data: campo("data"),
        inicio: campo("inicio"),
        banca: numero(dado.banca),
      };
    });
}
