/*
  Editais da Equipe Núcleo — a lógica da página "Editais", sem DOM nem rede.

  A tela é `src/modulos/editais/`. As linhas são as do monitoramento
  (`TB_MONITORAMENTO_INDIGENA`), carregadas pelo legado para o mapa e para esta
  página; o resumo de cronogramas vem de `get_nucleo_cronograma_resumo`.

  A ordenação, o tom do status e o do risco também são usados pela tabela do
  mapa (`legacy-app.js`): as duas telas têm de concordar.
*/

import { etapaComDatasValidas } from "./datas-do-cronograma.ts";
import type { DatasDaEtapa } from "./datas-do-cronograma.ts";
import {
  AREA_SAUDE_INDIGENA,
  ehResponsavelCores,
  normalizarResponsavel,
  unidadesDoResponsavel,
} from "./responsavel-do-edital.ts";

/**
 * Uma linha do monitoramento (`TB_MONITORAMENTO_INDIGENA`) no que esta lógica
 * lê. Todos opcionais e `unknown`: serve a linha tipada das telas e a que vem
 * crua do banco ou do cache.
 */
export interface LinhaDeEditalDoNucleo {
  readonly id?: unknown;
  readonly processo?: unknown;
  readonly edital?: unknown;
  readonly unidade?: unknown;
  readonly id_unidade?: unknown;
  readonly sigla_unidade?: unknown;
  readonly tipo_unidade?: unknown;
  readonly uf?: unknown;
  readonly ciclo?: unknown;
  readonly responsavel?: unknown;
  readonly link_edital?: unknown;
  readonly vagas_total?: unknown;
  readonly vagas_ociosas?: unknown;
  readonly data_inicio?: unknown;
  readonly data_fim?: unknown;
  readonly status?: unknown;
  readonly etapa?: unknown;
  readonly risco?: unknown;
  readonly observacoes?: unknown;
  readonly observacoes_internas?: unknown;
  readonly CO_AREA?: unknown;
}

/** Uma unidade de entrada (linha de `TD_UNIDADE` ou afins): só estes campos são lidos. */
export interface UnidadeDeEntrada {
  readonly nome_oficial?: unknown;
  readonly id_unidade?: unknown;
  readonly sigla?: unknown;
  readonly tipo?: unknown;
  readonly uf_sede?: unknown;
  readonly unidade?: unknown;
  readonly nome?: unknown;
}

/**
 * Uma opção do select de unidade: do catálogo, do CORES, derivada das linhas
 * ou registrada com área. O nome oficial é sempre texto.
 */
export interface UnidadeDoFormulario extends UnidadeDeEntrada {
  readonly nome_oficial: string;
  /** As derivadas das linhas: ativas e marcadas como `fallback`. */
  readonly ativo?: boolean;
  readonly fallback?: boolean;
}

/** Uma unidade registrada com área (`listar_unidades_por_area`). */
export interface UnidadeComArea {
  readonly unidade?: unknown;
  readonly area?: unknown;
}

/** O rascunho do formulário do edital (`formularioDoEdital`). */
export type FormularioDoEdital = {
  id: string;
  processo: string;
  edital: string;
  responsavel: string;
  unidade: string;
  unidadeNova: string;
  idUnidade: string;
  siglaUnidade: string;
  tipoUnidade: string;
  uf: string;
  ciclo: string;
  link: string;
  vagas: string;
  dataInicio: string;
  dataFim: string;
  status: string;
  etapa: string;
  risco: string;
  observacoes: string;
  observacoesInternas: string;
};

/** O cronograma que vai junto do edital ao salvar. */
export interface CronogramaParaSalvar {
  readonly automatico?: unknown;
  readonly etapas: readonly DatasDaEtapa[];
  readonly statusExcepcional?: unknown;
  readonly etapaExcepcional?: unknown;
  readonly motivoExcepcional?: unknown;
  readonly dataExcepcional?: unknown;
  readonly retomada?: unknown;
}

/** Uma linha de `get_nucleo_cronograma_resumo`: um edital, o alerta e as etapas. */
export interface ItemDoResumo {
  readonly [campo: string]: unknown;
  readonly id: string | number;
  readonly unidade?: string | null;
  readonly edital?: string | null;
  readonly status?: string | null;
  readonly alerta_tipo?: string | null;
  readonly cronograma_total?: number | string | null;
}

