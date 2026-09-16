import { getSupabaseClient } from "../lib/supabaseClient.js";
import { readApprovedWorkbook } from "../lib/aprovados-import.js";
import {
  canChangeCandidateStatus,
  canImportApprovedList,
  canManageSubJudice,
  canReplaceApprovedList,
  normalizeRole,
} from "../lib/access-roles.js";
import {
  statusNeedsMatricula,
  canEditCandidateStatus,
  canEditSubJudice,
  filterApprovedCandidates,
  summarizeApprovedCandidates,
  uniqueCandidateCargos,
} from "../lib/lista-aprovados-rules.js";

const BUCKET = "listas-aprovados";
const MODEL_URL = "/modelos/modelo-importacao-lista-aprovados.xlsx";

const escMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => escMap[char]);
const attr = (value) => esc(value).replaceAll("`", "&#096;");
const text = (value) => String(value ?? "").trim();
const low = (value) => text(value).toLocaleLowerCase("pt-BR");

function formatScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    number,
  );
}

function statusClass(status) {
  if (status === "Contratado") return "success";
  if (status === "Desistente" || status === "Documentação Rejeitada")
    return "danger";
  if (status === "Migração") return "info";
  return "neutral";
}

function safeFileName(name) {
  return (
    text(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lista-aprovados.xlsx"
  );
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createListaAprovadosController(options = {}) {
  const sb = options.supabase || getSupabaseClient();
  const toast = options.toast || ((message) => console.info(message));
  const loader = options.loader || (() => {});
  const getProfile = options.getProfile || (() => null);
  const state = {
    candidates: [],
    lists: [],
    loaded: false,
    currentStatusCandidateId: "",
    currentImportEditalId: "",
    currentImportEditalLabel: "",
  };

  function profile() {
    return getProfile() || null;
  }

  function byId(id) {
    return state.candidates.find(
      (row) => String(row.candidato_id) === String(id),
    );
  }

  function listByEdital(editalId) {
    return state.lists.find(
      (row) => String(row.edital_id) === String(editalId),
    );
  }

  function showModal(id, show = true) {
    document.getElementById(id)?.classList.toggle("show", show);
  }

  function fillFilters() {
    const edital = document.getElementById("approvedFilterEdital");
    const cargo = document.getElementById("approvedFilterCargo");
    if (!edital || !cargo) return;
    const editalValue = edital.value;
    const cargoValue = cargo.value;
    const editais = [
      ...new Map(
        state.candidates.map((row) => [String(row.edital_id), row]),
      ).values(),
    ].sort((a, b) => text(a.edital).localeCompare(text(b.edital), "pt-BR"));
    edital.innerHTML = `<option value="">Todos os editais</option>${editais
      .map(
        (row) =>
          `<option value="${attr(row.edital_id)}">${esc(row.edital || "Edital")} · ${esc(row.unidade || "")}</option>`,
      )
      .join("")}`;
    if ([...edital.options].some((option) => option.value === editalValue))
      edital.value = editalValue;
    cargo.innerHTML = `<option value="">Todos os cargos</option>${uniqueCandidateCargos(
      state.candidates,
    )
      .map((value) => `<option value="${attr(value)}">${esc(value)}</option>`)
      .join("")}`;
    if ([...cargo.options].some((option) => option.value === cargoValue))
      cargo.value = cargoValue;
  }

  function currentFilters() {
    return {
      query: document.getElementById("approvedSearch")?.value || "",
      editalId: document.getElementById("approvedFilterEdital")?.value || "",
      cargo: document.getElementById("approvedFilterCargo")?.value || "",
      status: document.getElementById("approvedFilterStatus")?.value || "",
    };
  }

  function renderKpis() {
    const summary = summarizeApprovedCandidates(
      state.candidates,
      currentFilters(),
    );
    const values = {
      approvedKpiTotal: summary.total,
      approvedKpiContratado: summary.contratado,
      approvedKpiDesistente: summary.desistente,
      approvedKpiMigracao: summary.migracao,
      approvedKpiDocumentacaoRejeitada: summary.documentacaoRejeitada,
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    });
  }

  function renderRows() {
    const body = document.getElementById("approvedRows");
    const count = document.getElementById("approvedCount");
    if (!body) return;
    const rows = filterApprovedCandidates(state.candidates, currentFilters());
    if (count)
      count.textContent = `${rows.length} candidato${rows.length === 1 ? "" : "s"}`;
    body.innerHTML = rows.length
      ? rows
          .map((row) => {
            const canStatus = canEditCandidateStatus(profile(), row);
            const canRemove = canEditSubJudice(profile(), row);
            const inactive = !row.lista_ativa;
            const status = text(row.status);
            const action = canStatus
              ? `<button class="btn icon outline" type="button" data-approved-action="status" data-candidate-id="${attr(row.candidato_id)}" title="Alterar status"><i class="fa-solid fa-pen"></i></button>`
              : inactive && canChangeCandidateStatus(profile())
                ? `<button class="btn icon outline" type="button" disabled title="Lista inativa"><i class="fa-solid fa-lock"></i></button>`
                : `<span class="approved-no-action">—</span>`;
            const remove = canRemove
              ? `<button class="btn icon red" type="button" data-approved-action="remove-subjudice" data-candidate-id="${attr(row.candidato_id)}" title="Remover sub judice"><i class="fa-solid fa-user-minus"></i></button>`
              : "";
            return `<tr>
            <td>${esc(row.cargo || "-")}</td>
            <td class="num">${row.classificacao ?? "-"}</td>
            <td class="num">${esc(formatScore(row.nota))}</td>
            <td><div class="approved-name"><strong>${esc(row.nome)}</strong>${row.sub_judice ? '<span class="approved-tag subjudice">SUB JUDICE</span>' : ""}<small>${esc(row.edital || "")}${row.modalidade ? ` · ${esc(row.modalidade)}` : ""}${inactive ? " · Lista inativa" : ""}</small></div></td>
            <td><span class="approved-status ${statusClass(status)}">${esc(status || "Sem status")}</span></td>
            <td class="approved-actions">${action}${remove}</td>
          </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" class="approved-empty">Nenhum candidato encontrado para os filtros selecionados.</td></tr>`;
  }

  function renderToolbar() {
    const button = document.getElementById("approvedAddSubJudiceBtn");
    if (!button) return;
    const allowed = canManageSubJudice(profile());
    button.classList.toggle("hidden", !allowed);
    const hasActiveList = state.lists.some((item) => item.ativo);
    button.disabled = allowed && !hasActiveList;
    button.title = hasActiveList
      ? "Incluir candidato sub judice"
      : "É necessário ter uma lista ativa";
  }

  function render() {
    fillFilters();
    renderToolbar();
    renderKpis();
    renderRows();
  }

  async function refresh(options = {}) {
    if (!sb) return false;
    if (options.loader !== false)
      loader(true, "Lista de aprovados", "Carregando candidatos...", 55);
    const [listsResult, candidatesResult] = await Promise.all([
      sb.rpc("listar_listas_aprovados"),
      sb.rpc("listar_candidatos_aprovados"),
    ]);
    if (options.loader !== false) loader(false);
    const error = listsResult.error || candidatesResult.error;
    if (error) {
      toast(
        `Erro ao carregar lista de aprovados: ${error.message || error}`,
        "error",
      );
      return false;
    }
    state.lists = Array.isArray(listsResult.data) ? listsResult.data : [];
    state.candidates = Array.isArray(candidatesResult.data)
      ? candidatesResult.data
      : [];
    state.loaded = true;
    render();
    document.dispatchEvent(
      new CustomEvent("agsus:listas-aprovados-loaded", {
        detail: { lists: state.lists },
      }),
    );
    return true;
  }

  async function ensureLoaded() {
    if (!state.loaded) await refresh();
    else render();
  }

  function openStatusModal(candidateId) {
    const candidate = byId(candidateId);
    if (!candidate || !canEditCandidateStatus(profile(), candidate)) {
      return toast(
        candidate?.lista_ativa === false
          ? "A lista está inativa."
          : "Sem permissão para alterar o status.",
        "warn",
      );
    }
    state.currentStatusCandidateId = String(candidateId);
    document.getElementById("approvedStatusCandidate").textContent =
      `${candidate.nome} · ${candidate.cargo}`;
    document.getElementById("approvedStatusSelect").value =
      candidate.status || "";
    document.getElementById("approvedStatusSei").value =
      candidate.processo_sei || "";
    document.getElementById("approvedStatusMatricula").value =
      candidate.matricula || "";
    updateStatusRequirement();
    showModal("approvedStatusModal", true);
  }

  function updateStatusRequirement() {
    const select = document.getElementById("approvedStatusSelect");
    const input = document.getElementById("approvedStatusMatricula");
    const hint = document.getElementById("approvedMatriculaHint");
    const required = statusNeedsMatricula(select?.value || "");
    if (input) input.required = required;
    if (hint)
      hint.textContent = required
        ? "Obrigatória para este status."
        : "Opcional para este status.";
  }

  async function saveCandidateStatus() {
    const candidate = byId(state.currentStatusCandidateId);
    if (!candidate || !canEditCandidateStatus(profile(), candidate)) return;
    const status = text(document.getElementById("approvedStatusSelect")?.value);
    const processo = text(document.getElementById("approvedStatusSei")?.value);
    const matricula = text(
      document.getElementById("approvedStatusMatricula")?.value,
    );
    if (statusNeedsMatricula(status) && !matricula) {
      return toast("Informe a matrícula para Contratado ou Migração.", "warn");
    }
    loader(true, "Lista de aprovados", "Salvando status do candidato...", 65);
    const { error } = await sb.rpc("alterar_status_candidato_aprovado", {
      p_candidato_id: candidate.candidato_id,
      p_status: status || null,
      p_processo_sei: processo || null,
      p_matricula: matricula || null,
    });
    loader(false);
    if (error)
      return toast(
        `Erro ao alterar status: ${error.message || error}`,
        "error",
      );
    showModal("approvedStatusModal", false);
    toast("Status do candidato atualizado.");
    await refresh({ loader: false });
  }

  function activeLists() {
    return state.lists.filter((item) => item.ativo);
  }

  function populateSubJudiceEditais() {
    const select = document.getElementById("subJudiceEdital");
    if (!select) return;
    select.innerHTML = activeLists()
      .map(
        (item) =>
          `<option value="${attr(item.edital_id)}">${esc(item.edital || "Edital")} · ${esc(item.unidade || "")}</option>`,
      )
      .join("");
    populateSubJudiceCargos();
  }

  function populateSubJudiceCargos() {
    const editalId = document.getElementById("subJudiceEdital")?.value || "";
    const select = document.getElementById("subJudiceCargo");
    if (!select) return;
    const cargos = uniqueCandidateCargos(
      state.candidates.filter(
        (row) => String(row.edital_id) === String(editalId),
      ),
    );
    select.innerHTML = cargos
      .map((cargo) => `<option value="${attr(cargo)}">${esc(cargo)}</option>`)
      .join("");
  }

  function openSubJudiceModal() {
    if (!canManageSubJudice(profile()))
      return toast("Sem permissão para incluir sub judice.", "warn");
    if (!activeLists().length)
      return toast("Não há lista ativa para receber sub judice.", "warn");
    document.getElementById("subJudiceNome").value = "";
    document.getElementById("subJudiceNota").value = "";
    populateSubJudiceEditais();
    showModal("subJudiceModal", true);
  }

  async function saveSubJudice() {
    const editalId = text(document.getElementById("subJudiceEdital")?.value);
    const cargo = text(document.getElementById("subJudiceCargo")?.value);
    const nome = text(document.getElementById("subJudiceNome")?.value);
    const notaRaw = text(
      document.getElementById("subJudiceNota")?.value,
    ).replace(",", ".");
    const nota = Number(notaRaw);
    if (!editalId || !cargo || !nome || !Number.isFinite(nota) || nota < 0) {
      return toast("Preencha edital, cargo, nome e uma nota válida.", "warn");
    }
    loader(true, "Sub judice", "Incluindo candidato...", 65);
    const { error } = await sb.rpc("incluir_sub_judice", {
      p_edital_id: editalId,
      p_cargo: cargo,
      p_nome: nome,
      p_nota: nota,
    });
    loader(false);
    if (error)
      return toast(
        `Erro ao incluir sub judice: ${error.message || error}`,
        "error",
      );
    showModal("subJudiceModal", false);
    toast("Candidato sub judice incluído.");
    await refresh({ loader: false });
  }

  async function removeSubJudice(candidateId) {
    const candidate = byId(candidateId);
    if (!candidate || !canEditSubJudice(profile(), candidate)) return;
    if (
      !window.confirm(
        `Remover ${candidate.nome} da lista como sub judice? O histórico será preservado.`,
      )
    )
      return;
    loader(true, "Sub judice", "Removendo candidato...", 60);
    const { error } = await sb.rpc("remover_sub_judice", {
      p_candidato_id: candidate.candidato_id,
    });
    loader(false);
    if (error)
      return toast(
        `Erro ao remover sub judice: ${error.message || error}`,
        "error",
      );
    toast("Sub judice removido da lista vigente.");
    await refresh({ loader: false });
  }

  function renderImportModal() {
    const editalId = state.currentImportEditalId;
    const list = listByEdital(editalId);
    const role = normalizeRole(profile());
    const canImport = canImportApprovedList(profile());
    const canReplace = canReplaceApprovedList(profile());
    document.getElementById("approvedImportEdital").textContent =
      state.currentImportEditalLabel || "Edital";
    const stateText = document.getElementById("approvedImportCurrentState");
    const fileRow = document.getElementById("approvedImportFileRow");
    const importButton = document.getElementById("approvedImportSubmit");
    const removeButton = document.getElementById("approvedImportRemove");
    const downloadCurrent = document.getElementById(
      "approvedImportDownloadCurrent",
    );
    const activeSelect = document.getElementById("approvedImportActive");
    const fileInput = document.getElementById("approvedImportFile");
    if (fileInput) fileInput.value = "";
    if (activeSelect)
      activeSelect.value = list?.ativo === false ? "false" : "true";
    if (stateText)
      stateText.innerHTML = list
        ? `<span class="approved-status ${list.ativo ? "success" : "neutral"}">${list.ativo ? "Lista ativa" : "Lista inativa"}</span><span>${esc(list.arquivo_nome || "Arquivo importado")}</span><span>${esc(String(list.total_candidatos ?? 0))} candidato(s)</span>`
        : `<span class="approved-status neutral">Sem lista importada</span>`;
    if (fileRow)
      fileRow.classList.toggle("hidden", Boolean(list && !canReplace));
    if (importButton) {
      importButton.classList.toggle(
        "hidden",
        !canImport || Boolean(list && !canReplace),
      );
      importButton.innerHTML = list
        ? '<i class="fa-solid fa-rotate"></i> Substituir XLSX'
        : '<i class="fa-solid fa-file-import"></i> Importar lista';
    }
    if (removeButton)
      removeButton.classList.toggle("hidden", !list || !canReplace);
    if (downloadCurrent) downloadCurrent.classList.toggle("hidden", !list);
    const toggleButton = document.getElementById("approvedImportToggleActive");
    if (toggleButton)
      toggleButton.classList.toggle("hidden", !list || !canImport);
    const note = document.getElementById("approvedImportPermissionNote");
    if (note) {
      note.textContent =
        list && !canReplace
          ? `A lista já foi importada. O perfil ${role || "atual"} pode ativar/inativar, mas somente admin pode substituir ou remover o XLSX.`
          : "A importação cria candidatos vinculados a este edital pelo ID do registro da Equipe Núcleo.";
    }
  }

  async function openImportModal(editalId, editalLabel = "") {
    if (!canImportApprovedList(profile()))
      return toast("Sem permissão para gerir lista de aprovados.", "warn");
    if (!state.loaded) await refresh({ loader: false });
    state.currentImportEditalId = String(editalId || "");
    state.currentImportEditalLabel = editalLabel;
    renderImportModal();
    showModal("approvedImportModal", true);
  }

  async function importList() {
    const editalId = state.currentImportEditalId;
    const current = listByEdital(editalId);
    if (current && !canReplaceApprovedList(profile()))
      return toast(
        "Somente admin pode substituir uma lista existente.",
        "warn",
      );
    const file = document.getElementById("approvedImportFile")?.files?.[0];
    if (!file) return toast("Selecione o arquivo XLSX.", "warn");
    if (file.size > 10 * 1024 * 1024)
      return toast("O XLSX deve ter no máximo 10 MB.", "warn");
    const active =
      document.getElementById("approvedImportActive")?.value !== "false";
    let candidates;
    try {
      loader(true, "Lista de aprovados", "Validando o XLSX...", 25);
      candidates = await readApprovedWorkbook(file);
    } catch (error) {
      loader(false);
      return toast(`Arquivo inválido: ${error.message || error}`, "error");
    }
    const path = `${editalId}/${Date.now()}-${uuid()}-${safeFileName(file.name)}`;
    loader(
      true,
      "Lista de aprovados",
      `Enviando ${candidates.length} candidato(s)...`,
      55,
    );
    const upload = await sb.storage.from(BUCKET).upload(path, file, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });
    if (upload.error) {
      loader(false);
      return toast(
        `Erro ao anexar XLSX: ${upload.error.message || upload.error}`,
        "error",
      );
    }
    const result = await sb.rpc("importar_lista_aprovados", {
      p_edital_id: editalId,
      p_ativo: active,
      p_arquivo_nome: file.name,
      p_arquivo_path: path,
      p_candidatos: candidates,
      p_substituir: Boolean(current),
    });
    loader(false);
    if (result.error)
      return toast(
        `Erro ao importar lista: ${result.error.message || result.error}`,
        "error",
      );
    showModal("approvedImportModal", false);
    toast(`${candidates.length} candidato(s) importados com sucesso.`);
    await refresh({ loader: false });
    document.dispatchEvent(new CustomEvent("agsus:listas-aprovados-changed"));
  }

  async function toggleActiveList() {
    const list = listByEdital(state.currentImportEditalId);
    if (!list) return;
    const active =
      document.getElementById("approvedImportActive")?.value !== "false";
    loader(
      true,
      "Lista de aprovados",
      active ? "Ativando lista..." : "Inativando lista...",
      60,
    );
    const { error } = await sb.rpc("definir_lista_aprovados_ativa", {
      p_lista_id: list.lista_id,
      p_ativo: active,
    });
    loader(false);
    if (error)
      return toast(
        `Erro ao alterar a lista: ${error.message || error}`,
        "error",
      );
    toast(
      active
        ? "Lista ativada."
        : "Lista inativada. Os candidatos ficaram bloqueados para alteração.",
    );
    await refresh({ loader: false });
    renderImportModal();
  }

  async function removeList() {
    const list = listByEdital(state.currentImportEditalId);
    if (!list || !canReplaceApprovedList(profile())) return;
    if (
      !window.confirm(
        "Remover a lista vigente deste edital? Os dados permanecerão preservados no histórico.",
      )
    )
      return;
    loader(true, "Lista de aprovados", "Arquivando lista vigente...", 60);
    const { error } = await sb.rpc("remover_lista_aprovados", {
      p_lista_id: list.lista_id,
    });
    loader(false);
    if (error)
      return toast(`Erro ao remover lista: ${error.message || error}`, "error");
    toast("Lista removida da visão vigente. O histórico foi preservado.");
    await refresh({ loader: false });
    renderImportModal();
    document.dispatchEvent(new CustomEvent("agsus:listas-aprovados-changed"));
  }

  async function downloadCurrentFile() {
    const list = listByEdital(state.currentImportEditalId);
    if (!list?.arquivo_path) return;
    const { data, error } = await sb.storage
      .from(BUCKET)
      .download(list.arquivo_path);
    if (error)
      return toast(`Erro ao baixar XLSX: ${error.message || error}`, "error");
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = list.arquivo_nome || "lista-aprovados.xlsx";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bind() {
    const renderFilteredView = () => {
      renderKpis();
      renderRows();
    };
    document
      .getElementById("approvedSearch")
      ?.addEventListener("input", renderFilteredView);
    [
      "approvedFilterEdital",
      "approvedFilterCargo",
      "approvedFilterStatus",
    ].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener("change", renderFilteredView);
    });
    document
      .getElementById("approvedRows")
      ?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-approved-action]");
        if (!button) return;
        if (button.dataset.approvedAction === "status")
          openStatusModal(button.dataset.candidateId);
        if (button.dataset.approvedAction === "remove-subjudice")
          void removeSubJudice(button.dataset.candidateId);
      });
    document
      .getElementById("approvedAddSubJudiceBtn")
      ?.addEventListener("click", openSubJudiceModal);
    document
      .getElementById("subJudiceEdital")
      ?.addEventListener("change", populateSubJudiceCargos);
    document
      .getElementById("subJudiceSave")
      ?.addEventListener("click", () => void saveSubJudice());
    document
      .getElementById("approvedStatusSelect")
      ?.addEventListener("change", updateStatusRequirement);
    document
      .getElementById("approvedStatusSave")
      ?.addEventListener("click", () => void saveCandidateStatus());
    document
      .getElementById("approvedImportSubmit")
      ?.addEventListener("click", () => void importList());
    document
      .getElementById("approvedImportToggleActive")
      ?.addEventListener("click", () => void toggleActiveList());
    document
      .getElementById("approvedImportRemove")
      ?.addEventListener("click", () => void removeList());
    document
      .getElementById("approvedImportDownloadCurrent")
      ?.addEventListener("click", () => void downloadCurrentFile());
    document
      .querySelectorAll("[data-close-approved-modal]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          showModal(button.dataset.closeApprovedModal, false),
        );
      });
    ["approvedStatusModal", "subJudiceModal", "approvedImportModal"].forEach(
      (id) => {
        document.getElementById(id)?.addEventListener("click", (event) => {
          if (event.target.id === id) showModal(id, false);
        });
      },
    );
  }

  bind();

  return {
    state,
    render: ensureLoaded,
    refresh,
    openStatusModal,
    openSubJudiceModal,
    openImportModal,
    closeImportModal: () => showModal("approvedImportModal", false),
    modelUrl: MODEL_URL,
  };
}
