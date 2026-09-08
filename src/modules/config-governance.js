import { getSupabaseClient } from "../lib/supabaseClient.js";
import { collectPanelRows } from "./config-ui.js";

const RPC_SNAPSHOT = "get_configuracoes_snapshot";
const RPC_SAVE_V2 = "salvar_configuracoes_e_paineis_v2";
const RPC_HISTORY = "get_configuracoes_historico";
const RPC_RESTORE = "restaurar_configuracoes_versao";

const FIELD_MAP = [
  ["cfgMonitId", "monit_id", "ID / referência da base"],
  ["cfgPageTitle", "page_title", "Título da página inicial"],
  ["cfgPageSubtitle", "page_subtitle", "Subtítulo da página inicial"],
  [
    "cfgGoogleEnabled",
    "auth_google_enabled",
    "Exibe ou oculta o login com Google",
    "true",
  ],
  [
    "cfgGoogleButtonText",
    "auth_google_button_text",
    "Texto do botão de autenticação Google",
  ],
  [
    "cfgGoogleDomainHint",
    "auth_google_domain_hint",
    "Domínio sugerido no login Google",
  ],
  ["cfgFilterTitle", "filter_title", "Título dos filtros"],
  ["cfgFilterSubtitle", "filter_subtitle", "Subtítulo dos filtros"],
  ["cfgFilterToggleShow", "filter_toggle_show", "Texto para mostrar filtros"],
  ["cfgFilterToggleHide", "filter_toggle_hide", "Texto para ocultar filtros"],
  ["cfgKpiProcessos", "kpi_processos_label", "Rótulo do KPI processos"],
  ["cfgKpiVagas", "kpi_vagas_label", "Rótulo do KPI vagas"],
  ["cfgKpiContratados", "kpi_contratados_label", "Rótulo do KPI contratações"],
  ["cfgKpiOciosas", "kpi_ociosas_label", "Rótulo do KPI vagas ociosas"],
  ["cfgKpiCriticos", "kpi_criticos_label", "Rótulo do KPI críticos"],
  ["cfgKpiInscritos", "kpi_inscritos_label", "Rótulo do KPI inscritos"],
  ["cfgFooter", "footer_text", "Texto do rodapé (fallback)"],
  ["cfgCogipNome", "cogip_nome", "Nome da equipe (COGIP)"],
  ["cfgCogipFuncao", "cogip_funcao", "Função / área da equipe"],
  ["cfgCogipVersao", "cogip_versao", "Versão do sistema"],
  ["cfgCogipDept", "cogip_dept", "Texto institucional"],
  ["cfgAppVersionCurrent", "app_version_current", "Versão corrente publicada"],
  ["cfgCogipLogo", "cogip_logo_url", "Logo da equipe"],
  ["cfgBroadcastType", "broadcast_type", "Tipo do aviso global", "info"],
  ["cfgBroadcastMsg", "broadcast_msg", "Mensagem do aviso global"],
  [
    "cfgRealtimeEnabled",
    "feature_realtime_monitoramento",
    "Habilita atualização em tempo real do monitoramento",
    "true",
  ],
  [
    "cfgAccessHeartbeatMinutos",
    "access_heartbeat_minutos",
    "Intervalo de auditoria heartbeat, em minutos",
    "5",
  ],
];

