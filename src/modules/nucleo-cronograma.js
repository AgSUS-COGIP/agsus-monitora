import { exigirSessao } from "../lib/sessao.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";

const RPC_GET = "get_monitoramento_cronograma";
const RPC_SAVE = "salvar_monitoramento_com_cronograma_v2";

const state = {
  initialized: false,
  client: null,
  rows: [],
  history: [],
  loading: false,
};

const $ = (id) => document.getElementById(id);
const txt = (value) => String(value ?? "").trim();
const escMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => escMap[char]);

function createClient() {
  if (state.client) return state.client;
  state.client = getSupabaseClient();
  return state.client;
}

async function ensureSession(client) {
  if (!client) throw new Error("Supabase indisponível.");
  return exigirSessao(client);
}

function modalSectionHTML() {
  return `
    <section id="cronogramaEditor" class="cronograma-editor full">
      <div class="cronograma-heading">
        <div>
          <span class="cronograma-eyebrow">Automação de acompanhamento</span>
          <h4>Cronograma do edital</h4>
          <p>Cadastre as etapas manualmente ou use o modelo padrão. Status e etapa serão calculados pelas datas salvas.</p>
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

      <div class="cronograma-actions-box cronograma-manual-actions">
        <button id="cronogramaAddRow" type="button" class="btn secondary"><i class="fa-solid fa-plus"></i> Adicionar etapa</button>
        <button id="cronogramaExample" type="button" class="btn secondary"><i class="fa-solid fa-list-check"></i> Usar modelo padrão</button>
        <button id="cronogramaClear" type="button" class="btn outline"><i class="fa-solid fa-trash"></i> Limpar cronograma</button>
      </div>

      <div id="cronogramaValidation" class="cronograma-validation" hidden></div>

      <div class="cronograma-table-wrap">
        <table class="cronograma-table">
          <thead><tr><th>#</th><th>Atividade</th><th>Início</th><th>Fim</th><th>Origem</th><th></th></tr></thead>
          <tbody id="cronogramaRows"></tbody>
        </table>
      </div>

      <div class="cronograma-overrides">
        <div class="form-row"><label>Status manual excepcional</label><select id="mStatusOverride"><option value="">Sem substituição</option><option>Suspenso</option><option>Cancelado</option><option>Paralisado</option></select></div>
        <div class="form-row"><label>Etapa manual excepcional</label><input id="mEtapaOverride" placeholder="Use somente quando o cronograma não refletir a situação real"></div>
        <div class="form-row cronograma-override-detail" hidden><label>Motivo do status excepcional *</label><input id="mStatusOverrideMotivo" maxlength="500" placeholder="Informe o ato ou motivo da decisão"></div>
        <div class="form-row cronograma-override-detail" hidden><label>Data da decisão *</label><input id="mStatusOverrideData" type="date"></div>
        <div class="form-row cronograma-override-detail" hidden><label>Previsão de retomada</label><input id="mStatusOverrideRetomada" type="date"></div>
      </div>

      <section class="cronograma-governance">
        <div class="cronograma-governance-heading">
          <div><span>Governança</span><strong>Registro da alteração</strong></div>
          <small>O motivo será armazenado no histórico do edital.</small>
        </div>
        <div class="cronograma-governance-grid">
          <div class="form-row"><label>Motivo da alteração *</label><textarea id="mCronogramaMotivo" rows="2" maxlength="500" placeholder="Ex.: cadastro inicial, ajuste de datas ou atualização conforme publicação"></textarea></div>
          <div class="form-row"><label>Número da errata</label><input id="mCronogramaErrata" maxlength="100" placeholder="Ex.: Errata nº 02/2026"></div>
        </div>
      </section>

      <section class="cronograma-history-section">
        <div class="cronograma-history-heading"><div><span>Auditoria</span><strong>Histórico do cronograma</strong></div><span id="cronogramaHistoryCount">0 registros</span></div>
        <div id="cronogramaHistory" class="cronograma-history-list"><div class="cronograma-history-empty">O histórico aparecerá após o primeiro salvamento.</div></div>
      </section>
    </section>
  `;
}

