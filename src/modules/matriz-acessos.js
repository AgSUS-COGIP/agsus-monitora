import {
  RESOURCES,
  LEVELS,
  matrixChanges,
} from "../lib/permissoes-recursos.js";
import { isOwnAccessProfile } from "../lib/access-roles.js";
import "../styles/matriz-acessos.css";
import { escapeHtml as escape, sanitizeHtml } from "../lib/sanitize.js";

const label = (level) =>
  LEVELS.find(([value]) => value === level)?.[1] || "Sem acesso";

export async function mountAccessMatrix(root, { sb, currentUser }) {
  let data = { usuarios: [], paineis: [], historico: [], total: 0 };
  let offset = 0;
  let search = "";
  let busy = false;
  const draft = new Map();
  const beforeUnload = (event) => {
    if (!draft.size || !root.isConnected) return;
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", beforeUnload);
  const resources = () => [
    ...RESOURCES,
    ...data.paineis.map((p) => [`painel:${p.id}`, p.titulo]),
  ];
  function render(message = "", error = false) {
    const changes = matrixChanges(data.usuarios, draft);
    root.dataset.pendingCount = String(changes.length);
    root.innerHTML =
      sanitizeHtml(`<section class="permission-matrix" aria-labelledby="permission-title">
      <h4 id="permission-title">Permissões por módulo e painel</h4>
      <p>Leitor consulta; Editor altera dados; Administrador também executa operações administrativas do módulo. A gestão de usuários continua restrita ao perfil global Admin.</p>
      <p>Painéis externos: a permissão libera a abertura pelo MONITORA. A edição e a proteção do endereço externo dependem do sistema de origem. O módulo “Painéis externos” também precisa estar liberado.</p>
      <form class="permission-toolbar" data-search>
        <label>Buscar usuário <input name="busca" value="${escape(search)}" placeholder="Nome ou e-mail" maxlength="100"></label>
        <button class="btn outline" ${busy || changes.length ? "disabled" : ""}>Buscar</button>
        <span>${data.total} usuários ativos</span>
      </form>
      <div class="permission-scroll" tabindex="0" role="region" aria-label="Matriz de permissões com rolagem horizontal">
        <table><thead><tr><th scope="col">Usuário</th>${resources()
          .map(([, title]) => `<th scope="col">${escape(title)}</th>`)
          .join("")}</tr></thead>
        <tbody>${
          data.usuarios
            .map(
              (u) =>
                `<tr><th scope="row"><strong>${escape(u.nome || u.email)}</strong><small>${escape(u.email)}</small>${isOwnAccessProfile(currentUser, u) ? "<small>Seu acesso: outro administrador deve alterar.</small>" : ""}</th>${resources()
                  .map(([id, title]) => {
                    const cell = u.permissoes[id] || {
                      nivel: "sem_acesso",
                      revisao: 0,
                    };
                    const value = draft.get(`${u.id}/${id}`) ?? cell.nivel;
                    const levels = id.startsWith("painel:")
                      ? LEVELS.slice(0, 2)
                      : id === "configuracoes"
                        ? LEVELS.filter(([key]) => key !== "leitor")
                        : LEVELS;
                    return `<td><select data-user="${escape(u.id)}" data-resource="${escape(id)}" data-level="${escape(value)}" aria-label="${escape(title)} — ${escape(u.email)}" ${isOwnAccessProfile(currentUser, u) || busy ? "disabled" : ""}>${levels.map(([key, text]) => `<option value="${key}" ${key === value ? "selected" : ""}>${text}</option>`).join("")}</select>${value !== cell.nivel ? '<small class="permission-changed">Alteração pendente</small>' : ""}</td>`;
                  })
                  .join("")}</tr>`,
            )
            .join("") ||
          `<tr><td colspan="${resources().length + 1}">Nenhum usuário encontrado.</td></tr>`
        }</tbody></table>
      </div>
      <div class="permission-toolbar"><button type="button" data-page="-1" class="btn outline" ${offset === 0 || busy || changes.length ? "disabled" : ""}>Anterior</button><span>${data.total ? offset + 1 : 0}–${Math.min(offset + data.usuarios.length, data.total)} de ${data.total}</span><button type="button" data-page="1" class="btn outline" ${offset + 30 >= data.total || busy || changes.length ? "disabled" : ""}>Próxima</button></div>
      <div data-pending>${changes.length ? `<details open><summary>${changes.length} alterações para revisar</summary><ul>${changes.map((c) => `<li>${escape(data.usuarios.find((u) => u.id === c.usuario_id)?.email)} · ${escape(resources().find(([r]) => r === c.recurso)?.[1])}: ${label(data.usuarios.find((u) => u.id === c.usuario_id).permissoes[c.recurso].nivel)} → <strong>${label(c.nivel)}</strong></li>`).join("")}</ul></details>` : ""}</div>
      <form data-save class="permission-toolbar"><label>Motivo da alteração <input name="motivo" required minlength="3" maxlength="500" placeholder="Descreva o motivo" ${busy ? "disabled" : ""}></label><button class="btn primary" ${!changes.length || busy ? "disabled" : ""}>${busy ? "Salvando…" : "Salvar alterações"}</button><button type="button" class="btn outline" data-discard ${!changes.length || busy ? "disabled" : ""}>Descartar alterações</button></form>
      <p role="status" class="${error ? "alert error" : "access-status"}">${escape(message)}</p>
      <details class="permission-history"><summary>Histórico de permissões — últimas 50 alterações</summary><div class="permission-scroll"><table><thead><tr><th>Data</th><th>Usuário</th><th>Módulo / painel</th><th>Alteração</th><th>Realizado por</th><th>Motivo</th></tr></thead><tbody>${data.historico.map((h) => `<tr><td>${escape(new Date(h.alterado_em).toLocaleString("pt-BR"))}</td><td>${escape(h.email)}</td><td>${escape(resources().find(([r]) => r === h.recurso)?.[1] || h.recurso)}</td><td>${label(h.nivel_anterior)} → ${label(h.nivel_novo)}</td><td>${escape(h.autor || h.alterado_por)}</td><td>${escape(h.motivo)}</td></tr>`).join("") || '<tr><td colspan="6">Nenhuma alteração de permissão registrada.</td></tr>'}</tbody></table></div></details>
    </section>`);
  }
  async function load(message = "") {
    root.innerHTML = '<p role="status">Carregando matriz de permissões…</p>';
    const response = await sb.rpc("obter_matriz_acessos", {
      p_busca: search,
      p_offset: offset,
    });
    if (response.error) {
      root.innerHTML = `<p class="alert error" role="alert">Não foi possível carregar as permissões: ${escape(response.error.message)}</p><button class="btn outline" data-retry>Tentar novamente</button>`;
      return;
    }
    data = response.data;
    render(message);
  }
  root.onchange = (event) => {
    const select = event.target.closest("select[data-resource]");
    if (!select || busy) return;
    const key = `${select.dataset.user}/${select.dataset.resource}`;
    const user = data.usuarios.find((u) => u.id === select.dataset.user);
    if (!user || isOwnAccessProfile(currentUser, user)) return;
    if (select.value === user.permissoes[select.dataset.resource].nivel)
      draft.delete(key);
    else draft.set(key, select.value);
    const motivo = root.querySelector('[name="motivo"]')?.value || "";
    render();
    root.querySelector('[name="motivo"]').value = motivo;
    root.querySelectorAll("select[data-resource]").forEach((el) => {
      if (
        el.dataset.user === select.dataset.user &&
        el.dataset.resource === select.dataset.resource
      )
        el.focus();
    });
  };
  root.onclick = async (event) => {
    if (busy) return;
    if (event.target.closest("[data-retry]")) await load();
    if (event.target.closest("[data-discard]")) {
      draft.clear();
      render();
    }
    const page = event.target.closest("[data-page]");
    if (page && !draft.size) {
      offset = Math.max(0, offset + Number(page.dataset.page) * 30);
      await load();
    }
  };
  root.onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (event.target.matches("[data-search]") && !draft.size) {
      search = new FormData(event.target).get("busca").toString().trim();
      offset = 0;
      await load();
      return;
    }
    if (!event.target.matches("[data-save]")) return;
    const changes = matrixChanges(data.usuarios, draft);
    const motivo = new FormData(event.target).get("motivo").toString().trim();
    if (!changes.length || motivo.length < 3) return;
    busy = true;
    render();
    try {
      const result = await sb.rpc("salvar_matriz_acessos", {
        p_alteracoes: changes,
        p_motivo: motivo,
      });
      if (result.error) throw result.error;
      draft.clear();
      busy = false;
      await load(
        `${result.data.alteradas} permissões salvas. As regras já estão valendo no banco; o usuário verá o novo menu ao atualizar a página.`,
      );
    } catch (error) {
      busy = false;
      render(
        `Não foi possível salvar: ${error.message}. As alterações continuam pendentes.`,
        true,
      );
      root.querySelector('[name="motivo"]').value = motivo;
    }
  };
  await load();
  return () => window.removeEventListener("beforeunload", beforeUnload);
}
