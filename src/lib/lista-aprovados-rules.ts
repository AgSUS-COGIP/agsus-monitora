import type {
  CandidatoDasRegrasDeAprovados,
  FiltrosDasRegrasDeAprovados,
  EscolhasDosFiltros,
  PaginaDosAprovados,
  ListaParaFiltroDeAprovados,
  OpcaoDosAprovados,
} from "./tipos-das-regras-de-aprovados.ts";
import {
  canAlterarPorDecisaoJudicial,
  canChangeCandidateStatus,
  canManageCandidateAttachments,
  canManageSubJudice,
  canUnlockCandidateStatus,
} from "./access-roles.js";

const text = (value: unknown) => String(value ?? "").trim();
const low = (value: unknown) => text(value).toLocaleLowerCase("pt-BR");

/*
  Os filtros da tela aceitam várias escolhas por campo. Aceitar também a forma
  antiga (uma string) evita quebrar quem ainda chame com um valor só — e é o que
  `summarizeApprovedCandidates` faz ao zerar o status.
*/
const multi = (value: unknown) =>
  (Array.isArray(value) ? value : [value]).map(text).filter(Boolean);

export const SEM_STATUS = "__sem_status__";

function matchStatus(
  escolhidos: readonly string[],
  row: CandidatoDasRegrasDeAprovados,
) {
  const status = text(row.status);
  return escolhidos.some((escolha) =>
    escolha === SEM_STATUS ? !status : escolha === status,
  );
}

export function statusNeedsMatricula(status: unknown) {
  return status === "Contratado" || status === "Migração";
}

/*
  Convocado: chamado para a contratação, aguardando apresentação e
  documentos. É o status de passagem — segue para Contratado, Desistente ou
  Documentação Rejeitada — e leva a data da convocação (DT_CONVOCACAO,
  migration 20261005180000).
*/
export const STATUS_CONVOCADO = "Convocado";

export function statusEhConvocado(status: unknown) {
  return text(status) === STATUS_CONVOCADO;
}

export function canEditCandidateStatus(
  profile: unknown,
  candidate: CandidatoDasRegrasDeAprovados | null | undefined,
) {
  return (
    Boolean(candidate?.lista_ativa) &&
    canChangeCandidateStatus(profile) &&
    !statusTravado(profile, candidate)
  );
}

/*
  A trava do status (migration 20260928180000): com status já definido, só o
  admin do módulo o altera — e o processo SEI e a matrícula, que vão na mesma
  RPC. Convocado não trava: quem edita segue o fluxo (Contratado,
  Desistente…) ou corrige a data (migration 20261005180000).
*/
export function statusTravado(
  profile: unknown,
  candidate: CandidatoDasRegrasDeAprovados | null | undefined,
) {
  return (
    Boolean(text(candidate?.status)) &&
    !statusEhConvocado(candidate?.status) &&
    !canUnlockCandidateStatus(profile)
  );
}

/*
  Voltar a "Sem status" (desfazer a convocação, por exemplo) é só do admin do
  módulo quando o candidato já tem status. O banco repete a regra.
*/
export function podeTirarOStatus(
  profile: unknown,
  candidate: CandidatoDasRegrasDeAprovados | null | undefined,
) {
  return !text(candidate?.status) || canUnlockCandidateStatus(profile);
}

/** Anexos do candidato: só o admin do módulo inclui e remove, em lista ativa. */
export function canEditCandidateAttachments(
  profile: unknown,
  candidate: CandidatoDasRegrasDeAprovados | null | undefined,
) {
  return (
    Boolean(candidate?.lista_ativa) && canManageCandidateAttachments(profile)
  );
}

/*
  Remover vale só para quem entrou como sub judice (inclusão). Quem teve a nota
  ou a modalidade alterada por decisão judicial sai pelo "Desfazer alteração",
  que devolve os valores do resultado publicado.
*/
export function canEditSubJudice(
  profile: unknown,
  candidate: CandidatoDasRegrasDeAprovados | null | undefined,
) {
  return (
    Boolean(candidate?.lista_ativa && candidate?.sub_judice) &&
    !candidate?.alterado_judicialmente &&
    canManageSubJudice(profile)
  );
}

/** Alterar nota/modalidade por decisão judicial: candidato de lista ativa, só o admin. */
export function canAlterarCandidatoSubJudice(
  profile: unknown,
  candidate: CandidatoDasRegrasDeAprovados | null | undefined,
) {
  return (
    Boolean(candidate?.lista_ativa) && canAlterarPorDecisaoJudicial(profile)
  );
}

export function canDesfazerAlteracaoSubJudice(
  profile: unknown,
  candidate: CandidatoDasRegrasDeAprovados | null | undefined,
) {
  return (
    Boolean(candidate?.alterado_judicialmente) &&
    canAlterarCandidatoSubJudice(profile, candidate)
  );
}

