import { getSupabaseClient } from "../lib/supabaseClient.js";

const RPC_GET = "get_monitoramento_cronograma";
const RPC_SUMMARY = "get_nucleo_cronograma_resumo";

const state = {
  initialized: false,
  client: null,
  catalog: [],
  currentId: "",
  loadingCatalog: false,
  copying: false
};

const $ = id => document.getElementById(id);
const txt = value => String(value ?? "").trim();
const escMap = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" };
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => escMap[char]);

function client() {
  if (state.client) return state.client;
  state.client = getSupabaseClient();
  return state.client;
}

async function ensureSession() {
  const sb = client();
  if (!sb) throw new Error("Supabase indisponível.");
  const { data, error } = await sb.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
  return sb;
}

function formatDate(value) {
  if (!value) return "-";
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle:"short",
      timeStyle:"short",
      timeZone:"America/Sao_Paulo"
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function stageState(row, index, rows, today) {
  const start = String(row.data_inicio || "");
  const end = String(row.data_fim || start);
  if (end && today > end) return "done";
  if (start && end && today >= start && today <= end) return "current";
  const firstFuture = rows.findIndex(item => String(item.data_inicio || "") > today);
  if (index === firstFuture) return "next";
  return "future";
}

function ensureTimelineModal() {
  if ($("nucleoTimelineModal")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div id="nucleoTimelineModal" class="modal nucleo-timeline-modal" aria-hidden="true">
      <div class="modal-card nucleo-timeline-card" role="dialog" aria-modal="true" aria-labelledby="nucleoTimelineTitle">
        <div class="modal-header">
          <div>
            <span class="nucleo-timeline-eyebrow">Acompanhamento do edital</span>
            <h3 id="nucleoTimelineTitle">Cronograma</h3>
            <p id="nucleoTimelineSubtitle"></p>
          </div>
          <button type="button" id="closeNucleoTimeline" class="btn outline">Fechar</button>
        </div>
        <div id="nucleoTimelineContent" class="nucleo-timeline-content"></div>
      </div>
    </div>`);

  $("closeNucleoTimeline")?.addEventListener("click", closeTimeline);
  $("nucleoTimelineModal")?.addEventListener("click", event => {
    if (event.target === $("nucleoTimelineModal")) closeTimeline();
  });
}

function closeTimeline() {
  const modal = $("nucleoTimelineModal");
  modal?.classList.remove("show");
  modal?.setAttribute("aria-hidden", "true");
}

function renderTimeline(data) {
  const monitor = data?.monitoramento || {};
  const current = data?.estado || {};
  const rows = Array.isArray(data?.etapas) ? data.etapas : [];
  const history = Array.isArray(data?.historico) ? data.historico : [];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/Sao_Paulo",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).format(new Date());

  $("nucleoTimelineTitle").textContent = monitor.edital || "Cronograma do edital";
  $("nucleoTimelineSubtitle").textContent = monitor.unidade || "";

  const content = $("nucleoTimelineContent");
  if (!content) return;
  content.innerHTML = `
    <div class="nucleo-timeline-summary">
      <div><span>Status</span><strong>${esc(current.status || "Cronograma pendente")}</strong></div>
      <div><span>Etapa atual</span><strong>${esc(current.etapa || "-")}</strong></div>
      <div><span>Próxima atividade</span><strong>${esc(current.proxima_atividade || "-")}</strong></div>
      <div><span>Progresso</span><strong>${Number(current.percentual || 0)}%</strong></div>
    </div>
    ${monitor.status_override ? `
      <div class="nucleo-timeline-exception">
        <i class="fa-solid fa-circle-exclamation"></i>
        <div>
          <strong>${esc(monitor.status_override)}</strong>
          <p>${esc(monitor.status_override_motivo || "Motivo não informado")}</p>
          <small>Decisão: ${formatDate(monitor.status_override_data)}${monitor.status_override_previsao_retomada ? ` · Retomada prevista: ${formatDate(monitor.status_override_previsao_retomada)}` : ""}</small>
        </div>
      </div>` : ""}
    <section class="nucleo-timeline-section">
      <div class="nucleo-timeline-section-title"><span>Linha do tempo</span><strong>${rows.length} etapa(s)</strong></div>
      <div class="nucleo-timeline-list">
        ${rows.length ? rows.map((row, index) => {
          const status = stageState(row, index, rows, today);
          const labels = { done:"Concluída", current:"Em andamento", next:"Próxima", future:"Futura" };
          const icon = status === "done" ? "fa-check" : status === "current" ? "fa-play" : status === "next" ? "fa-clock" : "fa-circle";
          return `
            <article class="nucleo-timeline-item is-${status}">
              <span class="nucleo-timeline-dot"><i class="fa-solid ${icon}"></i></span>
              <div>
                <div><strong>${esc(row.atividade || "Etapa sem nome")}</strong><span>${labels[status]}</span></div>
                <p>${formatDate(row.data_inicio)}${row.data_fim && row.data_fim !== row.data_inicio ? ` a ${formatDate(row.data_fim)}` : ""}</p>
                ${row.observacao ? `<small>${esc(row.observacao)}</small>` : ""}
              </div>
            </article>`;
        }).join("") : '<div class="nucleo-timeline-empty">Nenhuma etapa cadastrada para este edital.</div>'}
      </div>
    </section>
    <section class="nucleo-timeline-section">
      <div class="nucleo-timeline-section-title"><span>Histórico e erratas</span><strong>${history.length} registro(s)</strong></div>
      <div class="nucleo-timeline-history">
        ${history.length ? history.map(item => `
          <article>
            <i class="fa-solid ${item.acao === "errata" ? "fa-file-pen" : "fa-clock-rotate-left"}"></i>
            <div>
              <div><strong>${esc(item.numero_errata || (item.acao === "errata" ? "Errata" : "Alteração"))}</strong><span>${formatDateTime(item.created_at)}</span></div>
              <p>${esc(item.motivo || "Sem motivo informado")}</p>
              <small>${esc(item.created_by_email || "Usuário autenticado")} · ${Number(item.total_alteracoes || 0)} alteração(ões)</small>
            </div>
          </article>`).join("") : '<div class="nucleo-timeline-empty">Nenhuma alteração auditada.</div>'}
      </div>
    </section>`;
}

async function openTimeline(id) {
  ensureTimelineModal();
  const modal = $("nucleoTimelineModal");
  const content = $("nucleoTimelineContent");
  modal?.classList.add("show");
  modal?.setAttribute("aria-hidden", "false");
  if (content) content.innerHTML = '<div class="nucleo-timeline-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando cronograma...</div>';

  try {
    const sb = await ensureSession();
    const { data, error } = await sb.rpc(RPC_GET, { p_monitoramento_id:id });
    if (error) throw error;
    renderTimeline(data);
  } catch (error) {
    if (content) content.innerHTML = `<div class="nucleo-timeline-error">Erro ao carregar cronograma: ${esc(error?.message || error)}</div>`;
  }
}

function copyBoxMarkup() {
  return `
    <section id="cronogramaCopyBox" class="cronograma-copy-box">
      <div class="cronograma-copy-heading">
        <div>
          <span>Reaproveitamento</span>
          <strong>Copiar cronograma de outro edital</strong>
          <small>Serão copiadas somente atividades, datas e observações das etapas.</small>
        </div>
      </div>
      <div class="cronograma-copy-controls">
        <select id="cronogramaCopySource" aria-label="Edital de origem">
          <option value="">Selecione um edital com cronograma...</option>
        </select>
        <button type="button" id="cronogramaCopyApply" class="btn secondary" disabled>
          <i class="fa-solid fa-copy"></i> Copiar etapas
        </button>
      </div>
      <div id="cronogramaCopyFeedback" class="cronograma-copy-feedback" hidden></div>
    </section>`;
}

function ensureCopyUi() {
  const editor = $("cronogramaEditor");
  const actions = editor?.querySelector(".cronograma-actions-box");
  if (!editor || !actions) return false;
  if (!$("cronogramaCopyBox")) {
    actions.insertAdjacentHTML("afterend", copyBoxMarkup());
    $("cronogramaCopySource")?.addEventListener("change", () => {
      const button = $("cronogramaCopyApply");
      if (button) button.disabled = !txt($("cronogramaCopySource")?.value);
      setCopyFeedback("", "info");
    });
    $("cronogramaCopyApply")?.addEventListener("click", copySelectedCronograma);
  }
  return true;
}

function setCopyFeedback(message, tone = "info") {
  const box = $("cronogramaCopyFeedback");
  if (!box) return;
  box.hidden = !message;
  box.className = `cronograma-copy-feedback is-${tone}`;
  box.textContent = message;
}

function renderCopyCatalog() {
  const select = $("cronogramaCopySource");
  if (!select) return;
  const options = state.catalog
    .filter(item => String(item.id) !== String(state.currentId) && Number(item.cronograma_total || 0) > 0)
    .sort((a, b) => `${a.unidade} ${a.edital}`.localeCompare(`${b.unidade} ${b.edital}`, "pt-BR", { numeric:true }));

  select.innerHTML = '<option value="">Selecione um edital com cronograma...</option>' + options.map(item =>
    `<option value="${esc(item.id)}">${esc(item.unidade || "Unidade não informada")} — ${esc(item.edital || "Edital sem número")} (${Number(item.cronograma_total || 0)} etapas)</option>`
  ).join("");
  const button = $("cronogramaCopyApply");
  if (button) button.disabled = true;
  if (!options.length) setCopyFeedback("Nenhum outro edital possui cronograma cadastrado.", "warning");
}

async function loadCopyCatalog() {
  if (state.loadingCatalog) return;
  state.loadingCatalog = true;
  try {
    const sb = await ensureSession();
    const { data, error } = await sb.rpc(RPC_SUMMARY);
    if (error) throw error;
    state.catalog = Array.isArray(data) ? data : [];
    renderCopyCatalog();
  } catch (error) {
    setCopyFeedback(`Não foi possível carregar os editais de origem: ${error?.message || error}`, "error");
  } finally {
    state.loadingCatalog = false;
  }
}

function removeCurrentRows() {
  let guard = 0;
  while (guard < 500) {
    const button = document.querySelector("#cronogramaRows .cronograma-remove");
    if (!button) break;
    button.click();
    guard += 1;
  }
}

function setInput(input, value) {
  if (!input) return;
  input.value = value || "";
  input.dispatchEvent(new Event("input", { bubbles:true }));
  input.dispatchEvent(new Event("change", { bubbles:true }));
}

function importRowsThroughEditor(rows) {
  removeCurrentRows();
  const add = $("cronogramaAddRow");
  if (!add) throw new Error("Editor de cronograma indisponível.");

  rows.forEach(row => {
    add.click();
    const tr = document.querySelector("#cronogramaRows tr:last-child");
    setInput(tr?.querySelector('[data-field="atividade"]'), row.atividade);
    setInput(tr?.querySelector('[data-field="data_inicio"]'), row.data_inicio);
    setInput(tr?.querySelector('[data-field="data_fim"]'), row.data_fim || row.data_inicio);
  });
}

async function copySelectedCronograma() {
  if (state.copying) return;
  const sourceId = txt($("cronogramaCopySource")?.value);
  if (!sourceId) return;

  const source = state.catalog.find(item => String(item.id) === sourceId);
  if (!window.confirm(`Substituir o cronograma atual pelas etapas de ${source?.edital || "outro edital"}?`)) return;

  const button = $("cronogramaCopyApply");
  try {
    state.copying = true;
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Copiando...'; }
    const sb = await ensureSession();
    const { data, error } = await sb.rpc(RPC_GET, { p_monitoramento_id:sourceId });
    if (error) throw error;
    const rows = Array.isArray(data?.etapas) ? data.etapas : [];
    if (!rows.length) throw new Error("O edital selecionado não possui etapas cadastradas.");

    importRowsThroughEditor(rows);
    if ($("mCronogramaAutomatico")) {
      $("mCronogramaAutomatico").checked = true;
      $("mCronogramaAutomatico").dispatchEvent(new Event("change", { bubbles:true }));
    }
    if ($("mCronogramaMotivo") && !txt($("mCronogramaMotivo").value)) {
      $("mCronogramaMotivo").value = `Cronograma copiado do edital ${source?.edital || "selecionado"} — ${source?.unidade || ""}`.trim();
      $("mCronogramaMotivo").dispatchEvent(new Event("input", { bubbles:true }));
    }
    setCopyFeedback(`${rows.length} etapas copiadas. Revise as datas e salve o edital de destino.`, "success");
  } catch (error) {
    setCopyFeedback(`Erro ao copiar cronograma: ${error?.message || error}`, "error");
  } finally {
    state.copying = false;
    if (button) { button.disabled = !txt($("cronogramaCopySource")?.value); button.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar etapas'; }
  }
}

function interceptTimelineClick(event) {
  const button = event.target?.closest?.(".nucleo-view-timeline");
  if (!button) return;
  const row = button.closest("tr");
  const id = row?.dataset?.monitoramentoId;
  if (!id) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void openTimeline(id);
}

function handleCronogramaLoaded(event) {
  state.currentId = txt(event.detail?.id || $("mId")?.value);
  ensureCopyUi();
  setCopyFeedback("", "info");
  void loadCopyCatalog();
}

export function initNucleoCronogramaTools() {
  if (state.initialized) return;
  state.initialized = true;
  ensureTimelineModal();
  document.addEventListener("click", interceptTimelineClick, true);
  document.addEventListener("agsus:nucleo-cronograma-loaded", handleCronogramaLoaded);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $("nucleoTimelineModal")?.classList.contains("show")) closeTimeline();
  });
}
