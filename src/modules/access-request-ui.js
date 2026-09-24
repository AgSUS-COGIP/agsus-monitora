import {
  ACCESS_ROLES,
  isOwnAccessProfile,
  normalizeRole,
} from "../lib/access-roles.js";

const ESC_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ESC_MAP[char]);
const attr = (value) => esc(value).replaceAll("`", "&#096;");

export function accessRequestStatusMessage(req) {
  if (!req) return "";
  const messages = {
    pendente: "Solicitação enviada. Aguarde a análise de um administrador.",
    aprovado:
      "Solicitação aprovada. Entre novamente para carregar o perfil liberado.",
    recusado:
      "Solicitação recusada. Você pode ajustar os dados e enviar uma nova solicitação.",
  };
  const base = messages[req.status] || `Status da solicitação: ${req.status}`;
  return req.observacao_admin
    ? `${base} Observação: ${req.observacao_admin}`
    : base;
}

// Mantidos por compatibilidade com a tela de solicitação de acesso. A gestão
// administrativa de permissões não depende mais de painéis/checkboxes.
function profileOptionsHTML(value) {
  const normalized = normalizeRole({ perfil: value, ativo: true }) || "usuario";
  return ACCESS_ROLES.map(
    (role) =>
      `<option value="${attr(role.value)}" ${normalized === role.value ? "selected" : ""}>${esc(role.label)}</option>`,
  ).join("");
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
      ${
        editable
          ? `<button class="btn green" type="button" onclick="approveAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-check"></i> Aprovar acesso</button>
      <button class="btn red" type="button" onclick="denyAccessRequest('${attr(req.id)}')"><i class="fa-solid fa-xmark"></i> Recusar</button>`
          : ""
      }
    </div>
  </div>`;
}
