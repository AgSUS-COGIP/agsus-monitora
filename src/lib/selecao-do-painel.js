/*
  Regras do painel de seleção (`selecao.html`), sem React e sem banco: o que
  chega de `get_selecao_da_area` (migration 20261001090000_selecao.sql) vira a
  lista de vagas que o painel desenha. Nada aqui escreve.

  O painel repete o antigo painel externo "AgSUS Monitora Recrutamento e
  Seleção" (Apps Script sobre a planilha "Auditoria"): quatro filtros de
  escolha múltipla (DSEI, edital, cargo, vaga), sete KPIs (inscritos, aptos,
  triados, convocados, aprovados, contratados e a taxa de contratação), cinco
  gráficos, a lista única de observações e a tabela da base.

  O que muda em relação ao antigo está só na origem de três números, que o
  banco resolve: convocados vêm das entrevistas do MONITORA quando o edital as
  tem (senão, da coluna V da planilha); aprovados e contratados vêm da lista de
  aprovados vigente (nulos, "—", sem lista).
*/
import { sanitizeCsvCell } from "./csv-security.js";
import { dataHoraBR, normalizarBusca } from "./entrevistas-do-painel.js";
import { formatNumberBR } from "./formatters.js";

export { dataHoraBR };

const texto = (valor) => String(valor ?? "").trim();

const inteiro = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/* Os filtros do painel antigo: escolha múltipla em cada um, mais a busca da tabela. */
export const FILTROS_VAZIOS = Object.freeze({
  unidades: Object.freeze([]),
  editais: Object.freeze([]),
  cargos: Object.freeze([]),
  vagas: Object.freeze([]),
});

export const ORIGENS_DOS_CONVOCADOS = Object.freeze([
  Object.freeze({ id: "entrevistas", rotulo: "Entrevistas do MONITORA" }),
  Object.freeze({ id: "planilha", rotulo: "Planilha Auditoria (dado antigo)" }),
]);

export const rotuloDaOrigem = (id) =>
  ORIGENS_DOS_CONVOCADOS.find((o) => o.id === id)?.rotulo || "Planilha";

const CAMPOS_NUMERICOS = Object.freeze([
  ["inscritos", "inscritos"],
  ["aptos", "aptos"],
  ["cancelados", "cancelados"],
  ["reprovadosQuestionario", "reprovados_questionario"],
  ["eliminadosNota", "eliminados_nota"],
  ["reprovadosAnalise", "reprovados_analise"],
  ["triados", "triados"],
  ["totalEliminados", "total_eliminados"],
  ["convocados", "convocados"],
  ["aprovados", "aprovados"],
  ["contratados", "contratados"],
  ["naoContratados", "nao_contratados"],
]);

function normalizarVaga(bruta) {
  const v = {
    id: texto(bruta?.id),
    edital_id: bruta?.edital_id ?? null,
    edital: texto(bruta?.edital) || texto(bruta?.edital_planilha),
    edital_planilha: texto(bruta?.edital_planilha),
    unidade: texto(bruta?.unidade),
    vaga: texto(bruta?.vaga) || null,
    vagaPlanilha: texto(bruta?.vaga_planilha),
    cargo: texto(bruta?.cargo) || texto(bruta?.vaga_planilha),
    observacao: texto(bruta?.observacao) || null,
    origemConvocados:
      texto(bruta?.origem_convocados) === "entrevistas"
        ? "entrevistas"
        : "planilha",
  };
  for (const [campo, chave] of CAMPOS_NUMERICOS)
    v[campo] = inteiro(bruta?.[chave]);
  v.busca = normalizarBusca(
    [v.unidade, v.edital, v.cargo, v.vaga, v.vagaPlanilha, v.observacao]
      .filter(Boolean)
      .join(" "),
  );
  return v;
}

/** O payload de `get_selecao_da_area` no formato do painel. */
export function normalizarPayload(dados) {
  const carga = dados?.ultima_carga;
  return {
    area: texto(dados?.area),
    geradoEm: dados?.gerado_em || null,
    ultimaCarga: carga
      ? {
          em: carga.em || null,
          linhas: inteiro(carga.linhas),
          semEdital: inteiro(carga.sem_edital),
        }
      : null,
    vagas: (Array.isArray(dados?.vagas) ? dados.vagas : [])
      .map(normalizarVaga)
      .filter((v) => v.id || v.vagaPlanilha),
  };
}

/* ── Filtros ────────────────────────────────────────────────────────── */

const escolheu = (lista, valor) => !lista?.length || lista.includes(valor);

export function filtrarVagas(vagas, filtros = FILTROS_VAZIOS, busca = "") {
  const termo = normalizarBusca(busca);
  return vagas.filter(
    (v) =>
      escolheu(filtros.unidades, v.unidade) &&
      escolheu(filtros.editais, v.edital) &&
      escolheu(filtros.cargos, v.cargo) &&
      escolheu(filtros.vagas, v.vaga || "") &&
      (!termo || v.busca.includes(termo)),
  );
}

const ordenarPt = (a, b) =>
  String(a).localeCompare(String(b), "pt-BR", {
    sensitivity: "base",
    numeric: true,
  });