/*
  O que a decisão judicial mudou: `{ nota, modalidade, classificacaoOriginal }`,
  com nota e modalidade em `{ de, para }`, ou nulas quando não mudaram. Nulo de
  todo quando o candidato não foi alterado.
*/
export function alteracaoJudicial(
  candidate: CandidatoDasRegrasDeAprovados | null | undefined,
) {
  if (!candidate?.alterado_judicialmente) return null;
  const notaDe = Number(candidate.nota_original);
  const notaPara = Number(candidate.nota);
  const modalidadeDe = modalidadeSemAspas(candidate.modalidade_original);
  const modalidadePara = modalidadeSemAspas(candidate.modalidade);
  return {
    nota:
      candidate.nota_original != null &&
      Number.isFinite(notaDe) &&
      notaDe !== notaPara
        ? { de: notaDe, para: notaPara }
        : null,
    modalidade:
      modalidadeDe !== modalidadePara
        ? { de: modalidadeDe, para: modalidadePara }
        : null,
    classificacaoOriginal: candidate.classificacao_original ?? null,
  };
}

/*
  `candidatos` (ids): só aqueles registros — o caso de um aviso de conferência
  ("Contratado em duas vagas") abre a lista nas vagas da pessoa.
*/
export function filterApprovedCandidates<
  T extends CandidatoDasRegrasDeAprovados,
>(
  rows: readonly T[] | null | undefined,
  filters: FiltrosDasRegrasDeAprovados = {},
): T[] {
  const query = low(filters.query);
  const candidatoIds = multi(filters.candidatos);
  const editalIds = multi(filters.editalId);
  const cargos = multi(filters.cargo);
  const modalidades = multi(filters.modalidade);
  const statuses = multi(filters.status);
  return (rows || []).filter((row) => {
    if (candidatoIds.length && !candidatoIds.includes(String(row.candidato_id)))
      return false;
    if (editalIds.length && !editalIds.includes(String(row.edital_id)))
      return false;
    if (cargos.length && !cargos.includes(text(row.cargo))) return false;
    if (modalidades.length && !modalidades.includes(text(row.modalidade)))
      return false;
    if (statuses.length && !matchStatus(statuses, row)) return false;
    if (!query) return true;
    return [
      row.nome,
      row.cargo,
      row.edital,
      row.unidade,
      row.modalidade,
      row.matricula,
    ].some((value) => low(value).includes(query));
  });
}

/** O nome da pessoa do caso de aviso (o primeiro dos registros que estão na tela). */
export function nomeDosCandidatosFiltrados(
  rows: readonly CandidatoDasRegrasDeAprovados[] | null | undefined,
  ids: EscolhasDosFiltros | undefined = [],
) {
  const procurados = multi(ids);
  const achado = (rows || []).find((row) =>
    procurados.includes(String(row.candidato_id)),
  );
  return text(achado?.nome);
}

export function summarizeApprovedCandidates(
  rows: readonly CandidatoDasRegrasDeAprovados[] | null | undefined,
  filters: FiltrosDasRegrasDeAprovados = {},
) {
  const baseFilters = { ...filters, status: "" };
  const filtered = filterApprovedCandidates(rows, baseFilters);
  const summary = {
    total: filtered.length,
    contratado: 0,
    desistente: 0,
    migracao: 0,
    documentacaoRejeitada: 0,
    convocado: 0,
  };

  // Convocado não é contratado: conta à parte, como na Seleção e nos KPIs.
  filtered.forEach((row) => {
    const status = text(row.status);
    if (status === "Contratado") summary.contratado += 1;
    if (status === "Desistente") summary.desistente += 1;
    if (status === "Migração") summary.migracao += 1;
    if (status === "Documentação Rejeitada") summary.documentacaoRejeitada += 1;
    if (status === STATUS_CONVOCADO) summary.convocado += 1;
  });

  return summary;
}

