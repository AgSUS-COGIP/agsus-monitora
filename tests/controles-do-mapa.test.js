import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  criarBotaoDoMapa,
  legendaComecaAberta,
  montarLegendaRecolhivel,
} from "../src/modules/controles-do-mapa.js";

const app = readFileSync("src/modules/legacy-app.js", "utf8");
const EMOJI = /\p{Extended_Pictographic}/u;

describe("botões Brasil e Calor do mapa nacional", () => {
  it("desenham um ícone Lucide de 16px, decorativo, e mantêm o texto", () => {
    const botao = criarBotaoDoMapa(document, {
      icone: "flame",
      rotulo: "Calor",
    });
    const svg = botao.querySelector("svg.icone");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("data-icone")).toBe("flame");
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(botao.textContent).toBe("Calor");
    expect(botao.type).toBe("button");
  });

  it("o legado usa os ícones map e flame, sem emoji no rótulo", () => {
    const controle = app.slice(
      app.indexOf("const HomeCtl = L.Control.extend"),
      app.indexOf("_leaflet.addControl(new HomeCtl())"),
    );
    expect(controle).toContain('icone: "map", rotulo: "Brasil"');
    expect(controle).toContain('icone: "flame"');
    expect(controle).toContain('rotulo: "Calor"');
    expect(controle).not.toMatch(EMOJI);
    expect(controle).not.toContain("innerHTML");
  });
});

describe("legenda recolhível do mapa nacional", () => {
  it("começa fechada abaixo de 768px e aberta a partir daí", () => {
    expect(legendaComecaAberta(375)).toBe(false);
    expect(legendaComecaAberta(767)).toBe(false);
    expect(legendaComecaAberta(768)).toBe(true);
    expect(legendaComecaAberta(1440)).toBe(true);
    expect(legendaComecaAberta(undefined)).toBe(true);
  });

  it("no celular mostra só o cabeçalho, com aria-expanded e aria-controls", () => {
    const caixa = document.createElement("div");
    document.body.append(caixa);
    const { botao, corpo } = montarLegendaRecolhivel(caixa, { largura: 375 });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(botao.getAttribute("aria-controls")).toBe(corpo.id);
    expect(corpo.hidden).toBe(true);
    expect(botao.querySelector("svg").getAttribute("data-icone")).toBe(
      "chevron-down",
    );

    botao.click();
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(corpo.hidden).toBe(false);
    expect(botao.querySelectorAll("svg")).toHaveLength(1);
    expect(botao.querySelector("svg").getAttribute("data-icone")).toBe(
      "chevron-up",
    );
    caixa.remove();
  });

  it("no desktop começa aberta", () => {
    const caixa = document.createElement("div");
    const { botao, corpo } = montarLegendaRecolhivel(caixa, { largura: 1280 });
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(corpo.hidden).toBe(false);
  });

  /*
    O controle é criado uma vez; ao trocar Brasil/DSEI o legado reescreve só o
    título e o corpo. Reescrever a caixa inteira apagaria o botão e o estado.
  */
  it("o legado reescreve título e corpo, não a caixa inteira", () => {
    const sync = app.slice(
      app.indexOf("function syncMapLevelUI()"),
      app.indexOf("function renderRisks()"),
    );
    expect(sync).toContain('box.querySelector("[data-legenda-titulo]")');
    expect(sync).toContain('box.querySelector("[data-legenda-corpo]")');
    expect(sync).not.toContain("box.innerHTML");
    expect(app).toContain("montarLegendaRecolhivel(d, {");
  });
});
