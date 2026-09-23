const RPC_ACCESS_CONFIG = "get_acessos_config_master";
const DEFAULT_ONLINE_MINUTES = 15;
const DEFAULT_RECENT_LIMIT = 20;
const DEFAULT_DAYS = 14;

export function createAccessDashboard(deps) {
  const getSupabase = deps.getSupabase;
  const isMasterProfile = deps.isMasterProfile;
  const getCurrentView = deps.getCurrentView;
  const $ = deps.$;
  const n = deps.n;
  const txt = deps.txt;
  const esc = deps.esc;
  const fmt = deps.fmt;
  const fmtDate = deps.fmtDate;
  const friendlyError = deps.friendlyError;

  let refreshHandle = null;
  let loading = false;
  let lastLoadedAt = null;

  function formatAccessDateTime(value) {
    if (!value) return "-";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return txt(value) || "-";
      return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return txt(value) || "-";
    }
  }

  function formatAccessTime(value) {
    if (!value) return "-";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "-";
    }
  }

  function minutesSince(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  }

  function relativeAccessTime(value) {
    const minutes = minutesSince(value);
    if (minutes === null) return "-";
    if (minutes <= 0) return "agora";
    if (minutes === 1) return "há 1 min";
    if (minutes < 60) return `há ${fmt(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "há 1 h";
    if (hours < 24) return `há ${fmt(hours)} h`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "há 1 dia" : `há ${fmt(days)} dias`;
  }

  function accessScreen(user) {
    return (
      txt(user.tela_atual) || txt(user.ultimo_evento) || "Tela não registrada"
    );
  }

  function accessInitials(user) {
    const label = txt(user.nome) || txt(user.email) || "U";
    const clean = label.replace(/@.*/, "").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    const initials =
      parts.length > 1
        ? `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`
        : clean.slice(0, 2);
    return initials.toUpperCase() || "U";
  }

  function userStatus(user, onlineMinutes) {
    const minutes = minutesSince(user.ultimo_acesso);
    if (minutes !== null && minutes <= onlineMinutes)
      return { label: "Online", className: "online" };
    if (minutes !== null && minutes <= 60)
      return { label: "Recente", className: "recent" };
    return { label: "Offline", className: "offline" };
  }

  function accessMonitorKpi(label, value, variant = "") {
    const cls = ["access-monitor-kpi", variant ? `is-${variant}` : ""]
      .filter(Boolean)
      .join(" ");
    return `<div class="${cls}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }

  function statusPill(status) {
    return `<span class="access-monitor-status is-${esc(status.className)}">${esc(status.label)}</span>`;
  }

  function accessMonitorUsersHTML(users, onlineMinutes) {
    const list = Array.isArray(users) ? users : [];
    if (!list.length) {
      return `<div class="access-monitor-empty access-monitor-empty-strong">
        <strong>Ninguém online agora.</strong>
        <span>Quando um usuário abrir ou navegar pelo sistema, ele aparecerá aqui automaticamente.</span>
      </div>`;
    }
    return `<div class="access-monitor-list">${list
      .map((user) => {
        const nome = txt(user.nome) || txt(user.email) || "Usuário";
        const email = txt(user.email);
        const tela = accessScreen(user);
        const ultimo = relativeAccessTime(user.ultimo_acesso);
        const eventos = n(user.eventos_online);
        const status = userStatus(user, onlineMinutes);
        return `<div class="access-monitor-user-card">
        <div class="access-monitor-avatar">${esc(accessInitials(user))}</div>
        <div class="access-monitor-user-main">
          <div class="access-monitor-user-head">
            <strong>${esc(nome)}</strong>
            ${statusPill(status)}
          </div>
          ${email ? `<span class="access-monitor-email">${esc(email)}</span>` : ""}
          <div class="access-monitor-screen"><i class="fa-solid fa-display" aria-hidden="true"></i>${esc(tela)}</div>
        </div>
        <div class="access-monitor-user-meta">
          <strong>${esc(ultimo)}</strong>
          <span>${fmt(eventos)} evento(s)</span>
        </div>
      </div>`;
      })
      .join("")}</div>`;
  }

  function accessMonitorRecentHTML(users, onlineMinutes) {
    const list = Array.isArray(users) ? users : [];
    if (!list.length)
      return `<div class="access-monitor-empty">Ainda não há acessos registrados.</div>`;
    return `<div class="table-wrap"><table class="access-monitor-table">
      <thead><tr><th>Usuário</th><th>Status</th><th>Último acesso</th><th>Eventos</th><th>Última tela</th></tr></thead>
      <tbody>${list
        .map((user) => {
          const nome = txt(user.nome) || txt(user.email) || "Usuário";
          const email = txt(user.email);
          const status = userStatus(user, onlineMinutes);
          const tela = accessScreen(user);
          return `<tr>
          <td>${esc(nome)}${email ? `<div class="access-monitor-meta">${esc(email)}</div>` : ""}</td>
          <td>${statusPill(status)}</td>
          <td><strong>${esc(formatAccessDateTime(user.ultimo_acesso))}</strong><div class="access-monitor-meta">${esc(relativeAccessTime(user.ultimo_acesso))}</div></td>
          <td>${fmt(user.total_eventos)}</td>
          <td><span class="access-monitor-screen-chip">${esc(tela)}</span></td>
        </tr>`;
        })
        .join("")}</tbody>
    </table></div>`;
  }

  function accessMonitorStatsHTML(stats) {
    const list = Array.isArray(stats) ? stats.slice(0, 8) : [];
    if (!list.length)
      return `<div class="access-monitor-empty">Sem estatísticas recentes.</div>`;
    return `<div class="table-wrap"><table class="access-monitor-table compact">
      <thead><tr><th>Data</th><th>Usuários</th><th>Eventos</th><th>Online</th></tr></thead>
      <tbody>${list
        .map(
          (row) => `<tr>
        <td>${esc(fmtDate(row.dia))}</td>
        <td>${fmt(row.usuarios_unicos)}</td>
        <td>${fmt(row.eventos)}</td>
        <td>${fmt(row.online_maximo || 0)}</td>
      </tr>`,
        )
        .join("")}</tbody>
    </table></div>`;
  }

  function render(payload) {
    const card = $("accessMonitorCard");
    const body = $("accessMonitorBody");
    if (!card || !body) return false;
    const allowed = isMasterProfile();
    card.classList.toggle("hidden", !allowed);
    if (!allowed) {
      body.innerHTML = "";
      return false;
    }
    if (!payload) {
      body.className = "access-monitor-empty";
      body.textContent = "Carregando acessos...";
      return true;
    }
    const onlineMinutes =
      n(payload.online_minutes || DEFAULT_ONLINE_MINUTES) ||
      DEFAULT_ONLINE_MINUTES;
    const summary = payload.resumo || {};
    const storage = payload.armazenamento || {};
    const onlineUsers = Array.isArray(payload.usuarios_online)
      ? payload.usuarios_online
      : [];
    const recentUsers = Array.isArray(payload.usuarios_recentes)
      ? payload.usuarios_recentes
      : [];
    const dailyStats = Array.isArray(payload.estatisticas_diarias)
      ? payload.estatisticas_diarias
      : [];
    const lastCleanup = txt(storage.ultima_limpeza);
    const loadedAt = lastLoadedAt || new Date();
    body.className = "";
    body.innerHTML = `
      <div class="access-monitor-summary">
        <div>
          <span>Monitoramento de acesso</span>
          <strong>${fmt(onlineUsers.length)} usuário(s) online agora</strong>
        </div>
        <div>
          <span>Última atualização</span>
          <strong>${esc(formatAccessTime(loadedAt))}</strong>
        </div>
        <div>
          <span>Janela online</span>
          <strong>${fmt(onlineMinutes)} min</strong>
        </div>
      </div>
      <div class="access-monitor-kpis">
        ${accessMonitorKpi("Online agora", fmt(summary.online_agora), "online")}
        ${accessMonitorKpi("Usuários hoje", fmt(summary.usuarios_hoje), "users")}
        ${accessMonitorKpi("Eventos hoje", fmt(summary.eventos_hoje), "events")}
        ${accessMonitorKpi("Total de eventos", fmt(summary.eventos_total), "total")}
        ${accessMonitorKpi("Tamanho da tabela", txt(storage.total_size) || "-", "storage")}
      </div>
      <div class="access-monitor-layout">
        <div class="access-monitor-panel access-monitor-panel-online">
          <div class="access-monitor-title">
            <div><h4>Online agora</h4><span>Atividade nos últimos ${fmt(onlineMinutes)} min</span></div>
            <span class="chip green">${fmt(onlineUsers.length)}</span>
          </div>
          ${accessMonitorUsersHTML(onlineUsers, onlineMinutes)}
        </div>
        <div class="access-monitor-panel">
          <div class="access-monitor-title">
            <div><h4>Últimos acessos</h4><span>Usuários com atividade registrada</span></div>
            <span class="chip blue">${fmt(recentUsers.length)}</span>
          </div>
          ${accessMonitorRecentHTML(recentUsers, onlineMinutes)}
        </div>
        <div class="access-monitor-panel">
          <div class="access-monitor-title">
            <div><h4>Histórico diário</h4><span>Últimos dias monitorados</span></div>
          </div>
          ${accessMonitorStatsHTML(dailyStats)}
        </div>
        <div class="access-monitor-panel">
          <div class="access-monitor-title">
            <div><h4>Retenção e banco</h4><span>Controle de crescimento</span></div>
          </div>
          <div class="access-monitor-empty">
            Eventos mantidos: ${fmt(summary.eventos_total)}.<br>
            Heartbeats são limpos após 30 dias e demais eventos após 365 dias pela rotina diária do banco.
            ${lastCleanup ? `<div class="access-monitor-meta">Última limpeza registrada: ${esc(formatAccessDateTime(lastCleanup))}</div>` : ""}
          </div>
        </div>
      </div>`;
    return true;
  }

  async function load(force = false) {
    const card = $("accessMonitorCard");
    if (!card) return false;
    if (!isMasterProfile()) {
      render(null);
      stopRefresh();
      return false;
    }
    if (loading && !force) return false;
    loading = true;
    if (force) render(null);
    const sb = getSupabase();
    if (!sb) {
      loading = false;
      return false;
    }
    const { data, error } = await sb.rpc(RPC_ACCESS_CONFIG, {
      p_online_minutes: DEFAULT_ONLINE_MINUTES,
      p_recent_limit: DEFAULT_RECENT_LIMIT,
      p_days: DEFAULT_DAYS,
    });
    loading = false;
    if (error) {
      const body = $("accessMonitorBody");
      if (body) {
        body.className = "";
        body.innerHTML = `<div class="alert error">Erro ao carregar acessos: ${esc(friendlyError(error))}</div>`;
      }
      return false;
    }
    lastLoadedAt = new Date();
    render(data || {});
    return true;
  }

  function stopRefresh() {
    if (refreshHandle) {
      clearInterval(refreshHandle);
      refreshHandle = null;
    }
  }

  function startRefresh() {
    stopRefresh();
    if (!isMasterProfile()) return;
    load();
    refreshHandle = setInterval(() => {
      if (getCurrentView() === "config") load();
    }, 60 * 1000);
  }

  return {
    render,
    load,
    startRefresh,
    stopRefresh,
  };
}
