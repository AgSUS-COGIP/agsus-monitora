import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  enhanceHealthDetailsTable,
  ensureOnly2026Button,
  formatDeadlineLabel,
  installConfirmedLogout
} from "../../src/modules/health-details-ux.js";

describe("health details ux", () => {
  it("traduz prazos compactos para uma mensagem clara", () => {
    expect(formatDeadlineLabel("5d")).toBe("Edital encerra em 5 dias");
    expect(formatDeadlineLabel("1d")).toBe("Edital encerra em 1 dia");
    expect(formatDeadlineLabel("Encerrado")).toBe("Prazo do edital encerrado");
  });

  it("cancela o logout quando o usuario nao confirma", async () => {
    const original = vi.fn();
    const target = { logout: original };

    expect(installConfirmedLogout(target, async () => false)).toBe(true);
    await expect(target.logout()).resolves.toBe(false);
    expect(original).not.toHaveBeenCalled();
  });

  it("executa o logout depois da confirmacao", async () => {
    const original = vi.fn(async () => "ok");
    const target = { logout: original };

    installConfirmedLogout(target, async () => true);
    await expect(target.logout("manual")).resolves.toBe("ok");
    expect(original).toHaveBeenCalledWith("manual");
  });

  it("refina status e alertas da tabela sem duplicar decoracoes", () => {
    const dom = new JSDOM(`
      <section id="page-dashboard">
        <div class="health-details-legend"></div>
        <div class="table-actions"><div><input id="tableSearch"></div></div>
        <div id="tableMeta">Exibindo 1 de 1 registros.</div>
        <table class="details-table">
          <thead><tr>
            <th data-sort-field="unidade"></th>
            <th data-sort-field="edital"></th>
            <th data-sort-field="status"></th>
            <th data-sort-field="etapa"></th>
            <th data-sort-field="risco"></th>
          </tr></thead>
          <tbody id="monitorRows"><tr>
            <td>DSEI Teste</td>
            <td><a>01/2026</a><span class="expiry-badge crit"><i></i>5d</span><div class="health-row-operational tone-danger"><i></i>Próxima etapa em 3 dia(s)</div></td>
            <td><span class="chip blue">Em andamento</span></td>
            <td>Entrevistas</td>
            <td><span class="chip green">Baixo</span></td>
          </tr></tbody>
        </table>
      </section>
    `);

    expect(enhanceHealthDetailsTable(dom.window.document)).toBe(1);
    expect(enhanceHealthDetailsTable(dom.window.document)).toBe(1);

    const deadline = dom.window.document.querySelector(".health-deadline-badge");
    const operational = dom.window.document.querySelector(".health-operational-badge");
    const status = dom.window.document.querySelector(".health-status-chip");

    expect(deadline.textContent).toContain("Edital encerra em 5 dias");
    expect(operational.textContent).toContain("Cronograma");
    expect(status.getAttribute("aria-label")).toBe("Status operacional: Em andamento");
    expect(dom.window.document.querySelectorAll(".health-operational-copy")).toHaveLength(1);
  });

  it("filtra rapidamente somente editais de 2026", () => {
    const dom = new JSDOM(`
      <section id="page-dashboard">
        <div class="table-actions"><div><input id="tableSearch"></div></div>
        <div id="tableMeta">Exibindo 2 de 2 registros.</div>
        <table class="details-table">
          <thead><tr>
            <th data-sort-field="unidade"></th>
            <th data-sort-field="edital"></th>
            <th data-sort-field="status"></th>
            <th data-sort-field="etapa"></th>
            <th data-sort-field="risco"></th>
          </tr></thead>
          <tbody id="monitorRows">
            <tr><td>A</td><td><a>10/2026</a></td><td><span class="chip">Em andamento</span></td><td>Etapa</td><td>Baixo</td></tr>
            <tr><td>B</td><td><a>04/2025</a></td><td><span class="chip">Concluído</span></td><td>Final</td><td>Baixo</td></tr>
          </tbody>
        </table>
      </section>`);

    const button = ensureOnly2026Button(dom.window.document);
    button.click();

    const rows = [...dom.window.document.querySelectorAll("#monitorRows tr")];
    expect(rows[0].hidden).toBe(false);
    expect(rows[1].hidden).toBe(true);
    expect(dom.window.document.getElementById("tableMeta").textContent).toContain("1 edital(is) de 2026");
  });
});