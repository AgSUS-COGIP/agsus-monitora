import {
  canChangeCandidateStatus,
  canManageSubJudice,
} from "./access-roles.js";

const text = (value) => String(value ?? "").trim();
const low = (value) => text(value).toLocaleLowerCase("pt-BR");

/*
  Os filtros da tela aceitam várias escolhas por campo. Aceitar também a forma
  antiga (uma string) evita quebrar quem ainda chame com um valor só — e é o que
  `summarizeApprovedCandidates` faz ao zerar o status.
*/
const multi = (value) =>
  (Array.isArray(value) ? value : [value]).map(text).filter(Boolean);

const SEM_STATUS = "__sem_status__";

function matchStatus(escolhidos, row) {
  const status = text(row.status);
  return escolhidos.some((escolha) =>
    escolha === SEM_STATUS ? !status : escolha === status,
  );
}

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
  const editalIds = multi(filters.editalId);
  const cargos = multi(filters.cargo);
  const modalidades = multi(filters.modalidade);
  const statuses = multi(filters.status);
  return (rows || []).filter((row) => {
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

export function summarizeApprovedCandidates(rows, filters = {}) {
  const baseFilters = { ...filters, status: "" };
  const filtered = filterApprovedCandidates(rows, baseFilters);
  const summary = {
    total: filtered.length,
    contratado: 0,
    desistente: 0,
    migracao: 0,
    documentacaoRejeitada: 0,
    fimDeFila: 0,
  };

  filtered.forEach((row) => {
    const status = text(row.status);
    if (status === "Contratado") summary.contratado += 1;
    if (status === "Desistente") summary.desistente += 1;
    if (status === "Migração") summary.migracao += 1;
    if (status === "Documentação Rejeitada") summary.documentacaoRejeitada += 1;
    if (status === "Fim de Fila") summary.fimDeFila += 1;
  });

  return summary;
}

function valoresUnicos(rows, campo) {
  return [
    ...new Set((rows || []).map((row) => text(row[campo])).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/*
  Cargo e modalidade só oferecem o que existe nos editais escolhidos. Listar
  tudo daria opções que não devolvem candidato nenhum.
*/
function noEscopoDosEditais(rows, editalId) {
  const selectedEditalIds = multi(editalId);
  if (!selectedEditalIds.length) return rows || [];
  return (rows || []).filter((row) =>
    selectedEditalIds.includes(String(row.edital_id)),
  );
}

export function uniqueCandidateCargos(rows) {
  return valoresUnicos(rows, "cargo");
}

export function candidateCargosForEdital(rows, editalId) {
  return valoresUnicos(noEscopoDosEditais(rows, editalId), "cargo");
}

export function candidateModalidadesForEdital(rows, editalId) {
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
