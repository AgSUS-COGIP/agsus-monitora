const RPC_ACCESS_CONFIG = "get_acessos_config_master";
const DEFAULT_ONLINE_MINUTES = 15;
const DEFAULT_RECENT_LIMIT = 20;
const DEFAULT_DAYS = 14;

export function createAccessDashboard(deps){
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

  function formatAccessDateTime(value){
    if(!value) return "-";
    try{
      const date = new Date(value);
      if(Number.isNaN(date.getTime())) return txt(value) || "-";
      return date.toLocaleString("pt-BR", {
        day:"2-digit",
        month:"2-digit",
        hour:"2-digit",
        minute:"2-digit"
      });
    }catch(e){
      return txt(value) || "-";
    }
  }

  function accessMonitorKpi(label, value){
    return `<div class="access-monitor-kpi"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }

  function accessMonitorUsersHTML(users){
    const list = Array.isArray(users) ? users : [];
    if(!list.length) return `<div class="access-monitor-empty">Nenhum usuário online nos últimos 15 minutos.</div>`;
    return `<div class="access-monitor-list">${list.map(user => {
      const nome = txt(user.nome) || txt(user.email) || "Usuário";
      const email = txt(user.email);
      const tela = txt(user.tela_atual) || "sem tela registrada";
      const ultimo = formatAccessDateTime(user.ultimo_acesso);
      const eventos = n(user.eventos_online);
      return `<div class="access-monitor-user">
        <span class="access-monitor-dot" title="Online"></span>
        <div>
          <strong>${esc(nome)}</strong>
          <span>${esc([email, tela].filter(Boolean).join(" · "))}</span>
        </div>
        <span>${esc(ultimo)} · ${fmt(eventos)} evento(s)</span>
      </div>`;
    }).join("")}</div>`;
  }

  function accessMonitorRecentHTML(users){
    const list = Array.isArray(users) ? users : [];
    if(!list.length) return `<div class="access-monitor-empty">Ainda não há acessos registrados.</div>`;
    return `<div class="table-wrap"><table class="access-monitor-table">
      <thead><tr><th>Usuário</th><th>Último acesso</th><th>Eventos</th><th>Última tela</th></tr></thead>
      <tbody>${list.map(user => {
        const nome = txt(user.nome) || txt(user.email) || "Usuário";
        const email = txt(user.email);
        return `<tr>
          <td>${esc(nome)}${email ? `<div class="access-monitor-meta">${esc(email)}</div>` : ""}</td>
          <td>${esc(formatAccessDateTime(user.ultimo_acesso))}</td>
          <td>${fmt(user.total_eventos)}</td>
          <td>${esc(txt(user.ultimo_evento) || txt(user.tela_atual) || "-")}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
  }

  function accessMonitorStatsHTML(stats){
    const list = Array.isArray(stats) ? stats.slice(0, 8) : [];
    if(!list.length) return `<div class="access-monitor-empty">Sem estatísticas recentes.</div>`;
    return `<div class="table-wrap"><table class="access-monitor-table">
      <thead><tr><th>Data</th><th>Usuários</th><th>Eventos</th><th>Online</th></tr></thead>
      <tbody>${list.map(row => `<tr>
        <td>${esc(fmtDate(row.dia))}</td>
        <td>${fmt(row.usuarios_unicos)}</td>
        <td>${fmt(row.eventos)}</td>
        <td>${fmt(row.online_maximo || 0)}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
  }

  function render(payload){
    const card = $("accessMonitorCard");
    const body = $("accessMonitorBody");
    if(!card || !body) return false;
    const allowed = isMasterProfile();
    card.classList.toggle("hidden", !allowed);
    if(!allowed){ body.innerHTML = ""; return false; }
    if(!payload){
      body.className = "access-monitor-empty";
      body.textContent = "Carregando acessos...";
      return true;
    }
    const summary = payload.resumo || {};
    const storage = payload.armazenamento || {};
    const onlineUsers = Array.isArray(payload.usuarios_online) ? payload.usuarios_online : [];
    const recentUsers = Array.isArray(payload.usuarios_recentes) ? payload.usuarios_recentes : [];
    const dailyStats = Array.isArray(payload.estatisticas_diarias) ? payload.estatisticas_diarias : [];
    const lastCleanup = txt(storage.ultima_limpeza);
    body.className = "";
    body.innerHTML = `
      <div class="access-monitor-kpis">
        ${accessMonitorKpi("Online agora", fmt(summary.online_agora))}
        ${accessMonitorKpi("Usuários hoje", fmt(summary.usuarios_hoje))}
        ${accessMonitorKpi("Eventos hoje", fmt(summary.eventos_hoje))}
        ${accessMonitorKpi("Total de eventos", fmt(summary.eventos_total))}
        ${accessMonitorKpi("Tamanho da tabela", txt(storage.total_size) || "-")}
      </div>
      <div class="access-monitor-layout">
        <div class="access-monitor-panel">
          <div class="access-monitor-title">
            <div><h4>Online agora</h4><span>Últimos ${fmt(payload.online_minutes || DEFAULT_ONLINE_MINUTES)} min</span></div>
            <span class="chip green">${fmt(onlineUsers.length)}</span>
          </div>
          ${accessMonitorUsersHTML(onlineUsers)}
        </div>
        <div class="access-monitor-panel">
          <div class="access-monitor-title">
            <div><h4>Últimos acessos</h4><span>Usuários com atividade registrada</span></div>
            <span class="chip blue">${fmt(recentUsers.length)}</span>
          </div>
          ${accessMonitorRecentHTML(recentUsers)}
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

  async function load(force=false){
    const card = $("accessMonitorCard");
    if(!card) return false;
    if(!isMasterProfile()){
      render(null);
      stopRefresh();
      return false;
    }
    if(loading && !force) return false;
    loading = true;
    if(force) render(null);
    const sb = getSupabase();
    if(!sb){
      loading = false;
      return false;
    }
    const { data, error } = await sb.rpc(RPC_ACCESS_CONFIG, {
      p_online_minutes: DEFAULT_ONLINE_MINUTES,
      p_recent_limit: DEFAULT_RECENT_LIMIT,
      p_days: DEFAULT_DAYS
    });
    loading = false;
    if(error){
      const body = $("accessMonitorBody");
      if(body){
        body.className = "";
        body.innerHTML = `<div class="alert error">Erro ao carregar acessos: ${esc(friendlyError(error))}</div>`;
      }
      return false;
    }
    render(data || {});
    return true;
  }

  function stopRefresh(){
    if(refreshHandle){
      clearInterval(refreshHandle);
      refreshHandle = null;
    }
  }

  function startRefresh(){
    stopRefresh();
    if(!isMasterProfile()) return;
    load();
    refreshHandle = setInterval(() => {
      if(getCurrentView() === "config") load();
    }, 60 * 1000);
  }

  return {
    render,
    load,
    startRefresh,
    stopRefresh
  };
}
