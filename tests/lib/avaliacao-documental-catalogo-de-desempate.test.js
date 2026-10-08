import { describe, expect, it } from "vitest";
import { GRUPOS_DO_CARDAPIO } from "../../src/lib/avaliacao-documental/assistente-da-regra.ts";
import { DESEMPATES_DA_PROVISORIA } from "../../src/lib/avaliacao-documental/catalogo.js";
import {
  catalogoAgrupado,
  CRITERIOS_DA_CLASSIFICACAO,
  CRITERIOS_DA_PROVISORIA,
  GRUPOS_DE_DESEMPATE,
} from "../../src/lib/avaliacao-documental/catalogo-de-desempate.ts";
import { CATALOGO_DE_CRITERIOS } from "../../src/lib/classificacao/catalogo.js";

/*
  O passo 2 começa por "Na inscrição" e o passo 4 mostra o catálogo INTEIRO
  de desempate (classificação e Provisória), em grupos e com busca.
*/
describe("cardápio do assistente", () => {
  it("o grupo Na inscrição vem primeiro, antes de requisitos, pontos e cotas", () => {
    expect(GRUPOS_DO_CARDAPIO.map(([g]) => g)).toEqual([
      "inscricao",
      "eliminatorios",
      "pontos",
      "cotas",
    ]);
  });
});

describe("catálogo de desempate", () => {
  it("a classificação oferece todos os critérios do catálogo, em grupos", () => {
    const grupos = catalogoAgrupado(CRITERIOS_DA_CLASSIFICACAO, []);
    const codigos = grupos.flatMap((g) => g.itens.map((i) => i.codigo));
    expect(codigos.sort()).toEqual(
      CATALOGO_DE_CRITERIOS.map((c) => c.codigo).sort(),
    );
    expect(grupos.map((g) => g.titulo)).toEqual(
      GRUPOS_DE_DESEMPATE.map(([, t]) => t),
    );
    const doGrupo = (grupo) =>
      grupos.find((g) => g.grupo === grupo).itens.map((i) => i.codigo);
    expect(doGrupo("legal")).toEqual([
      "IDOSO_60",
      "INDIGENA_COMPROVADO",
      "PCD",
    ]);
    expect(doGrupo("idade")).toEqual(["MAIOR_IDADE"]);
    expect(doGrupo("experiencia")).toContain("EXP_SAUDE_INDIGENA");
    expect(doGrupo("experiencia")).toContain("EXP_ATENCAO_BASICA");
    expect(doGrupo("pontuacao")).toEqual(
      expect.arrayContaining([
        "NOTA_DOCUMENTAL",
        "NOTA_ENTREVISTA",
        "PONTUACAO_ETNICA",
        "PONTUACAO_EXPERIENCIA",
        "PONTUACAO_FORMACAO",
        "PONTUACAO_CURSOS",
        "NOTA_CONHECIMENTOS_ESPECIFICOS",
      ]),
    );
    expect(doGrupo("outros")).toEqual(["MAIOR_ESCOLARIDADE"]);
  });

  it("marca os já usados com a posição e busca sem acento", () => {
    const grupos = catalogoAgrupado(CRITERIOS_DA_CLASSIFICACAO, [
      "NOTA_DOCUMENTAL",
      "IDOSO_60",
    ]);
    const item = (codigo) =>
      grupos.flatMap((g) => g.itens).find((i) => i.codigo === codigo);
    expect(item("IDOSO_60").posicao).toBe(2);
    expect(item("NOTA_DOCUMENTAL").posicao).toBe(1);
    expect(item("PCD").posicao).toBeNull();
    const busca = catalogoAgrupado(CRITERIOS_DA_CLASSIFICACAO, [], "saude");
    expect(busca.flatMap((g) => g.itens.map((i) => i.codigo))).toEqual([
      "EXP_SAUDE_INDIGENA",
      "EXP_SAUDE_DIGITAL",
    ]);
    expect(catalogoAgrupado(CRITERIOS_DA_CLASSIFICACAO, [], "zzz")).toEqual([]);
  });

  it("a Provisória tem o próprio catálogo (o que a base Python calcula), inteiro", () => {
    const grupos = catalogoAgrupado(CRITERIOS_DA_PROVISORIA, ["IDOSO"]);
    expect(grupos.flatMap((g) => g.itens.map((i) => i.codigo)).sort()).toEqual(
      DESEMPATES_DA_PROVISORIA.map(([c]) => c).sort(),
    );
    expect(grupos.map((g) => g.grupo)).toEqual([
      "legal",
      "experiencia",
      "idade",
      "outros",
    ]);
  });
});