function ensureEditor() {
  const formGrid = document.querySelector("#editModal .modal-body .form-grid");
  if (!formGrid || $("cronogramaEditor")) return;
  const observationsHeading = [
    ...formGrid.querySelectorAll(".subsection"),
  ].find((el) => el.textContent.includes("Observações"));
  if (observationsHeading)
    observationsHeading.insertAdjacentHTML("beforebegin", modalSectionHTML());
  else formGrid.insertAdjacentHTML("beforeend", modalSectionHTML());

  $("cronogramaAddRow")?.addEventListener("click", () => addRow());
  $("cronogramaExample")?.addEventListener("click", loadDefaultTemplate);
  $("cronogramaClear")?.addEventListener("click", () => {
    if (
      !state.rows.length ||
      window.confirm("Remover todas as etapas do cronograma?")
    ) {
      state.rows = [];
      renderRows();
    }
  });
  $("mCronogramaAutomatico")?.addEventListener("change", updatePreview);
  $("mStatusOverride")?.addEventListener("change", () => {
    syncOverrideFields();
    updatePreview();
  });
}

function rowTemplate(data = {}) {
  return {
    ordem: Number(data.ordem || state.rows.length + 1),
    atividade: txt(data.atividade),
    data_inicio: txt(data.data_inicio),
    data_fim: txt(data.data_fim || data.data_inicio),
    origem: txt(data.origem || "MANUAL").toUpperCase(),
    observacao: txt(data.observacao),
    concluida: data.concluida ?? null,
    confianca_extracao: data.confianca_extracao ?? null,
  };
}

function addRow(data = {}) {
  state.rows.push(rowTemplate(data));
  normalizeOrder();
  renderRows();
}

function normalizeOrder() {
  state.rows.forEach((row, index) => (row.ordem = index + 1));
}

function renderRows() {
  const body = $("cronogramaRows");
  if (!body) return;
  body.innerHTML = state.rows.length
    ? state.rows
        .map(
          (row, index) => `
    <tr data-cronograma-index="${index}">
      <td><strong>${index + 1}</strong></td>
      <td><input data-field="atividade" value="${esc(row.atividade)}" placeholder="Nome da atividade"></td>
      <td><input data-field="data_inicio" type="date" value="${esc(row.data_inicio)}"></td>
      <td><input data-field="data_fim" type="date" value="${esc(row.data_fim)}"></td>
      <td><span class="cronograma-origin">${esc(row.origem)}</span></td>
      <td><button type="button" class="cronograma-remove" title="Remover"><i class="fa-solid fa-xmark"></i></button></td>
    </tr>
  `,
        )
        .join("")
    : `<tr><td colspan="6" class="cronograma-empty">Nenhuma etapa cadastrada.</td></tr>`;

  body.querySelectorAll("input[data-field]").forEach((input) =>
    input.addEventListener("input", (event) => {
      const index = Number(event.target.closest("tr")?.dataset.cronogramaIndex);
      if (!Number.isInteger(index) || !state.rows[index]) return;
      state.rows[index][event.target.dataset.field] = event.target.value;
      if (
        event.target.dataset.field === "data_inicio" &&
        !state.rows[index].data_fim
      )
        state.rows[index].data_fim = event.target.value;
      updatePreview();
      renderValidation(false);
    }),
  );
  body.querySelectorAll(".cronograma-remove").forEach((button) =>
    button.addEventListener("click", (event) => {
      const index = Number(
        event.currentTarget.closest("tr")?.dataset.cronogramaIndex,
      );
      state.rows.splice(index, 1);
      normalizeOrder();
      renderRows();
    }),
  );
  updatePreview();
  renderValidation(false);
}

function dateLocal(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateState(reference = new Date()) {
  const rows = state.rows
    .filter((row) => row.atividade && row.data_inicio && row.data_fim)
    .slice()
    .sort(
      (a, b) =>
        String(a.data_inicio).localeCompare(String(b.data_inicio)) ||
        a.ordem - b.ordem,
    );
  if (!rows.length || !$("mCronogramaAutomatico")?.checked)
    return {
      status: "Cronograma pendente",
      etapa: "Cronograma pendente",
      next: "-",
      percent: 0,
    };
  const today = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    12,
  );
  const first = rows[0],
    last = rows[rows.length - 1];
  const firstDate = dateLocal(first.data_inicio),
    lastDate = dateLocal(last.data_fim);
  const current = rows.find(
    (row) =>
      today >= dateLocal(row.data_inicio) && today <= dateLocal(row.data_fim),
  );
  const next = rows.find((row) => dateLocal(row.data_inicio) > today);
  const completed = rows.filter(
    (row) => dateLocal(row.data_fim) < today,
  ).length;
  let status = "Em andamento";
  let etapa =
    current?.atividade ||
    (next ? `Aguardando: ${next.atividade}` : last.atividade);
  if (today < firstDate) {
    status = "Planejado";
    etapa = `Aguardando: ${first.atividade}`;
  }
  if (today > lastDate) {
    status = "Concluído";
    etapa = last.atividade;
  }
  const overrideStatus = txt($("mStatusOverride")?.value);
  const overrideEtapa = txt($("mEtapaOverride")?.value);
  return {
    status: overrideStatus || status,
    etapa: overrideEtapa || etapa,
    next: next
      ? `${next.atividade} — ${next.data_inicio.split("-").reverse().join("/")}`
      : "Sem próxima atividade",
    percent:
      today > lastDate ? 100 : Math.round((completed / rows.length) * 100),
  };
}

