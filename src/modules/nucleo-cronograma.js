import { SUPABASE_AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL } from "../lib/env.js";
import { createSafeAuthStorage } from "./auth-storage.js";

const RPC_GET = "get_monitoramento_cronograma";
const RPC_SAVE = "salvar_monitoramento_com_cronograma";
const BUCKET = "cronogramas-editais";

const state = {
  initialized: false,
  client: null,
  rows: [],
  pdfFile: null,
  pdfPath: "",
  pdfName: "",
  loading: false
};

const $ = id => document.getElementById(id);
const txt = value => String(value ?? "").trim();
const escMap = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" };
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => escMap[char]);

function createClient() {
  if (state.client) return state.client;
  if (!window.supabase?.createClient || !SUPABASE_URL || !SUPABASE_KEY) return null;
  state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      storage: createSafeAuthStorage(SUPABASE_AUTH_STORAGE_KEY),
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  return state.client;
}

function ensureSession(client) {
  return client.auth.getSession().then(({ data, error }) => {
    if (error || !data?.session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
    return data.session;
  });
}

function modalSectionHTML() {
  return `
    <section id="cronogramaEditor" class="cronograma-editor full">
      <div class="cronograma-heading">
        <div>
          <span class="cronograma-eyebrow">Automação de acompanhamento</span>
          <h4>Cronograma do edital</h4>
          <p>Status e etapa serão calculados automaticamente pelas datas cadastradas.</p>
        </div>
        <label class="cronograma-auto-toggle">
          <input id="mCronogramaAutomatico" type="checkbox" checked>
          <span>Automático</span>
        </label>
      </div>

      <div class="cronograma-status-preview" id="cronogramaPreview">
        <div><span>Status calculado</span><strong id="cronogramaStatusPreview">Cronograma pendente</strong></div>
        <div><span>Etapa calculada</span><strong id="cronogramaEtapaPreview">Cronograma pendente</strong></div>
        <div><span>Próxima atividade</span><strong id="cronogramaProximaPreview">-</strong></div>
        <div><span>Progresso</span><strong id="cronogramaPercentualPreview">0%</strong></div>
      </div>

      <div class="cronograma-source-grid">
        <div class="cronograma-upload-box">
          <label for="cronogramaPdfInput"><i class="fa-solid fa-file-pdf"></i> PDF do cronograma</label>
          <input id="cronogramaPdfInput" type="file" accept="application/pdf">
          <p id="cronogramaPdfStatus">Nenhum PDF selecionado.</p>
          <small>PDFs com texto podem ser lidos automaticamente. PDFs digitalizados serão anexados e revisados manualmente.</small>
        </div>
        <div class="cronograma-actions-box">
          <button id="cronogramaAddRow" type="button" class="btn secondary"><i class="fa-solid fa-plus"></i> Adicionar etapa</button>
          <button id="cronogramaExample" type="button" class="btn secondary"><i class="fa-solid fa-list-check"></i> Usar modelo padrão</button>
          <button id="cronogramaClear" type="button" class="btn outline"><i class="fa-solid fa-trash"></i> Limpar cronograma</button>
        </div>
      </div>

      <div class="cronograma-table-wrap">
        <table class="cronograma-table">
          <thead><tr><th>#</th><th>Atividade</th><th>Início</th><th>Fim</th><th>Origem</th><th></th></tr></thead>
          <tbody id="cronogramaRows"></tbody>
        </table>
      </div>

      <div class="cronograma-overrides">
        <div class="form-row"><label>Status manual excepcional</label><select id="mStatusOverride"><option value="">Sem substituição</option><option>Suspenso</option><option>Cancelado</option><option>Paralisado</option></select></div>
        <div class="form-row"><label>Etapa manual excepcional</label><input id="mEtapaOverride" placeholder="Use somente quando o cronograma não refletir a situação real"></div>
      </div>
    </section>
  `;
}

function ensureEditor() {
  const formGrid = document.querySelector("#editModal .modal-body .form-grid");
  if (!formGrid || $("cronogramaEditor")) return;
  const observationsHeading = [...formGrid.querySelectorAll(".subsection")].find(el => el.textContent.includes("Observações"));
  if (observationsHeading) observationsHeading.insertAdjacentHTML("beforebegin", modalSectionHTML());
  else formGrid.insertAdjacentHTML("beforeend", modalSectionHTML());

  $("cronogramaAddRow")?.addEventListener("click", () => addRow());
  $("cronogramaExample")?.addEventListener("click", loadDefaultTemplate);
  $("cronogramaClear")?.addEventListener("click", () => {
    if (!state.rows.length || window.confirm("Remover todas as etapas do cronograma?")) {
      state.rows = [];
      renderRows();
    }
  });
  $("cronogramaPdfInput")?.addEventListener("change", onPdfSelected);
  $("mCronogramaAutomatico")?.addEventListener("change", updatePreview);
}

function rowTemplate(data = {}) {
  return {
    ordem: Number(data.ordem || state.rows.length + 1),
    atividade: txt(data.atividade),
    data_inicio: txt(data.data_inicio),
    data_fim: txt(data.data_fim || data.data_inicio),
    origem: txt(data.origem || "MANUAL").toUpperCase(),
    observacao: txt(data.observacao),
    confianca_extracao: data.confianca_extracao ?? null
  };
}

function addRow(data = {}) {
  state.rows.push(rowTemplate(data));
  normalizeOrder();
  renderRows();
}

function normalizeOrder() {
  state.rows.forEach((row, index) => row.ordem = index + 1);
}

function renderRows() {
  const body = $("cronogramaRows");
  if (!body) return;
  body.innerHTML = state.rows.length ? state.rows.map((row, index) => `
    <tr data-cronograma-index="${index}">
      <td><strong>${index + 1}</strong></td>
      <td><input data-field="atividade" value="${esc(row.atividade)}" placeholder="Nome da atividade"></td>
      <td><input data-field="data_inicio" type="date" value="${esc(row.data_inicio)}"></td>
      <td><input data-field="data_fim" type="date" value="${esc(row.data_fim)}"></td>
      <td><span class="cronograma-origin">${esc(row.origem)}</span></td>
      <td><button type="button" class="cronograma-remove" title="Remover"><i class="fa-solid fa-xmark"></i></button></td>
    </tr>
  `).join("") : `<tr><td colspan="6" class="cronograma-empty">Nenhuma etapa cadastrada.</td></tr>`;

  body.querySelectorAll("input[data-field]").forEach(input => input.addEventListener("input", event => {
    const tr = event.target.closest("tr");
    const index = Number(tr?.dataset.cronogramaIndex);
    if (!Number.isInteger(index) || !state.rows[index]) return;
    state.rows[index][event.target.dataset.field] = event.target.value;
    if (event.target.dataset.field === "data_inicio" && !state.rows[index].data_fim) state.rows[index].data_fim = event.target.value;
    updatePreview();
  }));
  body.querySelectorAll(".cronograma-remove").forEach(button => button.addEventListener("click", event => {
    const index = Number(event.currentTarget.closest("tr")?.dataset.cronogramaIndex);
    state.rows.splice(index, 1);
    normalizeOrder();
    renderRows();
  }));
  updatePreview();
}

function dateLocal(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateState(reference = new Date()) {
  const rows = state.rows
    .filter(row => row.atividade && row.data_inicio && row.data_fim)
    .slice()
    .sort((a, b) => String(a.data_inicio).localeCompare(String(b.data_inicio)) || a.ordem - b.ordem);
  if (!rows.length || !$("mCronogramaAutomatico")?.checked) {
    return { status: "Cronograma pendente", etapa: "Cronograma pendente", next: "-", percent: 0 };
  }
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const firstDate = dateLocal(first.data_inicio);
  const lastDate = dateLocal(last.data_fim);
  const current = rows.find(row => {
    const start = dateLocal(row.data_inicio), end = dateLocal(row.data_fim);
    return start && end && today >= start && today <= end;
  });
  const next = rows.find(row => dateLocal(row.data_inicio) > today);
  const completed = rows.filter(row => dateLocal(row.data_fim) < today).length;
  let status = "Em andamento";
  let etapa = current?.atividade || (next ? `Aguardando: ${next.atividade}` : last.atividade);
  if (today < firstDate) { status = "Planejado"; etapa = `Aguardando: ${first.atividade}`; }
  if (today > lastDate) { status = "Concluído"; etapa = last.atividade; }
  const overrideStatus = txt($("mStatusOverride")?.value);
  const overrideEtapa = txt($("mEtapaOverride")?.value);
  return {
    status: overrideStatus || status,
    etapa: overrideEtapa || etapa,
    next: next ? `${next.atividade} - ${next.data_inicio.split("-").reverse().join("/")}` : "Sem próxima atividade",
    percent: today > lastDate ? 100 : Math.round((completed / rows.length) * 100)
  };
}

function updatePreview() {
  const preview = calculateState();
  if ($("cronogramaStatusPreview")) $("cronogramaStatusPreview").textContent = preview.status;
  if ($("cronogramaEtapaPreview")) $("cronogramaEtapaPreview").textContent = preview.etapa;
  if ($("cronogramaProximaPreview")) $("cronogramaProximaPreview").textContent = preview.next;
  if ($("cronogramaPercentualPreview")) $("cronogramaPercentualPreview").textContent = `${preview.percent}%`;
  if ($("mCronogramaAutomatico")?.checked) {
    if ($("mStatus")) { $("mStatus").value = preview.status; $("mStatus").readOnly = true; }
    if ($("mEtapa")) { $("mEtapa").value = preview.etapa; $("mEtapa").readOnly = true; }
  } else {
    if ($("mStatus")) $("mStatus").readOnly = false;
    if ($("mEtapa")) $("mEtapa").readOnly = false;
  }
}

function loadDefaultTemplate() {
  if (state.rows.length && !window.confirm("Substituir o cronograma atual pelo modelo padrão?")) return;
  const activities = [
    "Publicação do Edital",
    "Impugnação do Edital",
    "Período de inscrição e envio dos documentos comprobatórios",
    "Resultado Preliminar da Avaliação Documental e de Títulos",
    "Prazo de recurso do resultado preliminar documental",
    "Resultado Final da Avaliação Documental e de Títulos",
    "Convocação para Entrevista",
    "Período de Entrevistas",
    "Resultado Preliminar das Entrevistas",
    "Prazo para recursos das entrevistas",
    "Resultado final da Entrevista",
    "Resultado final do Processo Seletivo"
  ];
  state.rows = activities.map((atividade, index) => rowTemplate({ ordem:index + 1, atividade, origem:"MANUAL" }));
  renderRows();
}

async function onPdfSelected(event) {
  const file = event.target.files?.[0] || null;
  state.pdfFile = file;
  const status = $("cronogramaPdfStatus");
  if (!file) {
    if (status) status.textContent = state.pdfName ? `PDF atual: ${state.pdfName}` : "Nenhum PDF selecionado.";
    return;
  }
  if (file.type !== "application/pdf") {
    event.target.value = "";
    state.pdfFile = null;
    if (status) status.textContent = "Selecione um arquivo PDF válido.";
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    event.target.value = "";
    state.pdfFile = null;
    if (status) status.textContent = "O PDF deve ter no máximo 15 MB.";
    return;
  }
  if (status) status.textContent = `${file.name} selecionado. O arquivo será enviado ao salvar.`;
}

async function loadCronograma(id) {
  state.rows = [];
  state.pdfFile = null;
  state.pdfPath = "";
  state.pdfName = "";
  if (!id) {
    if ($("mCronogramaAutomatico")) $("mCronogramaAutomatico").checked = true;
    if ($("mStatusOverride")) $("mStatusOverride").value = "";
    if ($("mEtapaOverride")) $("mEtapaOverride").value = "";
    renderRows();
    return;
  }
  const client = createClient();
  await ensureSession(client);
  const { data, error } = await client.rpc(RPC_GET, { p_monitoramento_id: id });
  if (error) throw error;
  const monitor = data?.monitoramento || {};
  state.rows = Array.isArray(data?.etapas) ? data.etapas.map(rowTemplate) : [];
  state.pdfPath = txt(monitor.cronograma_pdf_path);
  state.pdfName = txt(monitor.cronograma_pdf_nome);
  if ($("mCronogramaAutomatico")) $("mCronogramaAutomatico").checked = monitor.cronograma_automatico !== false;
  if ($("mStatusOverride")) $("mStatusOverride").value = txt(monitor.status_override);
  if ($("mEtapaOverride")) $("mEtapaOverride").value = txt(monitor.etapa_override);
  if ($("cronogramaPdfStatus")) $("cronogramaPdfStatus").textContent = state.pdfName ? `PDF atual: ${state.pdfName}` : "Nenhum PDF anexado.";
  renderRows();
}

async function uploadPdf(client) {
  if (!state.pdfFile) return { path: state.pdfPath, name: state.pdfName };
  const edital = txt($("mEdital")?.value).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "edital";
  const path = `${new Date().getFullYear()}/${edital}/${crypto.randomUUID()}-${state.pdfFile.name.replace(/[^a-z0-9_.-]+/gi, "-")}`;
  const { error } = await client.storage.from(BUCKET).upload(path, state.pdfFile, { contentType:"application/pdf", upsert:false });
  if (error) throw error;
  return { path, name: state.pdfFile.name };
}

function collectPayload() {
  const unitSelect = $("mUnidade");
  const option = unitSelect?.options?.[unitSelect.selectedIndex];
  const automatic = Boolean($("mCronogramaAutomatico")?.checked);
  const preview = calculateState();
  return {
    id: txt($("mId")?.value) || null,
    processo: txt($("mProcesso")?.value),
    edital: txt($("mEdital")?.value),
    id_unidade: txt($("mIdUnidade")?.value) || option?.dataset?.id || null,
    sigla_unidade: txt($("mSiglaUnidade")?.value) || option?.dataset?.sigla || null,
    tipo_unidade: txt($("mTipoUnidade")?.value) || option?.dataset?.tipo || null,
    unidade: option?.dataset?.nome || option?.textContent?.split(" — ")[0]?.trim() || "",
    uf: txt($("mUf")?.value),
    ciclo: txt($("mCiclo")?.value),
    vagas_total: Number($("mVagas")?.value || 0),
    data_inicio: txt($("mDataInicio")?.value) || null,
    data_fim: txt($("mDataFim")?.value) || null,
    status: automatic ? preview.status : txt($("mStatus")?.value),
    etapa: automatic ? preview.etapa : txt($("mEtapa")?.value),
    risco: txt($("mRisco")?.value) || "Baixo",
    responsavel: txt($("mResponsavel")?.value),
    link_edital: txt($("mLink")?.value),
    observacoes: txt($("mObs")?.value),
    observacoes_internas: txt($("mObsInternas")?.value),
    cronograma_automatico: automatic,
    cronograma_origem: state.pdfFile || state.pdfPath ? "PDF" : (state.rows.length ? "MANUAL" : null),
    cronograma_pdf_path: state.pdfPath || null,
    cronograma_pdf_nome: state.pdfName || null,
    status_override: txt($("mStatusOverride")?.value) || null,
    etapa_override: txt($("mEtapaOverride")?.value) || null
  };
}

function validateRows(payload) {
  if (!payload.edital || !payload.unidade) throw new Error("Informe pelo menos edital e unidade.");
  if (payload.cronograma_automatico && !state.rows.length) throw new Error("Adicione pelo menos uma etapa ou desative o cálculo automático.");
  state.rows.forEach((row, index) => {
    if (!row.atividade || !row.data_inicio || !row.data_fim) throw new Error(`Preencha atividade, início e fim na etapa ${index + 1}.`);
    if (row.data_fim < row.data_inicio) throw new Error(`A data final da etapa ${index + 1} é anterior à inicial.`);
  });
}

async function governedSave() {
  if (state.loading) return false;
  const client = createClient();
  if (!client) return window.alert("Supabase indisponível.");
  try {
    state.loading = true;
    await ensureSession(client);
    const payload = collectPayload();
    validateRows(payload);
    const uploaded = await uploadPdf(client);
    payload.cronograma_pdf_path = uploaded.path || null;
    payload.cronograma_pdf_nome = uploaded.name || null;
    const cronograma = state.rows.map((row, index) => ({ ...row, ordem:index + 1 }));
    const button = $("saveEditalBtn");
    if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando cronograma...'; }
    const { data, error } = await client.rpc(RPC_SAVE, { p_payload:payload, p_cronograma:cronograma });
    if (error) throw error;
    if (!data?.ok) throw new Error("O Supabase não confirmou o salvamento.");
    window.closeEditModal?.();
    await window.refreshData?.();
    window.navigate?.("nucleo");
    window.alert(`${payload.edital} salvo. Status e etapa serão calculados automaticamente pelo cronograma.`);
    return true;
  } catch (error) {
    window.alert(`Erro ao salvar edital: ${error?.message || error}`);
    return false;
  } finally {
    state.loading = false;
    const button = $("saveEditalBtn");
    if (button) { button.disabled = false; button.innerHTML = "Salvar"; }
  }
}

function installOpenWrapper() {
  const original = window.openEditModal;
  if (typeof original !== "function" || original.__cronogramaWrapped) return;
  const wrapped = (...args) => {
    const result = original(...args);
    ensureEditor();
    const id = txt(args[0] || $("mId")?.value);
    loadCronograma(id).catch(error => {
      console.error("Erro ao carregar cronograma:", error);
      if ($("cronogramaPdfStatus")) $("cronogramaPdfStatus").textContent = `Erro ao carregar cronograma: ${error?.message || error}`;
    });
    return result;
  };
  wrapped.__cronogramaWrapped = true;
  window.openEditModal = wrapped;
}

function installSaveWrapper() {
  const original = window.saveEdital;
  if (typeof original !== "function" || original.__cronogramaWrapped) return;
  const wrapped = async (...args) => {
    if (!$("cronogramaEditor")) return original(...args);
    return governedSave();
  };
  wrapped.__cronogramaWrapped = true;
  wrapped.__fallback = original;
  window.saveEdital = wrapped;
}

export function initNucleoCronograma() {
  if (state.initialized) return;
  state.initialized = true;
  installOpenWrapper();
  installSaveWrapper();
  document.addEventListener("input", event => {
    if (event.target?.id === "mStatusOverride" || event.target?.id === "mEtapaOverride") updatePreview();
  });
  document.addEventListener("change", event => {
    if (event.target?.id === "mStatusOverride" || event.target?.id === "mEtapaOverride") updatePreview();
  });
}
