import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  UF_POR_CODIGO_IBGE,
  VINCULO_EXTERNO,
  VINCULO_INDETERMINADO,
  VINCULO_NORMAL,
  classificarVinculoTerritorial,
  divergenciaDeDiagnostico,
  siglaDaUf,
} from "../src/lib/uf-ibge.js";
import {
  ESTILO_DA_LINHA,
  TOOLTIP_DA_LINHA,
  classificarRegistros,
  formaDoTipo,
  htmlDoMarcador,
  linhasDaReconciliacao,
  linhasDasCoordenadas,
  registrosExternos,
  registrosLocais,
  textoDoChip,
  tooltipDoRegistro,
} from "../src/modules/vinculos-territoriais.js";

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
    (_nome, ufCnes, ufsDoDsei, ufDoPoligono) => {
      const r = classificarVinculoTerritorial(ufCnes, ufsDoDsei);
      expect(r.vinculo).toBe(VINCULO_NORMAL);

      // O polígono discorda, mas isso é só diagnóstico — o CNES vence.
      const divergencia = divergenciaDeDiagnostico(ufCnes, ufDoPoligono);
      expect(divergencia).not.toBeNull();
      expect(divergencia.autoridade).toBe(r.uf);
    },
  );

  it("o diagnóstico se cala quando as duas fontes concordam", () => {
    expect(divergenciaDeDiagnostico(22, "PI")).toBeNull();
  });
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

    // O popup é quem herda a explicação.
    expect(linhasDaReconciliacao(registro).join(" ")).toContain(
      "Fontes divergem 10.4 km",
    );
  });

  it("escreve Registro, não Registo", () => {
    const linhas = linhasDaReconciliacao({
      origens: ["lmap", "rede_cnes"],
      coordenadas: { lotacoes: { lat: -5, lon: -35 } },
    });
    expect(linhas[0]).toContain("Registro unificado");
  });

  it("a linha avisa que não é trajeto", () => {
    expect(TOOLTIP_DA_LINHA).toBe(
      "Vínculo territorial — não representa trajeto",
    );
  });

  /*
    O popup de POLO BASE JOAO CAMARA imprimia três linhas de coordenada e duas
    eram idênticas — Lotações e CNES no mesmo ponto. Lido de fora, parecia
    defeito do registro.
  */
  it("agrupa fontes que apontam a mesma coordenada numa linha só", () => {
    expect(
      linhasDasCoordenadas({
        lmap: { lat: -5.514, lon: -35.9042 },
        lotacoes: { lat: -5.53222, lon: -35.81213 },
        rede_cnes: { lat: -5.53222, lon: -35.81213 },
      }),
    ).toEqual([
      "mapa anterior: -5.51400, -35.90420",
      "Lotações e CNES: -5.53222, -35.81213",
    ]);
  });

  it("junta as três quando todas concordam", () => {
    expect(
      linhasDasCoordenadas({
        lmap: { lat: -7.1, lon: -34.9 },
        lotacoes: { lat: -7.1, lon: -34.9 },
        rede_cnes: { lat: -7.1, lon: -34.9 },
      }),
    ).toEqual(["mapa anterior, Lotações e CNES: -7.10000, -34.90000"]);
  });

  it("mantém linhas separadas quando as fontes discordam", () => {
    expect(
      linhasDasCoordenadas({
        lmap: { lat: -1, lon: -2 },
        rede_cnes: { lat: -3, lon: -4 },
      }),
    ).toHaveLength(2);
  });

  it("não lista coordenada quando só há uma fonte", () => {
    expect(linhasDasCoordenadas({ lmap: { lat: -1, lon: -2 } })).toEqual([]);
    expect(linhasDasCoordenadas()).toEqual([]);
  });

  it("ignora coordenada que não é número", () => {
    expect(
      linhasDasCoordenadas({
        lmap: { lat: "sem valor", lon: -2 },
        rede_cnes: { lat: -3, lon: -4 },
      }),
    ).toEqual([]);
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
    const html = htmlDoMarcador(externo);
    expect(html).toContain("mapa-marcador--externo");
    // A casa (CASAI) continua sendo desenhada, não substituída por outro símbolo.
    expect(html).toContain("M9 2.6 15.2 8v8.2H2.8V8Z");
  });
});

describe("integração no mapa detalhado", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");
  const html = readFileSync("index.html", "utf8");

  /*
    Incluir os remotos no fit inicial encolheria o território: no Ceará a caixa
    passaria de 3.01 x 2.75 para 4.31 x 6.28 graus.
  */
  it("o enquadramento inicial usa só sede e unidades locais", () => {
    const fn = app.slice(
      app.indexOf("_detailBounds = {"),
      app.indexOf("function enquadrarDetalhe"),
    );
    expect(fn).toContain("territorio: [[d.lat, d.lon], ...locais.map(");
    expect(fn).toContain("completo: [[d.lat, d.lon], ...classificados.map(");
    expect(fn).toContain('enquadrarDetalhe("territorio")');
  });

  it("o botão alterna entre os dois escopos", () => {
    const fn = app.slice(
      app.indexOf("function toggleVinculosExternos"),
      app.indexOf("function toggleVinculosExternos") + 260,
    );
    expect(fn).toContain(
      '_detailEscopo === "completo" ? "territorio" : "completo"',
    );
    expect(app).toContain('"Voltar ao território"');
  });

  it("voltar ao Brasil limpa o estado de vínculos", () => {
    const fn = app.slice(
      app.indexOf("function resetDetailMap"),
      app.indexOf("function scheduleMapResize"),
    );
    expect(fn).toContain("atualizarChipDeVinculos(0)");
    expect(fn).toContain("_detailBounds = null");
  });

  it("o chip e o botão nascem ocultos no HTML", () => {
    expect(html).toContain('id="detailExternalChip"');
    expect(html).toContain('id="detailExternalToggle"');
    const bloco = html.slice(
      html.indexOf('id="detailExternalChip"'),
      html.indexOf('id="detailMapReset"'),
    );
    expect(bloco).toContain("hidden");
  });

  it("a coordenada real nunca é ajustada para a UF declarada", () => {
    const fn = app.slice(
      app.indexOf("const classificados = classificarRegistros"),
      app.indexOf("function enquadrarDetalhe"),
    );
    expect(fn).toContain("[record.lat, record.lon]");
    expect(fn).not.toMatch(/lat\s*=\s*[^=]/);
    expect(fn).not.toMatch(/lon\s*=\s*[^=]/);
  });
});
