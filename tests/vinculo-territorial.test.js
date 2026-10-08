import { describe, expect, it } from "vitest";
import {
  UF_POR_CODIGO_IBGE,
  VINCULO_EXTERNO,
  VINCULO_INDETERMINADO,
  VINCULO_NORMAL,
  classificarVinculoTerritorial,
  siglaDaUf,
} from "../src/lib/uf-ibge.js";
import {
  DESENHO_DAS_FORMAS,
  ESTILO_DA_LINHA_DE_VINCULO as ESTILO_DA_LINHA,
  TEXTO_DA_LINHA_DE_VINCULO as TOOLTIP_DA_LINHA,
  formaDoTipo,
} from "../src/lib/mapa-saude-indigena/formas.ts";
import {
  classificarRegistros,
  dicaDoRegistro,
  limitesDoDsei,
  registrosExternos,
  registrosLocais,
  textoDosVinculosExternos as textoDoChip,
} from "../src/lib/mapa-saude-indigena/mapa-do-dsei.ts";

/*
  As regras do vínculo territorial no mapa do DSEI (src/modulos/mapa-saude-indigena/,
  regras em src/lib/mapa-saude-indigena/). A dica é `{ titulo, linhas }`, em
  nós de texto; aqui, lida como uma linha só.
*/
const tooltipDoRegistro = (registro, dsei) => {
  const { titulo, linhas } = dicaDoRegistro(registro, dsei);
  return [titulo, ...linhas].join(" · ");
};

describe("conversão de código IBGE para sigla", () => {
  it("cobre as 27 unidades da federação", () => {
    expect(Object.keys(UF_POR_CODIGO_IBGE)).toHaveLength(27);
  });

  it("converte os extremos da tabela", () => {
    expect(siglaDaUf(11)).toBe("RO");
    expect(siglaDaUf(12)).toBe("AC");
    expect(siglaDaUf(53)).toBe("DF");
  });

  it("aceita o código como string, porque o payload varia", () => {
    expect(siglaDaUf("29")).toBe("BA");
  });

  it("aceita sigla e normaliza caixa", () => {
    expect(siglaDaUf("ba")).toBe("BA");
  });

  /*
    Devolver `null` — e não uma sigla qualquer — é o que faz a classificação
    parar em `indeterminado` em vez de afirmar que a unidade está fora.
  */
  it("recusa o que não é UF", () => {
    for (const entrada of [
      null,
      undefined,
      "",
      "  ",
      0,
      99,
      1.5,
      "XX",
      "BRA",
    ]) {
      expect(siglaDaUf(entrada)).toBeNull();
    }
  });
});

describe("classificação do vínculo", () => {
  it("dentro da abrangência é vínculo normal", () => {
    const r = classificarVinculoTerritorial(29, ["BA"]);
    expect(r.vinculo).toBe(VINCULO_NORMAL);
    expect(r.uf).toBe("BA");
  });

  it("um DSEI multi-UF não transforma a segunda UF em anomalia", () => {
    // Interior Sul cobre RS e SC; uma unidade em SC é normal.
    expect(classificarVinculoTerritorial(42, ["RS", "SC"]).vinculo).toBe(
      VINCULO_NORMAL,
    );
  });

  it("fora da abrangência é vínculo externo", () => {
    const r = classificarVinculoTerritorial(22, ["CE"]);
    expect(r.vinculo).toBe(VINCULO_EXTERNO);
    expect(r.uf).toBe("PI");
  });

  it("CNES sem UF válida não classifica", () => {
    expect(classificarVinculoTerritorial(null, ["CE"]).vinculo).toBe(
      VINCULO_INDETERMINADO,
    );
    expect(classificarVinculoTerritorial(99, ["CE"]).vinculo).toBe(
      VINCULO_INDETERMINADO,
    );
  });

  it("DSEI sem ufs não classifica", () => {
    expect(classificarVinculoTerritorial(22, []).vinculo).toBe(
      VINCULO_INDETERMINADO,
    );
    expect(classificarVinculoTerritorial(22, null).vinculo).toBe(
      VINCULO_INDETERMINADO,
    );
  });

  /*
    Comparar o código numérico direto com as siglas do DSEI marcaria as 1462
    unidades como externas. A conversão é o que impede isso.
  */
  it("o código numérico nunca é comparado cru com as siglas", () => {
    const codigo = 29;
    expect(["BA"].includes(codigo)).toBe(false);
    expect(classificarVinculoTerritorial(codigo, ["BA"]).vinculo).toBe(
      VINCULO_NORMAL,
    );
  });
});