const state = {
  initialized: false,
  client: null,
  saving: false,
  history: [],
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

function friendlyError(error) {
  return txt(
    error?.message ||
      error?.details ||
      error?.hint ||
      error ||
      "Erro desconhecido",
  );
}

function createClient() {
  if (state.client) return state.client;
  state.client = getSupabaseClient();
  return state.client;
}

function isDirty() {
  const indicator = $("configWorkspaceDirtyTop");
  const saveButton = $("configStickySaveButton");
  return (
    Boolean(indicator && !indicator.hidden) ||
    Boolean(saveButton && !saveButton.disabled)
  );
}

function markClean() {
  const indicator = $("configWorkspaceDirtyTop");
  const saveButton = $("configStickySaveButton");
  const icon = $("configStickyStatusIcon");
  const title = $("configStickyStatusTitle");
  const text = $("configStickyStatusText");
  if (indicator) indicator.hidden = true;
  if (saveButton) saveButton.disabled = true;
  if (icon) {
    icon.className = "config-status-icon is-clean";
    icon.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
  }
  if (title) title.textContent = "Nenhuma alteração pendente";
  if (text) text.textContent = "As configurações carregadas estão preservadas.";
}

function setSaving(saving) {
  state.saving = Boolean(saving);
  const button = $("configStickySaveButton");
  if (!button) return;
  button.disabled = state.saving || !isDirty();
  button.innerHTML = state.saving
    ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Publicando...</span>'
    : '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span>Salvar alterações</span>';
}

function collectConfigRows() {
  return FIELD_MAP.map(([id, chave, descricao, fallback = ""]) => ({
    chave,
    valor: txt($(id)?.value ?? fallback),
    descricao,
  }));
}

function currentPanels() {
  try {
    const panelItems = [
      ...document.querySelectorAll("#panelAdmin .panel-admin-item"),
    ];
    const placeholders = panelItems.map((_, index) => ({
      id: txt($(`panelId${index}`)?.value),
    }));
    return collectPanelRows(placeholders);
  } catch (error) {
    console.warn("Não foi possível coletar painéis para publicação:", error);
    return [];
  }
}

function validateCurrentConfiguration() {
  const errors = [];
  const pageTitle = txt($("cfgPageTitle")?.value);
  if (!pageTitle) errors.push("Informe o título da página inicial.");

  const domain = txt($("cfgGoogleDomainHint")?.value);
  if (
    domain &&
    (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain) ||
      /[:/\s@]/.test(domain))
  ) {
    errors.push("O domínio Google deve estar no formato agenciasus.org.br.");
  }

  const heartbeat = Number($("cfgAccessHeartbeatMinutos")?.value);
  if (!Number.isInteger(heartbeat) || heartbeat < 1 || heartbeat > 60) {
    errors.push("O heartbeat deve estar entre 1 e 60 minutos.");
  }

  const urls = [
    $("cfgAccessLogoUrl"),
    $("cfgCogipLogo"),
    ...document.querySelectorAll('[id^="panelUrl"]'),
  ].filter(Boolean);
  urls.forEach((field) => {
    const value = txt(field.value);
    if (!value) return;
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol))
        throw new Error("protocol");
    } catch (error) {
      errors.push(
        `URL inválida no campo ${field.closest(".form-row")?.querySelector("label")?.textContent || field.id}.`,
      );
    }
  });

  document.querySelectorAll('[id^="panelAtivo"]').forEach((active) => {
    if (active.value !== "true") return;
    const index = active.id.replace("panelAtivo", "");
    if (!txt($(`panelUrl${index}`)?.value))
      errors.push("Painel ativo sem URL configurada.");
  });

  return [...new Set(errors)];
}

function snapshotMaps(snapshot) {
  const configMap = new Map(
    (snapshot?.configuracoes || []).map((item) => [item.chave, item]),
  );
  const panelMap = new Map(
    (snapshot?.paineis || []).map((item) => [String(item.id), item]),
  );
  return { configMap, panelMap };
}

function buildChanges(snapshot, configRows, panels) {
  const { configMap, panelMap } = snapshotMaps(snapshot);
  const changes = [];

  configRows.forEach((row) => {
    const previous = configMap.get(row.chave);
    if (txt(previous?.valor) === txt(row.valor)) return;
    changes.push({
      entity: "Configuração",
      label: row.descricao || row.chave,
      field: "Valor",
      before: previous?.valor ?? "",
      after: row.valor ?? "",
    });
  });

  panels.forEach((panel) => {
    const previous = panelMap.get(String(panel.id));
    if (!previous) return;
    [
      ["titulo", "Título"],
      ["url", "URL"],
      ["ativo", "Ativo"],
      ["em_manutencao", "Manutenção"],
    ].forEach(([field, label]) => {
      if (String(previous[field] ?? "") === String(panel[field] ?? "")) return;
      changes.push({
        entity: "Painel",
        label: previous.titulo || previous.codigo || panel.id,
        field: label,
        before: previous[field] ?? "",
        after: panel[field] ?? "",
      });
    });
  });

  return changes;
}

function displayValue(value) {
  if (value === true || value === "true") return "Sim";
  if (value === false || value === "false") return "Não";
  const raw = txt(value);
  return raw || "(vazio)";
}

function modalHTML() {
  return `
    <div id="configGovernanceModal" class="config-governance-modal" hidden>
      <div class="config-governance-backdrop" data-governance-close></div>
      <section class="config-governance-dialog" role="dialog" aria-modal="true" aria-labelledby="configGovernanceTitle">
        <header>
          <div>
            <span class="config-governance-eyebrow">Governança de alterações</span>
            <h2 id="configGovernanceTitle">Revisar publicação</h2>
          </div>
          <button type="button" class="config-governance-close" data-governance-close aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <div id="configGovernanceBody" class="config-governance-body"></div>
        <footer id="configGovernanceFooter" class="config-governance-footer"></footer>
      </section>
    </div>
  `;
}

