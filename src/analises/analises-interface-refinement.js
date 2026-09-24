const state = { initialized: false, timer: 0, attempts: 0 };
const norm = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function installStyles() {
  if (document.getElementById("analisesModernVisualStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesModernVisualStyles";
  style.textContent = `
    :root{
      --bg:#f3f6fa!important;--bg2:#ffffff!important;--card:#ffffff!important;--card2:#f7f9fc!important;
      --line:#e3e9f1!important;--line2:#d5deea!important;--text:#334155!important;--strong:#0f172a!important;--muted:#64748b!important;
      --blue:#2563eb!important;--blue2:#3b82f6!important;--cyan:#0ea5e9!important;--green:#10b981!important;--green2:#059669!important;
      --yellow:#f59e0b!important;--red:#ef4444!important;--purple:#8b5cf6!important;
      --shadow:0 10px 28px rgba(15,23,42,.06)!important;--shadow-sm:0 3px 12px rgba(15,23,42,.05)!important;
      --radius:16px!important;--radius2:12px!important
    }
    body{background:#f3f6fa!important;background-image:none!important}
    .topbar{background:rgba(255,255,255,.94)!important;border-bottom:1px solid var(--line)!important;box-shadow:0 4px 18px rgba(15,23,42,.05)!important}
    h1{font-size:30px!important;letter-spacing:-.035em!important}
    .content{gap:16px!important;padding:18px 18px 28px!important}
    .panel{border:1px solid var(--line)!important;box-shadow:var(--shadow-sm)!important}
    .filter-panel{border-left:0!important;border-top:3px solid var(--blue)!important}
    .kpis{gap:10px!important}
    .kpi{min-height:90px!important;border-radius:14px!important;box-shadow:none!important;background:linear-gradient(180deg,#fff,#fbfcfe)!important}
    .kpi::before{height:3px!important}
    .kpi:hover{transform:none!important;border-color:#cbd5e1!important;box-shadow:0 8px 20px rgba(15,23,42,.06)!important}
    .kpi b{font-size:28px!important}
    .oper-grid{grid-template-columns:minmax(0,1.45fr) minmax(340px,.55fr)!important;gap:16px!important}
    .attention-item{background:#fff!important;border:1px solid var(--line)!important;border-left-width:4px!important;border-radius:12px!important}
    .attention-item:hover{transform:none!important;background:#f8fafc!important}
    .chart-wrap{height:290px!important}.chart-wrap.short{height:260px!important}.trend .chart-wrap{height:320px!important}
    .table-head{background:#fff!important;color:var(--strong)!important;border-bottom:1px solid var(--line)!important;padding:17px 18px!important}
    .table-head .eyebrow{color:var(--blue)!important}.table-head .title{color:var(--strong)!important}.table-head .hint{color:var(--muted)!important}
    .table-tools input,.rows-control select{background:#f8fafc!important;color:var(--text)!important;border:1px solid var(--line2)!important}
    .table-tools input::placeholder{color:#94a3b8!important}
    th{background:#f8fafc!important;color:#475569!important}
    td{font-size:13px!important}
    tbody tr:hover td{background:#f8fafc!important}
    .btn{border-radius:10px!important;box-shadow:none!important}.btn:hover{transform:none!important}
    .btn.green{background:#059669!important}.btn.secondary{background:#fff!important}

    .analises-drawer-backdrop{background:rgba(15,23,42,.48)!important;backdrop-filter:blur(2px)}
    .analises-drawer{width:min(720px,96vw)!important;padding:0!important;gap:0!important;background:#f6f8fb!important}
    .analises-drawer-head{top:0!important;margin:0!important;padding:20px 24px 18px!important;background:#fff!important;box-shadow:0 4px 14px rgba(15,23,42,.05)!important}
    .analises-drawer-head h2{font-size:20px!important;line-height:1.3!important}
    .analises-drawer-context{grid-template-columns:repeat(3,minmax(0,1fr))!important;padding:18px 24px 8px!important;gap:10px!important}
    .analises-drawer-context div{background:#fff!important;border:1px solid var(--line)!important;padding:11px 12px!important;border-radius:12px!important;min-height:62px!important}
    .analises-drawer-context div:nth-child(5){grid-column:span 2}
    #analisesDrawerBody{padding:10px 24px 28px!important}
    .analises-drawer .detail-shell{gap:14px!important}
    .analises-detail-section{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
    .analises-detail-section-head{display:flex;align-items:center;gap:9px;padding:13px 15px;border-bottom:1px solid var(--line);font-size:13px;font-weight:900;color:var(--strong)}
    .analises-detail-section-head i{color:var(--blue)}
    .analises-detail-section-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}
    .analises-detail-section .kv{border:0!important;background:#f8fafc!important;border-radius:10px!important;padding:11px 12px!important;min-height:68px!important}
    .analises-detail-section .kv-label{font-size:10px!important;letter-spacing:.05em!important;color:#64748b!important}
    .analises-detail-section .kv-value{font-size:14px!important;color:#0f172a!important;margin-top:5px!important}
    .analises-detail-analysis{padding:16px;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap}
    .analises-detail-empty{color:#94a3b8;font-style:italic}
    .analises-drawer .detail-actions{display:flex;gap:8px;flex-wrap:wrap}
    #attentionList .attention-item.low{display:none!important}
    #loading .loading-card{width:min(460px,calc(100vw - 32px))!important;border-radius:16px!important}
    @media(max-width:720px){
      .oper-grid{grid-template-columns:1fr!important}.analises-drawer-context{grid-template-columns:1fr!important;padding:14px 16px 6px!important}.analises-drawer-context div:nth-child(5){grid-column:auto}.analises-detail-section-grid{grid-template-columns:1fr}#analisesDrawerBody{padding:8px 16px 22px!important}
    }
  `;
  document.head.appendChild(style);
}

function friendly(raw) {
  const value = norm(raw);
  if (
    value.includes("cache consolidado indisponivel") ||
    value.includes("consultando supabase")
  )
    return "Buscando os dados mais recentes...";
  if (value.includes("carregando supabase"))
    return "Recebendo os registros da análise...";
  if (value.includes("montando filtros") || value.includes("montando painel"))
    return "Organizando filtros e informações...";
  if (value.includes("calculando indicadores"))
    return "Calculando indicadores e gráficos...";
  if (value.includes("preparando sessao")) return "Validando seu acesso...";
  return raw || "Preparando os dados para visualização...";
}

function refineLoading() {
  const loading = document.getElementById("loading"),
    title = document.getElementById("loadingTitle"),
    text = document.getElementById("loadingText");
  if (!loading || !title || !text) return false;
  const active = loading.classList.contains("show");
  if (active) {
    title.textContent = "Carregando análises";
    text.textContent = friendly(text.textContent);
  }
  return active;
}

function step() {
  const active = refineLoading();
  state.attempts += 1;
  if (active || state.attempts < 25) state.timer = setTimeout(step, 120);
  else {
    state.attempts = 0;
    state.timer = 0;
  }
}
function startLoading() {
  clearTimeout(state.timer);
  state.attempts = 0;
  state.timer = setTimeout(step, 0);
}
function recolorCharts() {
  const charts = Object.values(window.Chart?.instances || {});
  charts.forEach((chart) => {
    if (chart.config.type === "bar" && chart.data.datasets?.length >= 4) {
      const colors = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444"];
      chart.data.datasets.forEach((ds, i) => {
        ds.backgroundColor = colors[i] || "#64748b";
        ds.borderRadius = 6;
      });
    }
    if (chart.config.type === "line" && chart.data.datasets?.[0]) {
      chart.data.datasets[0].borderColor = "#2563eb";
      chart.data.datasets[0].backgroundColor = "rgba(37,99,235,.08)";
    }
    chart.update("none");
  });
}
function init() {
  if (state.initialized) return;
  state.initialized = true;
  installStyles();
  startLoading();
  setTimeout(recolorCharts, 500);
  document.addEventListener(
    "click",
    (e) => {
      if (e.target?.closest?.("#refreshBtn")) startLoading();
    },
    true,
  );
}
init();