/*
  Casos reais, colhidos de `mapa_saude_indigena_config` em 09/09/2026.

  Os três primeiros são as únicas relações interestaduais genuínas entre as 1462
  unidades. Os demais são falsos positivos do ray casting em `UF_GEO`: o
  polígono simplificado os coloca na UF vizinha, mas o CNES — a autoridade —
  os coloca dentro do próprio DSEI. Feijó é no Acre, Juazeiro é na Bahia,
  Paragominas é no Pará, Itacuruba é em Pernambuco, Jacareacanga é no Pará.
*/
describe("regressão sobre os dados reais", () => {
  const genuinos = [
    ["Uruçuí (DSEI Ceará)", 22, ["CE"], "PI"],
    ["Lagoa de São Francisco (DSEI Ceará)", 22, ["CE"], "PI"],
    ["Mangueirinha (DSEI Interior Sul)", 41, ["RS", "SC"], "PR"],
  ];

  it.each(genuinos)("%s recebe vínculo externo", (_nome, uf, ufs, sigla) => {
    const r = classificarVinculoTerritorial(uf, ufs);
    expect(r.vinculo).toBe(VINCULO_EXTERNO);
    expect(r.uf).toBe(sigla);
  });

  const falsosPositivosDoPoligono = [
    ["Polo Base de Feijó", 12, ["AC"], "AM"],
    ["Polo Base de Juazeiro", 29, ["BA"], "PE"],
    ["Paragominas", 15, ["PA"], "MA"],
    ["UBSI Serrote dos Campos (Itacuruba)", 26, ["PE"], "BA"],
    ["Polo Base Kato (Jacareacanga)", 15, ["PA"], "AM"],
    ["UBSI Serra Grande (Itacajá)", 17, ["TO"], "MA"],
  ];

  it.each(falsosPositivosDoPoligono)(
    "%s NÃO recebe linha pontilhada",
    (_nome, ufCnes, ufsDoDsei) => {
      const r = classificarVinculoTerritorial(ufCnes, ufsDoDsei);
      expect(r.vinculo).toBe(VINCULO_NORMAL);
    },
  );
});

describe("separação para o enquadramento", () => {
  const dsei = { n: "Ceará", ufs: ["CE"] };
  const registros = [
    { name: "Polo local", uf: 23, type: { key: "polo", label: "Polo base" } },
    { name: "Uruçuí", uf: 22, type: { key: "ubsi", label: "UBSI" } },
    { name: "Sem UF", uf: null, type: { key: "unit", label: "Unidade" } },
  ];
  const classificados = classificarRegistros(registros, dsei);

  it("anota cada registro sem perder nenhum", () => {
    expect(classificados).toHaveLength(3);
    expect(classificados.map((r) => r.vinculo)).toEqual([
      VINCULO_NORMAL,
      VINCULO_EXTERNO,
      VINCULO_INDETERMINADO,
    ]);
  });

  it("só o externo fica de fora do enquadramento inicial", () => {
    expect(registrosExternos(classificados).map((r) => r.name)).toEqual([
      "Uruçuí",
    ]);
    expect(registrosLocais(classificados).map((r) => r.name)).toEqual([
      "Polo local",
      "Sem UF",
    ]);
  });

  it("cai para a sede quando o DSEI não declara ufs", () => {
    const semUfs = classificarRegistros(registros, { n: "X", sedeuf: "CE" });
    expect(semUfs[0].vinculo).toBe(VINCULO_NORMAL);
    expect(semUfs[1].vinculo).toBe(VINCULO_EXTERNO);
  });
});

