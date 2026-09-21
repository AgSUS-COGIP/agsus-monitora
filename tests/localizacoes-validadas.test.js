import { describe, expect, it } from "vitest";
import {
  chaveDaUnidade,
  coordenadaValidada,
  indexarVereditos,
  rotuloDaLocalizacao,
  veredictoDaUnidade,
} from "../src/lib/localizacoes-validadas.js";
import { LOCALIZACOES_VALIDADAS } from "../src/lib/localizacoes-validadas-gerado.js";

describe("chave da unidade", () => {
  /*
    As duas fontes escrevem o mesmo sítio de maneiras diferentes. Se a chave
    fosse o nome bruto, nenhum veredito encontraria a sua unidade.
  */
  it("junta as grafias do mesmo polo", () => {
    const esperada = chaveDaUnidade("ALTO RIO JURUA", "POLO BASE FEIJÓ");
    expect(chaveDaUnidade("ALTO RIO JURUA", "PB FEIJÓ")).toBe(esperada);
    expect(chaveDaUnidade("Alto Rio Juruá", "Feijó")).toBe(esperada);
  });

  it("não devolve chave quando o nome não sobrevive ao canónico", () => {
    expect(chaveDaUnidade("X", "PB")).toBe("");
    expect(chaveDaUnidade("X", "")).toBe("");
  });
});

describe("índice de vereditos", () => {
  it("encontra o veredito pelo DSEI e pelo nome", () => {
    const indice = indexarVereditos([
      {
        dsei: "POTIGUARA",
        canonico: "JOAO CAMARA",
        estado: "validada",
        lat: -5.5,
        lon: -35.8,
      },
    ]);
    const v = veredictoDaUnidade("Potiguara", "POLO BASE JOAO CAMARA", indice);
    expect(v?.estado).toBe("validada");
  });

  /*
    Duas linhas com a mesma chave não decidem nada — é exatamente a situação em
    que o script se recusa a arbitrar. O índice não pode escolher uma delas.
  */
  it("descarta a chave repetida em vez de escolher uma", () => {
    const indice = indexarVereditos([
      { dsei: "X", canonico: "AAA", estado: "validada", lat: 1, lon: 2 },
      { dsei: "X", canonico: "AAA", estado: "erro" },
    ]);
    expect(veredictoDaUnidade("X", "AAA", indice)).toBeNull();
  });

  it("ausência de veredito não é veredito", () => {
    const indice = indexarVereditos([]);
    expect(veredictoDaUnidade("X", "POLO BASE Y", indice)).toBeNull();
    expect(rotuloDaLocalizacao(null)).toBe("Localização em validação");
  });
});

describe("o que o mapa mostra", () => {
  it("só diz validada quando houve prova", () => {
    expect(rotuloDaLocalizacao({ estado: "validada" })).toBe(
      "Localização validada",
    );
    expect(rotuloDaLocalizacao({ estado: "coerente" })).toBe(
      "Localização em validação",
    );
  });

  it("não esconde a coordenada que cai fora da UF declarada", () => {
    expect(rotuloDaLocalizacao({ estado: "erro" })).toContain(
      "fora da UF declarada",
    );
  });

  it("só substitui a coordenada quando o veredito é validada", () => {
    expect(
      coordenadaValidada({ estado: "validada", lat: -5.5, lon: -35.8 }),
    ).toEqual({
      lat: -5.5,
      lon: -35.8,
    });
    expect(
      coordenadaValidada({ estado: "erro", lat: -5.5, lon: -35.8 }),
    ).toBeNull();
    expect(
      coordenadaValidada({ estado: "coerente", lat: -5.5, lon: -35.8 }),
    ).toBeNull();
    expect(coordenadaValidada({ estado: "validada" })).toBeNull();
  });
});

/*
  O ficheiro gerado é dado, não código, mas é dado que decide o que o mapa
  desenha. Estes casos travam uma regeneração que saia deformada.
*/
describe("o ficheiro gerado", () => {
  it("só traz vereditos que mudam alguma coisa", () => {
    const estados = new Set(LOCALIZACOES_VALIDADAS.map((r) => r.estado));
    expect([...estados].sort()).toEqual(["erro", "validada"]);
  });

  it("todo veredito validada traz coordenada utilizável", () => {
    for (const r of LOCALIZACOES_VALIDADAS) {
      if (r.estado !== "validada") continue;
      expect(Number.isFinite(r.lat), `${r.canonico} sem latitude`).toBe(true);
      expect(Number.isFinite(r.lon), `${r.canonico} sem longitude`).toBe(true);
      expect(Math.abs(r.lat), `${r.canonico} fora do planeta`).toBeLessThan(90);
      expect(Math.abs(r.lon), `${r.canonico} fora do planeta`).toBeLessThan(
        180,
      );
    }
  });

  /*
    As coordenadas do Brasil continental cabem nesta caixa. Serve de rede
    contra o erro que a auditoria encontrou na planilha — uma linha com o ponto
    decimal perdido, a afirmar latitude -24182303.
  */
  it("nenhuma coordenada validada cai fora do Brasil", () => {
    for (const r of LOCALIZACOES_VALIDADAS) {
      if (r.estado !== "validada") continue;
      expect(r.lat, `${r.canonico}`).toBeGreaterThan(-34);
      expect(r.lat, `${r.canonico}`).toBeLessThan(6);
      expect(r.lon, `${r.canonico}`).toBeGreaterThan(-74);
      expect(r.lon, `${r.canonico}`).toBeLessThan(-34);
    }
  });

  it("cada veredito identifica o DSEI e a unidade", () => {
    for (const r of LOCALIZACOES_VALIDADAS) {
      expect(r.dsei, "veredito sem DSEI").toBeTruthy();
      expect(r.canonico, "veredito sem nome canónico").toBeTruthy();
      expect(r.motivo, "veredito sem motivo").toBeTruthy();
    }
  });
});
