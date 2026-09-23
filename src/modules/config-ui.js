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
const txt = (value) => String(value ?? "").trim();

export function renderPanelAdminHTML(panels) {
  const rows = (panels || [])
    .map((panel, index) => {
      const hasUrl = !!txt(panel.url);
      const status =
        panel.ativo === false
          ? statusPill("Inativo", "danger")
          : panel.em_manutencao
            ? statusPill("Manutenção", "warn")
            : hasUrl
              ? statusPill("Ativo", "ok")
              : statusPill("Sem URL", "neutral");

      return `<div class="panel-admin-item">
      <div class="panel-admin-head">
        <span>${esc(panel.titulo || panel.codigo)}</span>
        ${status}
      </div>
      <input type="hidden" id="panelId${index}" value="${attr(panel.id || "")}">
      <div class="form-grid compact">
        <div class="form-row"><label>Título</label><input id="panelTitulo${index}" value="${attr(panel.titulo || "")}"></div>
        <div class="form-row"><label>Código</label><input value="${attr(panel.codigo || "")}" readonly></div>
        <div class="form-row full"><label>URL</label><input id="panelUrl${index}" value="${attr(panel.url || "")}" placeholder="URL do painel"></div>
        <div class="form-row"><label>Ativo</label><select id="panelAtivo${index}"><option value="true" ${panel.ativo !== false ? "selected" : ""}>Sim</option><option value="false" ${panel.ativo === false ? "selected" : ""}>Não</option></select></div>
        <div class="form-row"><label>Manutenção</label><select id="panelManut${index}"><option value="false" ${!panel.em_manutencao ? "selected" : ""}>Não</option><option value="true" ${panel.em_manutencao ? "selected" : ""}>Sim</option></select></div>
      </div>
    </div>`;
    })
    .join("");

  return `<div class="config-card-title">
    <div>
      <h3>Painéis externos</h3>
      <p>Edite apenas título, URL, status e manutenção. As permissões ficam em Solicitações de acesso.</p>
    </div>
  </div>
  <div class="panel-admin-list">${rows || `<div class="access-status">Nenhum painel externo cadastrado.</div>`}</div>
  <p class="config-help">As alterações só são enviadas ao Supabase quando clicar em Salvar configurações.</p>`;
}

export function collectPanelRows(panels) {
  return (panels || [])
    .map((panel, index) =>
      panel.id
        ? {
            id: txt(panel.id),
            titulo: txt(document.getElementById(`panelTitulo${index}`)?.value),
            url: txt(document.getElementById(`panelUrl${index}`)?.value),
            ativo:
              document.getElementById(`panelAtivo${index}`)?.value === "true",
            em_manutencao:
              document.getElementById(`panelManut${index}`)?.value === "true",
          }
        : null,
    )
    .filter(Boolean);
}

function statusPill(label, tone) {
  return `<span class="config-status ${attr(tone)}">${esc(label)}</span>`;
}