function ensureGovernanceUI() {
  const root = $("page-config");
  if (!root) return;
  if (!$("configGovernanceModal"))
    document.body.insertAdjacentHTML("beforeend", modalHTML());

  const grid = root.querySelector(":scope > .admin-grid");
  if (grid && !$("configHistoryCard")) {
    grid.insertAdjacentHTML(
      "beforeend",
      `
      <div id="configHistoryCard" class="admin-card card full config-history-card" data-config-section="technical">
        <div class="config-card-title">
          <div>
            <h3>Histórico de configurações</h3>
            <p>Publicações auditadas, responsáveis e restauração de versões anteriores.</p>
          </div>
          <button id="configHistoryRefresh" class="btn secondary" type="button"><i class="fa-solid fa-rotate-right"></i> Atualizar</button>
        </div>
        <div id="configHistoryBody" class="config-history-empty">Carregando histórico...</div>
      </div>
    `,
    );
  }

  document
    .querySelectorAll("[data-governance-close]")
    .forEach((button) => button.addEventListener("click", closeModal));
  $("configHistoryRefresh")?.addEventListener("click", () => loadHistory(true));
}

function openModal(title, body, footer) {
  const modal = $("configGovernanceModal");
  if (!modal) return;
  $("configGovernanceTitle").textContent = title;
  $("configGovernanceBody").innerHTML = body;
  $("configGovernanceFooter").innerHTML = footer;
  modal.hidden = false;
  document.body.classList.add("config-governance-open");
  modal.querySelector("button, input, textarea")?.focus();
}

