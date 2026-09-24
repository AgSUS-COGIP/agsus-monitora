import { describe, expect, it } from "vitest";
import { House, ChartColumn, ChartPie, Scale } from "lucide";
import {
  iconeDaNavegacao,
  noDoIconeDaTela,
  setaDoGrupo,
  svgDoIcone,
} from "../src/lib/icones-da-navegacao.js";

describe("ícones da barra lateral", () => {
  it("cada tela interna tem o seu", () => {
    expect(noDoIconeDaTela("dashboard", "fa-chart-line")).toBe(House);
  });

  it("painel externo traduz o nome do Font Awesome gravado no banco", () => {
    expect(noDoIconeDaTela("panel:recrutamento", "fa-chart-pie")).toBe(
      ChartPie,
    );
    expect(
      noDoIconeDaTela("panel:recursos", "fa-solid fa-scale-balanced"),
    ).toBe(Scale);
  });

  it("nome desconhecido ou vazio vira gráfico de colunas", () => {
    expect(noDoIconeDaTela("panel:x", "fa-inexistente")).toBe(ChartColumn);
    expect(noDoIconeDaTela("panel:x", "")).toBe(ChartColumn);
  });

  it("gera SVG de traço, decorativo, na cor do texto", () => {
    const svg = iconeDaNavegacao("nucleo");
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('class="nav-svg"');
    expect(setaDoGrupo()).toContain('class="nav-grupo__seta"');
  });

  it("escapa atributos", () => {
    const svg = svgDoIcone([["path", { d: '"><script>' }]]);
    expect(svg).not.toContain("<script>");
  });
});
