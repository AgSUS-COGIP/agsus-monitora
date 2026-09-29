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

      /*
        Uma linha por painel (tabela leve do design.md 11.4). Os ids panelId,
        panelTitulo, panelUrl, panelAtivo e panelManut são contrato:
        collectPanelRows, a validação (config-governance.js e
        config-page-enhancements.js) e o salvamento leem por eles.
      */
      const nome = esc(panel.titulo || panel.codigo || "painel");
      return `<tr>
      <td>
        <input type="hidden" id="panelId${index}" value="${attr(panel.id || "")}">
        <input id="panelTitulo${index}" value="${attr(panel.titulo || "")}" aria-label="Título do painel ${nome}">
        <small>Código: ${esc(panel.codigo || "—")}</small>
      </td>
      <td><input id="panelUrl${index}" type="url" value="${attr(panel.url || "")}" placeholder="https://" aria-label="Endereço do painel ${nome}"></td>
      <td><select id="panelAtivo${index}" aria-label="Painel ${nome} ativo"><option value="true" ${panel.ativo !== false ? "selected" : ""}>Sim</option><option value="false" ${panel.ativo === false ? "selected" : ""}>Não</option></select></td>
      <td><select id="panelManut${index}" aria-label="Painel ${nome} em manutenção"><option value="false" ${!panel.em_manutencao ? "selected" : ""}>Não</option><option value="true" ${panel.em_manutencao ? "selected" : ""}>Sim</option></select></td>
      <td>${status}</td>
    </tr>`;
    })
    .join("");

  const tabela = rows
    ? `<div class="painel-externo-tabela" data-mobile-table="scroll">
    <table>
      <thead><tr><th scope="col">Painel</th><th scope="col">Endereço</th><th scope="col">Ativo</th><th scope="col">Em manutenção</th><th scope="col">Situação</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
    : `<p class="config-help">Nenhum painel externo cadastrado.</p>`;

  return `<div class="config-card-title">
    <div>
      <h3>Painéis externos</h3>
      <p>Título, endereço e situação de cada painel. Quem abre cada painel se define em Acessos.</p>
    </div>
  </div>
  ${tabela}
  <p class="config-help">As alterações só valem depois de clicar em Salvar alterações.</p>`;
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
