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

export function renderAccessRequestAdminItemHTML(req, panels) {
  const selectedPanels = new Set((req.solicitacoes_acesso_paineis || []).map((row) => String(row.painel_id)));
  const profileValue = ["leitor", "editor", "admin"].includes(req.perfil_solicitado) ? req.perfil_solicitado : "leitor";
  const editable = req.status === "pendente";
  const disabled = editable ? "" : "disabled";

  const painelChecks = (panels || []).filter((panel) => panel.ativo !== false).map((panel) => `
    <label class="panel-check">
      <input type="checkbox" data-access-panel="${attr(req.id)}" value="${attr(panel.id || "")}" ${selectedPanels.has(String(panel.id)) ? "checked" : ""} ${disabled}>
      <span>${esc(panel.titulo || panel.codigo)}</span>
    </label>
  `).join("") || `<div class="access-status">Nenhum painel externo ativo.</div>`;

  return `<div class="access-admin-item" data-access-request="${attr(req.id)}">
    <div class="access-admin-head">
      <div>
        <strong>${esc(req.nome || req.email)}</strong>
        <span>${esc(req.email)}${req.setor ? " · " + esc(req.setor) : ""}</span>
        ${req.justificativa ? `<span>${esc(req.justificativa)}</span>` : ""}
      </div>
      <div class="access-status-pill ${attr(req.status)}">${esc(req.status)}</div>
    </div>
    <div class="access-admin-controls">
      <div class="form-row">
        <label>Perfil</label>
        <select id="accessPerfil${attr(req.id)}" ${disabled}>
          <option value="leitor" ${profileValue === "leitor" ? "selected" : ""}>Leitor</option>
          <option value="editor" ${profileValue === "editor" ? "selected" : ""}>Editor</option>
          <option value="admin" ${profileValue === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </div>
      <div>
        <label>Permissões internas</label>
        <div class="permission-checks">
          ${permissionCheckHTML(req.id, "ind", "Saúde Indígena", true, disabled)}
          ${permissionCheckHTML(req.id, "cores", "Núcleo", false, disabled)}
          ${permissionCheckHTML(req.id, "paineis", "Painéis", true, disabled)}
          ${permissionCheckHTML(req.id, "config", "Config", false, disabled)}
          ${permissionCheckHTML(req.id, "admin", "Admin", false, disabled)}
        </div>
      </div>
    </div>
    <div class="access-admin-panels">
      <label>Painéis externos liberados</label>
      <div class="panel-check-list">${painelChecks}</div>
    </div>
    <div class="form-row access-admin-observation">
      <label>Observação administrativa</label>
      <input id="accessObs${attr(req.id)}" value="${attr(req.observacao_admin || "")}" placeholder="Opcional" ${disabled}>
    </div>
    <div class="access-admin-actions">
      ${editable ? `<button class="btn green" type="button" onclick="approveAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-check"></i> Aprovar acesso</button>
      <button class="btn red" type="button" onclick="denyAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-xmark"></i> Recusar</button>` : ""}
    </div>
  </div>`;
}

export function renderAccessUserAdminItemHTML(user, panels) {
  const activePanelIds = new Set((user.perfis_paineis_externos || [])
    .filter((row) => row.ativo !== false)
    .map((row) => String(row.painel_id)));
  const panelChecks = (panels || []).filter((panel) => panel.ativo !== false).map((panel) => {
    const checked = activePanelIds.has(String(panel.id));
    return `
      <label class="panel-check ${checked ? "" : "muted"}">
        <input type="checkbox" data-user-panel="${attr(user.id)}" value="${attr(panel.id || "")}" ${checked ? "checked" : ""} ${checked ? "" : "disabled"}>
        <span>${esc(panel.titulo || panel.codigo)}</span>
      </label>
    `;
  }).join("") || `<div class="access-status">Nenhum painel externo ativo.</div>`;

  const permissionLabels = [
    ["p_ind", "Saúde Indígena"],
    ["p_cores", "Núcleo"],
    ["p_paineis", "Painéis"],
    ["p_config", "Config"],
    ["p_admin", "Admin"]
  ];
  const permissions = permissionLabels.map(([key, label]) => `
    <span class="permission-chip ${user[key] ? "on" : "off"}">${esc(label)}</span>
  `).join("");

  return `<div class="access-admin-item access-user-item" data-access-user="${attr(user.id)}">
    <div class="access-admin-head">
      <div>
        <strong>${esc(user.nome || user.email)}</strong>
        <span>${esc(user.email)} · ${esc(user.perfil || "leitor")}</span>
      </div>
      <div class="access-status-pill ${user.ativo ? "aprovado" : "recusado"}">${user.ativo ? "ativo" : "inativo"}</div>
    </div>
    <div class="access-user-summary">
      <div>
        <label>Permissões internas</label>
        <div class="permission-checks readonly">${permissions}</div>
      </div>
      <div>
        <label>Painéis externos ativos</label>
        <div class="panel-check-list">${panelChecks}</div>
      </div>
    </div>
    <div class="access-admin-actions">
      <button class="btn outline" type="button" onclick="revokeUserPanels('${attr(user.id)}')"><i class="fa-solid fa-eye-slash"></i> Revogar painéis marcados</button>
      <button class="btn red" type="button" onclick="deactivateUserAccess('${attr(user.id)}')"><i class="fa-solid fa-user-slash"></i> Desativar acesso</button>
    </div>
  </div>`;
}

function permissionCheckHTML(id, key, label, checked, disabled) {
  return `<label class="permission-check"><input type="checkbox" id="accessPerm_${attr(key)}_${attr(id)}" ${checked ? "checked" : ""} ${disabled}><span>${esc(label)}</span></label>`;
}
