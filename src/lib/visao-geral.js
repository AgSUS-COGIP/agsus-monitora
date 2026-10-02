/*
  A VISÃO GERAL (página `dashboard`), sem DOM nem rede — as regras que
  moravam em `legacy-app.js` (applyFilters, renderKpis, renderTable,
  exportCSV) e nos remendos `health-*` da tabela.

  Saúde Indígena, SEDE e Projetos abrem a mesma página, com os editais da
  área atual (`CO_AREA`, `linhasDaArea`). O que muda por área é o bloco do
  mapa (`visao-geral-da-area.js`) e, em Projetos, "Processos por projeto"; o
  resto mora aqui.

  Cada linha ganha, antes do recorte (`enriquecerLinhas`), a fase calculada
  (`fases-do-processo.js`), os motivos de atenção (`criticos-da-visao-geral.js`)
  e as pendências pós-resultado. O recorte: cinco filtros de escolha múltipla
  (Unidade, Edital, Status, Fase, UF; comparação sem acento nem caixa,
  `filtros-do-mapa.js`), a busca livre, o DSEI aberto no mapa e um atalho
  (Críticos ou uma pendência do Pós-resultado). KPIs, mapa, blocos, tabela e
  exportação partem do mesmo recorte.
*/

import { hojeEmBrasilia } from "./cronograma-do-edital.js";
import {
  diaDoCalendario,
  gravidade,
  LIMITES_DO_CRITICO,
  motivosDeAtencao,
} from "./criticos-da-visao-geral.js";
import { sanitizeCsvCell } from "./csv-security.js";
import { tomDoRisco, tomDoStatusDoEdital } from "./editais-do-nucleo.js";
import {
  faseDoEdital,
  FASES,
  ORDEM_DAS_FASES,
  tomDaFase,
} from "./fases-do-processo.js";
import {
  linhaAtende,
  opcoesDoCampo,
  podarSelecoes,
} from "./filtros-do-mapa.js";
import {
  contratadasImediatas,
  ehCancelado,
  ehConcluido,
  ehCritica,
  indicadoresDoMonitoramento,
  temResultado,
  vagasSemContratacao,
} from "./indicadores-do-monitoramento.js";

const txt = (valor) => String(valor ?? "").trim();
const low = (valor) => txt(valor).toLowerCase();
const num = (valor) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};
const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

// ── Filtros ──────────────────────────────────────────────────────────────