const distintos = (lista, campo) =>
  [...new Set(lista.map((item) => texto(item[campo])).filter(Boolean))].sort(
    ordenarPt,
  );

/*
  As opções de cada filtro seguem os outros filtros já escolhidos (como no
  painel antigo): escolhido um DSEI, o filtro de edital só mostra os editais
  dele. A própria escolha de um filtro não limita as opções dele mesmo.
*/
export function opcoesDosFiltros(vagas, filtros = FILTROS_VAZIOS) {
  const sem = (campo) => filtrarVagas(vagas, { ...filtros, [campo]: [] });
  return {
    unidades: distintos(sem("unidades"), "unidade"),
    editais: distintos(sem("editais"), "edital"),
    cargos: distintos(sem("cargos"), "cargo"),
    vagas: distintos(sem("vagas"), "vaga"),
  };
}

export const CAMPOS_DO_FILTRO = Object.freeze([
  Object.freeze({
    campo: "unidades",
    rotulo: "Nome DSEI",
    todos: "Todos os DSEIs",
  }),
  Object.freeze({
    campo: "editais",
    rotulo: "Edital",
    todos: "Todos os editais",
  }),
  Object.freeze({
    campo: "cargos",
    rotulo: "Nome do cargo",
    todos: "Todos os cargos",
  }),
  Object.freeze({
    campo: "vagas",
    rotulo: "Número da vaga",
    todos: "Todas as vagas",
  }),
]);

/* Na SEDE e em Projetos a unidade não é DSEI. */
export function rotuloDaUnidade(area) {
  return area === "saude-indigena" ? "Nome DSEI" : "Unidade";
}

/** Os filtros escolhidos, como os chips e o recorte os descrevem. */
export function filtrosAtivos(filtros, area = "saude-indigena") {
  return CAMPOS_DO_FILTRO.filter(({ campo }) => filtros[campo]?.length).map(
    ({ campo, rotulo }) => ({
      campo,
      rotulo: campo === "unidades" ? rotuloDaUnidade(area) : rotulo,
      valores: filtros[campo],
    }),
  );
}

export function textoDoRecorte(filtros, area) {
  const ativos = filtrosAtivos(filtros, area);
  if (!ativos.length)
    return "Sem filtros aplicados. Visualizando toda a base carregada.";
  return `Recorte ativo: ${ativos.map((a) => `${a.rotulo}: ${a.valores.join(", ")}`).join(" · ")}`;
}

/* ── KPIs ───────────────────────────────────────────────────────────── */

/** Soma de um campo; `null` quando nenhuma vaga tem o número. */
export function somar(vagas, campo) {
  let soma = null;
  for (const v of vagas) if (v[campo] !== null) soma = (soma ?? 0) + v[campo];
  return soma;
}

/** Contratados ÷ aprovados, de 0 a 1; `null` sem aprovados. */
export function taxaDeContratacao(aprovados, contratados) {
  if (!aprovados) return null;
  return (contratados ?? 0) / aprovados;
}

export function calcularIndicadores(vagas) {
  const aprovados = somar(vagas, "aprovados");
  const contratados = somar(vagas, "contratados");
  return {
    vagas: vagas.length,
    inscritos: somar(vagas, "inscritos"),
    aptos: somar(vagas, "aptos"),
    triados: somar(vagas, "triados"),
    convocados: somar(vagas, "convocados"),
    aprovados,
    contratados,
    taxa: taxaDeContratacao(aprovados, contratados),
  };
}

/** Número inteiro em pt-BR; zero quando não há o número (como no painel antigo). */
export function formatarQuantidade(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor)))
    return "0";
  return formatNumberBR(Number(valor));
}

