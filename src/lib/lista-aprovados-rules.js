import {
  canChangeCandidateStatus,
  canManageSubJudice,
} from "./access-roles.js";

const text = (value) => String(value ?? "").trim();
const low = (value) => text(value).toLocaleLowerCase("pt-BR");

export function statusNeedsMatricula(status) {
  return status === "Contratado" || status === "Migração";
}

export function canEditCandidateStatus(profile, candidate) {
  return Boolean(candidate?.lista_ativa) && canChangeCandidateStatus(profile);
}

export function canEditSubJudice(profile, candidate) {
  return (
    Boolean(candidate?.lista_ativa && candidate?.sub_judice) &&
    canManageSubJudice(profile)
  );
}

export function filterApprovedCandidates(rows, filters = {}) {
  const query = low(filters.query);
  const editalId = text(filters.editalId);
  const cargo = text(filters.cargo);
  const status = text(filters.status);
  return (rows || []).filter((row) => {
    if (editalId && String(row.edital_id) !== editalId) return false;
    if (cargo && text(row.cargo) !== cargo) return false;
    if (status === "__sem_status__" && text(row.status)) return false;
    if (status && status !== "__sem_status__" && text(row.status) !== status)
      return false;
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

export function summarizeApprovedCandidates(rows, filters = {}) {
  const baseFilters = { ...filters, status: "" };
  const filtered = filterApprovedCandidates(rows, baseFilters);
  const summary = {
    total: filtered.length,
    contratado: 0,
    desistente: 0,
    migracao: 0,
    documentacaoRejeitada: 0,
  };

  filtered.forEach((row) => {
    const status = text(row.status);
    if (status === "Contratado") summary.contratado += 1;
    if (status === "Desistente") summary.desistente += 1;
    if (status === "Migração") summary.migracao += 1;
    if (status === "Documentação Rejeitada") summary.documentacaoRejeitada += 1;
  });

  return summary;
}

export function uniqueCandidateCargos(rows) {
  return [
    ...new Set((rows || []).map((row) => text(row.cargo)).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function candidateCargosForEdital(rows, editalId) {
  const selectedEditalId = text(editalId);
  const scopedRows = selectedEditalId
    ? (rows || []).filter((row) => String(row.edital_id) === selectedEditalId)
    : rows || [];
  return uniqueCandidateCargos(scopedRows);
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
export function paginateApprovedCandidates(rows, page = 1, pageSize = 50) {
  const todas = Array.isArray(rows) ? rows : [];
  const tamanho =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 50;
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
