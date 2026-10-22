import type {
  Acompanhamento,
  Atalho,
  CampoDoFiltro,
  ColunaDaTabela,
  FiltrosDaVisaoGeral,
  LinhaDoMonitoramento,
  LinhaDaVisaoGeral,
  ListaDoAcompanhamento,
  EtapaDoAcompanhamento,
  Ordenacao,
  Pendencia,
  Motivo,
  Indicadores,
  ChaveDoIndicador,
  TextosDaVisaoGeral,
} from "../modulos/visao-geral/tipos.ts";
/*
  A VISÃO GERAL (página `dashboard`), sem DOM nem rede — as regras que
  moravam em `legacy-app.js` (applyFilters, renderKpis, renderTable,
  exportCSV) e nos remendos `health-*` da tabela.

  Saúde Indígena, SEDE e Projetos abrem a mesma página, com os editais da
  área atual (`CO_AREA`, `linhasDaArea`). O que muda por área é o bloco do
  mapa (`visao-geral-da-area.ts`) e, em Projetos, "Processos por projeto"; o
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
import { tomDoStatusDoEdital } from "./editais-do-nucleo.js";
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

const txt = (valor: unknown) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
const low = (valor: unknown) => txt(valor).toLowerCase();
const num = (valor: unknown) => {
  const numero = Number(
    typeof valor === "string" || typeof valor === "number" ? valor : 0,
  );
  return Number.isFinite(numero) ? numero : 0;
};
const pct = (parte: number, total: number) =>
  total ? Math.round((parte / total) * 100) : 0;

// ── Filtros ──────────────────────────────────────────────────────────────

/* Os cinco filtros, na ordem da página. `mais`: ficam em "Mais opções". */
export const CAMPOS_DO_FILTRO: readonly {
  campo: CampoDoFiltro;
  rotulo: string;
  todos: string;
  mais?: boolean;
}[] = Object.freeze([
  Object.freeze({ campo: "unidade", rotulo: "Unidade", todos: "Todas" }),
  Object.freeze({ campo: "edital", rotulo: "Edital", todos: "Todos" }),
  Object.freeze({ campo: "status", rotulo: "Status", todos: "Todos" }),
  Object.freeze({ campo: "fase", rotulo: "Fase", todos: "Todas", mais: true }),
  Object.freeze({ campo: "uf", rotulo: "UF", todos: "Todas", mais: true }),
] as const);
export const CAMPOS = Object.freeze(CAMPOS_DO_FILTRO.map((c) => c.campo));

/** `{ unidade: [], edital: [], … }` */
export function filtrosVazios(): FiltrosDaVisaoGeral {
  return { unidade: [], edital: [], status: [], fase: [], uf: [] };
}

/* Do armazenamento (ou de qualquer origem): só os campos conhecidos, só texto. */
export function normalizarFiltros(bruto: unknown) {
  const filtros = filtrosVazios();
  const origem = registroDaVisaoGeral(bruto);
  for (const campo of CAMPOS) {
    const valores = origem[campo];
    if (Array.isArray(valores))
      filtros[campo] = [...new Set(valores.map(txt).filter(Boolean))];
  }
  return filtros;
}

const comoConjuntos = (filtros?: Partial<FiltrosDaVisaoGeral>) => {
  const conjuntos = {
    unidade: new Set<string>(),
    edital: new Set<string>(),
    status: new Set<string>(),
    fase: new Set<string>(),
    uf: new Set<string>(),
  };
  for (const c of CAMPOS) conjuntos[c] = new Set(filtros?.[c] || []);
  return conjuntos;
};
const comoListas = (
  conjuntos: Record<CampoDoFiltro, Set<string>>,
): FiltrosDaVisaoGeral => {
  const filtros = filtrosVazios();
  for (const c of CAMPOS) filtros[c] = [...conjuntos[c]];
  return filtros;
};