function closeModal() {
  const modal = $("configGovernanceModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("config-governance-open");
}

function changeRowsHTML(changes) {
  return changes
    .map(
      (change) => `
    <div class="config-change-row">
      <div class="config-change-name"><span>${esc(change.entity)}</span><strong>${esc(change.label)}</strong><small>${esc(change.field)}</small></div>
      <div class="config-change-value is-before"><span>Antes</span><code>${esc(displayValue(change.before))}</code></div>
      <i class="fa-solid fa-arrow-right config-change-arrow" aria-hidden="true"></i>
      <div class="config-change-value is-after"><span>Depois</span><code>${esc(displayValue(change.after))}</code></div>
    </div>
  `,
    )
    .join("");
}

async function reviewAndPublish() {
  if (state.saving) return false;
  const validationErrors = validateCurrentConfiguration();
  if (validationErrors.length) {
    openModal(
      "Corrigir configurações",
      `<div class="config-governance-alert is-error"><strong>Não foi possível publicar.</strong><ul>${validationErrors.map((error) => `<li>${esc(error)}</li>`).join("")}</ul></div>`,
      `<button type="button" class="btn secondary" data-governance-close>Fechar</button>`,
    );
    document
      .querySelectorAll("[data-governance-close]")
      .forEach((button) => button.addEventListener("click", closeModal));
    return false;
  }

  const client = createClient();
  if (!client)
    return window.alert("Supabase indisponível para publicar configurações.");

  setSaving(true);
  try {
    const [{ data: snapshot, error: snapshotError }] = await Promise.all([
      client.rpc(RPC_SNAPSHOT),
    ]);
    if (snapshotError) throw snapshotError;

    const configRows = collectConfigRows();
    const panels = currentPanels();
    const changes = buildChanges(snapshot, configRows, panels);
    if (!changes.length) {
      markClean();
      openModal(
        "Nenhuma alteração",
        `<div class="config-governance-empty"><i class="fa-solid fa-circle-check"></i><strong>Nada para publicar.</strong><span>Os valores da tela já são iguais aos publicados.</span></div>`,
        `<button type="button" class="btn secondary" data-governance-close>Fechar</button>`,
      );
      document
        .querySelectorAll("[data-governance-close]")
        .forEach((button) => button.addEventListener("click", closeModal));
      return true;
    }

    openModal(
      "Revisar publicação",
      `<div class="config-governance-summary"><strong>${changes.length} ${changes.length === 1 ? "alteração encontrada" : "alterações encontradas"}</strong><span>Confira exatamente o que será publicado.</span></div>
       <div class="config-change-list">${changeRowsHTML(changes)}</div>
       <label class="config-reason-field"><span>Motivo da alteração <b>*</b></span><textarea id="configPublishReason" rows="3" maxlength="500" placeholder="Ex.: Atualização dos rótulos e manutenção do painel de análises"></textarea><small>Obrigatório para auditoria.</small></label>`,
      `<button type="button" class="btn secondary" data-governance-close>Cancelar</button>
       <button id="configConfirmPublish" type="button" class="btn green"><i class="fa-solid fa-cloud-arrow-up"></i> Publicar ${changes.length} alteração(ões)</button>`,
    );

    document
      .querySelectorAll("[data-governance-close]")
      .forEach((button) => button.addEventListener("click", closeModal));
    $("configConfirmPublish")?.addEventListener("click", async () => {
      const reason = txt($("configPublishReason")?.value);
      const field = $("configPublishReason");
      if (!reason) {
        field?.classList.add("config-field-invalid");
        field?.focus();
        return;
      }

      const button = $("configConfirmPublish");
      if (button) {
        button.disabled = true;
        button.innerHTML =
          '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';
      }

      try {
        const { data, error } = await client.rpc(RPC_SAVE_V2, {
          p_config_rows: configRows,
          p_paineis: panels,
          p_motivo: reason,
        });
        if (error) throw error;
        if (!data?.ok)
          throw new Error("O Supabase não confirmou a publicação.");

        markClean();
        closeModal();
        await loadHistory(true);
        window.dispatchEvent(
          new CustomEvent("agsus:config-saved", { detail: data }),
        );
        window.alert(
          `${data.total_alteracoes || changes.length} alteração(ões) publicada(s) e auditada(s). A página será recarregada para aplicar os novos valores.`,
        );
        window.location.reload();
      } catch (error) {
        if (button) {
          button.disabled = false;
          button.innerHTML =
            '<i class="fa-solid fa-cloud-arrow-up"></i> Tentar novamente';
        }
        window.alert(`Erro ao publicar configurações: ${friendlyError(error)}`);
      }
    });
    return true;
  } catch (error) {
    window.alert(`Erro ao preparar publicação: ${friendlyError(error)}`);
    return false;
  } finally {
    setSaving(false);
  }
}

function historyChangeSummary(changes) {
  const items = Array.isArray(changes) ? changes : [];
  if (!items.length) return "Sem detalhes registrados";
  const labels = items
    .slice(0, 3)
    .map((item) => item.rotulo || item.chave || item.codigo || "Alteração");
  return `${labels.join(", ")}${items.length > 3 ? ` e mais ${items.length - 3}` : ""}`;
}

function historyHTML(history) {
  if (!history.length) {
    return `<div class="config-history-empty"><i class="fa-solid fa-clock-rotate-left"></i><strong>Nenhuma publicação auditada ainda.</strong><span>O próximo salvamento aparecerá aqui.</span></div>`;
  }
  return `<div class="config-history-list">${history
    .map((item) => {
      const date = item.created_at ? new Date(item.created_at) : null;
      const dateLabel =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleString("pt-BR")
          : "Data não informada";
      const action = item.acao === "restaurar" ? "Restauração" : "Publicação";
      return `<article class="config-history-item">
      <div class="config-history-icon is-${esc(item.acao || "salvar")}"><i class="fa-solid ${item.acao === "restaurar" ? "fa-clock-rotate-left" : "fa-cloud-arrow-up"}"></i></div>
      <div class="config-history-main">
        <div class="config-history-head"><strong>${esc(action)}</strong><span>${esc(dateLabel)}</span></div>
        <p>${esc(item.motivo || "Sem motivo informado")}</p>
        <small>${esc(historyChangeSummary(item.alteracoes))}</small>
        <div class="config-history-meta"><span><i class="fa-solid fa-user"></i> ${esc(item.created_by_email || "Usuário não identificado")}</span><span>${Number(item.total_alteracoes || 0)} alteração(ões)</span></div>
      </div>
      <button type="button" class="btn secondary config-history-restore" data-version-id="${esc(item.id)}"><i class="fa-solid fa-rotate-left"></i> Restaurar</button>
    </article>`;
    })
    .join("")}</div>`;
}

async function loadHistory(force = false) {
  const body = $("configHistoryBody");
  if (!body) return false;
  if (!force && state.history.length) {
    body.innerHTML = historyHTML(state.history);
    bindRestoreButtons();
    return true;
  }

  body.className = "config-history-empty";
  body.textContent = "Carregando histórico...";
  const client = createClient();
  if (!client) {
    body.textContent = "Supabase indisponível.";
    return false;
  }

  const { data, error } = await client.rpc(RPC_HISTORY, { p_limit: 30 });
  if (error) {
    body.innerHTML = `<div class="alert error">Erro ao carregar histórico: ${esc(friendlyError(error))}</div>`;
    return false;
  }
  state.history = Array.isArray(data) ? data : [];
  body.className = "";
  body.innerHTML = historyHTML(state.history);
  bindRestoreButtons();
  return true;
}

function bindRestoreButtons() {
  document.querySelectorAll(".config-history-restore").forEach((button) => {
    button.addEventListener("click", () =>
      reviewRestore(button.dataset.versionId),
    );
  });
}

function reviewRestore(versionId) {
  const version = state.history.find(
    (item) => String(item.id) === String(versionId),
  );
  if (!version) return;
  const changes = (version.alteracoes || []).map((item) => ({
    entity: item.entidade === "painel" ? "Painel" : "Configuração",
    label: item.rotulo || item.chave || item.codigo || "Alteração",
    field: item.campo || "Valor",
    before: item.antes,
    after: item.depois,
  }));

  openModal(
    "Restaurar versão",
    `<div class="config-governance-alert is-warning"><strong>Esta ação publicará novamente os valores dessa versão.</strong><span>Uma nova entrada de auditoria será criada. Nada será apagado do histórico.</span></div>
     <div class="config-change-list">${changeRowsHTML(changes.slice(0, 20))}</div>
     ${changes.length > 20 ? `<p class="config-governance-more">Mais ${changes.length - 20} alteração(ões) fazem parte desta versão.</p>` : ""}
     <label class="config-reason-field"><span>Motivo da restauração <b>*</b></span><textarea id="configRestoreReason" rows="3" maxlength="500" placeholder="Ex.: Reverter alteração publicada incorretamente"></textarea></label>`,
    `<button type="button" class="btn secondary" data-governance-close>Cancelar</button>
     <button id="configConfirmRestore" type="button" class="btn danger"><i class="fa-solid fa-rotate-left"></i> Restaurar versão</button>`,
  );
  document
    .querySelectorAll("[data-governance-close]")
    .forEach((button) => button.addEventListener("click", closeModal));
  $("configConfirmRestore")?.addEventListener("click", async () => {
    const reason = txt($("configRestoreReason")?.value);
    if (!reason) {
      $("configRestoreReason")?.classList.add("config-field-invalid");
      $("configRestoreReason")?.focus();
      return;
    }
    const confirmed = window.confirm(
      "Confirmar restauração desta versão? Os valores atuais serão substituídos.",
    );
    if (!confirmed) return;

    const button = $("configConfirmRestore");
    if (button) {
      button.disabled = true;
      button.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Restaurando...';
    }
    const client = createClient();
    const { data, error } = await client.rpc(RPC_RESTORE, {
      p_versao_id: versionId,
      p_motivo: reason,
    });
    if (error || !data?.ok) {
      if (button) {
        button.disabled = false;
        button.innerHTML =
          '<i class="fa-solid fa-rotate-left"></i> Tentar novamente';
      }
      window.alert(`Erro ao restaurar versão: ${friendlyError(error || data)}`);
      return;
    }
    markClean();
    closeModal();
    window.alert(
      `${data.total_alteracoes || 0} alteração(ões) restaurada(s). A página será recarregada.`,
    );
    window.location.reload();
  });
}

function installSaveOverride() {
  if (
    typeof window.saveAdminSettings !== "function" ||
    window.saveAdminSettings.__governanceWrapped
  )
    return;
  const fallback = window.saveAdminSettings;
  const governed = async (...args) => {
    try {
      return await reviewAndPublish(...args);
    } catch (error) {
      console.error(
        "Falha no fluxo de governança; salvamento antigo preservado como contingência.",
        error,
      );
      return fallback(...args);
    }
  };
  governed.__governanceWrapped = true;
  governed.__fallback = fallback;
  window.saveAdminSettings = governed;
}

function installNavigationGuard() {
  if (
    typeof window.navigate !== "function" ||
    window.navigate.__configGovernanceWrapped
  )
    return;
  const originalNavigate = window.navigate;
  const guardedNavigate = (...args) => {
    const target = String(args[0] || "");
    if (isDirty() && target !== "config") {
      const confirmed = window.confirm(
        "Existem alterações não salvas em Configurações. Sair e descartar essas alterações?",
      );
      if (!confirmed) return false;
      markClean();
    }
    return originalNavigate(...args);
  };
  guardedNavigate.__configGovernanceWrapped = true;
  guardedNavigate.__original = originalNavigate;
  window.navigate = guardedNavigate;
}

export function initConfigGovernance() {
  if (state.initialized) return;
  const root = $("page-config");
  if (!root) return;
  state.initialized = true;
  ensureGovernanceUI();
  installSaveOverride();
  installNavigationGuard();
  loadHistory();
}