function updatePreview() {
  const preview = calculateState();
  if ($("cronogramaStatusPreview"))
    $("cronogramaStatusPreview").textContent = preview.status;
  if ($("cronogramaEtapaPreview"))
    $("cronogramaEtapaPreview").textContent = preview.etapa;
  if ($("cronogramaProximaPreview"))
    $("cronogramaProximaPreview").textContent = preview.next;
  if ($("cronogramaPercentualPreview"))
    $("cronogramaPercentualPreview").textContent = `${preview.percent}%`;
  if ($("mCronogramaAutomatico")?.checked) {
    if ($("mStatus")) {
      $("mStatus").value = preview.status;
      $("mStatus").readOnly = true;
    }
    if ($("mEtapa")) {
      $("mEtapa").value = preview.etapa;
      $("mEtapa").readOnly = true;
    }
  } else {
    if ($("mStatus")) $("mStatus").readOnly = false;
    if ($("mEtapa")) $("mEtapa").readOnly = false;
  }
}

function loadDefaultTemplate() {
  if (
    state.rows.length &&
    !window.confirm("Substituir o cronograma atual pelo modelo padrão?")
  )
    return;
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
    "Resultado final do Processo Seletivo",
  ];
  state.rows = activities.map((atividade, index) =>
    rowTemplate({ ordem: index + 1, atividade, origem: "MANUAL" }),
  );
  renderRows();
}

function syncOverrideFields() {
  const active = Boolean(txt($("mStatusOverride")?.value));
  document
    .querySelectorAll("#cronogramaEditor .cronograma-override-detail")
    .forEach((el) => (el.hidden = !active));
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
    sigla_unidade:
      txt($("mSiglaUnidade")?.value) || option?.dataset?.sigla || null,
    tipo_unidade:
      txt($("mTipoUnidade")?.value) || option?.dataset?.tipo || null,
    unidade:
      option?.dataset?.nome ||
      option?.textContent?.split(" — ")[0]?.trim() ||
      "",
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
    cronograma_origem: state.rows.length ? "MANUAL" : null,
    status_override: txt($("mStatusOverride")?.value) || null,
    etapa_override: txt($("mEtapaOverride")?.value) || null,
    status_override_motivo: txt($("mStatusOverrideMotivo")?.value) || null,
    status_override_data: txt($("mStatusOverrideData")?.value) || null,
    status_override_previsao_retomada:
      txt($("mStatusOverrideRetomada")?.value) || null,
  };
}

