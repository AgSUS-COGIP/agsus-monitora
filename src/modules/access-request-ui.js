import { ACCESS_ROLES, isOwnAccessProfile, normalizeRole } from "../lib/access-roles.js";

const ESC_MAP = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ESC_MAP[char]);
const attr = (value) => esc(value).replaceAll("`", "&#096;");
const txt = (value) => String(value ?? "").trim();

export function accessRequestStatusMessage(req) {
  if (!req) return "";
  const messages = {
    pendente: "Solicitação enviada. Aguarde a análise de um administrador.",
    aprovado: "Solicitação aprovada. Entre novamente para carregar o perfil liberado.",
    recusado: "Solicitação recusada. Você pode ajustar os dados e enviar uma nova solicitação."
  };
  const base = messages[req.status] || `Status da solicitação: ${req.status}`;
  return req.observacao_admin ? `${base} Observação: ${req.observacao_admin}` : base;
}

// Mantidos por compatibilidade com a tela de solicitação de acesso. A gestão
// administrativa de permissões não depende mais de painéis/checkboxes.
export function renderAccessPanelChoicesHTML(panels, selectedIds = [], locked = false) {
  const activePanels = (panels || []).filter((panel) => panel.ativo !== false);
  if (!activePanels.length) {
    return `<div class="access-status">Nenhum painel externo ativo encontrado.</div>`;
  }
  const selected = new Set(selectedIds.map(String));
  const disabled = locked ? "disabled" : "";
  return activePanels.map((panel) => `
    <label class="panel-check">
      <input type="checkbox" class="access-panel-choice" value="${attr(panel.id || "")}" ${selected.has(String(panel.id)) ? "checked" : ""} ${disabled}>
      <span>${esc(panel.titulo || panel.codigo)}</span>
    </label>
  `).join("");
}

export function selectedPanelIdsFromForm() {
  return Array.from(document.querySelectorAll(".access-panel-choice:checked"))
    .map((el) => txt(el.value))
    .filter(Boolean);
}

function profileOptionsHTML(value) {
  const normalized = normalizeRole({ perfil: value, ativo: true }) || "usuario";
  return ACCESS_ROLES.map((role) => (
    `<option value="${attr(role.value)}" ${normalized === role.value ? "selected" : ""}>${esc(role.label)}</option>`
  )).join("");
}

export function renderAccessRequestAdminItemHTML(req) {
  const editable = req.status === "pendente";
  const disabled = editable ? "" : "disabled";

  return `<div class="access-admin-item" data-access-request="${attr(req.id)}">
    <div class="access-admin-head">
      <div>
        <strong>${esc(req.nome || req.email)}</strong>
        <span>${esc(req.email)}${req.setor ? " · " + esc(req.setor) : ""}</span>
        ${req.justificativa ? `<span>${esc(req.justificativa)}</span>` : ""}
      </div>
      <div class="access-status-pill ${attr(req.status)}">${esc(req.status)}</div>
    </div>
    <div class="access-admin-controls access-admin-controls--profile-only">
      <div class="form-row">
        <label for="accessPerfil${attr(req.id)}">Perfil</label>
        <select id="accessPerfil${attr(req.id)}" ${disabled}>
          ${profileOptionsHTML(req.perfil_solicitado)}
        </select>
      </div>
    </div>
    <div class="form-row access-admin-observation">
      <label for="accessObs${attr(req.id)}">Observação administrativa</label>
      <input id="accessObs${attr(req.id)}" value="${attr(req.observacao_admin || "")}" placeholder="Opcional" ${disabled}>
    </div>
    <div class="access-admin-actions">
      ${editable ? `<button class="btn green" type="button" onclick="approveAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-check"></i> Aprovar acesso</button>
      <button class="btn red" type="button" onclick="denyAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-xmark"></i> Recusar</button>` : ""}
    </div>
  </div>`;
}

export function renderAccessUserAdminItemHTML(user, options = {}) {
  const ownAccount = isOwnAccessProfile(options.currentUser, user);
  const ownBadge = ownAccount
    ? `<span class="chip blue" title="Sua própria conta não pode ter o perfil alterado por esta tela.">Sua conta</span>`
    : "";

  return `<div class="access-admin-item access-user-item${ownAccount ? " is-own-account" : ""}" data-access-user="${attr(user.id)}">
    <div class="access-admin-head">
      <div>
        <strong>${esc(user.nome || user.email)}</strong>
        <span>${esc(user.email)} · ${esc(normalizeRole(user) || "usuario")}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${ownBadge}
        <div class="access-status-pill ${user.ativo ? "aprovado" : "recusado"}">${user.ativo ? "ativo" : "inativo"}</div>
      </div>
    </div>
    <div class="access-admin-controls access-admin-controls--profile-only">
      <div class="form-row">
        <label for="userPerfil${attr(user.id)}">Perfil</label>
        <select id="userPerfil${attr(user.id)}" ${ownAccount ? "disabled" : ""} aria-disabled="${ownAccount ? "true" : "false"}">
          ${profileOptionsHTML(user.perfil)}
        </select>
        ${ownAccount ? `<small>Para evitar perda acidental de acesso administrativo, sua própria permissão só pode ser alterada por outro administrador.</small>` : ""}
      </div>
    </div>
    ${ownAccount ? "" : `<div class="access-admin-actions">
      <button class="btn green" type="button" onclick="updateUserAccess('${attr(user.id)}')"><i class="fa-solid fa-floppy-disk"></i> Salvar alterações</button>
      <button class="btn red" type="button" onclick="deactivateUserAccess('${attr(user.id)}')"><i class="fa-solid fa-user-slash"></i> Desativar acesso</button>
    </div>`}
  </div>`;
}
