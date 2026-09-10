import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODALIDADES, modalidadesDe } from "../src/lib/modalidades.js";

const app = readFileSync("src/analises/analises-app.js", "utf8");

/*
  Os valores abaixo não são inventados: são a distribuição medida no export de
  09/09/2026, 3561 linhas do recorte Ativo. As cinco canônicas cobrem 3556
  linhas; cinco linhas trazem combinações, em duas formas de separador
  diferentes.
*/
const MEDIDO = Object.freeze([
  ["Ampla concorrência", 2424],
  ["Pretos e pardos", 584],
  ["Indígenas", 447],
  ["Pessoas com deficiência (PCD)", 94],
  ["Quilombolas", 7],
  ["Ampla concorrência', 'Indígenas", 3],
  ["Ampla concorrência', 'Pretos e pardos", 1],
  ["Pessoas com deficiência (PCD)  Indígenas", 1],
]);

describe("as cinco modalidades canônicas", () => {
  it("são exatamente essas", () => {
    expect([...MODALIDADES]).toEqual([
      "Ampla concorrência",
      "Pretos e pardos",
      "Indígenas",
      "Pessoas com deficiência (PCD)",
      "Quilombolas",
    ]);
  });

  it("cada uma sozinha continua sendo ela mesma", () => {
    for (const modalidade of MODALIDADES) {
      expect(modalidadesDe(modalidade)).toEqual([modalidade]);
    }
  });
});

/*
  As duas formas medidas. O separador `', '` são restos de uma lista serializada
  como texto; o de dois espaços é outra coisa. Como divergem, a busca é pelas
  canônicas dentro da célula, não pelo separador.
*/
describe("as combinações medidas viram conjuntos", () => {
  it("separador de lista serializada", () => {
    expect(modalidadesDe("Ampla concorrência', 'Indígenas")).toEqual([
      "Ampla concorrência",
      "Indígenas",
    ]);
    expect(modalidadesDe("Ampla concorrência', 'Pretos e pardos")).toEqual([
      "Ampla concorrência",
      "Pretos e pardos",
    ]);
  });

  it("separador de dois espaços", () => {
    expect(modalidadesDe("Pessoas com deficiência (PCD)  Indígenas")).toEqual([
      "Indígenas",
      "Pessoas com deficiência (PCD)",
    ]);
  });

  /*
    A forma que o relato original supunha. Não apareceu na medição, mas passar a
    procurar as canônicas em vez do separador faz esta funcionar de graça — e é
    justamente por isso que a busca é por conteúdo.
  */
  it("e a forma entre aspas, que também atravessa", () => {
    expect(modalidadesDe('"Ampla concorrência" "Indígenas"')).toEqual([
      "Ampla concorrência",
      "Indígenas",
    ]);
  });

  it("a ordem é a canônica, não a de aparição", () => {
    expect(modalidadesDe("Indígenas, Ampla concorrência")).toEqual([
      "Ampla concorrência",
      "Indígenas",
    ]);
    expect(modalidadesDe("Ampla concorrência, Indígenas")).toEqual([
      "Ampla concorrência",
      "Indígenas",
    ]);
  });
});

describe("o que não é canônico não desaparece", () => {
  /*
    Sumir da lista seria pior do que aparecer torto: uma modalidade nova de
    verdade tem de ficar visível e filtrável, não ser engolida em silêncio.
  */
  it("um valor desconhecido volta como está", () => {
    expect(modalidadesDe("Modalidade inventada em 2027")).toEqual([
      "Modalidade inventada em 2027",
    ]);
  });

  it("vazio não vira uma opção fantasma", () => {
    expect(modalidadesDe("")).toEqual([]);
    expect(modalidadesDe("   ")).toEqual([]);
    expect(modalidadesDe(null)).toEqual([]);
    expect(modalidadesDe(undefined)).toEqual([]);
  });

  it("tolera caixa e acento, e devolve o rótulo canônico", () => {
    expect(modalidadesDe("AMPLA CONCORRENCIA")).toEqual(["Ampla concorrência"]);
    expect(modalidadesDe("indigenas")).toEqual(["Indígenas"]);
    expect(modalidadesDe("Ampla   concorrência")).toEqual([
      "Ampla concorrência",
    ]);
  });
});

/*
  O efeito que se queria: a lista de filtros volta a ter cinco entradas, e a
  linha combinada passa a ser encontrada pelas duas modalidades dela.
*/
describe("o efeito sobre o filtro", () => {
  it("oito valores brutos medidos viram cinco opções", () => {
    const opcoes = new Set();
    for (const [bruto] of MEDIDO) {
      for (const m of modalidadesDe(bruto)) opcoes.add(m);
    }
    expect([...opcoes].sort()).toEqual([...MODALIDADES].sort());
    expect(opcoes.size).toBe(5);
  });

  it("a linha combinada é achada pelas duas modalidades", () => {
    const linha = "Ampla concorrência', 'Indígenas";
    const casa = (escolhida) => modalidadesDe(linha).includes(escolhida);
    expect(casa("Indígenas")).toBe(true);
    expect(casa("Ampla concorrência")).toBe(true);
    expect(casa("Quilombolas")).toBe(false);
  });

  /*
    Antes, a mesma linha só era achada pela combinação inteira — e a combinação
    inteira era uma sexta entrada na lista.
  */
  it("nenhuma das combinações continua sendo uma opção própria", () => {
    const combinadas = MEDIDO.map(([v]) => v).filter(
      (v) => !MODALIDADES.includes(v),
    );
    expect(combinadas).toHaveLength(3);
    for (const bruto of combinadas) {
      expect(modalidadesDe(bruto)).not.toContain(bruto);
      expect(modalidadesDe(bruto).length).toBe(2);
    }
  });
});

describe("ligação no painel", () => {
  it("o filtro de modalidade usa o conjunto, não a célula crua", () => {
    expect(app).toContain(
      'import { modalidadesDe } from "../lib/modalidades.js"',
    );
    expect(app).toContain(
      "getValues: row => modalidadesDe(row.modalidade_concorrencia)",
    );
    expect(app).not.toContain("[txt(row.modalidade_concorrencia)]");
  });

  /*
    O casamento já era `rowValues.some(...)`, e `fPdf` já devolvia vários
    valores. Só a modalidade achatava o conjunto num texto — por isso a correção
    é de uma linha e não mexe no mecanismo.
  */
  it("o mecanismo de filtro já aceita vários valores por linha", () => {
    expect(app).toContain(
      "return rowValues.some(value => selectedSet.has(norm(value)));",
    );
  });
});
