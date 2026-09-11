import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODALIDADES, modalidadesDe } from "../src/lib/modalidades.js";

const app = readFileSync("src/analises/analises-app.js", "utf8");

/*
  Medição no Supabase principal, `vw_analises_dashboard_base`, em 10/09/2026:

    4073 registros ativos
      10 valores brutos distintos em `modalidade_concorrencia`
       0 valores não reconhecidos

  São as cinco canônicas mais cinco combinações. Como todo registro ativo tem um
  destes dez valores, provar que os dez resolvem é provar que os 4073 são
  preservados — nenhuma linha fica sem modalidade.
*/
const BRUTOS_NO_PRINCIPAL = Object.freeze([
  "Ampla concorrência",
  "Pretos e pardos",
  "Indígenas",
  "Pessoas com deficiência (PCD)",
  "Quilombolas",
  'Ampla concorrência" "Indígenas',
  'Ampla concorrência", "Indígenas',
  'Ampla concorrência", "Pretos e pardos',
  'Indígenas" "Pessoas com deficiência (PCD)',
  "Pessoas com deficiência (PCD); Indígenas",
]);

/*
  As formas que o export de 09/09/2026 trazia. Nenhuma delas sobreviveu ao
  principal de 10/09 — os separadores eram outros.

  Cinco formas de separador em dois retratos com um dia de diferença é a razão de
  o reconhecimento não procurar separador nenhum. Ficam aqui porque podem voltar,
  e porque um separador que some não pode levar a cobertura junto.
*/
const BRUTOS_HISTORICOS = Object.freeze([
  "Ampla concorrência', 'Indígenas",
  "Ampla concorrência', 'Pretos e pardos",
  "Pessoas com deficiência (PCD)  Indígenas",
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

describe("o principal em 10/09/2026: 10 valores brutos viram 5 canônicos", () => {
  it("os dez valores estão contados", () => {
    expect(BRUTOS_NO_PRINCIPAL).toHaveLength(10);
    expect(new Set(BRUTOS_NO_PRINCIPAL).size).toBe(10);
  });

  it("nenhum valor bruto fica sem reconhecimento", () => {
    for (const bruto of BRUTOS_NO_PRINCIPAL) {
      const encontradas = modalidadesDe(bruto);
      expect(encontradas.length, `${bruto} não resolveu`).toBeGreaterThan(0);
      for (const m of encontradas) {
        expect(MODALIDADES, `${bruto} devolveu não canônico`).toContain(m);
      }
    }
  });

  /*
    É este teste que sustenta o "4073 de 4073". Todo registro ativo tem um dos
    dez valores acima; se os dez resolvem para canônicas, nenhuma linha fica de
    fora.
  */
  it("a lista de filtros fica com as cinco, e só elas", () => {
    const opcoes = new Set();
    for (const bruto of BRUTOS_NO_PRINCIPAL) {
      for (const m of modalidadesDe(bruto)) opcoes.add(m);
    }
    expect(opcoes.size).toBe(5);
    expect([...opcoes].sort()).toEqual([...MODALIDADES].sort());
  });

  it("cada uma das cinco combinações devolve exatamente duas modalidades", () => {
    const combinadas = BRUTOS_NO_PRINCIPAL.filter(
      (v) => !MODALIDADES.includes(v),
    );
    expect(combinadas).toHaveLength(5);
    for (const bruto of combinadas) {
      expect(modalidadesDe(bruto), bruto).toHaveLength(2);
      expect(modalidadesDe(bruto), bruto).not.toContain(bruto);
    }
  });

  it("as cinco formas do principal, uma a uma", () => {
    expect(modalidadesDe('Ampla concorrência" "Indígenas')).toEqual([
      "Ampla concorrência",
      "Indígenas",
    ]);
    expect(modalidadesDe('Ampla concorrência", "Indígenas')).toEqual([
      "Ampla concorrência",
      "Indígenas",
    ]);
    expect(modalidadesDe('Ampla concorrência", "Pretos e pardos')).toEqual([
      "Ampla concorrência",
      "Pretos e pardos",
    ]);
    expect(modalidadesDe('Indígenas" "Pessoas com deficiência (PCD)')).toEqual([
      "Indígenas",
      "Pessoas com deficiência (PCD)",
    ]);
    expect(modalidadesDe("Pessoas com deficiência (PCD); Indígenas")).toEqual([
      "Indígenas",
      "Pessoas com deficiência (PCD)",
    ]);
  });
});

/*
  Cinco separadores diferentes em dois retratos com um dia de diferença.
  Procurar separador teria acertado um retrato e falhado no outro.
*/
describe("os separadores mudam; o reconhecimento não depende deles", () => {
  it("as formas de 09/09 continuam resolvendo", () => {
    expect(modalidadesDe(BRUTOS_HISTORICOS[0])).toEqual([
      "Ampla concorrência",
      "Indígenas",
    ]);
    expect(modalidadesDe(BRUTOS_HISTORICOS[1])).toEqual([
      "Ampla concorrência",
      "Pretos e pardos",
    ]);
    expect(modalidadesDe(BRUTOS_HISTORICOS[2])).toEqual([
      "Indígenas",
      "Pessoas com deficiência (PCD)",
    ]);
  });

  it("qualquer separador entre duas canônicas atravessa", () => {
    const separadores = [
      "', '",
      "  ",
      '" "',
      '", "',
      "; ",
      " / ",
      " e ",
      " | ",
    ];
    for (const sep of separadores) {
      expect(
        modalidadesDe(`Ampla concorrência${sep}Indígenas`),
        `separador ${JSON.stringify(sep)}`,
      ).toEqual(["Ampla concorrência", "Indígenas"]);
    }
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
    verdade tem de ficar visível e filtrável, não ser engolida em silêncio. Hoje
    o principal tem zero desses — este teste é o que garante que, quando houver
    um, ele apareça.
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
  Conter a palavra não basta.

  Procurar as canônicas dentro da célula resolve o separador que muda, mas abre
  um risco próprio: `Não indígenas` contém `indígenas`. A correção no produtor
  (`normalizeModalidadeConcorrenciaText_`, no Apps Script) fechou esse buraco lá;
  sem a mesma guarda aqui, o consumidor o reintroduziria na leitura — e o efeito
  visível seria o pior possível, uma linha filtrada como o oposto do que diz.

  As duas pontas usam a mesma semântica: fronteira lexical e negação.
*/
describe("negação e fronteira: o oposto não pode virar o valor", () => {
  it("uma negação antes da canônica descarta aquela ocorrência", () => {
    expect(modalidadesDe("Não indígenas")).toEqual(["Não indígenas"]);
    expect(modalidadesDe("Nao indigenas")).toEqual(["Nao indigenas"]);
    expect(modalidadesDe("NÃO INDÍGENAS")).toEqual(["NÃO INDÍGENAS"]);
  });

  it("a canônica dentro de outra palavra não conta", () => {
    expect(modalidadesDe("Reindígenas")).toEqual(["Reindígenas"]);
    expect(modalidadesDe("Indígenasx")).toEqual(["Indígenasx"]);
    expect(modalidadesDe("xIndígenas")).toEqual(["xIndígenas"]);
  });

  /*
    A negação atinge só a modalidade negada. Uma vaga de ampla concorrência que
    exclui indígenas continua sendo de ampla concorrência.
  */
  it("a negação não contamina as outras modalidades do mesmo texto", () => {
    expect(modalidadesDe("Ampla concorrência, exceto indígenas")).toEqual([
      "Ampla concorrência",
    ]);
  });

  it("as outras formas de negação também bloqueiam", () => {
    for (const texto of [
      "Exceto indígenas",
      "Sem indígenas",
      "Nem quilombolas",
      "Salvo pretos e pardos",
      "Excluindo indígenas",
    ]) {
      expect(modalidadesDe(texto), texto).toEqual([texto]);
    }
  });

  /*
    O reconhecimento legítimo não pode ser afetado pelas guardas: as dez formas
    do principal continuam resolvendo, inclusive a que termina em parêntese —
    `Pessoas com deficiência (PCD)` não tem letra no fim, e exigir separador
    depois do parêntese a rejeitaria.
  */
  it("as guardas não quebram nenhum reconhecimento legítimo", () => {
    for (const bruto of BRUTOS_NO_PRINCIPAL) {
      const encontradas = modalidadesDe(bruto);
      expect(encontradas.length, `${bruto} deixou de resolver`).toBeGreaterThan(
        0,
      );
      for (const m of encontradas) {
        expect(MODALIDADES, `${bruto} devolveu não canônico`).toContain(m);
      }
    }
    expect(modalidadesDe('Indígenas" "Pessoas com deficiência (PCD)')).toEqual([
      "Indígenas",
      "Pessoas com deficiência (PCD)",
    ]);
  });

  it("produtor e consumidor combinam a mesma guarda", () => {
    const fonte = readFileSync("src/lib/modalidades.js", "utf8");
    const codigo = fonte
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toContain("alvo.includes(m.chave)");
    expect(codigo).toContain("ocorreSemNegacao(alvo, m.chave)");
  });
});

describe("o efeito no filtro", () => {
  it("a linha combinada é achada pelas duas modalidades", () => {
    const linha = 'Ampla concorrência", "Indígenas';
    const casa = (escolhida) => modalidadesDe(linha).includes(escolhida);
    expect(casa("Indígenas")).toBe(true);
    expect(casa("Ampla concorrência")).toBe(true);
    expect(casa("Quilombolas")).toBe(false);
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