function analyzeRows(payload) {
  const errors = [],
    warnings = [];
  if (!payload.edital || !payload.unidade)
    errors.push("Informe pelo menos edital e unidade.");
  if (payload.cronograma_automatico && !state.rows.length)
    errors.push(
      "Adicione pelo menos uma etapa ou desative o cálculo automático.",
    );
  const seen = new Set();
  const editalYear = Number((payload.edital.match(/\b(20\d{2})\b/) || [])[1]);
  state.rows.forEach((row, index) => {
    const label = `Etapa ${index + 1}`;
    if (!row.atividade || !row.data_inicio || !row.data_fim)
      errors.push(`${label}: preencha atividade, início e fim.`);
    if (row.data_inicio && row.data_fim && row.data_fim < row.data_inicio)
      errors.push(`${label}: a data final é anterior à inicial.`);
    const key = txt(row.atividade).toLowerCase();
    if (key && seen.has(key)) errors.push(`${label}: atividade duplicada.`);
    seen.add(key);
    if (
      editalYear &&
      row.data_inicio &&
      Number(row.data_inicio.slice(0, 4)) !== editalYear
    )
      warnings.push(`${label}: data fora do ano ${editalYear}.`);
  });
  if (
    state.rows.length &&
    !state.rows.some((row) =>
      row.atividade.toLowerCase().includes("resultado final"),
    )
  )
    warnings.push("O cronograma não possui uma etapa de resultado final.");
  for (let i = 1; i < state.rows.length; i += 1) {
    const previous = state.rows[i - 1],
      current = state.rows[i];
    if (
      previous.data_inicio &&
      current.data_inicio &&
      current.data_inicio < previous.data_inicio
    )
      warnings.push(`A etapa ${i + 1} começa antes da etapa ${i}.`);
    if (
      previous.data_fim &&
      current.data_inicio &&
      current.data_inicio <= previous.data_fim
    )
      warnings.push(`As etapas ${i} e ${i + 1} possuem datas sobrepostas.`);
  }
  if (
    payload.status_override &&
    (!payload.status_override_motivo || !payload.status_override_data)
  )
    errors.push("Status excepcional exige motivo e data da decisão.");
  const reason = txt($("mCronogramaMotivo")?.value);
  if (!reason) errors.push("Informe o motivo da alteração do cronograma.");
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

function renderValidation(force = false) {
  const box = $("cronogramaValidation");
  if (!box) return { errors: [], warnings: [] };
  const analysis = analyzeRows(collectPayload());
  if (!force && !analysis.errors.length && !analysis.warnings.length) {
    box.hidden = true;
    box.innerHTML = "";
    return analysis;
  }
  box.hidden = !(analysis.errors.length || analysis.warnings.length);
  box.innerHTML = [
    analysis.errors.length
      ? `<div class="cronograma-validation-errors"><strong><i class="fa-solid fa-circle-xmark"></i> Corrija antes de salvar</strong><ul>${analysis.errors.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>`
      : "",
    analysis.warnings.length
      ? `<div class="cronograma-validation-warnings"><strong><i class="fa-solid fa-triangle-exclamation"></i> Pontos para revisão</strong><ul>${analysis.warnings.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>`
      : "",
  ].join("");
  return analysis;
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function renderHistory() {
  const container = $("cronogramaHistory");
  const count = $("cronogramaHistoryCount");
  if (!container) return;
  if (count)
    count.textContent = `${state.history.length} ${state.history.length === 1 ? "registro" : "registros"}`;
  container.innerHTML = state.history.length
    ? state.history
        .map(
          (item) => `
    <article class="cronograma-history-item">
      <div class="cronograma-history-icon"><i class="fa-solid ${item.acao === "errata" ? "fa-file-pen" : "fa-clock-rotate-left"}"></i></div>
      <div class="cronograma-history-content">
        <div><strong>${item.acao === "errata" ? esc(item.numero_errata || "Errata") : "Alteração do cronograma"}</strong><span>${formatDateTime(item.created_at)}</span></div>
        <p>${esc(item.motivo || "Sem motivo informado")}</p>
        <small>${esc(item.created_by_email || "Usuário autenticado")} · ${Number(item.total_alteracoes || 0)} alteração(ões)</small>
      </div>
    </article>`,
        )
        .join("")
    : `<div class="cronograma-history-empty">O histórico aparecerá após o primeiro salvamento.</div>`;
}

async function loadCronograma(id) {
  state.rows = [];
  state.history = [];
  if (!id) {
    if ($("mCronogramaAutomatico")) $("mCronogramaAutomatico").checked = true;
    [
      "mStatusOverride",
      "mEtapaOverride",
      "mStatusOverrideMotivo",
      "mStatusOverrideData",
      "mStatusOverrideRetomada",
      "mCronogramaMotivo",
      "mCronogramaErrata",
    ].forEach((id) => {
      if ($(id)) $(id).value = "";
    });
    renderRows();
    renderHistory();
    syncOverrideFields();
    return;
  }
  const client = createClient();
  await ensureSession(client);
  const { data, error } = await client.rpc(RPC_GET, { p_monitoramento_id: id });
  if (error) throw error;
  const monitor = data?.monitoramento || {};
  state.rows = Array.isArray(data?.etapas) ? data.etapas.map(rowTemplate) : [];
  state.history = Array.isArray(data?.historico) ? data.historico : [];
  if ($("mCronogramaAutomatico"))
    $("mCronogramaAutomatico").checked =
      monitor.cronograma_automatico !== false;
  if ($("mStatusOverride"))
    $("mStatusOverride").value = txt(monitor.status_override);
  if ($("mEtapaOverride"))
    $("mEtapaOverride").value = txt(monitor.etapa_override);
  if ($("mStatusOverrideMotivo"))
    $("mStatusOverrideMotivo").value = txt(monitor.status_override_motivo);
  if ($("mStatusOverrideData"))
    $("mStatusOverrideData").value = txt(monitor.status_override_data);
  if ($("mStatusOverrideRetomada"))
    $("mStatusOverrideRetomada").value = txt(
      monitor.status_override_previsao_retomada,
    );
  if ($("mCronogramaErrata")) $("mCronogramaErrata").value = "";
  if ($("mCronogramaMotivo")) $("mCronogramaMotivo").value = "";
  renderRows();
  renderHistory();
  syncOverrideFields();
  document.dispatchEvent(
    new CustomEvent("agsus:nucleo-cronograma-loaded", { detail: { id, data } }),
  );
}

async function governedSave() {
  if (state.loading) return false;
  const client = createClient();
  try {
    state.loading = true;
    await ensureSession(client);
    const payload = collectPayload();
    const analysis = renderValidation(true);
    if (analysis.errors.length) throw new Error(analysis.errors[0]);
    if (
      analysis.warnings.length &&
      !window.confirm(
        `Foram encontrados ${analysis.warnings.length} ponto(s) para revisão. Deseja salvar mesmo assim?`,
      )
    )
      return false;
    const cronograma = state.rows.map((row, index) => ({
      ...row,
      ordem: index + 1,
    }));
    const reason = txt($("mCronogramaMotivo")?.value);
    const errata = txt($("mCronogramaErrata")?.value) || null;
    const button = $("saveEditalBtn");
    if (button) {
      button.disabled = true;
      button.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Salvando cronograma...';
    }
    const { data, error } = await client.rpc(RPC_SAVE, {
      p_payload: payload,
      p_cronograma: cronograma,
      p_motivo: reason,
      p_numero_errata: errata,
    });
    if (error) throw error;
    if (!data?.ok) throw new Error("O Supabase não confirmou o salvamento.");
    window.closeEditModal?.();
    await window.refreshData?.();
    window.navigate?.("nucleo");
    document.dispatchEvent(
      new CustomEvent("agsus:nucleo-cronograma-saved", {
        detail: { id: data?.registro?.id, data },
      }),
    );
    window.alert(
      `${payload.edital} salvo. ${cronograma.length} etapa(s) registradas e histórico atualizado.`,
    );
    return true;
  } catch (error) {
    window.alert(`Erro ao salvar edital: ${error?.message || error}`);
    return false;
  } finally {
    state.loading = false;
    const button = $("saveEditalBtn");
    if (button) {
      button.disabled = false;
      button.innerHTML = "Salvar";
    }
  }
}

function installOpenWrapper() {
  const original = window.openEditModal;
  if (typeof original !== "function" || original.__cronogramaWrapped) return;
  const wrapped = (...args) => {
    const result = original(...args);
    ensureEditor();
    const id = txt(args[0] || $("mId")?.value);
    loadCronograma(id).catch((error) => {
      console.error("Erro ao carregar cronograma:", error);
      const box = $("cronogramaValidation");
      if (box) {
        box.hidden = false;
        box.innerHTML = `<div class="cronograma-validation-errors">Erro ao carregar cronograma: ${esc(error?.message || error)}</div>`;
      }
    });
    return result;
  };
  wrapped.__cronogramaWrapped = true;
  window.openEditModal = wrapped;
}

function installSaveWrapper() {
  const original = window.saveEdital;
  if (typeof original !== "function" || original.__cronogramaWrapped) return;
  const wrapped = async (...args) =>
    $("cronogramaEditor") ? governedSave() : original(...args);
  wrapped.__cronogramaWrapped = true;
  wrapped.__fallback = original;
  window.saveEdital = wrapped;
}

export function initNucleoCronograma() {
  if (state.initialized) return;
  state.initialized = true;
  installOpenWrapper();
  installSaveWrapper();
  document.addEventListener("input", (event) => {
    if (event.target?.closest?.("#cronogramaEditor")) {
      updatePreview();
      renderValidation(false);
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target?.id === "mStatusOverride") syncOverrideFields();
    if (event.target?.closest?.("#cronogramaEditor")) {
      updatePreview();
      renderValidation(false);
    }
  });
}
