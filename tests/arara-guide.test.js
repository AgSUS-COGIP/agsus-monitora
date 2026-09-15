import { beforeEach, describe, expect, it } from "vitest";
import { updateAraraGuide } from "../src/modules/arara-guide.js";

describe("guia da Arara Azul", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });
  it("mantém um guia e preserva sua abertura ao renderizar a mesma seção", () => {
    const host = document.getElementById("host");
    const guide = updateAraraGuide("dashboard", "Saúde Indígena", host);
    guide.open = true;
    updateAraraGuide("dashboard", "Saúde Indígena", host);
    expect(host.querySelectorAll("details")).toHaveLength(1);
    expect(guide.open).toBe(true);
    expect(guide.textContent).toContain("mapa");
  });
  it("troca a orientação e recolhe os detalhes ao navegar", () => {
    const host = document.getElementById("host");
    const guide = updateAraraGuide("dashboard", "", host);
    guide.open = true;
    updateAraraGuide("nucleo", "", host);
    expect(guide.open).toBe(false);
    expect(guide.textContent).toContain("cronograma");
    expect(guide.textContent).not.toContain("território");
  });
  it("trata títulos de painéis como texto, sem executar marcação", () => {
    const host = document.getElementById("host");
    updateAraraGuide("panel:custom", '<img src=x onerror="alert(1)">', host);
    expect(host.querySelectorAll("img")).toHaveLength(1);
    expect(host.textContent).toContain("<img");
  });
  it("não exige que o contêiner exista", () => {
    expect(updateAraraGuide("dashboard", "", null)).toBeNull();
  });
});
