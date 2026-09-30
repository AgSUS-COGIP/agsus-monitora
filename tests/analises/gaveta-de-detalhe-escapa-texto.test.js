import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/analises/analises-pareceres-sob-demanda.js", () => ({
  buscarParecerDaLinha: vi.fn(async () => ""),
}));

/*
  A gaveta de detalhe lê textos das células (candidato, responsável, unidade,
  edital) por textContent e os devolve como HTML. Sem escape, um nome gravado
  como `<img src=x onerror=…>` virava marcação executável na gaveta.
*/
const MALICIOSO = '<img src="x" onerror="window.__xss = true">';

function montarTabela() {
  document.body.innerHTML = `
    <table><tbody id="tableBody">
      <tr>
        <td></td><td></td><td></td><td></td>
        <td><span class="primary-text"></span></td>
        <td><span class="primary-text"></span><span class="secondary-text"></span></td>
        <td></td>
        <td><button type="button" onclick="toggleDetails('k%7C0')">Ver</button></td>
      </tr>
      <tr class="detail-row"><td><div class="detail-shell"><div class="detail-grid"></div></div></td></tr>
    </tbody></table>`;
  const celulas = document.querySelectorAll("#tableBody tr:first-child td");
  celulas[0].textContent = "Grupo A";
  celulas[1].textContent = MALICIOSO;
  celulas[2].textContent = MALICIOSO;
  celulas[3].textContent = "V-01";
  celulas[4].querySelector(".primary-text").textContent = "Enfermeiro";
  celulas[5].querySelector(".primary-text").textContent = MALICIOSO;
  celulas[5].querySelector(".secondary-text").textContent = MALICIOSO;
  celulas[6].textContent = MALICIOSO;
}

beforeAll(async () => {
  window.toggleDetails = vi.fn();
  await import("../../src/analises/analises-detail-runtime-fix.js");
});

describe("gaveta de detalhe das análises", () => {
  it("mostra os textos das células como texto, nunca como HTML", async () => {
    montarTabela();
    document.querySelector("#tableBody button").click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const gaveta = document.getElementById("analisesDetailDrawer");
    expect(gaveta.hidden).toBe(false);
    expect(gaveta.querySelector("img")).toBeNull();
    expect(window.__xss).toBeUndefined();

    expect(gaveta.querySelector("#analisesDrawerTitle").textContent).toBe(
      MALICIOSO,
    );
    const resumo = gaveta.querySelector("#analisesDrawerSummary").textContent;
    expect(resumo).toContain(MALICIOSO);
    const contexto = [
      ...gaveta.querySelectorAll("#analisesDrawerContext strong"),
    ].map((el) => el.textContent);
    expect(contexto).toContain(MALICIOSO);
  });

  it("uma só gaveta e um só Escape fecham o detalhe", async () => {
    expect(document.querySelectorAll("#analisesDetailDrawer")).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("analisesDetailDrawer").hidden).toBe(true);
  });
});