function valoresUnicos(
  rows: readonly CandidatoDasRegrasDeAprovados[] | null | undefined,
  campo: "cargo" | "modalidade",
) {
  return [
    ...new Set((rows || []).map((row) => text(row[campo])).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/*
  Cargo e modalidade só oferecem o que existe nos editais escolhidos. Listar
  tudo daria opções que não devolvem candidato nenhum.
*/
function noEscopoDosEditais(
  rows: readonly CandidatoDasRegrasDeAprovados[] | null | undefined,
  editalId: EscolhasDosFiltros | undefined,
) {
  const selectedEditalIds = multi(editalId);
  if (!selectedEditalIds.length) return rows || [];
  return (rows || []).filter((row) =>
    selectedEditalIds.includes(String(row.edital_id)),
  );
}

export function uniqueCandidateCargos(
  rows: readonly CandidatoDasRegrasDeAprovados[] | null | undefined,
) {
  return valoresUnicos(rows, "cargo");
}

export function candidateCargosForEdital(
  rows: readonly CandidatoDasRegrasDeAprovados[] | null | undefined,
  editalId: EscolhasDosFiltros | undefined,
) {
  return valoresUnicos(noEscopoDosEditais(rows, editalId), "cargo");
}

export function candidateModalidadesForEdital(
  rows: readonly CandidatoDasRegrasDeAprovados[] | null | undefined,
  editalId: EscolhasDosFiltros | undefined,
) {
  return valoresUnicos(noEscopoDosEditais(rows, editalId), "modalidade");
}

/*
  Paginação da tabela de aprovados.

  A lista inteira continua em memória — paginar aqui não poupa rede, poupa o
  desenho. Antes, cada filtragem montava uma string HTML com TODAS as linhas e a
  atribuía de uma vez ao `innerHTML`; com milhares de candidatos isso trava o
  navegador, e acontecia a cada tecla digitada na busca.

  A função corrige a página em vez de confiar em quem chama: filtrar reduz o
  total e a página aberta pode deixar de existir. Devolver uma fatia vazia nesse
  caso faria a tabela parecer sem resultados quando há.
*/
export function paginateApprovedCandidates<T>(
  rows: readonly T[] | null | undefined,
  page = 1,
  pageSize = 50,
): PaginaDosAprovados<T> {
  const todas: readonly T[] = Array.isArray(rows) ? rows : [];
  const tamanho =
    Number.isFinite(pageSize) && pageSize > 0
      ? Math.max(1, Math.floor(pageSize))
      : 50;
  const totalPages = Math.max(1, Math.ceil(todas.length / tamanho));
  const pedida = Number.isFinite(page) ? Math.floor(page) : 1;
  const current = Math.min(Math.max(1, pedida), totalPages);
  const start = (current - 1) * tamanho;
  const pageRows = todas.slice(start, start + tamanho);
  return {
    rows: pageRows,
    page: current,
    totalPages,
    total: todas.length,
    // 1-indexados e para leitura humana; `to` é 0 quando não há nada.
    from: pageRows.length ? start + 1 : 0,
    to: start + pageRows.length,
  };
}

// ── Apresentação ─────────────────────────────────────────────────────────

/*
  Os status que um candidato pode ter, na ordem da tela. O filtro acrescenta
  "Sem status" (`SEM_STATUS`) à frente; o modal de status usa o valor vazio.
*/
export const STATUS_DO_CANDIDATO = Object.freeze([
  STATUS_CONVOCADO,
  "Contratado",
  "Desistente",
  "Migração",
  "Documentação Rejeitada",
]);

export const OPCOES_DO_FILTRO_DE_STATUS = Object.freeze([
  Object.freeze({ value: SEM_STATUS, label: "Sem status" }),
  ...STATUS_DO_CANDIDATO.map((status) =>
    Object.freeze({ value: status, label: status }),
  ),
]);

/** "2026-10-05" → "05/10/2026" (sem fuso: é uma data, não um instante). */
export function formatarData(valor: unknown) {
  const m = text(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Nota como a tela a escreve: "87,5"; "-" quando não há número. */
export function formatarNota(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    number,
  );
}

/** A planilha importada traz a modalidade entre aspas ("Ampla Concorrência"). */
export function modalidadeSemAspas(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "");
}

/** Tom do selo de status (`.approved-status.<tom>`). */
export function tomDoStatus(status: unknown) {
  if (status === "Contratado") return "success";
  if (status === "Desistente" || status === "Documentação Rejeitada")
    return "danger";
  if (status === "Migração") return "info";
  if (status === STATUS_CONVOCADO) return "warning";
  return "neutral";
}

/** Nome do arquivo no Storage: sem acento, espaço nem símbolo. */
export function nomeDeArquivoSeguro(name: unknown) {
  return (
    text(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lista-aprovados.xlsx"
  );
}

/**
 * Opções do filtro de edital: um por edital com lista, ordenados por número
 * e unidade, no formato "03/2025 · CASAI Manaus".
 */
export function opcoesDeEdital(
  lists: readonly ListaParaFiltroDeAprovados[] | null | undefined,
): OpcaoDosAprovados[] {
  return [
    ...new Map(
      (lists || []).map((row) => [String(row.edital_id), row]),
    ).values(),
  ]
    .sort(
      (a, b) =>
        text(a.edital).localeCompare(text(b.edital), "pt-BR") ||
        text(a.unidade).localeCompare(text(b.unidade), "pt-BR"),
    )
    .map((row) => ({
      value: String(row.edital_id),
      label: [text(row.edital) || "Edital", text(row.unidade)]
        .filter(Boolean)
        .join(" · "),
    }));
}

/*
  Tira da seleção o que deixou de ser opção. Ao filtrar por edital, a lista de
  cargos encolhe, e um cargo escolhido que sumiu não pode continuar a filtrar —
  estaria a esconder linhas sem aparecer na tela.
*/
export function manterSoAsOpcoes<T extends string | number>(
  selecionados: readonly T[] | null | undefined,
  opcoes: readonly (T | { value: T })[] | null | undefined,
): T[] {
  const disponiveis = new Set(
    (opcoes || []).map((opcao) =>
      typeof opcao === "object" && opcao !== null ? opcao.value : opcao,
    ),
  );
  return (selecionados || []).filter((valor) => disponiveis.has(valor));
}
