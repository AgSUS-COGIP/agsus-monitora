import { exigirSessao } from "../lib/sessao.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";

const state = {
  initialized: false,
  client: null,
  rows: [],
  rowsByKey: new Map(),
  loading: false,
  selectedId: "",
  chartSignature: "",
  /* Verdadeiro assim que as linhas chegam pela carga principal. */
  recebeuPorEvento: false,
};

const $ = (id) => document.getElementById(id);
const escMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => escMap[char]);
const txt = (value) => String(value ?? "").trim();
const norm = (value) =>
  txt(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
const fmt = (value) => Number(value || 0).toLocaleString("pt-BR");

function client() {
  if (state.client) return state.client;
  state.client = getSupabaseClient();
  return state.client;
}

async function ensureSession() {
  const sb = client();
  if (!sb) throw new Error("Supabase indisponível.");
  await exigirSessao(sb);
  return sb;
}

function canonicalStatus(value) {
  const key = norm(value);
  if (key.includes("conclu")) return "Concluído";
  if (key.includes("cancel")) return "Cancelado";
  if (key.includes("suspens")) return "Suspenso";
  if (key.includes("paralis")) return "Paralisado";
  if (key.includes("planejad")) return "Planejado";
  if (key.includes("andamento")) return "Em andamento";
  if (key.includes("cronograma pendente") || !key) return "Cronograma pendente";
  return txt(value) || "Não informado";
}

function statusColor(label) {
  const key = norm(label);
  if (key.includes("conclu")) return "#0ea76b";
  if (key.includes("andamento")) return "#2474e7";
  if (key.includes("planejad")) return "#15a7c8";
  if (key.includes("cancel")) return "#e43f4c";
  if (key.includes("suspens") || key.includes("paralis")) return "#8b5cf6";
  return "#94a3b8";
}

function formatDate(value) {
  const raw = txt(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw || "-";
}

function keyOf(unidade, edital) {
  return `${norm(unidade)}|${norm(edital)}`;
}

/*
  Consome as linhas que `legacy-app.js` já carregou.

  Antes, este módulo abria a sua própria leitura completa de
  `vw_monitoramento_indigena_operacional` — 21 colunas, das quais 15 eram cópia
  exata da requisição que a tabela principal já tinha feito, e só 6 eram novas
  (as `cronograma_*`). Essas seis passaram para a requisição principal, e o que
  sobra aqui é escutar.

  O placeholder "Carregando cronograma..." vivia exatamente nessa janela: a
  tabela era desenhada pela primeira requisição, que não trazia cronograma, e o
  badge só nascia quando a segunda voltava.
*/
function aplicarLinhasDeMonitoramento(linhas) {
  state.rows = Array.isArray(linhas) ? linhas : [];
  state.rowsByKey = new Map(
    state.rows.map((row) => [keyOf(row.unidade, row.edital), row]),
  );
  enhanceDetails();
}

/*
  Contingência: se o evento não vier — outra página, ou um erro na carga
  principal — a leitura própria continua disponível. Ela não roda no caminho
  normal.
*/
async function loadOperationalRows() {
  if (state.loading) return;
  state.loading = true;
  try {
    const sb = await ensureSession();
    const { data, error } = await sb
      .from("monitoramento_indigena")
      .select(
        "id,unidade,edital,status,etapa,risco,vagas_total,contratados,vagas_ociosas,inscritos,data_inicio,data_fim,link_edital,observacoes,responsavel,cronograma_automatico,cronograma_percentual,cronograma_atividade_atual,cronograma_proxima_atividade,cronograma_proxima_data,cronograma_dias_para_proxima",
      )
      .eq("ativo", true)
      .order("unidade", { ascending: true })
      .order("edital", { ascending: true });
    if (error) throw error;
    aplicarLinhasDeMonitoramento(data);
  } catch (error) {
    console.error("Erro ao carregar detalhes operacionais:", error);
  } finally {
    state.loading = false;
  }
}

function ensureChartLayout() {
  const canvas = $("statusChart");
  const card = canvas?.closest(".card");
  const wrap = canvas?.closest(".chart-wrap");
  if (!canvas || !card || !wrap) return null;

  card.classList.add("health-status-card");
  if (!card.querySelector(".health-status-subtitle")) {
    card
      .querySelector(".panel-title")
      ?.insertAdjacentHTML(
        "afterend",
        '<p class="health-status-subtitle">Distribuição dos processos por situação operacional. Clique em uma categoria para filtrar.</p>',
      );
  }
  if (!wrap.parentElement?.classList.contains("health-status-layout")) {
    const layout = document.createElement("div");
    layout.className = "health-status-layout";
    wrap.parentElement.insertBefore(layout, wrap);
    layout.appendChild(wrap);
    layout.insertAdjacentHTML(
      "beforeend",
      '<div id="healthStatusLegend" class="health-status-legend"></div>',
    );
  }
  if (!wrap.querySelector(".health-status-center")) {
    wrap.insertAdjacentHTML(
      "beforeend",
      '<div class="health-status-center"><strong id="healthStatusTotal">0</strong><span>processos</span></div>',
    );
  }
  return canvas;
}

function currentVisibleStatuses() {
  const tableRows = [...document.querySelectorAll("#monitorRows tr")];
  const counts = new Map();
  tableRows.forEach((tr) => {
    if (tr.querySelector("td[colspan]")) return;
    const cells = [...tr.querySelectorAll("td")];
    const statusCell = cells.find(
      (td) =>
        td.querySelector(".chip") &&
        /andamento|conclu|cancel|planejad|cronograma|suspens|paralis/i.test(
          td.textContent,
        ),
    );
    const status = canonicalStatus(statusCell?.textContent);
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function enhanceChart() {
  const canvas = ensureChartLayout();
  if (!canvas || !window.Chart) return;
  const entries = currentVisibleStatuses();
  if (!entries.length) return;

  const signature = entries
    .map(([label, value]) => `${label}:${value}`)
    .join("|");
  if (
    signature === state.chartSignature &&
    $("healthStatusLegend")?.children.length
  )
    return;
  state.chartSignature = signature;

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const chart = window.Chart.getChart(canvas);
  if (chart) {
    chart.data.labels = entries.map(([label]) => label);
    chart.data.datasets[0].data = entries.map(([, value]) => value);
    chart.data.datasets[0].backgroundColor = entries.map(([label]) =>
      statusColor(label),
    );
    chart.data.datasets[0].borderColor = "#ffffff";
    chart.data.datasets[0].borderWidth = 3;
    chart.options.cutout = "72%";
    chart.options.plugins.legend.display = false;
    chart.options.plugins.tooltip.callbacks = {
      label(context) {
        const value = Number(context.raw || 0);
        const pct = total ? Math.round((value / total) * 100) : 0;
        return ` ${context.label}: ${value} (${pct}%)`;
      },
    };
    chart.update("none");
  }

  if ($("healthStatusTotal")) $("healthStatusTotal").textContent = fmt(total);
  const legend = $("healthStatusLegend");
  if (legend) {
    legend.innerHTML = entries
      .map(([label, value]) => {
        const pct = total ? Math.round((value / total) * 100) : 0;
        return `<button type="button" class="health-status-legend-item" data-health-status="${esc(label)}">
        <span class="health-status-dot" style="background:${statusColor(label)}"></span>
        <span class="health-status-name">${esc(label)}</span>
        <strong>${fmt(value)}</strong>
        <small>${pct}%</small>
      </button>`;
      })
      .join("");
  }
}

function rowData(tr) {
  const cells = [...tr.querySelectorAll("td")];
  if (!cells.length || tr.querySelector("td[colspan]")) return null;
  const unidade = txt(cells[0]?.textContent);
  const edital = txt(
    cells[1]?.querySelector("a")?.textContent || cells[1]?.textContent,
  )
    .replace(/↗/g, "")
    .replace(/\b\d+d\b/g, "")
    .trim();
  return state.rowsByKey.get(keyOf(unidade, edital)) || null;
}

function urgencyMeta(row) {
  if (!row)
    return { tone: "neutral", label: "Dados operacionais indisponíveis" };
  const status = canonicalStatus(row.status);
  if (["Concluído", "Cancelado"].includes(status))
    return { tone: "done", label: status };
  if (!row.cronograma_automatico)
    return { tone: "warning", label: "Sem cronograma estruturado" };
  const days = Number(row.cronograma_dias_para_proxima);
  if (Number.isFinite(days) && days < 0)
    return {
      tone: "danger",
      label: `Etapa atrasada há ${Math.abs(days)} dia(s)`,
    };
  if (Number.isFinite(days) && days <= 3)
    return { tone: "danger", label: `Próxima etapa em ${days} dia(s)` };
  if (Number.isFinite(days) && days <= 7)
    return { tone: "warning", label: `Próxima etapa em ${days} dia(s)` };
  if (row.cronograma_proxima_atividade)
    return {
      tone: "info",
      label: `Próxima: ${row.cronograma_proxima_atividade}`,
    };
  return { tone: "neutral", label: "Sem próxima atividade" };
}

function enhanceDetails() {
  const tableCard = document.querySelector("#page-dashboard .table-card");
  const tbody = $("monitorRows");
  if (!tableCard || !tbody) return;
  tableCard.classList.add("health-details-card");

  if (!tableCard.querySelector(".health-details-intro")) {
    const meta = $("tableMeta");
    meta?.insertAdjacentHTML(
      "beforebegin",
      `
      <div class="health-details-intro">
        <div><strong>Processos seletivos</strong><span>Clique em uma linha para consultar o resumo operacional e o cronograma.</span></div>
        <div class="health-details-legend"><span><i class="dot danger"></i> até 3 dias</span><span><i class="dot warning"></i> até 7 dias</span><span><i class="dot neutral"></i> sem cronograma</span></div>
      </div>`,
    );
  }

  [...tbody.querySelectorAll("tr")].forEach((tr) => {
    const row = rowData(tr);
    if (!row) return;
    tr.dataset.healthDetailId = row.id;
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.setAttribute(
      "aria-label",
      `Abrir detalhes do edital ${row.edital} da ${row.unidade}`,
    );
    tr.classList.add("health-detail-row");

    tr.classList.remove(
      "row-ending-critical",
      "row-ending-soon",
      "health-urgency-danger",
      "health-urgency-warning",
      "health-urgency-neutral",
    );
    const urgency = urgencyMeta(row);
    tr.classList.add(`health-urgency-${urgency.tone}`);

    const editalCell = tr.querySelector("td:nth-child(2)");
    if (editalCell && !editalCell.querySelector(".health-row-operational")) {
      editalCell.insertAdjacentHTML(
        "beforeend",
        `<div class="health-row-operational tone-${urgency.tone}"><i class="fa-solid ${urgency.tone === "danger" ? "fa-triangle-exclamation" : urgency.tone === "warning" ? "fa-clock" : urgency.tone === "done" ? "fa-circle-check" : "fa-calendar"}"></i>${esc(urgency.label)}</div>`,
      );
    }
  });

  enhanceChart();
}

function ensureDrawer() {
  if ($("healthProcessDrawer")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="healthProcessDrawerBackdrop" class="health-process-drawer-backdrop" hidden></div>
    <aside id="healthProcessDrawer" class="health-process-drawer" aria-hidden="true" aria-labelledby="healthProcessDrawerTitle">
      <div class="health-process-drawer-head">
        <div><span>Detalhes do processo</span><h2 id="healthProcessDrawerTitle">Processo seletivo</h2><p id="healthProcessDrawerSubtitle"></p></div>
        <button type="button" id="healthProcessDrawerClose" class="btn outline" aria-label="Fechar detalhes"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div id="healthProcessDrawerBody" class="health-process-drawer-body"></div>
    </aside>`,
  );
  $("healthProcessDrawerClose")?.addEventListener("click", closeDrawer);
  $("healthProcessDrawerBackdrop")?.addEventListener("click", closeDrawer);
}

function closeDrawer() {
  $("healthProcessDrawer")?.classList.remove("show");
  $("healthProcessDrawer")?.setAttribute("aria-hidden", "true");
  if ($("healthProcessDrawerBackdrop"))
    $("healthProcessDrawerBackdrop").hidden = true;
  state.selectedId = "";
}

function openDrawer(id) {
  const row = state.rows.find((item) => String(item.id) === String(id));
  if (!row) return;
  ensureDrawer();
  state.selectedId = row.id;
  const urgency = urgencyMeta(row);
  $("healthProcessDrawerTitle").textContent = row.edital || "Processo seletivo";
  $("healthProcessDrawerSubtitle").textContent = row.unidade || "";
  const body = $("healthProcessDrawerBody");
  if (body)
    body.innerHTML = `
    <section class="health-drawer-status tone-${urgency.tone}">
      <div><span>Status</span><strong>${esc(canonicalStatus(row.status))}</strong></div>
      <div><span>Etapa atual</span><strong>${esc(row.cronograma_atividade_atual || row.etapa || "-")}</strong></div>
      <div><span>Próxima atividade</span><strong>${esc(row.cronograma_proxima_atividade || "-")}</strong></div>
      <div><span>Prazo</span><strong>${esc(urgency.label)}</strong></div>
    </section>
    <section class="health-drawer-section">
      <h3>Provimento</h3>
      <div class="health-drawer-metrics">
        <div><span>Vagas</span><strong>${fmt(row.vagas_total)}</strong></div>
        <div><span>Contratações</span><strong>${fmt(row.contratados)}</strong></div>
        <div><span>Ociosas</span><strong>${fmt(row.vagas_ociosas)}</strong></div>
        <div><span>Inscritos</span><strong>${fmt(row.inscritos)}</strong></div>
      </div>
    </section>
    <section class="health-drawer-section">
      <h3>Cronograma</h3>
      <div class="health-progress-line"><span style="width:${Math.max(0, Math.min(100, Number(row.cronograma_percentual || 0)))}%"></span></div>
      <div class="health-progress-meta"><strong>${Number(row.cronograma_percentual || 0)}% concluído</strong><span>Próxima data: ${formatDate(row.cronograma_proxima_data)}</span></div>
      ${row.cronograma_automatico ? "" : '<div class="health-drawer-warning"><i class="fa-solid fa-calendar-xmark"></i> Cronograma ainda não estruturado na Equipe Núcleo.</div>'}
    </section>
    <section class="health-drawer-section">
      <h3>Informações</h3>
      <dl class="health-drawer-list">
        <div><dt>Período</dt><dd>${formatDate(row.data_inicio)} a ${formatDate(row.data_fim)}</dd></div>
        <div><dt>Responsável</dt><dd>${esc(row.responsavel || "Não informado")}</dd></div>
        <div><dt>Risco</dt><dd>${esc(row.risco || "Não informado")}</dd></div>
        <div><dt>Observações</dt><dd>${esc(row.observacoes || "Sem observações")}</dd></div>
      </dl>
    </section>
    <div class="health-drawer-actions">
      ${row.link_edital ? `<a class="btn secondary" href="${esc(row.link_edital)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir edital</a>` : ""}
      <button type="button" class="btn outline" data-health-scroll-row="${esc(row.id)}"><i class="fa-solid fa-table-list"></i> Voltar à linha</button>
    </div>`;
  $("healthProcessDrawer")?.classList.add("show");
  $("healthProcessDrawer")?.setAttribute("aria-hidden", "false");
  if ($("healthProcessDrawerBackdrop"))
    $("healthProcessDrawerBackdrop").hidden = false;
}

function scheduleEnhancement() {
  [0, 80, 240].forEach((delay) =>
    window.setTimeout(() => {
      enhanceChart();
      enhanceDetails();
    }, delay),
  );
}

function handleDashboardInteraction(event) {
  if (!event.target?.closest?.("#page-dashboard")) return;
  window.setTimeout(scheduleEnhancement, 30);
}

function handleClick(event) {
  const legend = event.target.closest?.("[data-health-status]");
  if (legend) {
    const label = legend.dataset.healthStatus;
    const button = [
      ...document.querySelectorAll(
        '#filterStatus input[data-filter-field="status"]',
      ),
    ].find((input) => canonicalStatus(input.dataset.filterValue) === label);
    if (button) button.click();
    return;
  }

  const returnButton = event.target.closest?.("[data-health-scroll-row]");
  if (returnButton) {
    const id = returnButton.dataset.healthScrollRow;
    closeDrawer();
    document
      .querySelector(
        `#monitorRows tr[data-health-detail-id="${CSS.escape(id)}"]`,
      )
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const row = event.target.closest?.("#monitorRows tr[data-health-detail-id]");
  if (!row || event.target.closest("a,button,input,select,textarea")) return;
  openDrawer(row.dataset.healthDetailId);
}

function handleKeydown(event) {
  if (
    event.key === "Escape" &&
    $("healthProcessDrawer")?.classList.contains("show")
  )
    closeDrawer();
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches?.("#monitorRows tr[data-health-detail-id]")
  ) {
    event.preventDefault();
    openDrawer(event.target.dataset.healthDetailId);
  }
}

export function initHealthStatusDetails() {
  if (state.initialized) return;
  state.initialized = true;
  ensureDrawer();
  /*
    O caminho normal é este: as linhas chegam pelo evento da carga principal,
    sem nenhuma requisição adicional.
  */
  window.addEventListener("agsus:monitoramento-carregado", (event) => {
    const linhas = event?.detail?.rows;
    if (!Array.isArray(linhas)) return;
    state.recebeuPorEvento = true;
    aplicarLinhasDeMonitoramento(linhas);
  });

  const sb = client();
  if (sb) {
    /*
      A leitura própria só acontece se, passado o arranque, nada tiver chegado
      pelo evento — por exemplo numa página que não roda a carga principal.
    */
    void sb.auth.getSession().then(({ data }) => {
      if (!data?.session?.user) return;
      window.setTimeout(() => {
        if (!state.recebeuPorEvento) void loadOperationalRows();
      }, 4000);
    });
  }
  scheduleEnhancement();
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleDashboardInteraction);
  document.addEventListener("change", handleDashboardInteraction);
  document.addEventListener("keydown", handleKeydown);
  /*
    Depois de salvar um cronograma o dado mudou de verdade, e a carga principal
    não é refeita nesse fluxo — então esta releitura fica. É uma requisição, por
    ação explícita da pessoa, e não no caminho de arranque.
  */
  document.addEventListener("agsus:nucleo-cronograma-saved", () => {
    state.chartSignature = "";
    void loadOperationalRows();
  });
  /*
    O refetch a cada foco da janela saiu.

    Ele relia a view inteira — 94 linhas — toda vez que a pessoa voltava para a
    aba, e durante essa releitura os badges sumiam e o "Carregando cronograma..."
    reaparecia sem que nada tivesse mudado. Quem decide quando os dados estão
    velhos é a carga principal, e o evento traz o resultado dela.
  */
}