/** Quantos campos têm seleção. */
export const camposAtivos = (filtros?: Partial<FiltrosDaVisaoGeral>) =>
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
export function normalizarTexto(valor: unknown) {
  return txt(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function posicaoNaLista(valor: unknown, lista: readonly string[]) {
  const indice = lista.map(normalizarTexto).indexOf(normalizarTexto(valor));
  return indice >= 0 ? indice : 999;
}

function partesDoEdital(valor: unknown) {
  const achado = txt(valor).match(/^(\d{1,3})\s*\/\s*(\d{4})/);
  return achado ? { numero: Number(achado[1]), ano: Number(achado[2]) } : null;
}

export function compararValoresDoFiltro(campo: string, a: unknown, b: unknown) {
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
export function opcoesDosFiltros(
  linhas: readonly LinhaDoMonitoramento[],
  filtros: FiltrosDaVisaoGeral,
): FiltrosDaVisaoGeral {
  const estado = comoConjuntos(filtros);
  const opcoes = filtrosVazios();
  for (const campo of CAMPOS)
    opcoes[campo] = opcoesDoCampo(linhas, estado, campo, {
      campos: CAMPOS,
      comparar: (a: string, b: string) => compararValoresDoFiltro(campo, a, b),
    });
  return opcoes;
}

/*
  Tira, até estabilizar, as seleções que nenhuma opção oferece mais (trocar de
  área ou recarregar os dados). Devolve os mesmos filtros se nada mudou.
*/
export function podarFiltros(
  linhas: readonly LinhaDoMonitoramento[],
  filtros: FiltrosDaVisaoGeral,
) {
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
export function acompanhamentoDaResposta(
  resposta: unknown,
): Acompanhamento | null {
  if (!resposta || typeof resposta !== "object" || Array.isArray(resposta))
    return null;
  const origem = registroDaVisaoGeral(resposta);
  const etapasPorEdital = new Map<string, EtapaDoAcompanhamento[]>();
  for (const bruto of Array.isArray(origem.etapas) ? origem.etapas : []) {
    const etapa = registroDaVisaoGeral(bruto);
    const id = idDoRegistro(etapa.monitoramento_id);
    if (id === null) continue;
    const normalizada: EtapaDoAcompanhamento = {
      monitoramento_id: id,
      data_inicio: textoOpcional(etapa.data_inicio),
      data_fim: textoOpcional(etapa.data_fim),
      atividade: textoOpcional(etapa.atividade),
      ordem: typeof etapa.ordem === "number" ? etapa.ordem : undefined,
    };
    const chave = String(id);
    const bloco = etapasPorEdital.get(chave) || [];
    bloco.push(normalizada);
    etapasPorEdital.set(chave, bloco);
  }
  const listasPorEdital = new Map<string, ListaDoAcompanhamento>();
  for (const bruto of Array.isArray(origem.listas) ? origem.listas : []) {
    const lista = registroDaVisaoGeral(bruto);
    const id = idDoRegistro(lista.monitoramento_id);
    if (id !== null)
      listasPorEdital.set(String(id), {
        monitoramento_id: id,
        aprovados: numeroOpcional(lista.aprovados),
        com_status: numeroOpcional(lista.com_status),
        desistentes: numeroOpcional(lista.desistentes),
      });
  }
  return { etapasPorEdital, listasPorEdital };
}

/* As pendências pós-resultado de uma linha (códigos de PENDENCIAS_POS_RESULTADO). */
function pendenciasDaLinha(
  linha: LinhaDoMonitoramento,
  lista: ListaDoAcompanhamento | null,
  temListas: boolean,
  limites: { contratacaoMinima: number },
): Pendencia[] {
  if (ehCancelado(linha) || !temResultado(linha)) return [];
  const codigos: Pendencia[] = [];
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
  linhas: readonly LinhaDoMonitoramento[],
  {
    hoje,
    acompanhamento = null,
    limites = LIMITES_DO_CRITICO,
  }: {
    hoje?: string;
    acompanhamento?: Acompanhamento | null;
    limites?: {
      diasDoPrazo: number;
      diasParado: number;
      contratacaoMinima: number;
    };
  } = {},
): LinhaDaVisaoGeral[] {
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

export const PENDENCIAS_POS_RESULTADO: readonly {
  codigo: Pendencia;
  rotulo: string;
}[] = Object.freeze([
  Object.freeze({ codigo: "sem_lista", rotulo: "Sem lista de aprovados" }),
  Object.freeze({ codigo: "sem_status", rotulo: "Lista sem status" }),
  Object.freeze({
    codigo: "contratacao_baixa",
    rotulo: `Contratação abaixo de ${Math.round(LIMITES_DO_CRITICO.contratacaoMinima * 100)}%`,
  }),
  Object.freeze({ codigo: "desistencias", rotulo: "Desistências" }),
] as const);

/** O rótulo do atalho no chip do recorte. */
export function rotuloDoAtalho(atalho: string) {
  if (atalho === "criticos") return "Críticos";
  const codigo = txt(atalho).replace(/^pos:/, "");
  return (
    PENDENCIAS_POS_RESULTADO.find((p) => p.codigo === codigo)?.rotulo || ""
  );
}

/** A linha entra no atalho? Sem atalho, sempre. */
export function linhaAtendeAoAtalho(
  linha: LinhaDoMonitoramento,
  atalho: Atalho,
) {
  if (!atalho) return true;
  if (atalho === "criticos") return ehCritica(linha);
  if (atalho.startsWith("pos:"))
    return (linha?.pos_resultado || []).some(
      (codigo) => `pos:${codigo}` === atalho,
    );
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

export function linhaCasaComBusca(linha: LinhaDoMonitoramento, busca: string) {
  const termo = normalizarTexto(busca);
  if (!termo) return true;
  return CAMPOS_DA_BUSCA.map((campo) => normalizarTexto(linha?.[campo]))
    .join(" | ")
    .includes(termo);
}

/* O valor de uma coluna para ordenar a tabela. */
export function valorParaOrdenar(linha: LinhaDoMonitoramento, campo: string) {
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
export function compararPelaAtencao(
  a: LinhaDoMonitoramento,
  b: LinhaDoMonitoramento,
) {
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
export function compararLinhas(ordenacao?: Ordenacao) {
  const { campo, direcao } = ordenacao || {};
  if (!campo || !direcao) return compararPelaAtencao;
  return (a: LinhaDoMonitoramento, b: LinhaDoMonitoramento) => {
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
export function proximaOrdenacao(
  atual: Ordenacao,
  campo: ColunaDaTabela,
): Ordenacao {
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
  linhas: readonly LinhaDaVisaoGeral[],
  {
    filtros,
    busca = "",
    dsei = "",
    chaveDsei,
    ordenacao,
    atalho = "",
  }: {
    filtros?: FiltrosDaVisaoGeral;
    busca?: string;
    dsei?: string;
    chaveDsei?: (linha: LinhaDoMonitoramento) => string;
    ordenacao?: Ordenacao;
    atalho?: Atalho;
  } = {},
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
export const INDICADORES: readonly (readonly [
  ChaveDoIndicador,
  string,
  string,
  string,
])[] = Object.freeze([
  Object.freeze([
    "kpi_vagas_label",
    "Vagas imediatas",
    "fa-users",
    "info",
  ] as const),
  Object.freeze([
    "kpi_contratadas_label",
    "Contratadas",
    "fa-circle-check",
    "sucesso",
  ] as const),
  Object.freeze([
    "kpi_em_selecao_label",
    "Em seleção",
    "fa-clock",
    "destaque",
  ] as const),
  Object.freeze([
    "kpi_ociosas_label",
    "Ociosas",
    "fa-circle-exclamation",
    "alerta",
  ] as const),
  Object.freeze([
    "kpi_cadastro_reserva_label",
    "Cadastro reserva",
    "fa-user-plus",
    "neutro",
  ] as const),
  Object.freeze([
    "kpi_criticos_label",
    "Críticos",
    "fa-fire",
    "perigo",
  ] as const),
  Object.freeze([
    "kpi_inscritos_label",
    "Inscritos",
    "fa-file-lines",
    "destaque",
  ] as const),
]);

/* A chave de cada indicador no objeto de `indicadoresDaVisaoGeral`. */
export const VALOR_DO_INDICADOR: Readonly<
  Record<ChaveDoIndicador, keyof Indicadores>
> = Object.freeze({
  kpi_vagas_label: "vagas",
  kpi_contratadas_label: "contratadas",
  kpi_em_selecao_label: "emSelecao",
  kpi_ociosas_label: "ociosas",
  kpi_cadastro_reserva_label: "cadastroReserva",
  kpi_criticos_label: "criticos",
  kpi_inscritos_label: "inscritos",
});

/** Os números da faixa, das linhas do recorte (já enriquecidas). */
export function indicadoresDaVisaoGeral(
  linhas: readonly LinhaDoMonitoramento[],
): Indicadores {
  return indicadoresDoMonitoramento(linhas);
}

// ── Blocos ───────────────────────────────────────────────────────────────

/** "Fases": as fases do fluxo sempre, as de fora só com edital. */
export function fasesDosProcessos(linhas: readonly LinhaDoMonitoramento[]) {
  const contagem = new Map(ORDEM_DAS_FASES.map((fase) => [fase, 0]));
  for (const linha of linhas || []) {
    const fase = linha?.fase || faseDoEdital(linha);
    contagem.set(fase, (contagem.get(fase) || 0) + 1);
  }
  const total = linhas?.length || 0;
  return ORDEM_DAS_FASES.filter(
    (fase) => FASES.includes(fase) || (contagem.get(fase) || 0) > 0,
  ).map((fase) => ({
    fase,
    quantos: contagem.get(fase) || 0,
    pct: pct(contagem.get(fase) || 0, total),
    tom: tomDaFase(fase),
  }));
}

/**
 * "Pós-resultado": cada pendência com os editais que a têm.
 * `quantos`: editais; em Desistências, `pessoas` é o total de desistentes.
 * Sem o resumo das listas, só "Contratação abaixo de 50%".
 */
export function posResultado(
  linhas: readonly LinhaDoMonitoramento[],
  { comListas = false } = {},
) {
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
export const temProcessosPorProjeto = (area: string) => area === "projetos";

/** "Processos por projeto" (Projetos): a unidade é o projeto. */
export function processosPorProjeto(linhas: readonly LinhaDoMonitoramento[]) {
  const porProjeto = new Map<
    string,
    {
      projeto: string;
      processos: number;
      abertos: number;
      vagas: number;
      contratadas: number;
    }
  >();
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
export function statusCanonico(valor: unknown) {
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

export const COLUNAS_DA_TABELA: readonly {
  campo: ColunaDaTabela;
  rotulo: string;
  numero?: boolean;
}[] = Object.freeze([
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
] as const);
export const COLUNAS_PADRAO = Object.freeze(
  COLUNAS_DA_TABELA.map((c) => c.campo),
);

/* As colunas guardadas: só as conhecidas; nenhuma válida → todas. */
export function normalizarColunas(bruto: unknown) {
  const lista = Array.isArray(bruto)
    ? COLUNAS_PADRAO.filter((campo) => bruto.includes(campo))
    : [];
  return lista.length ? lista : [...COLUNAS_PADRAO];
}

/* Marcar/desmarcar uma coluna; a última visível não sai. */
export function alternarColuna(
  colunas: readonly ColunaDaTabela[],
  campo: ColunaDaTabela,
  visivel: boolean,
) {
  const proximas = visivel
    ? COLUNAS_PADRAO.filter((c) => c === campo || colunas.includes(c))
    : colunas.filter((c) => c !== campo);
  return proximas.length ? proximas : colunas;
}

/** "AAAA-MM-DD…" → "DD/MM/AAAA"; outro texto fica como está. */
export function dataCurta(valor: unknown) {
  const texto = txt(valor);
  const achado = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return achado ? `${achado[3]}/${achado[2]}/${achado[1]}` : texto;
}

/* Dias de hoje até a data (local; "AAAA-MM-DD" não vira UTC). */
export function diasAte(
  data: string | undefined,
  hoje: Date | string = new Date(),
) {
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
  // "Hoje" pode vir como "AAAA-MM-DD" (o dia de Brasília, o mesmo dos críticos).
  const diaDeHoje = String(hoje).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dia = diaDeHoje
    ? new Date(
        Number(diaDeHoje[1]),
        Number(diaDeHoje[2]) - 1,
        Number(diaDeHoje[3]),
      )
    : new Date(
        new Date(hoje).getFullYear(),
        new Date(hoje).getMonth(),
        new Date(hoje).getDate(),
      );
  return Math.round((alvo.getTime() - dia.getTime()) / 86400000);
}

/*
  O prazo do edital, na célula do edital: cancelado e concluído dizem isso;
  "Edital encerra em N dias" até 7 (perigo) e até 30 (alerta); mais longe,
  nada. Prazo vencido sem concluir não repete aqui: o selo do cronograma diz
  "Etapa atrasada". `{ tom, rotulo, icone }` ou `null`.
*/
export function prazoDoEdital(
  linha: LinhaDoMonitoramento,
  hoje: Date | string = new Date(),
) {
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
export function urgenciaDoCronograma(
  linha: LinhaDoMonitoramento | null,
  hoje: Date | string = new Date(),
) {
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
export function seloDoCronograma(
  linha: LinhaDoMonitoramento,
  hoje: Date | string = new Date(),
) {
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
export function taxaDeOciosidade(linha: LinhaDoMonitoramento) {
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
const SELO_DO_TOM: Record<string, string> = {
  green: "aprovado",
  red: "reprovado",
  yellow: "pendente",
  blue: "revisar",
  cyan: "revisar",
  gray: "neutro",
};
export const seloDoStatus = (status: unknown) =>
  SELO_DO_TOM[tomDoStatusDoEdital(status)] || "neutro";
/** O tom do `Selo` de um motivo de atenção (perigo → vermelho, alerta → âmbar). */
export const seloDoMotivo = (motivo: Motivo) =>
  motivo?.tom === "perigo" ? "reprovado" : "pendente";

/** Observação longa (mais de 180 caracteres) abre com "Ver mais". */
export const observacaoLonga = (valor: unknown) => txt(valor).length > 180;

/** Link do edital só se for http(s). */
export function linkSeguro(valor: unknown) {
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

const motivosEmTexto = (linha: LinhaDoMonitoramento) =>
  (linha?.atencao || []).map((m) => m.rotulo).join("; ");

const CAMPOS_DO_CSV: [
  string,
  string,
  ((linha: LinhaDoMonitoramento) => string)?,
][] = [
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
export function csvDaVisaoGeral(linhas: readonly LinhaDoMonitoramento[]) {
  const celula = (valor: unknown) =>
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
const nomeDaAreaNoArquivo = (area: string) =>
  txt(area)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join("") || "Monitoramento";

/* O dia é o de Brasília (com o de UTC, quem exportava à noite levava amanhã). */
export function nomeDoCsv(area: string, agora = new Date()) {
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
}: {
  filtros?: FiltrosDaVisaoGeral;
  busca?: string;
  atalho?: Atalho;
  linhas?: readonly LinhaDoMonitoramento[];
} = {}) {
  const ativos = CAMPOS_DO_FILTRO.filter(
    ({ campo }) => (filtros?.[campo] || []).length,
  ).map(({ campo, rotulo }) => `${rotulo}: ${filtros?.[campo].join(", ")}`);
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
export function textosDaVisaoGeral(
  valor: (chave: string) => unknown = () => "",
): TextosDaVisaoGeral {
  const ler = (chave: string, padrao: string) => txt(valor(chave)) || padrao;
  const rotulos: Record<ChaveDoIndicador, string> = {
    kpi_vagas_label: "",
    kpi_contratadas_label: "",
    kpi_em_selecao_label: "",
    kpi_ociosas_label: "",
    kpi_cadastro_reserva_label: "",
    kpi_criticos_label: "",
    kpi_inscritos_label: "",
  };
  for (const [chave, padrao] of INDICADORES)
    rotulos[chave] = ler(chave, padrao);
  return {
    filtros: ler("filter_title", "Refinar resultados"),
    filtrosSubtitulo: txt(valor("filter_subtitle")),
    mostrarFiltros: ler("filter_toggle_show", "Mostrar filtros"),
    ocultarFiltros: ler("filter_toggle_hide", "Ocultar filtros"),
    indicadores: ler("dashboard_section_processos", "Indicadores"),
    rotulos,
    tabela: ler("details_title", "Processos seletivos"),
    busca: ler(
      "table_search_placeholder",
      "Buscar edital, unidade, processo ou observação",
    ),
    colunas: ler("columns_button_text", "Colunas"),
    colunasTitulo: ler("columns_menu_title", "Colunas visíveis"),
  };
}

/** Guarda estrutural usada antes de acessar JSON externo. */
export function registroDaVisaoGeral(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}
const textoOpcional = (valor: unknown) =>
  typeof valor === "string" ? valor : undefined;
const numeroOpcional = (valor: unknown) =>
  (typeof valor === "string" || typeof valor === "number") &&
  Number.isFinite(Number(valor))
    ? valor
    : undefined;
function idDoRegistro(valor: unknown): string | number | null {
  if (typeof valor === "string" && valor.trim()) return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  return null;
}
/** Preserva campos adicionais dos mapas; valida os campos que esta tela consome. */
export function linhasDaResposta(
  linhas: readonly unknown[],
): LinhaDoMonitoramento[] {
  const resultado: LinhaDoMonitoramento[] = [];
  for (const bruto of linhas) {
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) continue;
    const origem = registroDaVisaoGeral(bruto);
    const linha: LinhaDoMonitoramento = { ...origem };
    const id = idDoRegistro(origem.id);
    linha.id = id === null ? undefined : id;
    const textos = [
      "unidade",
      "edital",
      "status",
      "fase",
      "uf",
      "processo",
      "ciclo",
      "etapa",
      "responsavel",
      "cargos",
      "observacoes",
      "observacoes_internas",
      "link_edital",
      "risco",
      "CO_AREA",
      "data_inicio",
      "data_fim",
      "cronograma_atividade_atual",
      "cronograma_proxima_atividade",
      "cronograma_proxima_data",
    ] as const;
    for (const campo of textos)
      if (campo in origem) linha[campo] = textoOpcional(origem[campo]);
    const numeros = [
      "vagas_total",
      "contratados",
      "inscritos",
      "vagas_ociosas",
      "cronograma_percentual",
      "cronograma_dias_para_proxima",
    ] as const;
    for (const campo of numeros)
      if (campo in origem) linha[campo] = numeroOpcional(origem[campo]);
    linha.cronograma_automatico =
      typeof origem.cronograma_automatico === "boolean"
        ? origem.cronograma_automatico
        : undefined;
    // Estes valores são calculados de novo pelo enriquecimento.
    delete linha.atencao;
    delete linha.pos_resultado;
    delete linha.desistentes;
    resultado.push(linha);
  }
  return resultado;
}