/** Um alerta do resumo (rótulo, ícone e tom). */
export interface AlertaDoResumo {
  readonly label: string;
  readonly icon: string;
  readonly tone: string;
}

/** Um dos indicadores do painel operacional. */
export interface IndicadorDoResumo {
  key: string;
  label: string;
  value: number;
  icon: string;
  tone: string;
}

const txt = (valor: unknown) => String(valor ?? "").trim();
const low = (valor: unknown) => txt(valor).toLowerCase();
const num = (valor: unknown) => {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
};

/** Número como a tela o escreve: "1.308". */
export const formatarNumero = (valor: unknown) =>
  num(valor).toLocaleString("pt-BR");

// ── Ordem, busca e tons ──────────────────────────────────────────────────

/** Alto antes de médio antes de baixo; sem risco vai para o fim. */
export function ordemDoRisco(valor: unknown): number {
  const ordem: Partial<Record<string, number>> = {
    alto: 0,
    médio: 1,
    medio: 1,
    baixo: 2,
  };
  return ordem[low(valor)] ?? 9;
}

/** A fila do Núcleo: primeiro o risco, depois quem tem mais vagas ociosas. */
export function compararEditais(
  a: LinhaDeEditalDoNucleo,
  b: LinhaDeEditalDoNucleo,
): number {
  const ra = ordemDoRisco(a.risco);
  const rb = ordemDoRisco(b.risco);
  if (ra !== rb) return ra - rb;
  return num(b.vagas_ociosas) - num(a.vagas_ociosas);
}

/** Busca livre por edital, unidade, status, etapa, risco e processo. */
export function filtrarEditais<T extends LinhaDeEditalDoNucleo>(
  linhas: readonly T[] | null | undefined,
  busca: unknown,
): T[] {
  const termo = low(busca);
  return (linhas || [])
    .filter(
      (linha) =>
        !termo ||
        [
          linha.edital,
          linha.unidade,
          linha.status,
          linha.etapa,
          linha.risco,
          linha.processo,
        ]
          .map(low)
          .join(" | ")
          .includes(termo),
    )
    .sort(compararEditais);
}

/** Cor do chip de status (`.chip.<tom>`). */
export function tomDoStatusDoEdital(status: unknown): string {
  const l = low(status);
  if (l.includes("conclu")) return "green";
  if (l.includes("andamento")) return "blue";
  if (l.includes("elabora")) return "cyan";
  if (l.includes("cancel")) return "red";
  return "gray";
}

/** Cor do chip de risco (`.chip.<tom>`). */
export function tomDoRisco(risco: unknown): string {
  const l = low(risco);
  if (l === "alto") return "red";
  if (l === "médio" || l === "medio") return "yellow";
  return "green";
}

// ── Unidades do formulário ───────────────────────────────────────────────

