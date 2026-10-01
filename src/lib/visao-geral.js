/*
  A VISÃO GERAL (página `dashboard`), sem DOM nem rede — as regras que
  moravam em `legacy-app.js` (applyFilters, renderKpis, renderStatusSummary,
  renderMultiUnits, renderChart, renderRisks, renderTable, exportCSV) e nos
  remendos `health-*` da tabela e do gráfico.

  Saúde Indígena, SEDE e Projetos abrem a mesma página, com os editais da
  área atual (`CO_AREA`, `linhasDaArea`). O que muda por área é o bloco do
  mapa (`visao-geral-da-area.js`); o resto mora aqui.

  O recorte: seis filtros de escolha múltipla (Unidade, Edital, Etapa,
  Status, Risco, UF; comparação sem acento nem caixa, `filtros-do-mapa.js`),
  a busca livre e o DSEI aberto no mapa. KPIs, mapa, resumo, gráfico,
  atenção, tabela e exportação partem do mesmo recorte.
*/

import { hojeEmBrasilia } from "./cronograma-do-edital.js";
import { sanitizeCsvCell } from "./csv-security.js";
import {
  compararEditais,
  ordemDoRisco,
  tomDoRisco,
  tomDoStatusDoEdital,
} from "./editais-do-nucleo.js";
import {
  linhaAtende,
  opcoesDoCampo,
  podarSelecoes,
} from "./filtros-do-mapa.js";
import {
  ehRiscoAtivo,
  indicadoresDoMonitoramento,
  somarCampo,
} from "./indicadores-do-monitoramento.js";

const txt = (valor) => String(valor ?? "").trim();
const low = (valor) => txt(valor).toLowerCase();
const num = (valor) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};
const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

// ── Filtros ──────────────────────────────────────────────────────────────

/* Os seis filtros, na ordem da página. `mais`: ficam em "Mais opções". */
export const CAMPOS_DO_FILTRO = Object.freeze([
  Object.freeze({ campo: "unidade", rotulo: "Unidade", todos: "Todas" }),
  Object.freeze({ campo: "edital", rotulo: "Edital", todos: "Todos" }),
  Object.freeze({ campo: "status", rotulo: "Status", todos: "Todos" }),
  Object.freeze({
    campo: "etapa",
    rotulo: "Etapa",
    todos: "Todas",
    mais: true,
  }),
  Object.freeze({
    campo: "risco",
    rotulo: "Risco",
    todos: "Todos",
    mais: true,
  }),
  Object.freeze({ campo: "uf", rotulo: "UF", todos: "Todas", mais: true }),
]);
export const CAMPOS = Object.freeze(CAMPOS_DO_FILTRO.map((c) => c.campo));

export const rotuloDoCampo = (campo) =>
  CAMPOS_DO_FILTRO.find((c) => c.campo === campo)?.rotulo || campo;

/** `{ unidade: [], edital: [], … }` */
export function filtrosVazios() {
  return Object.fromEntries(CAMPOS.map((campo) => [campo, []]));
}

/* Do armazenamento (ou de qualquer origem): só os campos conhecidos, só texto. */
export function normalizarFiltros(bruto) {
  const filtros = filtrosVazios();
  if (!bruto || typeof bruto !== "object") return filtros;
  for (const campo of CAMPOS) {
    if (Array.isArray(bruto[campo]))
      filtros[campo] = [...new Set(bruto[campo].map(txt).filter(Boolean))];
  }
  return filtros;
}

const comoConjuntos = (filtros) =>
  Object.fromEntries(CAMPOS.map((c) => [c, new Set(filtros?.[c] || [])]));
const comoListas = (conjuntos) =>
  Object.fromEntries(CAMPOS.map((c) => [c, [...(conjuntos[c] || [])]]));

/** Quantos campos têm seleção. */
export const camposAtivos = (filtros) =>
  CAMPOS.filter((campo) => (filtros?.[campo] || []).length).length;

