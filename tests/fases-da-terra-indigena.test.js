import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FASES_DAS_TERRAS,
  ZOOM_DO_PAIS,
  estiloDaFase,
  estiloDoSimbolo,
  faseDaLegenda,
  faseDaTerra,
  lerFasesOcultas,
  raioDoSimbolo,
  terrasDasFasesVisiveis,
} from "../src/modules/indigenous-territories-layer.js";

/*
  DOIS ACHADOS DA BANCADA (bench/, com o catálogo real)

  1. Depois de afinar os polígonos, o país continuava coberto: 410 das 665
     terras são pequenas demais para a escala nacional e viravam um círculo de
     8 px cada, com fundo a 45%. O recuo tem de valer também para eles.

  2. Oito terras têm polígono e fase "Em Estudo", e desenhavam-se com o traço
     cheio da regularizada.
*/
describe("o que a bancada mostrou", () => {
  const mapaNoZoom = (zoom) => ({ getZoom: () => zoom });

  it("no país, o símbolo é um ponto pequeno", () => {
    expect(raioDoSimbolo(ZOOM_DO_PAIS - 1)).toBeLessThanOrEqual(3);
    expect(raioDoSimbolo(ZOOM_DO_PAIS + 1)).toBeGreaterThan(
      raioDoSimbolo(ZOOM_DO_PAIS - 1),
    );
    expect(raioDoSimbolo(undefined)).toBe(raioDoSimbolo(ZOOM_DO_PAIS + 1));
  });

  it("o ponto da definitiva é cheio e o da provisória é vazado", () => {
    const pais = mapaNoZoom(ZOOM_DO_PAIS - 1);
    expect(estiloDoSimbolo(pais, "definitiva").fillOpacity).toBeGreaterThan(
      0.5,
    );
    expect(estiloDoSimbolo(pais, "em_processo").fillOpacity).toBe(0);
    expect(estiloDoSimbolo(pais, "em_estudo").fillOpacity).toBe(0);
  });

  it("de perto, o símbolo da provisória continua tracejado", () => {
    const perto = mapaNoZoom(ZOOM_DO_PAIS + 3);
    expect(estiloDoSimbolo(perto, "em_processo").dashArray).toBeTruthy();
    expect(estiloDoSimbolo(perto, "definitiva").dashArray).toBeNull();
  });

  it("a terra em estudo com polígono desenha-se como provisória", () => {
    const estudo = estiloDaFase("em_estudo", false);
    expect(estudo.dashArray).toBeTruthy();
    expect(estudo.color).toBe(estiloDaFase("em_processo", false).color);
    expect(estudo.color).not.toBe(estiloDaFase("definitiva", false).color);
  });

  it("há mesmo terras em estudo com polígono no catálogo", () => {
    const catalogo = JSON.parse(
      readFileSync("public/data/terras-indigenas.json", "utf8"),
    );
    const emEstudo = catalogo.features.filter(
      (f) => faseDaTerra(f.properties) === "em_estudo",
    );
    expect(emEstudo.length).toBeGreaterThan(0);
  });
});

/*
  UMA TERRA HOMOLOGADA E UMA EM PROCESSO NÃO SÃO A MESMA COISA

  O mapa pintava as 665 com a mesma cor. Mas a fase é o estado jurídico da
  terra, e no catálogo da Funai elas repartem-se assim:

      494  Regularizada      limite definitivo, registrada em cartório
       17  Homologada        limite definitivo, homologado por decreto
       73  Declarada         limite definido; o processo continua
       45  Delimitada        idem
       28  Encaminhada RI    idem
        8  Em Estudo         sem limite definido

  Para quem planeia atendimento isso muda tudo: um limite que ainda pode mudar
  não é o mesmo que um limite que não muda mais.
*/
describe("a que família pertence cada fase", () => {
  it("regularizada e homologada têm limite definitivo", () => {
    expect(faseDaTerra({ fase_ti: "Regularizada" })).toBe("definitiva");
    expect(faseDaTerra({ fase_ti: "Homologada" })).toBe("definitiva");
  });

  it("declarada, delimitada e encaminhada continuam em processo", () => {
    expect(faseDaTerra({ fase_ti: "Declarada" })).toBe("em_processo");
    expect(faseDaTerra({ fase_ti: "Delimitada" })).toBe("em_processo");
    expect(faseDaTerra({ fase_ti: "Encaminhada RI" })).toBe("em_processo");
  });

  it("em estudo é a terceira família, e tem desenho próprio", () => {
    expect(faseDaTerra({ fase_ti: "Em Estudo" })).toBe("em_estudo");
  });

  it("não se perde por acento nem por caixa", () => {
    expect(faseDaTerra({ fase_ti: "regularizada" })).toBe("definitiva");
    expect(faseDaTerra({ fase_ti: "ENCAMINHADA RI" })).toBe("em_processo");
  });

  /*
    Sem fase declarada desenha-se como definitiva. Dizer "ainda em processo"
    sobre uma terra que talvez esteja regularizada é afirmar mais do que se
    sabe, e na direção que pesa contra quem lá vive.
  */
  it("sem fase não se presume processo", () => {
    expect(faseDaTerra({})).toBe("desconhecida");
    expect(faseDaTerra(null)).toBe("desconhecida");
    expect(estiloDaFase("desconhecida", false).dashArray).toBeNull();
  });

  /*
    O contrário do caso de cima, e igualmente deliberado: só `Regularizada` e
    `Homologada` são definitivas por nome. Uma fase que a Funai venha a publicar
    — `Interditada`, por exemplo, que existe para povos isolados — entra como
    em processo. Errar para o lado de "ainda não é definitiva" é errar para o
    lado que não promete a ninguém um limite que não existe.
  */
  it("fase desconhecida entra como em processo, nunca como definitiva", () => {
    expect(faseDaTerra({ fase_ti: "Interditada" })).toBe("em_processo");
  });
});