/* Os cinco filtros, na ordem da página. `mais`: ficam em "Mais opções". */
export const CAMPOS_DO_FILTRO = Object.freeze([
  Object.freeze({ campo: "unidade", rotulo: "Unidade", todos: "Todas" }),
  Object.freeze({ campo: "edital", rotulo: "Edital", todos: "Todos" }),
  Object.freeze({ campo: "status", rotulo: "Status", todos: "Todos" }),
  Object.freeze({ campo: "fase", rotulo: "Fase", todos: "Todas", mais: true }),
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

/* A ordem das opções: edital por ano e número, status e fase pelo fluxo. */
const ORDEM_DO_STATUS = [
  "Em Andamento",
  "Andamento",
  "Concluído",
  "Concluido",
  "Cancelado",
  "Cancelada",
];

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
    campo === "status"
      ? ORDEM_DO_STATUS
      : campo === "fase"
        ? ORDEM_DAS_FASES
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

// ── Linhas enriquecidas ──────────────────────────────────────────────────

/*
  O que vem de `listar_acompanhamento_da_visao_geral`: as etapas do cronograma
  e o resumo das listas de aprovados, por edital. `null` enquanto não chega
  (ou com o banco sem a função): crítico "parado", agenda completa e as
  pendências de lista ficam de fora.
*/
export function acompanhamentoDaResposta(resposta) {
  if (!resposta || typeof resposta !== "object") return null;
  const etapasPorEdital = new Map();
  for (const etapa of Array.isArray(resposta.etapas) ? resposta.etapas : []) {
    const id = txt(etapa?.monitoramento_id);
    if (!id) continue;
    if (!etapasPorEdital.has(id)) etapasPorEdital.set(id, []);
    etapasPorEdital.get(id).push(etapa);
  }
  const listasPorEdital = new Map();
  for (const lista of Array.isArray(resposta.listas) ? resposta.listas : []) {
    const id = txt(lista?.monitoramento_id);
    if (id) listasPorEdital.set(id, lista);
  }
  return { etapasPorEdital, listasPorEdital };
}

/* As pendências pós-resultado de uma linha (códigos de PENDENCIAS_POS_RESULTADO). */
function pendenciasDaLinha(linha, lista, temListas, limites) {
  if (ehCancelado(linha) || !temResultado(linha)) return [];
  const codigos = [];
  if (temListas && !lista) codigos.push("sem_lista");
  if (lista && num(lista.aprovados) > 0 && num(lista.com_status) === 0)
    codigos.push("sem_status");
  const vagas = num(linha.vagas_total);
  if (
    ehConcluido(linha) &&
    vagas > 0 &&
    contratadasImediatas(linha) / vagas < limites.contratacaoMinima
  )
    codigos.push("contratacao_baixa");
  if (lista && num(lista.desistentes) > 0) codigos.push("desistencias");
  return codigos;
}

/**
 * Cada linha com `fase`, `atencao` (motivos do crítico), `pos_resultado`
 * (pendências) e `desistentes` (da lista vigente). `hoje`: "AAAA-MM-DD".
 */
export function enriquecerLinhas(
  linhas,
  { hoje, acompanhamento = null, limites = LIMITES_DO_CRITICO } = {},
) {
  const temListas = Boolean(acompanhamento?.listasPorEdital);
  return (Array.isArray(linhas) ? linhas : []).map((linha) => {
    const id = txt(linha?.id);
    const fase = faseDoEdital(linha);
    const comFase = { ...linha, fase };
    const etapas = acompanhamento?.etapasPorEdital?.get(id) || null;
    const lista = acompanhamento?.listasPorEdital?.get(id) || null;
    return {
      ...comFase,
      atencao: motivosDeAtencao(comFase, { hoje, etapas, limites }),
      pos_resultado: pendenciasDaLinha(comFase, lista, temListas, limites),
      desistentes: lista ? num(lista.desistentes) : 0,
    };
  });
}

// ── Atalhos (KPI Críticos e pendências do Pós-resultado) ─────────────────

export const PENDENCIAS_POS_RESULTADO = Object.freeze([
  Object.freeze({ codigo: "sem_lista", rotulo: "Sem lista de aprovados" }),
  Object.freeze({ codigo: "sem_status", rotulo: "Lista sem status" }),
  Object.freeze({
    codigo: "contratacao_baixa",
    rotulo: `Contratação abaixo de ${Math.round(LIMITES_DO_CRITICO.contratacaoMinima * 100)}%`,
  }),
  Object.freeze({ codigo: "desistencias", rotulo: "Desistências" }),
]);

/** O rótulo do atalho no chip do recorte. */
export function rotuloDoAtalho(atalho) {
  if (atalho === "criticos") return "Críticos";
  const codigo = txt(atalho).replace(/^pos:/, "");
  return (
    PENDENCIAS_POS_RESULTADO.find((p) => p.codigo === codigo)?.rotulo || ""
  );
}

/** A linha entra no atalho? Sem atalho, sempre. */
export function linhaAtendeAoAtalho(linha, atalho) {
  if (!atalho) return true;
  if (atalho === "criticos") return ehCritica(linha);
  if (atalho.startsWith("pos:"))
    return (linha?.pos_resultado || []).includes(atalho.slice(4));
  return true;
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
  "fase",
  "responsavel",
  "cargos",
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
  if (["vagas_total", "contratados"].includes(campo))
    return num(linha?.[campo]);
  if (campo === "vagas_ociosas") return vagasSemContratacao(linha);
  if (campo === "atencao") return gravidade(linha?.atencao);
  if (campo === "data_inicio" || campo === "data_fim") {
    const valor = txt(linha?.[campo]);
    const tempo = valor ? Date.parse(valor) : NaN;
    return Number.isFinite(tempo) ? tempo : 0;
  }
  return txt(linha?.[campo]).toLocaleLowerCase("pt-BR");
}

/*
  A fila da Visão geral: os críticos primeiro (pelo motivo mais grave), depois
  quem tem mais vagas sem contratação, depois o edital.
*/
export function compararPelaAtencao(a, b) {
  const diferenca = gravidade(a?.atencao) - gravidade(b?.atencao);
  if (diferenca) return diferenca;
  const vagas = vagasSemContratacao(b) - vagasSemContratacao(a);
  if (vagas) return vagas;
  return compararValoresDoFiltro("edital", a?.edital, b?.edital);
}

/*
  Sem ordenação escolhida, a fila da Visão geral. Com ela, a coluna, e a fila
  desempata.
*/
export function compararLinhas(ordenacao) {
  const { campo, direcao } = ordenacao || {};
  if (!campo || !direcao) return compararPelaAtencao;
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
    if (resultado === 0) resultado = compararPelaAtencao(a, b);
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
 * (a do mapa, `dseiKey` do legado). `atalho`: "criticos" ou "pos:<código>".
 */
export function recortar(
  linhas,
  { filtros, busca = "", dsei = "", chaveDsei, ordenacao, atalho = "" } = {},
) {
  const estado = comoConjuntos(filtros);
  return (Array.isArray(linhas) ? linhas : [])
    .filter(
      (linha) =>
        linhaAtende(linha, estado, {
          campos: CAMPOS,
          dsei,
          chaveDsei: chaveDsei || (() => ""),
        }) &&
        linhaCasaComBusca(linha, busca) &&
        linhaAtendeAoAtalho(linha, atalho),
    )
    .sort(compararLinhas(ordenacao));
}

// ── Indicadores ──────────────────────────────────────────────────────────

/*
  Os sete indicadores, na ordem da página inicial: chave do rótulo em
  Configurações › Página inicial, rótulo padrão, ícone e tom. A prévia de
  Configurações usa a mesma lista. As chaves que mantêm o significado de
  antes continuam (vagas, ociosas, críticos, inscritos); "Contratadas" (só
  as imediatas), "Em seleção" e "Cadastro reserva" têm chave nova — o rótulo
  publicado de "Contratações" (imediatas + CR) não vale para elas.
*/
export const INDICADORES = Object.freeze([
  Object.freeze(["kpi_vagas_label", "Vagas imediatas", "fa-users", "info"]),
  Object.freeze([
    "kpi_contratadas_label",
    "Contratadas",
    "fa-circle-check",
    "sucesso",
  ]),
  Object.freeze(["kpi_em_selecao_label", "Em seleção", "fa-clock", "destaque"]),
  Object.freeze([
    "kpi_ociosas_label",
    "Ociosas",
    "fa-circle-exclamation",
    "alerta",
  ]),
  Object.freeze([
    "kpi_cadastro_reserva_label",
    "Cadastro reserva",
    "fa-user-plus",
    "neutro",
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
  kpi_vagas_label: "vagas",
  kpi_contratadas_label: "contratadas",
  kpi_em_selecao_label: "emSelecao",
  kpi_ociosas_label: "ociosas",
  kpi_cadastro_reserva_label: "cadastroReserva",
  kpi_criticos_label: "criticos",
  kpi_inscritos_label: "inscritos",
});

/** Os números da faixa, das linhas do recorte (já enriquecidas). */
export function indicadoresDaVisaoGeral(linhas) {
  return indicadoresDoMonitoramento(linhas);
}

// ── Blocos ───────────────────────────────────────────────────────────────

/** "Fases": as fases do fluxo sempre, as de fora só com edital. */
export function fasesDosProcessos(linhas) {
  const contagem = new Map(ORDEM_DAS_FASES.map((fase) => [fase, 0]));
  for (const linha of linhas || []) {
    const fase = linha?.fase || faseDoEdital(linha);
    contagem.set(fase, (contagem.get(fase) || 0) + 1);
  }
  const total = linhas?.length || 0;
  return ORDEM_DAS_FASES.filter(
    (fase) => FASES.includes(fase) || contagem.get(fase) > 0,
  ).map((fase) => ({
    fase,
    quantos: contagem.get(fase),
    pct: pct(contagem.get(fase), total),
    tom: tomDaFase(fase),
  }));
}

/**
 * "Pós-resultado": cada pendência com os editais que a têm.
 * `quantos`: editais; em Desistências, `pessoas` é o total de desistentes.
 * Sem o resumo das listas, só "Contratação abaixo de 50%".
 */
export function posResultado(linhas, { comListas = false } = {}) {
  return PENDENCIAS_POS_RESULTADO.filter(
    (p) => comListas || p.codigo === "contratacao_baixa",
  ).map(({ codigo, rotulo }) => {
    const editais = (linhas || []).filter((linha) =>
      (linha?.pos_resultado || []).includes(codigo),
    );
    return {
      codigo,
      rotulo,
      quantos: editais.length,
      pessoas:
        codigo === "desistencias"
          ? editais.reduce((soma, linha) => soma + num(linha.desistentes), 0)
          : null,
    };
  });
}

/** Só Projetos tem "Processos por projeto" (lá a unidade é o projeto). */
export const temProcessosPorProjeto = (area) => area === "projetos";

/** "Processos por projeto" (Projetos): a unidade é o projeto. */
export function processosPorProjeto(linhas) {
  const porProjeto = new Map();
  for (const linha of linhas || []) {
    const projeto = txt(linha?.unidade) || "Não informado";
    const item = porProjeto.get(projeto) || {
      projeto,
      processos: 0,
      abertos: 0,
      vagas: 0,
      contratadas: 0,
    };
    item.processos += 1;
    if (!ehCancelado(linha) && !ehConcluido(linha)) item.abertos += 1;
    if (!ehCancelado(linha)) {
      item.vagas += num(linha?.vagas_total);
      item.contratadas += contratadasImediatas(linha);
    }
    porProjeto.set(projeto, item);
  }
  return [...porProjeto.values()].sort(
    (a, b) =>
      b.processos - a.processos || a.projeto.localeCompare(b.projeto, "pt-BR"),
  );
}

/*
  O status como a gaveta mostra ("em andamento", "Em Andamento" e
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

// ── Tabela ───────────────────────────────────────────────────────────────

export const COLUNAS_DA_TABELA = Object.freeze([
  Object.freeze({ campo: "unidade", rotulo: "Unidade" }),
  Object.freeze({ campo: "edital", rotulo: "Edital" }),
  Object.freeze({ campo: "data_inicio", rotulo: "Início" }),
  Object.freeze({ campo: "data_fim", rotulo: "Encerramento" }),
  Object.freeze({ campo: "vagas_total", rotulo: "Vagas", numero: true }),
  Object.freeze({ campo: "contratados", rotulo: "Contratados", numero: true }),
  Object.freeze({
    campo: "vagas_ociosas",
    rotulo: "Sem contratação",
    numero: true,
  }),
  Object.freeze({ campo: "status", rotulo: "Status" }),
  Object.freeze({ campo: "fase", rotulo: "Fase" }),
  Object.freeze({ campo: "atencao", rotulo: "Atenção" }),
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
  "Edital encerra em N dias" até 7 (perigo) e até 30 (alerta); mais longe,
  nada. Prazo vencido sem concluir não repete aqui: o selo do cronograma diz
  "Etapa atrasada". `{ tom, rotulo, icone }` ou `null`.
*/
export function prazoDoEdital(linha, hoje = new Date()) {
  const status = low(linha?.status);
  if (["cancelado", "cancelada"].includes(status))
    return { tom: "neutro", rotulo: "Processo cancelado", icone: "fa-ban" };
  if (["concluído", "concluido"].includes(status))
    return { tom: "neutro", rotulo: "Processo concluído", icone: "fa-check" };
  const dias = diasAte(linha?.data_fim, hoje);
  if (dias === null || dias < 0) return null;
  const rotulo = `Edital encerra em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  if (dias <= 7) return { tom: "perigo", rotulo, icone: "fa-fire" };
  if (dias <= 30) return { tom: "alerta", rotulo, icone: "fa-clock" };
  return null;
}

/*
  A situação do cronograma (Editais): `{ tom, rotulo }`. `tom`: "done"
  (concluído/cancelado), "warning", "danger", "info" ou "neutral" — também a
  cor da linha na tabela. Atrasada: o fim do cronograma (`data_fim`) passou e
  o edital não concluiu (a mesma regra do crítico).
*/
export function urgenciaDoCronograma(linha, hoje = new Date()) {
  if (!linha)
    return { tom: "neutral", rotulo: "Dados operacionais indisponíveis" };
  const status = statusCanonico(linha.status);
  if (["Concluído", "Cancelado"].includes(status))
    return { tom: "done", rotulo: status };
  const fim = diasAte(linha.data_fim, hoje);
  if (fim !== null && fim < 0)
    return {
      tom: "danger",
      rotulo: `Etapa atrasada há ${Math.abs(fim)} dia(s)`,
    };
  if (!linha.cronograma_automatico)
    return { tom: "warning", rotulo: "Sem cronograma estruturado" };
  const dias = Number(linha.cronograma_dias_para_proxima);
  const temDias =
    linha.cronograma_dias_para_proxima !== null &&
    linha.cronograma_dias_para_proxima !== undefined &&
    linha.cronograma_dias_para_proxima !== "" &&
    Number.isFinite(dias);
  if (temDias && dias <= LIMITES_DO_CRITICO.diasDoPrazo)
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
export function seloDoCronograma(linha, hoje = new Date()) {
  const urgencia = urgenciaDoCronograma(linha, hoje);
  if (urgencia.tom === "done") return null;
  if (urgencia.rotulo === "Sem cronograma estruturado")
    return {
      ...urgencia,
      rotulo: "Sem cronograma",
      titulo: "Cronograma ainda não cadastrado em Editais",
    };
  return { ...urgencia, titulo: `Cronograma: ${urgencia.rotulo}` };
}

/** A taxa de vagas sem contratação da linha: `{ pct, nivel }` (low, medium, high, critical). */
export function taxaDeOciosidade(linha) {
  const vagas = num(linha?.vagas_total);
  const taxa =
    vagas > 0 ? Math.round((vagasSemContratacao(linha) / vagas) * 100) : 0;
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
/** O tom do `Selo` de um motivo de atenção (perigo → vermelho, alerta → âmbar). */
export const seloDoMotivo = (motivo) =>
  motivo?.tom === "perigo" ? "reprovado" : "pendente";

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

const motivosEmTexto = (linha) =>
  (linha?.atencao || []).map((m) => m.rotulo).join("; ");

const CAMPOS_DO_CSV = [
  ["unidade", "Unidade"],
  ["uf", "UF"],
  ["edital", "Edital"],
  ["processo", "Processo SEI"],
  ["ciclo", "Ciclo"],
  ["vagas_total", "Vagas Imediatas"],
  ["contratados", "Contratados"],
  ["vagas_ociosas", "Vagas Sem Contratação"],
  ["inscritos", "Inscritos"],
  ["status", "Status"],
  ["fase", "Fase"],
  ["etapa", "Etapa"],
  ["atencao", "Atenção", motivosEmTexto],
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
      CAMPOS_DO_CSV.map(([campo, , ler]) =>
        celula(ler ? ler(linha) : linha?.[campo]),
      ).join(";"),
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
  os filtros aplicados em uma linha e os números do recorte, com as contas
  dos indicadores (contratações = contratadas imediatas; ociosas = editais
  com resultado).
*/
export function resumoDoRelatorio({
  filtros,
  busca = "",
  atalho = "",
  linhas = [],
} = {}) {
  const ativos = CAMPOS_DO_FILTRO.filter(
    ({ campo }) => (filtros?.[campo] || []).length,
  ).map(({ campo, rotulo }) => `${rotulo}: ${filtros[campo].join(", ")}`);
  if (txt(busca)) ativos.push(`Busca: ${txt(busca)}`);
  if (rotuloDoAtalho(atalho)) ativos.push(rotuloDoAtalho(atalho));
  const k = indicadoresDoMonitoramento(linhas);
  return {
    filtros: ativos.length
      ? ativos.join(" · ")
      : "Nenhum filtro aplicado (todos os processos)",
    processos: linhas.length,
    vagas: k.vagas,
    contratados: k.contratadas,
    ociosas: k.ociosas,
    pctOciosas: pct(k.ociosas, k.vagas),
  };
}

// ── Textos de Configurações ──────────────────────────────────────────────

/*
  Os textos da página que vêm de Configurações › Página inicial
  (TB_CONFIGURACAO, publicados). `valor(chave)` lê o publicado; vazio cai no
  padrão. Título e subtítulo da página (page_title, page_subtitle) são do
  cabeçalho do app (legado). Os títulos dos blocos são fixos.
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
    tabela: ler("details_title", "Processos seletivos"),
    busca: ler(
      "table_search_placeholder",
      "Buscar edital, unidade, processo ou observação",
    ),
    colunas: ler("columns_button_text", "Colunas"),
    colunasTitulo: ler("columns_menu_title", "Colunas visíveis"),
  };
}
