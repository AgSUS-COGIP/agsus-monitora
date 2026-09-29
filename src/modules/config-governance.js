import { isValidAccessAssetUrl } from "../lib/config-validation.js";
import { comTempoLimite, mensagemDeFalha } from "../lib/falha-de-rede.js";
import { sanitizeHtml } from "../lib/sanitize.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { collectPanelRows } from "./config-ui.js";
import { anexarNaSecao } from "./config-secoes.js";
import { linhasDeConfiguracaoDaSidebar } from "./sidebar-branding.js";

/*
  Publicação das Configurações: o único dono do "salvar" da página.

  Aqui moram a barra de cabeçalho (título, indicador de alterações e resumo
  da validação), a barra fixa "Salvar alterações" (e o Ctrl+S), o controle de
  alterações não salvas, a validação, a revisão do que muda ("Revisar
  publicação") com motivo obrigatório, a publicação versionada
  (salvar_configuracoes_e_paineis_v2) e o histórico com restauração.

  Antes eram duas camadas: `config-page-enhancements.js` embrulhava o
  `saveAdminSettings` do legado e marcava a página como "suja" a cada `input`
  dentro de #page-config (filtros e selects fora dos campos de configuração
  também), e este módulo embrulhava de novo o `saveAdminSettings` e o
  `window.navigate`. Agora o botão e o Ctrl+S chamam a publicação direto, só
  os campos de configuração marcam alteração (`ehCampoDeConfiguracao`) e o
  `navigate` do legado pergunta a `confirmarSaidaDasConfiguracoes`, como já
  pergunta ao `acessosController`.
*/