describe("o desenho de cada família", () => {
  it("a definitiva é traço cheio", () => {
    expect(estiloDaFase("definitiva", false).dashArray).toBeNull();
  });

  /*
    Tracejado porque uma linha interrompida é como um limite provisório se
    desenha em cartografia desde sempre — e porque a diferença tem de ser
    visível também para quem não distingue as duas tonalidades de magenta.
  */
  it("a que está em processo é tracejada e mais clara", () => {
    const processo = estiloDaFase("em_processo", false);
    const definitiva = estiloDaFase("definitiva", false);
    expect(processo.dashArray).toBeTruthy();
    expect(processo.fillOpacity).toBeLessThan(definitiva.fillOpacity);
    expect(processo.color).not.toBe(definitiva.color);
  });

  it("sobre satélite as duas engrossam o traço e aliviam o preenchimento", () => {
    for (const fase of ["definitiva", "em_processo"]) {
      const comum = estiloDaFase(fase, false);
      const satelite = estiloDaFase(fase, true);
      expect(satelite.weight).toBeGreaterThanOrEqual(comum.weight);
      expect(satelite.fillOpacity).toBeLessThan(comum.fillOpacity);
    }
  });

  /*
    ERAM DUAS TONALIDADES DA MESMA COR, E TÊM DE SER DUAS CORES

    Este caso exigia o contrário — que as duas ficassem no mesmo matiz, a
    menos de 25° —, e as duas eram magenta, uma escura e outra clara. Quem
    olhava perguntava qual era qual. O pedido foi explícito: a terra em
    processo de homologação com OUTRA cor.

    ΔE acima de 25 é "cores com nomes diferentes" — marrom e terracota. O
    traço tracejado continua, para quem não distingue as duas.
  */
  it("são duas cores, e não duas tonalidades", () => {
    const lab = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
      const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
      const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const [a, b] = [
      estiloDaFase("definitiva", false).color,
      estiloDaFase("em_processo", false).color,
    ].map(lab);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(
      25,
    );
  });
});

/*
  O BRASIL INTEIRO NÃO É UM MAPA DE TERRAS

  Na visão nacional as 665 terras, cheias, cobriam o país. Abaixo do zoom do
  país elas recuam: traço fino, fundo quase transparente.
*/
describe("na visão do país as terras recuam", () => {
  for (const fase of ["definitiva", "em_processo"]) {
    it(`a ${fase} afina o traço e quase apaga o fundo`, () => {
      const perto = estiloDaFase(fase, false, ZOOM_DO_PAIS + 2);
      const pais = estiloDaFase(fase, false, ZOOM_DO_PAIS - 1);
      expect(pais.weight).toBeLessThan(perto.weight);
      expect(pais.fillOpacity).toBeLessThan(perto.fillOpacity);
      expect(pais.fillOpacity).toBeLessThanOrEqual(0.12);
    });
  }

  it("sem zoom, vale o desenho de perto", () => {
    expect(estiloDaFase("definitiva", false)).toEqual(
      estiloDaFase("definitiva", false, ZOOM_DO_PAIS + 3),
    );
  });

  it("recuar não apaga a diferença entre as fases", () => {
    const pais = (fase) => estiloDaFase(fase, false, ZOOM_DO_PAIS - 1);
    expect(pais("definitiva").dashArray).toBeNull();
    expect(pais("em_processo").dashArray).toBeTruthy();
    expect(pais("em_processo").color).not.toBe(pais("definitiva").color);
  });

  it("a camada passa o zoom do mapa para o estilo", () => {
    const camada = readFileSync(
      "src/modules/indigenous-territories-layer.js",
      "utf8",
    );
    expect(camada).toContain("Number(map?.getZoom?.())");
  });
});

