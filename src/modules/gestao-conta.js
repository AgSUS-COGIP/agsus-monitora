import { ACCESS_ROLES, isOwnAccessProfile } from "../lib/access-roles.js";
import { escapeHtml, sanitizeHtml } from "../lib/sanitize.js";

export function abrirGestaoConta(user, { currentUser, onSave, onDeactivate }) {
  if (isOwnAccessProfile(currentUser, user)) return;
  const dialog = document.createElement("dialog");
  dialog.className = "permission-account-dialog";
  dialog.setAttribute("aria-labelledby", "account-title");
  dialog.innerHTML = sanitizeHtml(`
    <h3 id="account-title">Gerenciar conta</h3>
    <strong>${escapeHtml(user.nome || user.email)}</strong>
    <p>${escapeHtml(user.email)}</p>
    <p>O perfil global define as permissões padrão. As permissões individuais da matriz prevalecem. Admin também permite gerenciar usuários.</p>
    <label>Perfil global <select name="perfil">${ACCESS_ROLES.map((role) => `<option value="${escapeHtml(role.value)}" ${role.value === user.perfil ? "selected" : ""}>${escapeHtml(role.label)}</option>`).join("")}</select></label>
    <p role="status"></p>
    <div class="permission-toolbar">
      <button type="button" class="btn primary" data-save-account>Salvar perfil global</button>
      <button type="button" class="btn red" data-deactivate-account>Desativar acesso</button>
      <button type="button" class="btn outline" data-close-account>Fechar</button>
    </div>`);
  let busy = false;
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.addEventListener("click", async (event) => {
    if (busy) return;
    if (event.target.closest("[data-close-account]")) return dialog.close();
    const save = event.target.closest("[data-save-account]");
    if (!save && !event.target.closest("[data-deactivate-account]")) return;
    busy = true;
    dialog
      .querySelectorAll("button,select")
      .forEach((el) => (el.disabled = true));
    try {
      const done = save
        ? await onSave(user.id, dialog.querySelector("select").value)
        : await onDeactivate(user.id);
      if (done === true) dialog.close();
    } catch {
      dialog.querySelector('[role="status"]').textContent =
        "Não foi possível concluir. Tente novamente.";
    } finally {
      busy = false;
      dialog
        .querySelectorAll("button,select")
        .forEach((el) => (el.disabled = false));
    }
  });
  document.body.append(dialog);
  dialog.showModal();
}
