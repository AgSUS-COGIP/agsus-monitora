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

export const SEM_STATUS = "__sem_status__";

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

// ── Apresentação ─────────────────────────────────────────────────────────

/*
  Os status que um candidato pode ter, na ordem da tela. O filtro acrescenta
  "Sem status" (`SEM_STATUS`) à frente; o modal de status usa o valor vazio.
*/
export const STATUS_DO_CANDIDATO = Object.freeze([
  "Contratado",
  "Desistente",
  "Migração",
  "Documentação Rejeitada",
  "Fim de Fila",
]);

export const OPCOES_DO_FILTRO_DE_STATUS = Object.freeze([
  Object.freeze({ value: SEM_STATUS, label: "Sem status" }),
  ...STATUS_DO_CANDIDATO.map((status) =>
    Object.freeze({ value: status, label: status }),
  ),
]);

/** Nota como a tela a escreve: "87,5"; "-" quando não há número. */
export function formatarNota(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    number,
  );
}

/** A planilha importada traz a modalidade entre aspas ("Ampla Concorrência"). */
export function modalidadeSemAspas(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "");
}

/** Tom do selo de status (`.approved-status.<tom>`). */
export function tomDoStatus(status) {
  if (status === "Contratado") return "success";
  if (status === "Desistente" || status === "Documentação Rejeitada")
    return "danger";
  if (status === "Migração") return "info";
  if (status === "Fim de Fila") return "warning";
  return "neutral";
}

/** Nome do arquivo no Storage: sem acento, espaço nem símbolo. */
export function nomeDeArquivoSeguro(name) {
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
export function opcoesDeEdital(lists) {
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
export function manterSoAsOpcoes(selecionados, opcoes) {
  const disponiveis = new Set(
    (opcoes || []).map((opcao) =>
      typeof opcao === "object" && opcao !== null ? opcao.value : opcao,
    ),
  );
  return (selecionados || []).filter((valor) => disponiveis.has(valor));
}