/*
  UM INTERRUPTOR POR FASE

  O pedido: esconder as terras já regularizadas e continuar a ver as que estão
  em delimitação. A legenda liga e desliga cada fase; esta função é o recorte.
*/
describe("esconder uma fase", () => {
  const terra = (fase) => ({ properties: { fase_ti: fase } });
  const catalogo = [
    terra("Regularizada"),
    terra("Homologada"),
    terra("Delimitada"),
    terra("Declarada"),
    terra(""),
  ];

  it("sem nada escondido, fica tudo", () => {
    expect(terrasDasFasesVisiveis(catalogo, new Set())).toHaveLength(5);
  });

  it("esconder as definitivas deixa só as em processo", () => {
    const sobra = terrasDasFasesVisiveis(catalogo, new Set(["definitiva"]));
    expect(sobra.map((f) => f.properties.fase_ti)).toEqual([
      "Delimitada",
      "Declarada",
    ]);
  });

  /*
    A terra sem fase desenha-se como definitiva; esconder as definitivas tem de
    a levar junto, senão fica no mapa uma mancha que nenhum interruptor apaga.
  */
  it("a sem fase vai com as definitivas", () => {
    expect(faseDaLegenda("desconhecida")).toBe("definitiva");
    const sobra = terrasDasFasesVisiveis(catalogo, new Set(["definitiva"]));
    expect(sobra.some((f) => f.properties.fase_ti === "")).toBe(false);
  });

  it("esconder as em processo deixa só as definitivas", () => {
    expect(
      terrasDasFasesVisiveis(catalogo, new Set(["em_processo"])),
    ).toHaveLength(3);
  });

  it("aceita o que não é lista sem partir", () => {
    expect(terrasDasFasesVisiveis(null, new Set(["definitiva"]))).toEqual([]);
    expect(terrasDasFasesVisiveis(catalogo, null)).toHaveLength(5);
  });

  /*
    O que vem do armazenamento local não é confiável: pode ser de uma versão
    antiga, ou escrito à mão. Só se esconde o que a legenda oferece.
  */
  it("do armazenamento só se aceita fase que a legenda conhece", () => {
    expect([...lerFasesOcultas('["definitiva","inventada"]')]).toEqual([
      "definitiva",
    ]);
    expect(lerFasesOcultas("não é json").size).toBe(0);
    expect(lerFasesOcultas(null).size).toBe(0);
    expect(lerFasesOcultas('{"definitiva":true}').size).toBe(0);
  });

  it("a legenda oferece as três fases, com nome", () => {
    expect(FASES_DAS_TERRAS.map((f) => f.fase)).toEqual([
      "definitiva",
      "em_processo",
      "em_estudo",
    ]);
    for (const f of FASES_DAS_TERRAS) expect(f.rotulo).toBeTruthy();
  });
});

describe("contra o catálogo real", () => {
  const catalogo = JSON.parse(
    readFileSync("public/data/terras-indigenas.json", "utf8"),
  );

  it("as três famílias cobrem todas as terras publicadas", () => {
    const por = new Map();
    for (const f of catalogo.features) {
      const k = faseDaTerra(f.properties);
      por.set(k, (por.get(k) || 0) + 1);
    }
    expect(por.get("desconhecida") ?? 0).toBe(0);
    expect(por.get("definitiva")).toBeGreaterThan(400);
    expect(por.get("em_processo")).toBeGreaterThan(100);
  });
});

/*
  Legenda que descreve menos do que o mapa mostra ensina a procurar a coisa
  errada. Foi assim que o quadrado ficou vermelho enquanto o mapa desenhava
  verde, e depois verde enquanto o mapa desenhava magenta.
*/
describe("a legenda descreve as três", () => {
  const app = readFileSync("src/modules/legacy-app.js", "utf8");
  const vinculos = readFileSync("src/modules/vinculos-territoriais.js", "utf8");

  it("nomeia a homologada, a em processo e a em estudo", () => {
    const rotulos = FASES_DAS_TERRAS.map((f) => f.rotulo).join(" | ");
    expect(rotulos).toContain("Homologada ou regularizada");
    expect(rotulos).toContain("Em processo");
    expect(rotulos).toContain("Em estudo");
  });

  /*
    As amostras escritas à mão, em `style` inline, foram o que deixou a
    legenda magenta depois de o mapa mudar. Não voltam.
  */
  it("o legacy não escreve mais amostra de terra à mão", () => {
    expect(app).not.toContain("border:2px dashed #f9a8d4");
    expect(app).not.toContain("border:2px solid #e030a6");
  });

  it("as duas legendas do mapa montam o mesmo módulo", () => {
    expect(app.match(/\$\{terras\}/g) ?? []).toHaveLength(2);
    expect(app).toContain("montarLegendaDasTerras(");
    expect(vinculos).toContain("data-legenda-das-terras");
  });
});
