import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SEDES_DOCUMENTADAS,
  afinidadeComODsei,
  bairroGenerico,
  decidir,
  kmAteAGeometria,
  mesmaRua,
  mesmoBairro,
  nomeDoEstabelecimento,
  pareceSede,
  pontoMaisProximo,
  variantesDoEndereco,
} from "../scripts/localizar-sedes-dos-dsei.mjs";

/*
  A ESTRELA DA SEDE NO ENDEREÇO DA SEDE

  Cada caso abaixo é uma armadilha em que a primeira versão do levantamento
  caiu, com os dados reais de 23/09/2026.
*/
describe("o que é a sede", () => {
  it("a unidade que se chama distrito", () => {
    expect(pareceSede("DISTRITO SANITARIO ESPECIAL INDIGENA XINGU")).toBe(true);
    expect(pareceSede("DSEI XINGU")).toBe(true);
    expect(pareceSede("DISTRITO SANITARIO ESPECIAL INDIGINA ALSE")).toBe(true);
  });

  it("e não a CASAI, o polo ou o posto do mesmo DSEI", () => {
    expect(pareceSede("CASAI CANARANA")).toBe(false);
    expect(pareceSede("POLO BASE SANTA ISABEL DO RIO NEGRO DSEI ARN")).toBe(
      false,
    );
    expect(pareceSede("DSEI AP POLO BASE DE SAUDE INDIGENA KUMENE")).toBe(
      false,
    );
    expect(pareceSede("CASA DE SAUDE INDIGENA DSEI CE")).toBe(false);
  });

  /*
    A razão social de TODO polo de um DSEI é "Distrito Sanitário Especial
    Indígena ...". Olhá-la fez o levantamento escolher o Polo Base Milho como
    sede do Yanomami.
  */
  it("olha o nome fantasia, não a razão social", () => {
    const polo = {
      nome: "POLO BASE INDIGENA MILHO",
      razao: "DISTRITO SANITARIO ESPECIAL INDIGENA YANOMAMI",
    };
    expect(pareceSede(nomeDoEstabelecimento(polo))).toBe(false);
    expect(nomeDoEstabelecimento({ nome: "", razao: "DSEI X" })).toBe("DSEI X");
  });

  // Boa Vista tem duas sedes; é o nome que diz qual é de quem.
  it("separa as duas sedes de Boa Vista pelo nome", () => {
    const yanomami = "DISTRITO SANITARIO ESPECIAL INDIGENA YANOMAMI E YEKWANA";
    const leste = "DISTRITO SANITARIO ESPECIAL INDIGENA LESTE DE RORAIMA";
    expect(afinidadeComODsei(yanomami, "Yanomami")).toBeGreaterThan(
      afinidadeComODsei(leste, "Yanomami"),
    );
    expect(afinidadeComODsei(leste, "Leste de Roraima")).toBeGreaterThan(
      afinidadeComODsei(yanomami, "Leste de Roraima"),
    );
  });
});

describe("a rua do endereço", () => {
  /*
    O Nominatim, quando não acha a rua pedida, devolve outra: "777 Avenida
    Goiás" em Canarana trouxe a Avenida Santa Catarina.
  */
  it("só aceita a rua pedida", () => {
    expect(mesmaRua("777 AVENIDA GOIAS", "Avenida Santa Catarina")).toBe(false);
    expect(mesmaRua("777 AVENIDA GOIAS", "Avenida Goiás")).toBe(true);
    expect(mesmaRua("AV RAFAEL VAZ E SILVA", "Rua Rafael Vaz e Silva")).toBe(
      true,
    );
    expect(mesmaRua("166 RUA 5 DE JANEIRO", "Rua Cinco de Janeiro")).toBe(true);
  });

  it("uma esquina vira as duas ruas, e o número vai com a última", () => {
    expect(variantesDoEndereco("MATO GROSSO X AVENIDA GOIAS", "777")).toEqual([
      "777 AVENIDA GOIAS",
      "AVENIDA GOIAS",
      "MATO GROSSO",
    ]);
  });

  it("o zero à esquerda sai, e S/N não é número", () => {
    expect(variantesDoEndereco("RUA 05 DE JANEIRO", "166")[0]).toBe(
      "166 RUA 5 DE JANEIRO",
    );
    expect(variantesDoEndereco("COMUNIDADE MILHO", "S/N")).toEqual([
      "COMUNIDADE MILHO",
    ]);
  });

  // "GOIABEIRAS" no CNES é "Goiabeira" no OSM.
  it("o bairro compara-se sem o plural", () => {
    expect(mesmoBairro("GOIABEIRAS", "Goiabeira")).toBe(true);
    expect(mesmoBairro("CHAPADA", "São Geraldo Manaus")).toBe(false);
    expect(mesmoBairro("CENTRO", "Centro")).toBe(false);
    expect(bairroGenerico("CENTRAL")).toBe(true);
  });
});