/* A ordem das opções: edital por ano e número, etapa/status/risco pelo fluxo. */
const ORDEM_DA_ETAPA = [
  "Elaboração do Edital",
  "Impugnação do Edital",
  "Período de inscrição",
  "Análise Curricular",
  "Resultado Preliminar",
  "Abertura do Prazo de Recurso",
  "Entrevistas",
  "Resultado final do Processo Seletivo",
];
const ORDEM_DO_STATUS = [
  "Em Andamento",
  "Andamento",
  "Concluído",
  "Concluido",
  "Cancelado",
  "Cancelada",
];
const ORDEM_DO_RISCO = ["Alto", "Médio", "Medio", "Baixo"];

/** Texto sem acento, sem caixa e com espaços colapsados (busca e ordem). */
export function normalizarTexto(valor) {
  return txt(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function posicaoNaLista(valor, lista) {
  const indice = lista.map(normalizarTexto).indexOf(normalizarTexto(valor));
  return indice >= 0 ? indice : 999;
}

function partesDoEdital(valor) {
  const achado = txt(valor).match(/^(\d{1,3})\s*\/\s*(\d{4})/);
  return achado ? { numero: Number(achado[1]), ano: Number(achado[2]) } : null;
}

export function compararValoresDoFiltro(campo, a, b) {
  if (campo === "edital") {
    const ea = partesDoEdital(a);
    const eb = partesDoEdital(b);
    if (ea && eb) {
      if (ea.ano !== eb.ano) return ea.ano - eb.ano;
      if (ea.numero !== eb.numero) return ea.numero - eb.numero;
    }
    if (ea && !eb) return -1;
    if (!ea && eb) return 1;
  }
  const lista =
    campo === "etapa"
      ? ORDEM_DA_ETAPA
      : campo === "status"
        ? ORDEM_DO_STATUS
        : campo === "risco"
          ? ORDEM_DO_RISCO
          : null;
  if (lista) {
    const diferenca = posicaoNaLista(a, lista) - posicaoNaLista(b, lista);
    if (diferenca) return diferenca;
  }
  return txt(a).localeCompare(txt(b), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

/** As opções de cada filtro: o que as linhas que atendem aos OUTROS filtros têm. */
export function opcoesDosFiltros(linhas, filtros) {
  const estado = comoConjuntos(filtros);
  return Object.fromEntries(
    CAMPOS.map((campo) => [
      campo,
      opcoesDoCampo(linhas, estado, campo, {
        campos: CAMPOS,
        comparar: (a, b) => compararValoresDoFiltro(campo, a, b),
      }),
    ]),
  );
}

/*
  Tira, até estabilizar, as seleções que nenhuma opção oferece mais (trocar de
  área ou recarregar os dados). Devolve os mesmos filtros se nada mudou.
*/
export function podarFiltros(linhas, filtros) {
  const estado = comoConjuntos(filtros);
  return podarSelecoes(linhas, estado, { campos: CAMPOS })
    ? comoListas(estado)
    : filtros;
}

// ── Busca e recorte ──────────────────────────────────────────────────────

const CAMPOS_DA_BUSCA = [
  "processo",
  "edital",
  "unidade",
  "ciclo",
  "uf",
  "status",
  "etapa",
  "responsavel",
  "cargos",
  "risco",
  "observacoes",
  "observacoes_internas",
  "link_edital",
];

export function linhaCasaComBusca(linha, busca) {
  const termo = normalizarTexto(busca);
  if (!termo) return true;
  return CAMPOS_DA_BUSCA.map((campo) => normalizarTexto(linha?.[campo]))
    .join(" | ")
    .includes(termo);
}

/* O valor de uma coluna para ordenar a tabela. */
export function valorParaOrdenar(linha, campo) {
  if (["vagas_total", "contratados", "vagas_ociosas"].includes(campo))
    return num(linha?.[campo]);
  if (campo === "risco") return ordemDoRisco(linha?.risco);
  if (campo === "data_inicio" || campo === "data_fim") {
    const valor = txt(linha?.[campo]);
    const tempo = valor ? Date.parse(valor) : NaN;
    return Number.isFinite(tempo) ? tempo : 0;
  }
  return txt(linha?.[campo]).toLocaleLowerCase("pt-BR");
}

/*
  Sem ordenação escolhida, a fila do Núcleo (risco, depois ociosas). Com ela,
  a coluna, e a fila desempata.
*/
export function compararLinhas(ordenacao) {
  const { campo, direcao } = ordenacao || {};
  if (!campo || !direcao) return compararEditais;
  return (a, b) => {
    const va = valorParaOrdenar(a, campo);
    const vb = valorParaOrdenar(b, campo);
    let resultado =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "pt-BR", {
            numeric: true,
            sensitivity: "base",
          });
    if (resultado === 0) resultado = compararEditais(a, b);
    return direcao === "desc" ? -resultado : resultado;
  };
}

/** Clicar no cabeçalho: crescente → decrescente → sem ordenação. */
export function proximaOrdenacao(atual, campo) {
  if (atual?.campo !== campo) return { campo, direcao: "asc" };
  if (atual.direcao === "asc") return { campo, direcao: "desc" };
  return { campo: "", direcao: "" };
}

/**
 * As linhas do recorte, já ordenadas.
 * `dsei`: chave do DSEI aberto no mapa; `chaveDsei(linha)`, a chave da linha
 * (a do mapa, `dseiKey` do legado).
 */
export function recortar(
  linhas,
  { filtros, busca = "", dsei = "", chaveDsei, ordenacao } = {},
) {
  const estado = comoConjuntos(filtros);
  return (Array.isArray(linhas) ? linhas : [])
    .filter(
      (linha) =>
        linhaAtende(linha, estado, {
          campos: CAMPOS,
          dsei,
          chaveDsei: chaveDsei || (() => ""),
        }) && linhaCasaComBusca(linha, busca),
    )
    .sort(compararLinhas(ordenacao));
}

// ── Risco crítico (o KPI que filtra) ─────────────────────────────────────

const ehRiscoCritico = (valor) =>
  ["alto", "médio", "medio"].includes(low(valor));

/** Os valores de risco Médio/Alto entre as opções do filtro. */
export const riscosCriticos = (opcoesDeRisco) =>
  (opcoesDeRisco || []).filter(ehRiscoCritico);

/** O filtro de risco é só Médio/Alto? */
export function filtroDeRiscoCriticoAtivo(filtros) {
  const selecionados = filtros?.risco || [];
  return selecionados.length > 0 && selecionados.every(ehRiscoCritico);
}

// ── Indicadores ──────────────────────────────────────────────────────────

/*
  Os seis indicadores, na ordem da página inicial: chave do rótulo em
  Configurações › Página inicial, rótulo padrão, ícone e tom. A prévia de
  Configurações usa a mesma lista.
*/
export const INDICADORES = Object.freeze([
  Object.freeze(["kpi_processos_label", "Processos", "fa-folder-open", "info"]),
  Object.freeze(["kpi_vagas_label", "Vagas", "fa-users", "info"]),
  Object.freeze([
    "kpi_contratados_label",
    "Contratações",
    "fa-circle-check",
    "sucesso",
  ]),
  Object.freeze([
    "kpi_ociosas_label",
    "Vagas ociosas",
    "fa-circle-exclamation",
    "alerta",
  ]),
  Object.freeze(["kpi_criticos_label", "Críticos", "fa-fire", "perigo"]),
  Object.freeze([
    "kpi_inscritos_label",
    "Inscritos",
    "fa-file-lines",
    "destaque",
  ]),
]);

/* A chave de cada indicador no objeto de `indicadoresDaVisaoGeral`. */
export const VALOR_DO_INDICADOR = Object.freeze({
  kpi_processos_label: "processos",
  kpi_vagas_label: "vagas",
  kpi_contratados_label: "contratados",
  kpi_ociosas_label: "ociosas",
  kpi_criticos_label: "criticos",
  kpi_inscritos_label: "inscritos",
});

/*
  O resumo do servidor (`get_monitoramento_dashboard_payload`) soma todos os
  editais, de todas as áreas: só vale sem recorte e quando a área atual tem
  todas as linhas da base.
*/
export function podeUsarResumoDoServidor({
  resumo,
  temRecorte,
  linhasDaArea,
  totalDeLinhas,
}) {
  return Boolean(resumo?.kpis) && !temRecorte && linhasDaArea === totalDeLinhas;
}

/** Os seis números; `resumo` (do servidor) troca todos menos Críticos. */
export function indicadoresDaVisaoGeral(linhas, resumo = null) {
  const locais = indicadoresDoMonitoramento(linhas);
  const k = resumo?.kpis;
  if (!k) return locais;
  return {
    processos: num(k.processos_ativos),
    vagas: num(k.vagas_total),
    contratados: num(k.contratados),
    ociosas: num(k.vagas_ociosas),
    criticos: locais.criticos,
    inscritos: num(k.inscritos),
  };
}

// ── Blocos ───────────────────────────────────────────────────────────────

/* Contagem por valor de um campo, do maior para o menor. */
export function contarPorCampo(linhas, campo, vazio = "Não informado") {
  const contagem = new Map();
  (linhas || []).forEach((linha) => {
    const chave = txt(linha?.[campo]) || vazio;
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  });
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
}

/** O tom da etapa (sucesso, info, alerta, perigo, neutro). */
export function tomDaEtapa(etapa) {
  const l = low(etapa);
  if (l.includes("conclu")) return "sucesso";
  if (l.includes("entrevista")) return "info";
  if (l.includes("análise") || l.includes("analise")) return "destaque";
  if (l.includes("resultado")) return "alerta";
  if (l.includes("cancel")) return "perigo";
  return "neutro";
}

/** "Resumo por etapa": `[{ etapa, quantos, pct, tom }]`. */
export function resumoPorEtapa(linhas) {
  const contagem = contarPorCampo(linhas, "etapa");
  const total = contagem.reduce((soma, [, quantos]) => soma + quantos, 0);
  return contagem.map(([etapa, quantos]) => ({
    etapa,
    quantos,
    pct: pct(quantos, total),
    tom: tomDaEtapa(etapa),
  }));
}

/*
  O status como o gráfico agrupa ("em andamento", "Em Andamento" e
  "Andamento" são um só); vazio é "Cronograma pendente".
*/
export function statusCanonico(valor) {
  const chave = normalizarTexto(valor);
  if (chave.includes("conclu")) return "Concluído";
  if (chave.includes("cancel")) return "Cancelado";
  if (chave.includes("suspens")) return "Suspenso";
  if (chave.includes("paralis")) return "Paralisado";
  if (chave.includes("planejad")) return "Planejado";
  if (chave.includes("andamento")) return "Em andamento";
  if (chave.includes("cronograma pendente") || !chave)
    return "Cronograma pendente";
  return txt(valor) || "Não informado";
}

/** O tom de cada status no gráfico (cor dos tokens). */
export function tomDoStatus(status) {
  const chave = normalizarTexto(status);
  if (chave.includes("conclu")) return "sucesso";
  if (chave.includes("andamento")) return "info";
  if (chave.includes("planejad")) return "destaque";
  if (chave.includes("cancel")) return "perigo";
  if (chave.includes("suspens") || chave.includes("paralis")) return "alerta";
  return "neutro";
}

/** "Status operacional": `{ total, itens: [{ status, quantos, pct, tom }] }`. */
export function statusOperacional(linhas) {
  const contagem = new Map();
  (linhas || []).forEach((linha) => {
    const status = statusCanonico(linha?.status);
    contagem.set(status, (contagem.get(status) || 0) + 1);
  });
  const total = linhas?.length || 0;
  return {
    total,
    itens: [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([status, quantos]) => ({
        status,
        quantos,
        pct: pct(quantos, total),
        tom: tomDoStatus(status),
      })),
  };
}

/* Os valores do filtro de Status que um status do gráfico representa. */
export function valoresDoStatus(status, opcoesDeStatus) {
  return (opcoesDeStatus || []).filter(
    (valor) => statusCanonico(valor) === status,
  );
}

/** Os status do gráfico que a seleção do filtro cobre (o destaque da legenda). */
export function statusSelecionados(filtros) {
  return new Set((filtros?.status || []).map(statusCanonico));
}

/** "Unidades com mais de um processo seletivo": as 8 com mais processos. */
export function unidadesComMaisDeUmProcesso(linhas, limite = 8) {
  return contarPorCampo(linhas, "unidade", "Não informada")
    .filter(([, quantos]) => quantos > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, limite)
    .map(([unidade, quantos]) => ({ unidade, quantos }));
}

/** "Atenção": os processos com risco Médio/Alto ainda abertos (até 30). */
export function processosEmAtencao(linhas, limite = 30) {
  return (linhas || []).filter(ehRiscoAtivo).slice(0, limite);
}

// ── Tabela ───────────────────────────────────────────────────────────────

export const COLUNAS_DA_TABELA = Object.freeze([
  Object.freeze({ campo: "unidade", rotulo: "Unidade" }),
  Object.freeze({ campo: "edital", rotulo: "Edital" }),
  Object.freeze({ campo: "data_inicio", rotulo: "Início" }),
  Object.freeze({ campo: "data_fim", rotulo: "Encerramento" }),
  Object.freeze({ campo: "vagas_total", rotulo: "Vagas", numero: true }),
  Object.freeze({ campo: "contratados", rotulo: "Contratados", numero: true }),
  Object.freeze({ campo: "vagas_ociosas", rotulo: "Ociosas", numero: true }),
  Object.freeze({ campo: "status", rotulo: "Status" }),
  Object.freeze({ campo: "etapa", rotulo: "Etapa" }),
  Object.freeze({ campo: "risco", rotulo: "Risco" }),
  Object.freeze({ campo: "observacoes", rotulo: "Observações" }),
]);
export const COLUNAS_PADRAO = Object.freeze(
  COLUNAS_DA_TABELA.map((c) => c.campo),
);

/* As colunas guardadas: só as conhecidas; nenhuma válida → todas. */
export function normalizarColunas(bruto) {
  const lista = Array.isArray(bruto)
    ? COLUNAS_PADRAO.filter((campo) => bruto.includes(campo))
    : [];
  return lista.length ? lista : [...COLUNAS_PADRAO];
}

/* Marcar/desmarcar uma coluna; a última visível não sai. */
export function alternarColuna(colunas, campo, visivel) {
  const proximas = visivel
    ? COLUNAS_PADRAO.filter((c) => c === campo || colunas.includes(c))
    : colunas.filter((c) => c !== campo);
  return proximas.length ? proximas : colunas;
}

/** "AAAA-MM-DD…" → "DD/MM/AAAA"; outro texto fica como está. */
export function dataCurta(valor) {
  const texto = txt(valor);
  const achado = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return achado ? `${achado[3]}/${achado[2]}/${achado[1]}` : texto;
}

/* Dias de hoje até a data (local; "AAAA-MM-DD" não vira UTC). */
export function diasAte(data, hoje = new Date()) {
  if (!data) return null;
  const achado = String(data).match(/^(\d{4})-(\d{2})-(\d{2})/);
  let alvo;
  if (achado)
    alvo = new Date(
      Number(achado[1]),
      Number(achado[2]) - 1,
      Number(achado[3]),
    );
  else {
    const tempo = Date.parse(data);
    if (!Number.isFinite(tempo)) return null;
    alvo = new Date(tempo);
    alvo = new Date(alvo.getFullYear(), alvo.getMonth(), alvo.getDate());
  }
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - dia) / 86400000);
}

/*
  O prazo do edital, na célula do edital: cancelado e concluído dizem isso;
  encerrado; "Edital encerra em N dias" até 7 (perigo) e até 30 (alerta);
  mais longe, nada. `{ tom, rotulo, icone }` ou `null`.
*/
export function prazoDoEdital(linha, hoje = new Date()) {
  const status = low(linha?.status);
  if (["cancelado", "cancelada"].includes(status))
    return { tom: "neutro", rotulo: "Processo cancelado", icone: "fa-ban" };
  if (["concluído", "concluido"].includes(status))
    return { tom: "neutro", rotulo: "Processo concluído", icone: "fa-check" };
  const dias = diasAte(linha?.data_fim, hoje);
  if (dias === null) return null;
  if (dias < 0)
    return {
      tom: "neutro",
      rotulo: "Prazo do edital encerrado",
      icone: "fa-calendar-days",
    };
  const rotulo = `Edital encerra em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  if (dias <= 7) return { tom: "perigo", rotulo, icone: "fa-fire" };
  if (dias <= 30) return { tom: "alerta", rotulo, icone: "fa-clock" };
  return null;
}

/*
  A situação do cronograma (Editais): `{ tom, rotulo }`. `tom`: "done"
  (concluído/cancelado), "warning", "danger", "info" ou "neutral" — também a
  cor da linha na tabela.
*/
export function urgenciaDoCronograma(linha) {
  if (!linha)
    return { tom: "neutral", rotulo: "Dados operacionais indisponíveis" };
  const status = statusCanonico(linha.status);
  if (["Concluído", "Cancelado"].includes(status))
    return { tom: "done", rotulo: status };
  if (!linha.cronograma_automatico)
    return { tom: "warning", rotulo: "Sem cronograma estruturado" };
  const dias = Number(linha.cronograma_dias_para_proxima);
  const temDias =
    linha.cronograma_dias_para_proxima !== null &&
    linha.cronograma_dias_para_proxima !== undefined &&
    linha.cronograma_dias_para_proxima !== "" &&
    Number.isFinite(dias);
  if (temDias && dias < 0)
    return {
      tom: "danger",
      rotulo: `Etapa atrasada há ${Math.abs(dias)} dia(s)`,
    };
  if (temDias && dias <= 3)
    return { tom: "danger", rotulo: `Próxima etapa em ${dias} dia(s)` };
  if (temDias && dias <= 7)
    return { tom: "warning", rotulo: `Próxima etapa em ${dias} dia(s)` };
  if (linha.cronograma_proxima_atividade)
    return {
      tom: "info",
      rotulo: `Próxima: ${linha.cronograma_proxima_atividade}`,
    };
  return { tom: "neutral", rotulo: "Sem próxima atividade" };
}

/*
  O selo do cronograma na célula do edital: some nos concluídos e cancelados
  (o prazo já diz) e "Sem cronograma estruturado" fica curto.
*/
export function seloDoCronograma(linha) {
  const urgencia = urgenciaDoCronograma(linha);
  if (urgencia.tom === "done") return null;
  if (urgencia.rotulo === "Sem cronograma estruturado")
    return {
      ...urgencia,
      rotulo: "Sem cronograma",
      titulo: "Cronograma ainda não cadastrado em Editais",
    };
  return { ...urgencia, titulo: `Cronograma: ${urgencia.rotulo}` };
}

/** A taxa de vagas ociosas da linha: `{ pct, nivel }` (low, medium, high, critical). */
export function taxaDeOciosidade(linha) {
  const vagas = num(linha?.vagas_total);
  const taxa =
    vagas > 0 ? Math.round((num(linha?.vagas_ociosas) / vagas) * 100) : 0;
  const nivel =
    taxa >= 60
      ? "critical"
      : taxa >= 40
        ? "high"
        : taxa >= 20
          ? "medium"
          : "low";
  return { pct: taxa, nivel };
}

/* Os tons de chip do Núcleo (`green`…) no tom do `Selo` de src/ui/. */
const SELO_DO_TOM = {
  green: "aprovado",
  red: "reprovado",
  yellow: "pendente",
  blue: "revisar",
  cyan: "revisar",
  gray: "neutro",
};
export const seloDoStatus = (status) =>
  SELO_DO_TOM[tomDoStatusDoEdital(status)] || "neutro";
export const seloDoRisco = (risco) =>
  SELO_DO_TOM[tomDoRisco(risco)] || "neutro";

/** Observação longa (mais de 180 caracteres) abre com "Ver mais". */
export const observacaoLonga = (valor) => txt(valor).length > 180;

/** Link do edital só se for http(s). */
export function linkSeguro(valor) {
  const texto = txt(valor);
  if (!texto) return "";
  try {
    const url = new URL(texto, "https://monitora.invalid");
    return url.protocol === "http:" || url.protocol === "https:" ? texto : "";
  } catch {
    return "";
  }
}

// ── Exportação ───────────────────────────────────────────────────────────

const CAMPOS_DO_CSV = [
  ["unidade", "Unidade"],
  ["uf", "UF"],
  ["edital", "Edital"],
  ["processo", "Processo SEI"],
  ["ciclo", "Ciclo"],
  ["vagas_total", "Vagas Previstas"],
  ["contratados", "Contratados"],
  ["vagas_ociosas", "Vagas Ociosas"],
  ["inscritos", "Inscritos"],
  ["status", "Status"],
  ["etapa", "Etapa"],
  ["risco", "Risco"],
  ["data_inicio", "Data de Início"],
  ["data_fim", "Data de Encerramento"],
  ["responsavel", "Responsável"],
  ["observacoes", "Observações"],
  ["link_edital", "Link do Edital"],
];

/* A marca de ordem de bytes: o Excel abre o CSV como UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** O CSV da tabela (separador `;`, BOM para o Excel, sem fórmula). */
export function csvDaVisaoGeral(linhas) {
  const celula = (valor) =>
    `"${sanitizeCsvCell(valor)
      .replaceAll('"', '""')
      .replaceAll("\r", " ")
      .replaceAll("\n", " ")}"`;
  const cabecalho = CAMPOS_DO_CSV.map(([, rotulo]) => `"${rotulo}"`).join(";");
  const corpo = (linhas || [])
    .map((linha) =>
      CAMPOS_DO_CSV.map(([campo]) => celula(linha?.[campo])).join(";"),
    )
    .join("\r\n");
  return `${BOM}${cabecalho}\n${corpo}`;
}