export function normalizarNomeDaUnidade(valor: unknown): string {
  return low(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Por tipo (CASAI, DSEI…) e depois pelo nome, com número em ordem numérica. */
export function ordenarUnidades(
  a: UnidadeDeEntrada,
  b: UnidadeDeEntrada,
): number {
  const ta = txt(a.tipo);
  const tb = txt(b.tipo);
  if (ta !== tb) return ta.localeCompare(tb, "pt-BR", { numeric: true });
  return txt(a.nome_oficial || a.unidade || a.nome).localeCompare(
    txt(b.nome_oficial || b.unidade || b.nome),
    "pt-BR",
    { numeric: true },
  );
}

/*
  Unidades que aparecem nos editais e não estão no catálogo `TD_UNIDADE` —
  editais antigos, gravados com um nome que o catálogo não tem. Sem elas, abrir
  um desses editais mostraria a unidade em branco.
*/
function unidadesDasLinhas(
  linhas: readonly LinhaDeEditalDoNucleo[] | null | undefined,
) {
  const porNome = new Map<string, UnidadeDoFormulario>();
  (linhas || []).forEach((linha) => {
    const nome = txt(linha.unidade);
    const chave = normalizarNomeDaUnidade(nome);
    if (!nome || porNome.has(chave)) return;
    porNome.set(chave, {
      id_unidade: txt(linha.id_unidade),
      sigla: txt(linha.sigla_unidade),
      nome_oficial: nome,
      tipo:
        txt(linha.tipo_unidade) ||
        (nome.toUpperCase().startsWith("CASAI") ? "CASAI" : "DSEI"),
      uf_sede: txt(linha.uf).toUpperCase(),
      ativo: true,
      fallback: true,
    });
  });
  return [...porNome.values()];
}

/** O catálogo, completado pelas unidades que só existem nos editais. */
export function unidadesDisponiveis(
  catalogo: readonly UnidadeDeEntrada[] | null | undefined,
  linhas: readonly LinhaDeEditalDoNucleo[] | null | undefined,
): UnidadeDoFormulario[] {
  // O catálogo (`TD_UNIDADE`) tem o nome oficial de cada unidade.
  const porNome = new Map(
    ((catalogo || []) as readonly UnidadeDoFormulario[]).map((u) => [
      normalizarNomeDaUnidade(u.nome_oficial),
      u,
    ]),
  );
  unidadesDasLinhas(linhas).forEach((u) => {
    const chave = normalizarNomeDaUnidade(u.nome_oficial);
    if (!porNome.has(chave)) porNome.set(chave, u);
  });
  return [...porNome.values()].sort(ordenarUnidades);
}

/** O valor da opção: o id quando existe; as unidades do CORES só têm nome. */
export const valorDaUnidade = (unidade: UnidadeDeEntrada): string =>
  txt(unidade.id_unidade) || txt(unidade.nome_oficial);

export function rotuloDaUnidade(unidade: UnidadeDeEntrada): string {
  const uf = txt(unidade.uf_sede).toUpperCase();
  return `${txt(unidade.nome_oficial)}${uf ? ` — ${uf}` : ""}`;
}

/*
  Unidades que o banco sabe de que área são (`listar_unidades_por_area`): as do
  CORES e as digitadas em "Outra unidade". Sem elas, uma unidade que ainda não
  tem edital (o CCE, em Projetos) só aparecia com o responsável CORES.
*/
function unidadesRegistradas(
  unidadesPorArea:
    readonly (UnidadeComArea | null | undefined)[] | null | undefined,
): UnidadeDoFormulario[] {
  return (unidadesPorArea || [])
    .map((item) => ({
      nome_oficial: txt(item?.unidade),
      id_unidade: "",
      sigla: "",
      tipo: "",
      uf_sede: "",
    }))
    .filter((unidade) => unidade.nome_oficial);
}

/**
 * As opções do select de unidade para o responsável escolhido, completadas
 * pelas unidades registradas com área. Quem filtra pela área é `unidadesDaArea`.
 */
export function opcoesDeUnidade(
  responsavel: unknown,
  catalogo: readonly UnidadeDeEntrada[] | null | undefined,
  linhas: readonly LinhaDeEditalDoNucleo[] | null | undefined,
  unidadesPorArea:
    readonly (UnidadeComArea | null | undefined)[] | null | undefined = [],
): UnidadeDoFormulario[] {
  const disponiveis = unidadesDisponiveis(catalogo, linhas);
  const registradas = unidadesRegistradas(unidadesPorArea);
  const nomeDe = (unidade: UnidadeDeEntrada) =>
    normalizarNomeDaUnidade(unidade.nome_oficial);
  const conhecidas = new Set(disponiveis.map(nomeDe));
  const opcoes = unidadesDoResponsavel(
    responsavel,
    [
      ...disponiveis,
      ...registradas.filter((unidade) => !conhecidas.has(nomeDe(unidade))),
    ].sort(ordenarUnidades),
  );
  // O CORES tem lista própria: as registradas que ela não traz vão no fim.
  const oferecidas = new Set(opcoes.map(nomeDe));
  return [
    ...opcoes,
    ...registradas.filter((unidade) => {
      const nome = nomeDe(unidade);
      if (oferecidas.has(nome)) return false;
      oferecidas.add(nome);
      return true;
    }),
  ];
}

// ── Unidades por área ────────────────────────────────────────────────────

/** A opção do select de unidade que abre o campo para digitar uma unidade nova. */
export const NOVA_UNIDADE = "__nova__";

/**
 * Área de cada unidade, pelo nome normalizado. A mesma regra do banco
 * (`private."FC_AREA_DA_UNIDADE"`), na mesma ordem:
 *   1. `TA_UNIDADE_AREA` (`listar_unidades_por_area`);
 *   2. catálogo `TD_UNIDADE` (DSEI e CASAI) → Saúde Indígena;
 *   3. na falta dos dois, a área gravada nos editais que já usam a unidade —
 *      o que resta quando a RPC falha ou ainda não chegou.
 * Unidade fora do mapa é desconhecida: o banco a registra na área de quem salva.
 */
export function mapaDeAreasDasUnidades({
  unidadesPorArea = [],
  catalogo = [],
  linhas = [],
}: {
  unidadesPorArea?: readonly (UnidadeComArea | null | undefined)[] | null;
  catalogo?: readonly (UnidadeDeEntrada | null | undefined)[] | null;
  linhas?: readonly (LinhaDeEditalDoNucleo | null | undefined)[] | null;
} = {}): Map<string, string> {
  const mapa = new Map<string, string>();
  const anotar = (nome: unknown, area: unknown) => {
    const chave = normalizarNomeDaUnidade(nome);
    if (chave && txt(area) && !mapa.has(chave)) mapa.set(chave, txt(area));
  };
  (unidadesPorArea || []).forEach((item) => anotar(item?.unidade, item?.area));
  (catalogo || []).forEach((u) => anotar(u?.nome_oficial, AREA_SAUDE_INDIGENA));
  (linhas || []).forEach((linha) => anotar(linha?.unidade, linha?.CO_AREA));
  return mapa;
}

/** A área conhecida de uma unidade, ou `""`. */
export function areaDaUnidade(
  nome: unknown,
  mapa: ReadonlyMap<string, string> | null | undefined,
): string {
  return mapa?.get(normalizarNomeDaUnidade(nome)) || "";
}

/**
 * As opções de unidade que servem para a área: as da área e as desconhecidas.
 * `manter` é a unidade gravada no edital aberto — continua na lista mesmo que
 * seja de outra área (edital movido por um administrador).
 */
export function unidadesDaArea<U extends UnidadeDeEntrada>(
  opcoes: readonly U[] | null | undefined,
  area: unknown,
  mapa: ReadonlyMap<string, string> | null | undefined,
  manter: unknown = "",
): U[] {
  const mantida = normalizarNomeDaUnidade(manter);
  return (opcoes || []).filter((unidade) => {
    const nome = normalizarNomeDaUnidade(unidade.nome_oficial);
    if (mantida && nome === mantida) return true;
    const daUnidade = mapa?.get(nome);
    return !daUnidade || daUnidade === area;
  });
}

/** A unidade de um edital gravado: pelo id e, na falta dele, pelo nome. */
export function unidadeDoEdital<U extends UnidadeDeEntrada>(
  edital: LinhaDeEditalDoNucleo | null | undefined,
  unidades: readonly U[],
): U | null {
  if (!edital) return null;
  const id = txt(edital.id_unidade);
  if (id) {
    const porId = unidades.find((u) => txt(u.id_unidade) === id);
    if (porId) return porId;
  }
  const nome = normalizarNomeDaUnidade(edital.unidade);
  if (!nome) return null;
  return (
    unidades.find((u) => normalizarNomeDaUnidade(u.nome_oficial) === nome) ||
    null
  );
}

// ── Formulário do edital ─────────────────────────────────────────────────

/**
 * O rascunho do formulário a partir de um edital gravado (ou vazio, para um
 * novo).
 *
 * O responsável decide de que catálogo vêm as unidades, por isso entra antes
 * delas. Editais gravados antes de o campo virar seleção têm um nome de pessoa
 * em `responsavel`: não é USI nem CORES, e o select abre vazio.
 *
 * Unidade que não está em lista nenhuma deixa o select vazio, mas o id, a
 * sigla, o tipo e a UF gravados continuam no rascunho — trocar de unidade os
 * substitui; não trocar não apaga o que estava gravado.
 */
export function formularioDoEdital(
  edital: LinhaDeEditalDoNucleo | null | undefined,
  catalogo: readonly UnidadeDeEntrada[] | null | undefined,
  linhas: readonly LinhaDeEditalDoNucleo[] | null | undefined,
): FormularioDoEdital {
  const e: LinhaDeEditalDoNucleo = edital || {};
  const responsavel = normalizarResponsavel(e.responsavel);
  const doCores = ehResponsavelCores(responsavel);
  const opcoes = opcoesDeUnidade(responsavel, catalogo, linhas);
  const daLinha = doCores
    ? null
    : unidadeDoEdital(e, unidadesDisponiveis(catalogo, linhas));
  const valor = doCores
    ? txt(e.unidade)
    : daLinha
      ? valorDaUnidade(daLinha)
      : "";
  const escolhida = opcoes.find((u) => valorDaUnidade(u) === valor) || null;
  const pelaUnidade = Boolean(daLinha || doCores);
  return {
    id: txt(e.id),
    processo: txt(e.processo),
    edital: txt(e.edital),
    responsavel,
    unidade: escolhida ? valor : "",
    // Nome digitado quando a unidade não está na lista (opção NOVA_UNIDADE).
    unidadeNova: "",
    idUnidade: pelaUnidade ? txt(escolhida?.id_unidade) : txt(e.id_unidade),
    siglaUnidade: pelaUnidade ? txt(escolhida?.sigla) : txt(e.sigla_unidade),
    tipoUnidade: pelaUnidade ? txt(escolhida?.tipo) : txt(e.tipo_unidade),
    uf: pelaUnidade ? txt(escolhida?.uf_sede).toUpperCase() : txt(e.uf),
    // O ciclo saiu do formulário, mas a coluna continua no banco: salvar devolve o valor gravado.
    ciclo: txt(e.ciclo),
    link: txt(e.link_edital),
    vagas: String(e.vagas_total || 0),
    dataInicio: txt(e.data_inicio),
    dataFim: txt(e.data_fim),
    status: txt(e.status),
    etapa: txt(e.etapa),
    risco: txt(e.risco) || "Baixo",
    observacoes: txt(e.observacoes),
    observacoesInternas: txt(e.observacoes_internas),
  };
}

/** Os campos que a unidade escolhida define: id, sigla, tipo e UF. */
export function camposDaUnidade(unidade: UnidadeDeEntrada | null | undefined) {
  return {
    idUnidade: txt(unidade?.id_unidade),
    siglaUnidade: txt(unidade?.sigla),
    tipoUnidade: txt(unidade?.tipo),
    uf: txt(unidade?.uf_sede).toUpperCase(),
  };
}

/**
 * O `p_payload` de `salvar_monitoramento_com_cronograma_v2`.
 *
 * @param {object} formulario o rascunho de `formularioDoEdital`
 * @param {object|null} unidade a unidade escolhida no select
 * @param {object} cronograma `{ automatico, etapas, statusExcepcional, … }`
 * @param {{status: string, etapa: string}} previa o que `estadoDoCronograma` calculou
 * @param {string} [area] a área pretendida (`co_area`): a do menu no edital novo,
 *   a do próprio edital ao editar. Sem ela, o banco deduz a área como antes.
 */
/**
 * Início e fim do edital pelo cronograma: a primeira data de início e a
 * última de fim das etapas com datas possíveis; null sem etapa válida.
 * Com o cronograma automático, são essas as datas do edital — digitadas à
 * mão saíram "0202-10-09" e "20206-09-14" em 02/10/2026.
 */
export function periodoDoCronograma(
  etapas: readonly DatasDaEtapa[] | null | undefined,
): { inicio: string; fim: string } | null {
  // Só etapas com datas válidas passam: início (e fim, ou o início) é texto.
  const validas = (etapas || []).filter(etapaComDatasValidas);
  if (!validas.length) return null;
  const inicios = validas.map((e) => e.data_inicio!.slice(0, 10)).sort();
  const fins = validas
    .map((e) => (e.data_fim || e.data_inicio)!.slice(0, 10))
    .sort();
  return { inicio: inicios[0]!, fim: fins[fins.length - 1]! };
}

export function editalParaSalvar(
  formulario: FormularioDoEdital,
  unidade: UnidadeDeEntrada | null | undefined,
  cronograma: CronogramaParaSalvar,
  previa: { status: string; etapa: string },
  area: unknown = "",
) {
  const f = formulario;
  const automatico = Boolean(cronograma.automatico);
  const periodo = automatico ? periodoDoCronograma(cronograma.etapas) : null;
  return {
    id: txt(f.id) || null,
    processo: txt(f.processo),
    edital: txt(f.edital),
    id_unidade: txt(f.idUnidade) || txt(unidade?.id_unidade) || null,
    sigla_unidade: txt(f.siglaUnidade) || txt(unidade?.sigla) || null,
    tipo_unidade: txt(f.tipoUnidade) || txt(unidade?.tipo) || null,
    unidade: txt(unidade?.nome_oficial),
    uf: txt(f.uf),
    ciclo: txt(f.ciclo),
    vagas_total: Number(f.vagas || 0),
    data_inicio: periodo?.inicio || txt(f.dataInicio) || null,
    data_fim: periodo?.fim || txt(f.dataFim) || null,
    status: automatico ? previa.status : txt(f.status),
    etapa: automatico ? previa.etapa : txt(f.etapa),
    risco: txt(f.risco) || "Baixo",
    responsavel: txt(f.responsavel),
    link_edital: txt(f.link),
    observacoes: txt(f.observacoes),
    observacoes_internas: txt(f.observacoesInternas),
    cronograma_automatico: automatico,
    cronograma_origem: cronograma.etapas.length ? "MANUAL" : null,
    status_override: txt(cronograma.statusExcepcional) || null,
    etapa_override: txt(cronograma.etapaExcepcional) || null,
    status_override_motivo: txt(cronograma.motivoExcepcional) || null,
    status_override_data: txt(cronograma.dataExcepcional) || null,
    status_override_previsao_retomada: txt(cronograma.retomada) || null,
    ...(txt(area) ? { co_area: txt(area) } : {}),
  };
}

// ── Resumo dos cronogramas e alertas ─────────────────────────────────────

const chaveDoResumo = (unidade: unknown, edital: unknown) =>
  `${normalizarNomeDaUnidade(unidade)}|${normalizarNomeDaUnidade(edital)}`;

/**
 * Índice do resumo por id e por unidade + edital. O id vem primeiro: dois
 * registros com o mesmo edital e a mesma unidade são editais diferentes.
 */
export function indexarResumo<T extends ItemDoResumo>(
  resumo: readonly T[] | null | undefined,
): Map<string, T> {
  const indice = new Map<string, T>();
  (resumo || []).forEach((item) => {
    indice.set(`id:${item.id}`, item);
    const chave = chaveDoResumo(item.unidade, item.edital);
    if (!indice.has(chave)) indice.set(chave, item);
  });
  return indice;
}

export function resumoDoEdital<T extends ItemDoResumo>(
  indice: ReadonlyMap<string, T>,
  linha: LinhaDeEditalDoNucleo,
): T | null {
  return (
    indice.get(`id:${linha.id}`) ||
    indice.get(chaveDoResumo(linha.unidade, linha.edital)) ||
    null
  );
}

/**
 * Só os itens do resumo que casam com alguma das linhas, pela mesma regra da
 * tabela (`resumoDoEdital`). O resumo vem de todos os editais; recortado assim,
 * os indicadores contam exatamente os editais que a tabela mostra (a área
 * atual, no Núcleo).
 */
export function resumoDasLinhas<T extends ItemDoResumo>(
  resumo: readonly T[] | null | undefined,
  linhas: readonly LinhaDeEditalDoNucleo[] | null | undefined,
): T[] {
  const indice = indexarResumo(resumo);
  const casados = new Set(
    (linhas || []).map((linha) => resumoDoEdital(indice, linha)),
  );
  return (resumo || []).filter((item) => casados.has(item));
}

const ALERTAS: Readonly<Record<string, AlertaDoResumo>> & {
  readonly ok: AlertaDoResumo;
} = Object.freeze({
  sem_cronograma: {
    label: "Sem cronograma",
    icon: "fa-calendar-xmark",
    tone: "danger",
  },
  incompleto: {
    label: "Cronograma incompleto",
    icon: "fa-triangle-exclamation",
    tone: "warning",
  },
  proxima_3d: {
    label: "Próxima etapa em até 3 dias",
    icon: "fa-bell",
    tone: "danger",
  },
  proxima_7d: {
    label: "Próxima etapa em até 7 dias",
    icon: "fa-clock",
    tone: "warning",
  },
  excepcional: {
    label: "Situação excepcional",
    icon: "fa-circle-exclamation",
    tone: "purple",
  },
  ok: { label: "Cronograma regular", icon: "fa-circle-check", tone: "success" },
});

export const alertaDoTipo = (tipo: string | null | undefined): AlertaDoResumo =>
  ALERTAS[tipo as string] || ALERTAS.ok;

const EM_ANDAMENTO: readonly unknown[] = ["Em andamento", "Planejado"];
const PROXIMAS: readonly unknown[] = ["proxima_3d", "proxima_7d"];

/*
  Ativo ou inativo, pelo status do edital — o mesmo sentido da "Situação do
  processo" das Análises: inativo é o processo que acabou (Concluído ou
  Cancelado); os demais (Planejado, Em andamento, Suspenso, Paralisado, sem
  status) seguem ativos. Os editais desligados no banco (`ativo = false`) nem
  chegam à tela.
*/
export function situacaoDoEdital(status: unknown): "ativo" | "inativo" {
  const l = low(status);
  return l.includes("conclu") || l.includes("cancel") ? "inativo" : "ativo";
}

/** Quantos editais ativos e inativos há no resumo (pelo status de cada um). */
export function contarAtivosEInativos(
  resumo: readonly (ItemDoResumo | null | undefined)[] | null | undefined,
): { ativos: number; inativos: number } {
  return (resumo || []).reduce(
    (acc, item) => {
      if (situacaoDoEdital(item?.status) === "inativo") acc.inativos += 1;
      else acc.ativos += 1;
      return acc;
    },
    { ativos: 0, inativos: 0 },
  );
}

/** O nome do filtro no chip: a situação (ativos/inativos) ou o alerta. */
export const rotuloDoFiltroOperacional = (filtro: string): string =>
  filtro === "ativos" || filtro === "inativos" ? "Situação" : "Alerta";

/** Os oito indicadores do painel operacional, contados sobre o resumo. */
export function indicadoresDoResumo(
  resumo: readonly ItemDoResumo[] | null | undefined,
): IndicadorDoResumo[] {
  const contagem = (resumo || []).reduce<
    { total: number; andamento: number } & Partial<Record<string, number>>
  >(
    (acc, item) => {
      acc.total += 1;
      acc[item.alerta_tipo as string] =
        (acc[item.alerta_tipo as string] || 0) + 1;
      if (EM_ANDAMENTO.includes(item.status)) acc.andamento += 1;
      return acc;
    },
    { total: 0, andamento: 0 },
  );
  const { ativos, inativos } = contarAtivosEInativos(resumo);
  return [
    {
      key: "todos",
      label: "Total de editais",
      value: contagem.total,
      icon: "fa-folder-open",
      tone: "blue",
    },
    {
      key: "ativos",
      label: "Editais ativos",
      value: ativos,
      icon: "fa-signal",
      tone: "green",
    },
    {
      key: "inativos",
      label: "Editais inativos",
      value: inativos,
      icon: "fa-box-archive",
      tone: "slate",
    },
    {
      key: "andamento",
      label: "Em andamento",
      value: contagem.andamento,
      icon: "fa-play",
      tone: "green",
    },
    {
      key: "sem_cronograma",
      label: "Sem cronograma",
      value: contagem.sem_cronograma || 0,
      icon: "fa-calendar-xmark",
      tone: "red",
    },
    {
      key: "incompleto",
      label: "Incompletos",
      value: contagem.incompleto || 0,
      icon: "fa-triangle-exclamation",
      tone: "amber",
    },
    {
      key: "proxima",
      label: "Próximos 7 dias",
      value: (contagem.proxima_3d || 0) + (contagem.proxima_7d || 0),
      icon: "fa-bell",
      tone: "cyan",
    },
    {
      key: "excepcional",
      label: "Excepcionais",
      value: contagem.excepcional || 0,
      icon: "fa-circle-exclamation",
      tone: "purple",
    },
  ];
}

/**
 * O edital passa no filtro do painel? Sem resumo, só aparece quando não há
 * filtro: não há como saber em que indicador ele cairia.
 */
export function passaNoFiltroOperacional(
  item: ItemDoResumo | null | undefined,
  filtro: string,
): boolean {
  if (filtro === "todos") return true;
  if (!item) return false;
  if (filtro === "ativos" || filtro === "inativos")
    return `${situacaoDoEdital(item.status)}s` === filtro;
  if (filtro === "andamento") return EM_ANDAMENTO.includes(item.status);
  if (filtro === "proxima") return PROXIMAS.includes(item.alerta_tipo);
  return item.alerta_tipo === filtro;
}

/** Opções para copiar cronograma: outros editais que já têm etapas. */
export function editaisComCronogramaParaCopiar<T extends ItemDoResumo>(
  resumo: readonly T[] | null | undefined,
  idAtual: unknown,
): T[] {
  return (resumo || [])
    .filter(
      (item) =>
        String(item.id) !== String(idAtual || "") &&
        Number(item.cronograma_total || 0) > 0,
    )
    .sort((a, b) =>
      `${a.unidade} ${a.edital}`.localeCompare(
        `${b.unidade} ${b.edital}`,
        "pt-BR",
        { numeric: true },
      ),
    );
}