describe("a medida contra o traçado da rua", () => {
  // Uma rua reta de leste a oeste no equador: 0,001° ≈ 111 m.
  const rua = [
    {
      type: "LineString",
      coordinates: [
        [-60, 0],
        [-59.99, 0],
      ],
    },
  ];

  it("mede até à rua, e não até ao meio dela", () => {
    expect(kmAteAGeometria(0.001, -59.995, rua)).toBeCloseTo(0.1106, 2);
    // Ponta da rua: a distância é à ponta, não ao centro do trecho.
    expect(kmAteAGeometria(0, -60.001, rua)).toBeCloseTo(0.111, 2);
  });

  it("encaixa na beira da rua, guardando a posição ao longo dela", () => {
    const p = pontoMaisProximo(0.002, -59.993, rua);
    expect(p.lat).toBeCloseTo(0, 6);
    expect(p.lon).toBeCloseTo(-59.993, 6);
  });
});

describe("a decisão", () => {
  const centroAtual = { lat: 0, lon: 0.5 };
  const trechos = [
    {
      type: "LineString",
      coordinates: [
        [-60, 0],
        [-59.99, 0],
      ],
    },
  ];
  const cnes = (lat, lon, dentro = true) => ({ lat, lon, dentro });
  const rua = { trechos, ponto: { lat: 0, lon: -59.995 } };

  it("CNES em cima da rua do endereço: fica o CNES", () => {
    expect(
      decidir({ cnes: cnes(0.0003, -59.995), geo: rua, centroAtual }),
    ).toMatchObject({
      acao: "cnes",
      motivo: "cnes_na_rua_declarada",
    });
  });

  it("CNES ao lado da porta: as duas concordam", () => {
    const geo = { ...rua, numero: { lat: 0.0005, lon: -59.995 } };
    expect(
      decidir({ cnes: cnes(0.001, -59.995), geo, centroAtual }).motivo,
    ).toBe("duas_fontes_concordam");
  });

  // Amapá: a porta exata no OSM, o CNES na mesma avenida a quase 1 km.
  it("a porta certa vale mais que um ponto da avenida certa", () => {
    const geo = { ...rua, numero: { lat: 0, lon: -59.999 } };
    expect(decidir({ cnes: cnes(0, -59.99), geo, centroAtual })).toMatchObject({
      acao: "numero",
    });
  });

  // Belém: a avenida é a divisa, e o OSM rotula o número no bairro do lado.
  it("número no bairro vizinho, ao lado do CNES, confirma-o", () => {
    const geo = { ...rua, numeroDescartado: { lat: 0.001, lon: -59.995 } };
    expect(
      decidir({ cnes: cnes(0.002, -59.995), geo, centroAtual }).motivo,
    ).toBe("numero_no_bairro_vizinho_confirma_o_cnes");
  });

  it("CNES a poucas centenas de metros da rua: encaixado nela", () => {
    expect(
      decidir({ cnes: cnes(0.004, -59.995), geo: rua, centroAtual }).acao,
    ).toBe("encaixe");
  });

  // Cuiabá: o ponto do CNES a 24,8 km da Rua Rui Barbosa.
  it("CNES longe da rua: vale a rua", () => {
    expect(
      decidir({ cnes: cnes(0.25, -59.995), geo: rua, centroAtual }),
    ).toMatchObject({
      acao: "rua",
      motivo: "cnes_longe_da_rua_declarada",
    });
  });

  // Maranhão: endereço em São Luís, ponto fora de São Luís.
  it("CNES fora do município: vale o endereço", () => {
    expect(
      decidir({ cnes: cnes(0.3, -59.9, false), geo: rua, centroAtual }).motivo,
    ).toBe("cnes_fora_do_municipio");
  });

  // Altamira: o CNES tem (0, 0) no lugar da coordenada.
  it("(0, 0) é CNES sem coordenada, não um ponto no Atlântico", () => {
    expect(
      decidir({ cnes: cnes(0, 0, false), geo: rua, centroAtual }).motivo,
    ).toBe("cnes_sem_coordenada");
  });

  it("sem rua no OSM, fica o CNES — dito como fonte única", () => {
    expect(
      decidir({ cnes: cnes(0.2, -59.9), geo: null, centroAtual }).motivo,
    ).toBe("fonte_unica_cnes");
  });

  it("mas nunca um CNES que repete o centro da cidade", () => {
    expect(
      decidir({ cnes: cnes(0, 0.5005), geo: null, centroAtual }).acao,
    ).toBe("manter");
  });

  it("sem CNES e sem rua, não se mexe", () => {
    expect(decidir({ cnes: null, geo: null, centroAtual })).toMatchObject({
      acao: "manter",
      motivo: "sede_sem_cnes",
    });
  });

  it("endereço de documento, sem CNES, diz-se como tal", () => {
    const documentado = {
      lat: NaN,
      lon: NaN,
      dentro: false,
      documentado: "Edital",
    };
    expect(decidir({ cnes: documentado, geo: rua, centroAtual }).motivo).toBe(
      "endereco_documentado_sem_cnes",
    );
  });
});