const RPC_SNAPSHOT = "get_configuracoes_snapshot";
const RPC_SAVE_V2 = "salvar_configuracoes_e_paineis_v2";
const RPC_HISTORY = "get_configuracoes_historico";
const RPC_RESTORE = "restaurar_configuracoes_versao";
const TEMPO_LIMITE_MS = 30000;

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
  [
    "cfgGoogleAllowedDomains",
    "auth_google_allowed_domains",
    "Domínios institucionais autorizados",
  ],
  [
    "cfgAccessBackgroundUrl",
    "auth_access_background_url",
    "Arte institucional da tela de acesso",
  ],
  [
    "cfgAccessBackgroundPath",
    "auth_access_background_path",
    "Caminho da arte institucional da tela de acesso",
  ],
  [
    "cfgAccessLogoUrl",
    "auth_access_logo_url",
    "Logo da AgSUS na tela de acesso",
  ],
  [
    "cfgAccessPanelColor",
    "auth_access_panel_color",
    "Cor do painel da tela de acesso",
  ],
  [
    "cfgAccessTextoModo",
    "auth_access_texto_modo",
    "Texto sobre o painel de acesso",
    "auto",
  ],

  ["cfgAccessGreeting", "auth_access_greeting", "Saudação da tela de acesso"],
  [
    "cfgAccessInstruction",
    "auth_access_instruction",
    "Instrução da tela de acesso",
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
  dirty: false,
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

function createClient() {
  if (state.client) return state.client;
  state.client = getSupabaseClient();
  return state.client;
}

// ── Barra de cabeçalho e barra fixa ────────────────────────────────────────

function toolbarHTML() {
  return `
    <section id="configWorkspaceToolbar" class="config-workspace-toolbar" aria-label="Configurações">
      <div class="config-workspace-heading">
        <div>
          <span class="config-workspace-eyebrow">Administração do sistema</span>
          <h2>Configurações</h2>
          <p>Localize ajustes, revise acessos e salve alterações com validação antes de publicar.</p>
        </div>
      </div>
      <div class="config-workspace-meta">
        <span id="configWorkspaceDirtyTop" class="config-dirty-indicator" hidden><i class="fa-solid fa-circle" aria-hidden="true"></i> Alterações não salvas</span>
      </div>
      <div id="configValidationSummary" class="config-validation-summary" role="alert" hidden></div>
    </section>
  `;
}

function stickyActionsHTML() {
  return `
    <div id="configStickyActions" class="config-sticky-actions" aria-live="polite">
      <div class="config-sticky-status">
        <span id="configStickyStatusIcon" class="config-status-icon is-clean"><i class="fa-solid fa-check" aria-hidden="true"></i></span>
        <div>
          <strong id="configStickyStatusTitle">Nenhuma alteração pendente</strong>
          <span id="configStickyStatusText">As configurações carregadas estão preservadas.</span>
        </div>
      </div>
      <div class="config-sticky-buttons">
        <span class="config-shortcut-hint"><kbd>Ctrl</kbd> + <kbd>S</kbd></span>
        <button id="configStickySaveButton" type="button" class="btn green" disabled>
          <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
          <span>Salvar alterações</span>
        </button>
      </div>
    </div>
  `;
}

function ensureWorkspace(root) {
  if (!$("configWorkspaceToolbar"))
    root.insertAdjacentHTML("afterbegin", toolbarHTML());
  if (!$("configStickyActions"))
    root.insertAdjacentHTML("beforeend", stickyActionsHTML());
}

/*
  A seção Acessos tem o próprio fluxo (a matriz salva sozinha, com motivo):
  lá a barra global de Configurações não aparece nem responde ao Ctrl+S.
*/
function secaoAtual(root = $("page-config")) {
  return root?.dataset.subgrupo || "";
}

function atualizarBarraDaSecao(root = $("page-config")) {
  const barra = $("configStickyActions");
  if (barra) barra.hidden = secaoAtual(root) === "acessos";
}

/**
 * Só os campos de configuração marcam a página como alterada: os `cfg*` e
 * os do editor de painéis. Busca, matriz de acessos e solicitações não.
 */
export function ehCampoDeConfiguracao(campo) {
  if (!(
    campo instanceof HTMLInputElement ||
    campo instanceof HTMLTextAreaElement ||
    campo instanceof HTMLSelectElement
  ))
    return false;
  if (campo.closest("[data-acessos], #configWorkspaceToolbar")) return false;
  return (
    /^cfg/.test(campo.id) ||
    Boolean(campo.closest("#panelAdmin") && /^panel/.test(campo.id))
  );
}

export function configuracoesComAlteracoes() {
  return state.dirty;
}

function setDirty(dirty) {
  state.dirty = Boolean(dirty);
  const topIndicator = $("configWorkspaceDirtyTop");
  const saveButton = $("configStickySaveButton");
  const icon = $("configStickyStatusIcon");
  const title = $("configStickyStatusTitle");
  const text = $("configStickyStatusText");

  if (topIndicator) topIndicator.hidden = !state.dirty;
  if (saveButton) saveButton.disabled = !state.dirty || state.saving;
  if (icon) {
    icon.className = `config-status-icon ${state.dirty ? "is-dirty" : "is-clean"}`;
    icon.innerHTML = `<i class="fa-solid ${state.dirty ? "fa-pen" : "fa-check"}" aria-hidden="true"></i>`;
  }
  if (title)
    title.textContent = state.dirty
      ? "Existem alterações não salvas"
      : "Nenhuma alteração pendente";
  if (text)
    text.textContent = state.dirty
      ? "Revise os campos e salve antes de sair desta página."
      : "As configurações carregadas estão preservadas.";
}

const markClean = () => setDirty(false);

function setSaving(saving) {
  state.saving = Boolean(saving);
  const button = $("configStickySaveButton");
  if (button) {
    button.disabled = state.saving || !state.dirty;
    button.innerHTML = state.saving
      ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Publicando...</span>'
      : '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i><span>Salvar alterações</span>';
  }
  if (!state.saving) return setDirty(state.dirty);
  const title = $("configStickyStatusTitle");
  const text = $("configStickyStatusText");
  const icon = $("configStickyStatusIcon");
  if (title) title.textContent = "Preparando publicação";
  if (text) text.textContent = "Aguarde a resposta do servidor.";
  if (icon) {
    icon.className = "config-status-icon is-saving";
    icon.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>';
  }
}

// ── Coleta e validação ─────────────────────────────────────────────────────

/*
  As chaves da barra lateral viajam no mesmo `p_config_rows` (uma chamada,
  uma transação). A lista delas devolve `[]` quando os campos não estão no
  DOM — sem isso, um salvamento com a seção ausente gravaria os valores
  padrão por cima de uma personalização existente.
*/
function collectConfigRows() {
  const campos = FIELD_MAP.map(([id, chave, descricao, fallback = ""]) => ({
    chave,
    valor: txt($(id)?.value ?? fallback),
    descricao,
  }));
  return [...campos, ...linhasDeConfiguracaoDaSidebar()];
}

function currentPanels() {
  try {
    const panelItems = [
      ...document.querySelectorAll('#panelAdmin input[id^="panelId"]'),
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

function urlHttpValida(valor) {
  const raw = txt(valor);
  if (!raw) return true;
  try {
    return ["https:", "http:"].includes(new URL(raw).protocol);
  } catch {
    return false;
  }
}

function dominioValido(valor) {
  const raw = txt(valor);
  if (!raw) return true;
  if (/[:/\s@]/.test(raw)) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(raw);
}

function rotuloDoCampo(campo) {
  return (
    campo.getAttribute("aria-label") ||
    txt(campo.closest(".form-row")?.querySelector("label")?.textContent) ||
    campo.id
  );
}

/** [{ campo, mensagem }] — campo pode ser null. */
function validateCurrentConfiguration() {
  const erros = [];
  const erro = (campo, mensagem) => erros.push({ campo, mensagem });

  const pageTitle = $("cfgPageTitle");
  if (pageTitle && !txt(pageTitle.value))
    erro(pageTitle, "Informe o título da página inicial.");

  const domain = $("cfgGoogleDomainHint");
  if (domain && !dominioValido(domain.value))
    erro(
      domain,
      "O domínio Google deve estar no formato agenciasus.org.br, sem https://, @ ou barras.",
    );

  const heartbeat = $("cfgAccessHeartbeatMinutos");
  if (heartbeat) {
    const valor = Number(heartbeat.value);
    if (!Number.isInteger(valor) || valor < 1 || valor > 60)
      erro(heartbeat, "O heartbeat deve ser um número inteiro entre 1 e 60.");
  }

  const accessLogo = $("cfgAccessLogoUrl");
  if (accessLogo && !isValidAccessAssetUrl(accessLogo.value))
    erro(accessLogo, "URL inválida no campo Logo da AgSUS no acesso.");

  [$("cfgCogipLogo"), ...document.querySelectorAll('[id^="panelUrl"]')]
    .filter(Boolean)
    .forEach((campo) => {
      if (!urlHttpValida(campo.value))
        erro(
          campo,
          `URL inválida no campo ${rotuloDoCampo(campo)}: use https:// ou http://.`,
        );
    });

  document.querySelectorAll('[id^="panelAtivo"]').forEach((ativo) => {
    if (ativo.value !== "true") return;
    const campo = $(`panelUrl${ativo.id.replace("panelAtivo", "")}`);
    if (campo && !txt(campo.value))
      erro(campo, "Painéis ativos precisam de uma URL configurada.");
  });

  return erros;
}

function mostrarValidacao(erros) {
  document
    .querySelectorAll("#page-config .config-field-invalid")
    .forEach((f) => {
      f.classList.remove("config-field-invalid");
      f.removeAttribute("aria-invalid");
    });
  const resumo = $("configValidationSummary");
  erros.forEach(({ campo }) => {
    campo?.classList.add("config-field-invalid");
    campo?.setAttribute("aria-invalid", "true");
  });
  if (resumo) {
    resumo.hidden = !erros.length;
    resumo.innerHTML = erros.length
      ? sanitizeHtml(
          `<div><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><strong>Revise ${erros.length} ${erros.length === 1 ? "campo" : "campos"} antes de salvar.</strong></div><ul>${[...new Set(erros.map((e) => e.mensagem))].map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`,
        )
      : "";
  }
}

// ── Revisão do que muda ────────────────────────────────────────────────────

/*
  get_configuracoes_snapshot devolve { configuracoes, paineis, gerado_em }.
  (A renomeação de 20260918160000 trocou a chave por '"TB_CONFIGURACAO"' e a
  revisão passou a mostrar toda configuração como "(vazio) → valor"; a
  migration 20260929220000 devolveu o nome.)
*/
export function snapshotMaps(snapshot) {
  const configMap = new Map(
    (snapshot?.configuracoes || []).map((item) => [item.chave, item]),
  );
  const panelMap = new Map(
    (snapshot?.paineis || []).map((item) => [String(item.id), item]),
  );
  return { configMap, panelMap };
}

export function buildChanges(snapshot, configRows, panels) {
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

function historyCardHTML() {
  return `
      <div id="configHistoryCard" class="admin-card card full config-history-card">
        <div class="config-card-title">
          <div>
            <h3>Histórico de configurações</h3>
            <p>Publicações auditadas, responsáveis e restauração de versões anteriores.</p>
          </div>
          <button id="configHistoryRefresh" class="btn secondary" type="button"><i class="fa-solid fa-rotate-right"></i> Atualizar</button>
        </div>
        <div id="configHistoryBody" class="config-history-empty">Carregando histórico...</div>
      </div>
    `;
}

/*
  O histórico mora na seção Operação ("Referência da base, auditoria e
  importação"). Antes ele era acrescentado à `.admin-grid` original, que
  `organizarConfiguracoesEmSecoes` já tinha esvaziado e escondido: o card
  existia, mas nunca aparecia.
*/
function ensureGovernanceUI(root) {
  if (!$("configGovernanceModal"))
    document.body.insertAdjacentHTML("beforeend", modalHTML());

  if (!$("configHistoryCard")) {
    const molde = document.createElement("template");
    molde.innerHTML = historyCardHTML().trim();
    const cartao = molde.content.firstElementChild;
    if (!anexarNaSecao(document, "operacao", cartao))
      (root.querySelector(":scope > .admin-grid") || root).append(cartao);
  }

  $("configGovernanceModal").addEventListener("click", (event) => {
    if (event.target.closest("[data-governance-close]")) closeModal();
  });
  $("configHistoryRefresh")?.addEventListener("click", () => loadHistory(true));
  $("configHistoryBody")?.addEventListener("click", (event) => {
    const botao = event.target.closest(".config-history-restore");
    if (botao) reviewRestore(botao.dataset.versionId);
  });
}

function openModal(title, body, footer) {
  const modal = $("configGovernanceModal");
  if (!modal) return;
  $("configGovernanceTitle").textContent = title;
  $("configGovernanceBody").innerHTML = sanitizeHtml(body);
  $("configGovernanceFooter").innerHTML = sanitizeHtml(footer);
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

function alertaHTML(titulo, detalhe) {
  return `<div class="config-governance-alert is-error" role="alert"><strong>${esc(titulo)}</strong><span>${esc(detalhe)}</span></div>`;
}

/** Mostra o erro dentro do modal aberto, acima do conteúdo. */
function mostrarErroNoModal(titulo, erro) {
  const corpo = $("configGovernanceBody");
  if (!corpo) return;
  corpo.querySelector("[data-erro-da-publicacao]")?.remove();
  const aviso = document.createElement("div");
  aviso.dataset.erroDaPublicacao = "";
  aviso.innerHTML = sanitizeHtml(alertaHTML(titulo, mensagemDeFalha(erro)));
  corpo.prepend(aviso);
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

const BOTAO_FECHAR = `<button type="button" class="btn secondary" data-governance-close>Fechar</button>`;

async function publicar(client, { configRows, panels, changes }) {
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

  let data;
  try {
    const resposta = await comTempoLimite(
      client.rpc(RPC_SAVE_V2, {
        p_config_rows: configRows,
        p_paineis: panels,
        p_motivo: reason,
      }),
      TEMPO_LIMITE_MS,
    );
    if (resposta.error) throw resposta.error;
    data = resposta.data;
    if (!data?.ok) throw new Error("O servidor não confirmou a publicação.");
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.innerHTML =
        '<i class="fa-solid fa-cloud-arrow-up"></i> Tentar novamente';
    }
    mostrarErroNoModal("Não foi possível publicar.", error);
    return;
  }

  markClean();
  closeModal();
  await loadHistory(true);
  window.dispatchEvent(new CustomEvent("agsus:config-saved", { detail: data }));
  window.alert(
    `${data.total_alteracoes || changes.length} alteração(ões) publicada(s) e auditada(s). A página será recarregada para aplicar os novos valores.`,
  );
  window.location.reload();
}

/** O "Salvar alterações" de Configurações (botão da barra e Ctrl+S). */
export async function reviewAndPublish() {
  if (state.saving) return false;
  const erros = validateCurrentConfiguration();
  mostrarValidacao(erros);
  if (erros.length) {
    openModal(
      "Corrigir configurações",
      `<div class="config-governance-alert is-error"><strong>Não foi possível publicar.</strong><ul>${[...new Set(erros.map((e) => e.mensagem))].map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>`,
      BOTAO_FECHAR,
    );
    return false;
  }

  if (
    $("cfgGoogleEnabled")?.value === "false" &&
    !window.confirm(
      "O login Google será desativado. Como este é o acesso institucional principal, usuários podem ficar sem conseguir entrar. Deseja continuar?",
    )
  )
    return false;

  const client = createClient();
  if (!client) {
    openModal(
      "Publicação indisponível",
      alertaHTML(
        "Não foi possível publicar.",
        "O servidor de dados não está configurado neste ambiente.",
      ),
      BOTAO_FECHAR,
    );
    return false;
  }

  setSaving(true);
  try {
    const { data: snapshot, error } = await comTempoLimite(
      client.rpc(RPC_SNAPSHOT),
      TEMPO_LIMITE_MS,
    );
    if (error) throw error;

    const configRows = collectConfigRows();
    const panels = currentPanels();
    const changes = buildChanges(snapshot, configRows, panels);
    if (!changes.length) {
      markClean();
      openModal(
        "Nenhuma alteração",
        `<div class="config-governance-empty"><i class="fa-solid fa-circle-check"></i><strong>Nada para publicar.</strong><span>Os valores da tela já são iguais aos publicados.</span></div>`,
        BOTAO_FECHAR,
      );
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
    $("configConfirmPublish")?.addEventListener("click", () =>
      publicar(client, { configRows, panels, changes }),
    );
    return true;
  } catch (error) {
    openModal(
      "Não foi possível preparar a publicação",
      `${alertaHTML("Nada foi publicado.", mensagemDeFalha(error))}<p>As alterações continuam na tela. Tente salvar de novo.</p>`,
      BOTAO_FECHAR,
    );
    return false;
  } finally {
    setSaving(false);
  }
}

// ── Histórico e restauração ────────────────────────────────────────────────

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
    body.innerHTML = sanitizeHtml(historyHTML(state.history));
    return true;
  }

  body.className = "config-history-empty";
  body.textContent = "Carregando histórico...";
  const client = createClient();
  if (!client) {
    body.textContent = "Servidor de dados indisponível.";
    return false;
  }

  try {
    const { data, error } = await comTempoLimite(
      client.rpc(RPC_HISTORY, { p_limit: 30 }),
      TEMPO_LIMITE_MS,
    );
    if (error) throw error;
    state.history = Array.isArray(data) ? data : [];
  } catch (error) {
    body.innerHTML = sanitizeHtml(
      `<div class="alert error" role="alert">Erro ao carregar histórico: ${esc(mensagemDeFalha(error))}</div>`,
    );
    return false;
  }
  body.className = "";
  body.innerHTML = sanitizeHtml(historyHTML(state.history));
  return true;
}

async function restaurar(versionId) {
  const reason = txt($("configRestoreReason")?.value);
  if (!reason) {
    $("configRestoreReason")?.classList.add("config-field-invalid");
    $("configRestoreReason")?.focus();
    return;
  }
  if (
    !window.confirm(
      "Confirmar restauração desta versão? Os valores atuais serão substituídos.",
    )
  )
    return;

  const button = $("configConfirmRestore");
  if (button) {
    button.disabled = true;
    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Restaurando...';
  }
  let data;
  try {
    const resposta = await comTempoLimite(
      createClient().rpc(RPC_RESTORE, {
        p_versao_id: versionId,
        p_motivo: reason,
      }),
      TEMPO_LIMITE_MS,
    );
    if (resposta.error) throw resposta.error;
    data = resposta.data;
    if (!data?.ok) throw new Error("O servidor não confirmou a restauração.");
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.innerHTML =
        '<i class="fa-solid fa-rotate-left"></i> Tentar novamente';
    }
    mostrarErroNoModal("Não foi possível restaurar.", error);
    return;
  }
  markClean();
  closeModal();
  window.alert(
    `${data.total_alteracoes || 0} alteração(ões) restaurada(s). A página será recarregada.`,
  );
  window.location.reload();
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
  $("configConfirmRestore")?.addEventListener("click", () =>
    restaurar(versionId),
  );
}

// ── Eventos ────────────────────────────────────────────────────────────────

function bindWorkspaceEvents(root) {
  const marcar = (event) => {
    if (!ehCampoDeConfiguracao(event.target)) return;
    setDirty(true);
    event.target.classList.remove("config-field-invalid");
    event.target.removeAttribute("aria-invalid");
  };
  root.addEventListener("input", marcar);
  root.addEventListener("change", marcar);

  $("configStickySaveButton")?.addEventListener("click", () => {
    void reviewAndPublish();
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s")
      return;
    if (!root.isConnected || !root.classList.contains("active")) return;
    event.preventDefault();
    if (secaoAtual(root) === "acessos") return;
    if (state.dirty && !state.saving) void reviewAndPublish();
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

/**
 * Pode sair de Configurações? Sem alteração não salva, sim; com, pergunta e,
 * confirmado, descarta. Chamado pelo `navigate` do legado.
 */
export function confirmarSaidaDasConfiguracoes(
  confirmar = (mensagem) => window.confirm(mensagem),
) {
  if (!state.dirty) return true;
  if (
    !confirmar(
      "Existem alterações não salvas em Configurações. Sair e descartar essas alterações?",
    )
  )
    return false;
  markClean();
  return true;
}

export function initConfigGovernance() {
  if (state.initialized) return;
  const root = $("page-config");
  if (!root) return;
  state.initialized = true;
  ensureWorkspace(root);
  ensureGovernanceUI(root);
  bindWorkspaceEvents(root);
  atualizarBarraDaSecao(root);
  setDirty(false);
  loadHistory();
}