describe("apresentação", () => {
  const dsei = { n: "Ceará", ufs: ["CE"] };

  it("o tooltip diz tipo, DSEI, localização e a relação", () => {
    const [registro] = classificarRegistros(
      [{ name: "Uruçuí", uf: 22, type: { key: "ubsi", label: "UBSI" } }],
      dsei,
    );
    const texto = tooltipDoRegistro(registro, dsei);
    expect(texto).toContain("UBSI Uruçuí");
    expect(texto).toContain("Vinculado ao DSEI Ceará");
    expect(texto).toContain("Localização: PI");
    expect(texto).toContain("Fora das UFs de abrangência do DSEI");
  });

  it("o tooltip não acusa nada quando o vínculo é normal", () => {
    const [registro] = classificarRegistros(
      [
        {
          name: "Polo local",
          uf: 23,
          type: { key: "polo", label: "Polo base" },
        },
      ],
      dsei,
    );
    expect(tooltipDoRegistro(registro, dsei)).not.toContain("Fora das UFs");
  });

  it("um vínculo indeterminado é dito como tal, não como externo", () => {
    const [registro] = classificarRegistros(
      [{ name: "Sem UF", uf: null, type: { key: "unit", label: "Unidade" } }],
      dsei,
    );
    const texto = tooltipDoRegistro(registro, dsei);
    expect(texto).toContain("não classificado");
    expect(texto).not.toContain("Fora das UFs");
  });

  /*
    POLO BASE JOAO CAMARA, DSEI Potiguara: o tooltip contava a reconciliação e
    o popup repetia-a com as coordenadas. Como o autopan do popup reabre o
    tooltip, os dois ficavam visíveis dizendo o mesmo. A repartição é esta.
  */
  it("o tooltip não repete o que o popup vai explicar", () => {
    const [registro] = classificarRegistros(
      [
        {
          name: "POLO BASE JOAO CAMARA",
          uf: 24,
          type: { key: "polo", label: "Polo base" },
          origens: ["lmap", "rede_cnes"],
          divergencia: "divergente",
          distancia_entre_fontes_km: 10.4,
          coordenadas: {
            lmap: { lat: -5.514, lon: -35.9042 },
            rede_cnes: { lat: -5.53222, lon: -35.81213 },
          },
        },
      ],
      { n: "Potiguara", ufs: ["PB", "RN"] },
    );

    const texto = tooltipDoRegistro(registro, { n: "Potiguara" });
    expect(texto).toContain("Polo base POLO BASE JOAO CAMARA");
    expect(texto).toContain("Localização: RN");
    expect(texto).not.toContain("Fontes divergem");
    expect(texto).not.toContain("Registro unificado");
  });

  it("a linha avisa que não é trajeto", () => {
    expect(TOOLTIP_DA_LINHA).toBe(
      "Vínculo territorial — não representa trajeto",
    );
  });

  it("a linha é visualmente secundária, como especificado", () => {
    expect(ESTILO_DA_LINHA.dashArray).toBe("6 7");
    expect(ESTILO_DA_LINHA.opacity).toBeCloseTo(0.55, 2);
    expect(ESTILO_DA_LINHA.weight).toBeGreaterThanOrEqual(1.5);
    expect(ESTILO_DA_LINHA.weight).toBeLessThanOrEqual(2);
  });

  it("o chip concorda em número", () => {
    expect(textoDoChip(0)).toBe("");
    expect(textoDoChip(1)).toBe("1 vínculo fora da área");
    expect(textoDoChip(2)).toBe("2 vínculos fora da área");
  });

  /*
    Acessibilidade: se a única diferença fosse a cor, quem não a distingue
    perderia a informação. Cada tipo tem forma própria.
  */
  it("cada tipo tem forma própria, não só cor", () => {
    const formas = ["polo", "casai", "ubsi", "unit"].map(
      (k) => formaDoTipo(k).forma,
    );
    expect(new Set(formas).size).toBe(4);
  });

  it("o marcador externo mantém o ícone do seu tipo", () => {
    const [externo] = classificarRegistros(
      [{ name: "Uruçuí", uf: 22, type: { key: "casai", color: "#d92d3a" } }],
      dsei,
    );
    expect(externo.vinculo).toBe(VINCULO_EXTERNO);
    // A casa (CASAI) continua sendo desenhada, não substituída por outro símbolo.
    expect(DESENHO_DAS_FORMAS[formaDoTipo(externo.type.key).forma]).toContain(
      "M9 2.6 15.2 8v8.2H2.8V8Z",
    );
  });
});

describe("enquadramento do mapa do DSEI", () => {
  /*
    Incluir os remotos no enquadramento inicial encolheria o território: no
    Ceará a caixa passaria de 3.01 x 2.75 para 4.31 x 6.28 graus.
  */
  it("o inicial usa só sede e unidades locais; o completo inclui as externas", () => {
    const dsei = { n: "Ceará", ufs: ["CE"], lat: -3.7, lon: -38.5 };
    const classificados = classificarRegistros(
      [
        { name: "Local", uf: 23, lat: -4, lon: -39 },
        { name: "Uruçuí", uf: 22, lat: -7.2, lon: -44.5 },
      ],
      dsei,
    );
    const limites = limitesDoDsei(dsei, classificados);
    expect(limites.territorio).toEqual([
      [-3.7, -38.5],
      [-4, -39],
    ]);
    expect(limites.completo).toEqual([
      [-3.7, -38.5],
      [-4, -39],
      [-7.2, -44.5],
    ]);
  });

  it("a coordenada real nunca é ajustada para a UF declarada", () => {
    const [externo] = classificarRegistros(
      [{ name: "Uruçuí", uf: 22, lat: -7.2, lon: -44.5 }],
      { n: "Ceará", ufs: ["CE"] },
    );
    expect([externo.lat, externo.lon]).toEqual([-7.2, -44.5]);
  });
});