describe("a fonte documentada", () => {
  it("o Kaiapó do Mato Grosso cita o documento de onde vem", () => {
    const k = SEDES_DOCUMENTADAS["KAIAPO DE MATO GROSSO"];
    expect(k.endereco).toContain("626");
    expect(k.fonte).toContain("Edital AgSUS 14/2025");
  });
});

/*
  O SQL gerado. É ele que o banco recebe, e é por ele que uma regeneração
  deformada tem de ser apanhada antes de chegar à produção.
*/
describe("a correção gerada", () => {
  const sql = readFileSync(
    "supabase/correcoes/20260923-leva-as-sedes-dos-dsei-ao-endereco.sql",
    "utf8",
  );
  const blocos = sql.split("with correcao(");
  const valores = (blocos[1] || "")
    .split("\n")
    .filter((l) => /^\s+\('/.test(l))
    .map((l) => l.trim());

  it("a conferência e a correção levam as mesmas linhas", () => {
    const daCorrecao = (blocos[2] || "")
      .split("\n")
      .filter((l) => /^\s+\('/.test(l))
      .map((l) => l.trim());
    expect(valores.length).toBeGreaterThan(20);
    expect(daCorrecao).toEqual(valores);
  });

  it("só escreve onde a coordenada atual é a de antes", () => {
    expect(sql).toContain("(d.value ->> 'lat')::numeric = c.de_lat");
    expect(sql).toContain("(d.value ->> 'lon')::numeric = c.de_lon");
  });

  it("todo ponto novo está no Brasil, e nenhum é (0, 0)", () => {
    for (const linha of valores) {
      const [lat, lon] = linha
        .split(",")
        .slice(1, 3)
        .map((v) => Number(v.trim()));
      expect(lat, linha).toBeGreaterThan(-34);
      expect(lat, linha).toBeLessThan(6);
      expect(lon, linha).toBeGreaterThan(-74);
      expect(lon, linha).toBeLessThan(-34);
    }
  });

  // Sem segunda fonte e sem a rua no OSM, a sede do Kaiapó MT não se mexe.
  it("a sede sem confirmação fica de fora", () => {
    expect(
      valores.some((l) => /KAIAPO DO MATO GROSSO|KAIAPO DE MATO/.test(l)),
    ).toBe(false);
    expect(sql).toContain("Kaiapó de Mato Grosso");
  });
});

describe("o popup da estrela", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");

  it("diz o endereço e de onde ele vem", () => {
    expect(app).toContain("d.sede_endereco");
    expect(app).toContain("d.sede_cnes");
  });
});
