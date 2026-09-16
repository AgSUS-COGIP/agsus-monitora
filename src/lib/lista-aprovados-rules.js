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