/* "saude-indigena" → "SaudeIndigena" (nome do arquivo). */
const nomeDaAreaNoArquivo = (area) =>
  txt(area)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((parte) => parte[0].toUpperCase() + parte.slice(1))
    .join("") || "Monitoramento";

/* O dia é o de Brasília (com o de UTC, quem exportava à noite levava amanhã). */
export function nomeDoCsv(area, agora = new Date()) {
  const dia = hojeEmBrasilia(agora).replaceAll("-", "");
  return `AgSUS_Monitora_${nomeDaAreaNoArquivo(area)}_${dia}.csv`;
}

/*
  O cabeçalho do relatório em PDF (impressão do navegador, menu da conta):
  os filtros aplicados em uma linha e os números do recorte.
*/
export function resumoDoRelatorio({ filtros, busca = "", linhas = [] } = {}) {
  const ativos = CAMPOS_DO_FILTRO.filter(
    ({ campo }) => (filtros?.[campo] || []).length,
  ).map(({ campo, rotulo }) => `${rotulo}: ${filtros[campo].join(", ")}`);
  if (txt(busca)) ativos.push(`Busca: ${txt(busca)}`);
  const vagas = somarCampo(linhas, "vagas_total");
  const ociosas = somarCampo(linhas, "vagas_ociosas");
  return {
    filtros: ativos.length
      ? ativos.join(" · ")
      : "Nenhum filtro aplicado (todos os processos)",
    processos: linhas.length,
    vagas,
    contratados: somarCampo(linhas, "contratados"),
    ociosas,
    pctOciosas: pct(ociosas, vagas),
  };
}

