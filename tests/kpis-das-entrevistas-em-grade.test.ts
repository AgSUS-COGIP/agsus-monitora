import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Os KPIs da tela de Entrevistas em grade equilibrada. Eram oito cards numa
  grade de sete colunas a partir de 1380px: sete na primeira linha e o
  último sozinho na segunda (11/11/2026). O jsdom não mede layout, então o
  teste confere no CSS de origem que cada corte da grade divide os oito
  cards por igual: 8 numa linha, 4 × 2 no meio e as 2 colunas de src/ui/ no
  celular.
*/

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

/** Colunas de `seletor` em cada `@media` (a condição como está no CSS). */
function colunasPorMedia(css: string, seletor: string): Map<string, number> {
  const colunas = new Map<string, number>();
  for (const media of css.matchAll(/@media([^{]+)\{/g)) {
    // O corpo do @media vai até a chave que fecha a dele.
    let nivel = 1;
    let fim = (media.index ?? 0) + media[0].length;
    while (nivel > 0 && fim < css.length) {
      if (css[fim] === "{") nivel += 1;
      if (css[fim] === "}") nivel -= 1;
      fim += 1;
    }
    const corpo = css.slice((media.index ?? 0) + media[0].length, fim - 1);
    for (const [, seletores = "", declaracoes = ""] of corpo.matchAll(
      /([^{}]+)\{([^{}]*)\}/g,
    )) {
      const lista = seletores.split(",").map((s) => s.trim());
      const repeticao = /grid-template-columns:\s*repeat\((\d+),/.exec(
        declaracoes,
      );
      if (lista.includes(seletor) && repeticao)
        colunas.set(
          (media[1] ?? "").replace(/\s+/g, " ").trim(),
          Number(repeticao[1]),
        );
    }
  }
  return colunas;
}

/** Quantos <Kpi> a grade de Indicadores das Entrevistas monta. */
function kpisDaGrade(): number {
  const jsx = ler("src/modulos/entrevistas/paineis.tsx");
  const grade =
    /<GradeDeKpis[\s\S]*?className="entrevistas-kpis"[\s\S]*?<\/GradeDeKpis>/.exec(
      jsx,
    );
  return grade ? (grade[0].match(/<Kpi\b/g) || []).length : 0;
}

describe("KPIs das Entrevistas em grade equilibrada", () => {
  const css = ler("src/modulos/entrevistas/entrevistas.css");
  const colunas = colunasPorMedia(css, ".entrevistas-kpis");
  const total = kpisDaGrade();

  it("monta os oito indicadores", () => {
    expect(total).toBe(8);
  });

  it("põe os oito numa fileira só em tela larga", () => {
    expect(colunas.get("(min-width: 1380px)")).toBe(total);
  });

  it("faz 4 × 2 nas telas médias, sem buraco entre o celular e a tela larga", () => {
    expect(colunas.get("(min-width: 641px) and (max-width: 1379px)")).toBe(4);
  });

  it("no celular, fica com as duas colunas de src/ui/", () => {
    const ui = ler("src/ui/ui.css");
    expect(colunasPorMedia(ui, ".ui-kpis").get("(max-width: 640px)")).toBe(2);
  });

  it("nenhum corte deixa um card sozinho na última linha", () => {
    expect(colunas.size).toBeGreaterThan(0);
    for (const [condicao, n] of colunas)
      expect({ condicao, sobra: total % n }).toEqual({ condicao, sobra: 0 });
  });
});
