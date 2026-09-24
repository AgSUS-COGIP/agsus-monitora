import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  ensureTopFilterToolbar,
  startTableRenderWatch,
  syncFilterToolbar,
} from "../../src/modules/health-details-runtime-fix.js";

function dashboardDom() {
  return new JSDOM(`
    <body>
      <section id="page-dashboard" class="active">
        <div class="filter-card">
          <div class="filter-head">
            <div><div id="filterTitle">Filtros</div><p>Refine os dados</p></div>
            <button id="filterToggleBtn"></button>
          </div>
          <div id="filterBody" class="filter-body hidden">
            <div><label>Unidade</label><div id="filterUnidade" class="multi-select"><div class="multi-select-menu"><div class="multi-select-actions"></div><div class="multi-options"></div><div class="multi-hint"></div></div></div></div>
            <div><label>Edital</label><div id="filterEdital" class="multi-select"><div class="multi-select-menu"><div class="multi-select-actions"></div><div class="multi-options">
              <label class="multi-option"><input type="checkbox" data-filter-field="edital" data-filter-value="01/2026"><span>01/2026</span></label>
              <label class="multi-option"><input type="checkbox" data-filter-field="edital" data-filter-value="02/2026"><span>02/2026</span></label>
              <label class="multi-option"><input type="checkbox" data-filter-field="edital" data-filter-value="03/2025"><span>03/2025</span></label>
            </div><div class="multi-hint"></div></div></div></div>
            <div><label>Etapa</label><div id="filterEtapa" class="multi-select"><div class="multi-select-menu"><div class="multi-select-actions"></div><div class="multi-options"></div><div class="multi-hint"></div></div></div></div>
            <div><label>Status</label><div id="filterStatus" class="multi-select"><div class="multi-select-menu"><div class="multi-select-actions"></div><div class="multi-options"><label class="multi-option"><input type="checkbox" data-filter-field="status" data-filter-value="Em andamento"><span>Em andamento</span></label></div><div class="multi-hint"></div></div></div></div>
            <div><label>Risco</label><div id="filterRisco" class="multi-select"><div class="multi-select-menu"><div class="multi-select-actions"></div><div class="multi-options"></div><div class="multi-hint"></div></div></div></div>
            <div><label>UF</label><div id="filterUf" class="multi-select"><div class="multi-select-menu"><div class="multi-select-actions"></div><div class="multi-options"></div><div class="multi-hint"></div></div></div></div>
            <button>Limpar</button>
          </div>
        </div>
        <input id="tableSearch">
        <button id="hideClosedBtn" aria-pressed="false"></button>
        <button id="healthOnly2026Btn"></button>
        <div class="table-card"><div id="tableMeta"></div></div>
        <table class="details-table">
          <thead><tr><th data-sort-field="unidade"></th><th data-sort-field="edital"></th></tr></thead>
          <tbody id="monitorRows"></tbody>
        </table>
      </section>
    </body>`);
}

function nextUiCycle(dom) {
  return new Promise((resolve) => dom.window.setTimeout(resolve, 0));
}

describe("health details runtime fix", () => {
  /*
    "Editais 2026" (ano fixo no botão) virou o seletor Ano, com os anos dos
    próprios editais; "Em andamento" virou uma opção do seletor Situação.
  */
  it("seletor Ano fica no topo e seleciona só os editais do ano escolhido", async () => {
    const dom = dashboardDom();
    dom.window.toggleSelectFilter = vi.fn();
    dom.window.toggleCriticalRiskFilter = vi.fn();
    dom.window.toggleHideClosed = vi.fn();
    dom.window.clearFilters = vi.fn();
    const doc = dom.window.document;

    doc.querySelector('input[data-filter-value="03/2025"]').click();

    const toolbar = ensureTopFilterToolbar(dom.window, doc);
    const ano = doc.getElementById("healthFiltroAno");

    expect(toolbar).not.toBeNull();
    expect(ano?.closest(".filter-head")).not.toBeNull();
    expect([...ano.options].map((o) => o.value)).toEqual(["", "2026", "2025"]);
    expect(ano.value).toBe("2025");
    expect(doc.getElementById("healthOnly2026Btn").hidden).toBe(true);
    expect(doc.getElementById("hideClosedBtn").hidden).toBe(true);
    expect(doc.getElementById("healthQuickRiskBtn")).toBeNull();

    const marcados = () =>
      [
        ...doc.querySelectorAll('input[data-filter-field="edital"]:checked'),
      ].map((input) => input.dataset.filterValue);

    ano.value = "2026";
    ano.dispatchEvent(new dom.window.Event("change"));
    await nextUiCycle(dom);
    expect(marcados()).toEqual(["01/2026", "02/2026"]);
    expect(doc.getElementById("tableSearch").value).toBe("");
    expect(ano.value).toBe("2026");

    ano.value = "";
    ano.dispatchEvent(new dom.window.Event("change"));
    await nextUiCycle(dom);
    expect(marcados()).toEqual([]);
  });

  it("mostra contador no botão de filtros e marca a situação em andamento", () => {
    const dom = dashboardDom();
    const status = dom.window.document.querySelector(
      'input[data-filter-field="status"]',
    );
    status.checked = true;

    ensureTopFilterToolbar(dom.window, dom.window.document);
    expect(syncFilterToolbar(dom.window, dom.window.document)).toBe(1);
    expect(
      dom.window.document.getElementById("filterToggleBtn").textContent,
    ).toContain("1");
    expect(
      dom.window.document
        .querySelector('#healthFiltroSituacao [data-situacao="andamento"]')
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("aplica placeholder de cronograma imediatamente e o remove quando chega o dado real", () => {
    vi.useFakeTimers();
    const dom = dashboardDom();
    dom.window.document.getElementById("monitorRows").innerHTML =
      "<tr><td>DSEI</td><td><a>01/2026</a></td></tr>";

    startTableRenderWatch(dom.window, dom.window.document, {
      interval: 10,
      maxAttempts: 20,
    });
    vi.advanceTimersByTime(20);
    expect(
      dom.window.document.querySelector(".health-operational-loading"),
    ).not.toBeNull();

    const editalCell = dom.window.document.querySelector(
      "#monitorRows td:nth-child(2)",
    );
    editalCell.insertAdjacentHTML(
      "beforeend",
      '<div class="health-row-operational">Próxima etapa em 3 dias</div>',
    );
    vi.advanceTimersByTime(30);

    expect(
      dom.window.document.querySelector(".health-operational-loading"),
    ).toBeNull();
    expect(
      dom.window.document.querySelector(".health-row-operational")?.textContent,
    ).toContain("Próxima etapa");
    vi.useRealTimers();
  });
});