// ── Textos de Configurações ──────────────────────────────────────────────

/*
  Os textos da página que vêm de Configurações (TB_CONFIGURACAO, publicados).
  `valor(chave)` lê o publicado; vazio cai no padrão. Título e subtítulo da
  página (page_title, page_subtitle) são do cabeçalho do app (legado).
*/
export function textosDaVisaoGeral(valor = () => "") {
  const ler = (chave, padrao) => txt(valor(chave)) || padrao;
  return {
    filtros: ler("filter_title", "Refinar resultados"),
    filtrosSubtitulo: txt(valor("filter_subtitle")),
    mostrarFiltros: ler("filter_toggle_show", "Mostrar filtros"),
    ocultarFiltros: ler("filter_toggle_hide", "Ocultar filtros"),
    indicadores: ler("dashboard_section_processos", "Indicadores"),
    rotulos: Object.fromEntries(
      INDICADORES.map(([chave, padrao]) => [chave, ler(chave, padrao)]),
    ),
    resumo: ler("panel_status_summary_title", "Resumo por etapa"),
    status: ler("panel_operational_status_title", "Status operacional"),
    atencao: ler("panel_attention_title", "Atenção"),
    tabela: ler("details_title", "Processos seletivos"),
    busca: ler(
      "table_search_placeholder",
      "Buscar edital, unidade, processo ou observação",
    ),
    colunas: ler("columns_button_text", "Colunas"),
    colunasTitulo: ler("columns_menu_title", "Colunas visíveis"),
  };
}