/** "12,5%"; "0%" sem aprovados. */
export function formatarTaxa(taxa) {
  if (taxa === null || taxa === undefined) return "0%";
  const pct = Math.round(taxa * 1000) / 10;
  return `${formatNumberBR(pct, { maximumFractionDigits: 1 })}%`;
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

/* "Eliminados antes da análise": cancelados, questionário e nota. */
export function eliminadosAntesDaAnalise(vagas) {
  return [
    {
      id: "cancelados",
      rotulo: "Cancelados",
      valor: somar(vagas, "cancelados") ?? 0,
    },
    {
      id: "reprovadosQuestionario",
      rotulo: "Questionário não finalizado",
      valor: somar(vagas, "reprovadosQuestionario") ?? 0,
    },
    {
      id: "eliminadosNota",
      rotulo: "Eliminados por nota",
      valor: somar(vagas, "eliminadosNota") ?? 0,
    },
  ];
}

/* "Aptos na análise e eliminados": aptos para análise × total de eliminados. */
export function aptosEEliminados(vagas) {
  return [
    {
      id: "aptos",
      rotulo: "Aptos para análise",
      valor: somar(vagas, "aptos") ?? 0,
    },
    {
      id: "eliminados",
      rotulo: "Eliminados",
      valor: somar(vagas, "totalEliminados") ?? 0,
    },
  ];
}

/* "Triados e reprovados na análise". */
export function triadosEReprovados(vagas) {
  return [
    { id: "triados", rotulo: "Triados", valor: somar(vagas, "triados") ?? 0 },
    {
      id: "reprovadosAnalise",
      rotulo: "Reprovados na análise",
      valor: somar(vagas, "reprovadosAnalise") ?? 0,
    },
  ];
}

/* "Top DSEIs por inscritos". */
export function topUnidades(vagas, limite = 10) {
  const soma = new Map();
  for (const v of vagas) {
    const unidade = v.unidade || "Sem unidade";
    soma.set(unidade, (soma.get(unidade) || 0) + (v.inscritos || 0));
  }
  return [...soma]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .filter((u) => u.valor > 0)
    .sort((a, b) => b.valor - a.valor || ordenarPt(a.rotulo, b.rotulo))
    .slice(0, limite);
}

/* ── Observações ────────────────────────────────────────────────────── */

/*
  "Alertas identificados no recorte": cada observação da coluna T uma vez,
  com onde ela aparece (quantas vagas, em quais DSEIs e editais).
*/
export function observacoesDoRecorte(vagas) {
  const grupos = new Map();
  for (const v of vagas) {
    if (!v.observacao) continue;
    const chave = normalizarBusca(v.observacao);
    if (!grupos.has(chave))
      grupos.set(chave, {
        texto: v.observacao,
        vagas: 0,
        unidades: new Set(),
        editais: new Set(),
      });
    const g = grupos.get(chave);
    g.vagas += 1;
    if (v.unidade) g.unidades.add(v.unidade);
    if (v.edital) g.editais.add(v.edital);
  }
  return [...grupos.values()]
    .map((g) => ({
      texto: g.texto,
      vagas: g.vagas,
      unidades: [...g.unidades].sort(ordenarPt),
      editais: [...g.editais].sort(ordenarPt),
    }))
    .sort((a, b) => b.vagas - a.vagas || ordenarPt(a.texto, b.texto));
}

/* ── Datas e CSV ────────────────────────────────────────────────────── */

export function textoDaUltimaCarga(ultimaCarga) {
  const quando = dataHoraBR(ultimaCarga?.em);
  return quando ? `Atualizado: ${quando}` : "Atualizado: --";
}

const numeroDoCsv = (valor) => (valor === null ? "" : String(valor));

const COLUNAS_DO_CSV = Object.freeze([
  ["DSEI / Unidade", (v) => v.unidade],
  ["Edital", (v) => v.edital],
  ["Cargo", (v) => v.cargo],
  ["Vaga", (v) => v.vaga || ""],
  ["Inscritos", (v) => numeroDoCsv(v.inscritos)],
  ["Aptos para análise", (v) => numeroDoCsv(v.aptos)],
  ["Cancelados", (v) => numeroDoCsv(v.cancelados)],
  [
    "Reprovados por não finalizar o questionário",
    (v) => numeroDoCsv(v.reprovadosQuestionario),
  ],
  ["Eliminados por nota", (v) => numeroDoCsv(v.eliminadosNota)],
  ["Reprovados na análise", (v) => numeroDoCsv(v.reprovadosAnalise)],
  ["Triados", (v) => numeroDoCsv(v.triados)],
  ["Total de eliminados", (v) => numeroDoCsv(v.totalEliminados)],
  ["Convocados para entrevista", (v) => numeroDoCsv(v.convocados)],
  ["Origem dos convocados", (v) => rotuloDaOrigem(v.origemConvocados)],
  ["Aprovados", (v) => numeroDoCsv(v.aprovados)],
  ["Contratados", (v) => numeroDoCsv(v.contratados)],
  ["Não contratados", (v) => numeroDoCsv(v.naoContratados)],
  ["Observação", (v) => v.observacao || ""],
]);

const BOM = String.fromCharCode(0xfeff);

/** CSV com `;` (Excel pt-BR), BOM e células protegidas contra fórmula. */
export function csvDaSelecao(vagas) {
  const celula = (valor) => {
    const seguro = sanitizeCsvCell(valor ?? "");
    return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  const linhas = [
    COLUNAS_DO_CSV.map(([titulo]) => celula(titulo)).join(";"),
    ...vagas.map((v) =>
      COLUNAS_DO_CSV.map(([, valor]) => celula(valor(v))).join(";"),
    ),
  ];
  return `${BOM}${linhas.join("\r\n")}\r\n`;
}

/* ── Cópia guardada no navegador ────────────────────────────────────── */

/* O tipo de payload para src/lib/cache-de-payload.js (a mesma cópia das Entrevistas). */
export const PAINEL_DE_SELECAO = Object.freeze({
  nome: "painel de seleção",
  chave: ({ area }) => `selecao:${String(area ?? "").trim()}`,
  esquema: (payload) => payload?.schema_version,
  esquemas: Object.freeze([1]),
  valido: (payload) => Array.isArray(payload?.vagas),
});

/* O payload mudou? `gerado_em` muda a cada leitura e não conta. */
export function payloadMudou(anterior, novo) {
  const semData = (payload) => JSON.stringify({ ...payload, gerado_em: null });
  return !anterior || !novo || semData(anterior) !== semData(novo);
}
