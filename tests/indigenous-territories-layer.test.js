import { describe, expect, it } from "vitest";
import {
  AVISO_DO_SIMBOLO,
  FUNAI_PROXY_GEOJSON,
  FUNAI_PROXY_WMS,
  FUNAI_TERRITORIES_LAYER,
  FUNAI_TERRITORIES_WFS,
  FUNAI_TERRITORIES_WMS,
  dseiFeatureMatches,
  dseiFeatureName,
  funaiDseiUrl,
  funaiFeatureName,
  funaiViewportUrl,
  isHealthMapElementId,
  povosDaTerraIndigena,
  rotuloDaTerraIndigena,
  tamanhoNaTelaEmPixels,
  terraPrecisaDeSimbolo,
  tooltipDaTerraIndigena,
} from "../src/modules/indigenous-territories-layer.js";

/*
  Bordas reais das terras do DSEI Alagoas e Sergipe, medidas na camada
  publicada pela Funai. São a razão de o símbolo existir: no zoom em que cabe
  o distrito inteiro, 1 pixel vale 600 m.
*/
const limitesDe = (oesteLat, oesteLon, lesteLat, lesteLon) => ({
  isValid: () => true,
  getNorthEast: () => ({ lat: lesteLat, lng: lesteLon }),
  getSouthWest: () => ({ lat: oesteLat, lng: oesteLon }),
});

// Projeção do Leaflet no zoom 8: 1 px = 0,60 km à latitude de Alagoas.
const projetarNoZoom8 = (ponto) => ({
  x: (ponto.lng * 111 * Math.cos((-9.8 * Math.PI) / 180)) / 0.6,
  y: (-ponto.lat * 111) / 0.6,
});

describe("camada de Terras Indígenas", () => {
  it("usa a camada oficial de polígonos da Funai", () => {
    expect(FUNAI_TERRITORIES_WMS).toContain("geoserver.funai.gov.br");
    expect(FUNAI_TERRITORIES_LAYER).toBe("Funai:tis_poligonais");
  });

  it("mantém as fontes oficiais e usa proxy same-origin no navegador", () => {
    expect(FUNAI_TERRITORIES_WFS).toContain("geoserver.funai.gov.br");
    expect(FUNAI_PROXY_WMS).toBe("/api/funai-wms");
    expect(FUNAI_PROXY_GEOJSON).toBe("/api/funai-geodata");

    const url = funaiViewportUrl({
      getWest: () => -40,
      getSouth: () => -12,
      getEast: () => -35,
      getNorth: () => -8,
    });
    expect(url).toContain("/api/funai-geodata?");
    expect(url).toContain("dataset=territories");
    expect(url).toContain("bbox=-40%2C-12%2C-35%2C-8");
  });

  it("busca a área oficial dos DSEIs pelo proxy do catálogo atual da Funai", () => {
    expect(funaiDseiUrl()).toBe("/api/funai-geodata?dataset=dsei");
  });

  it("reconhece o nome do DSEI sem depender de um único atributo", () => {
    expect(dseiFeatureName({ nome_dsei: "Alagoas e Sergipe" })).toBe(
      "Alagoas e Sergipe",
    );
    expect(dseiFeatureName({ dsei: "Yanomami" })).toBe("Yanomami");
    expect(
      dseiFeatureMatches(
        { properties: { nome_dsei: "DSEI Alagoas e Sergipe" } },
        "Alagoas e Sergipe",
      ),
    ).toBe(true);
  });

  it("lê o nome no atributo que a Funai publica hoje", () => {
    // `terrai_nome` é o que o DescribeFeatureType de Funai:tis_poligonais lista.
    expect(funaiFeatureName({ terrai_nome: "Potiguara" })).toBe("Potiguara");
  });

  it("mantém os nomes antigos como reserva", () => {
    expect(funaiFeatureName({ terrai_nom: "Kariri-Xocó" })).toBe("Kariri-Xocó");
    expect(funaiFeatureName({ nome: "Munduruku" })).toBe("Munduruku");
  });

  it("não inventa nome quando a camada não traz nenhum", () => {
    expect(funaiFeatureName({ gid: 12 })).toBe("");
  });
});

describe("povos declarados na Terra Indígena", () => {
  it("lê um povo único", () => {
    expect(povosDaTerraIndigena({ etnia_nome: "Kokama" })).toEqual(["Kokama"]);
  });

  it("separa por vírgula, como em Aldeia Katurama", () => {
    expect(
      povosDaTerraIndigena({ etnia_nome: "Pataxó, Pataxo Há-Há-Há" }),
    ).toEqual(["Pataxó", "Pataxo Há-Há-Há"]);
  });

  it("separa por ' e ', como em São Jeronimo", () => {
    expect(
      povosDaTerraIndigena({ etnia_nome: "Guaraní e Kaingang e Xetá" }),
    ).toEqual(["Guaraní", "Kaingang", "Xetá"]);
  });

  it("não parte nomes que contêm a letra e sem espaços em volta", () => {
    expect(povosDaTerraIndigena({ etnia_nome: "Tenetehara" })).toEqual([
      "Tenetehara",
    ]);
    expect(povosDaTerraIndigena({ etnia_nome: "Guarani Kaiowá" })).toEqual([
      "Guarani Kaiowá",
    ]);
  });

  it("descarta repetição e sobras de separador", () => {
    expect(
      povosDaTerraIndigena({ etnia_nome: "Kaingang, kaingang, , Xokleng" }),
    ).toEqual(["Kaingang", "Xokleng"]);
  });

  it("devolve lista vazia quando a Funai não declara etnia", () => {
    expect(povosDaTerraIndigena({ terrai_nome: "Sem etnia" })).toEqual([]);
    expect(povosDaTerraIndigena()).toEqual([]);
  });
});

describe("marcação da Terra Indígena no mapa", () => {
  it("põe o povo em primeiro lugar, e a terra abaixo", () => {
    const texto = tooltipDaTerraIndigena({
      etnia_nome: "Potiguara",
      terrai_nome: "Potiguara de Monte-Mór",
      uf_sigla: "PB",
    });
    expect(texto).toBe(
      "<b>Povo: Potiguara</b><br>Terra Indígena Potiguara de Monte-Mór<br>PB",
    );
  });

  it("diz 'Povos' no plural quando há mais de um", () => {
    expect(
      tooltipDaTerraIndigena({
        etnia_nome: "Guaraní e Kaingang",
        terrai_nome: "São Jeronimo",
      }),
    ).toContain("<b>Povos: Guaraní, Kaingang</b>");
  });

  /*
    Não afirma povo nenhum — e diz que a Funai não o declarou, como a lista do
    painel já dizia. Antes o balão simplesmente calava, e a ausência lia-se
    como esquecimento do painel.
  */
  it("sem etnia declarada, identifica pela terra e não afirma povo", () => {
    const texto = tooltipDaTerraIndigena({
      terrai_nome: "Acapuri de Cima",
      uf_sigla: "AM",
    });
    expect(texto).toBe(
      "<b>Terra Indígena Acapuri de Cima</b><br><i>Povo não declarado pela Funai</i><br>AM",
    );
    expect(texto).not.toContain("Povo:");
  });

  /*
    Em 32 das 163 terras em estudo o campo vem "Não especificada", e o balão
    dizia "Povo: Não especificada" — a ausência do dado a passar por nome.
  */
  it("o preenchimento da Funai não vira nome de povo", () => {
    for (const valor of [
      "Não especificada",
      "não especificado",
      "Nao informado",
      "Sem informação",
    ]) {
      expect(povosDaTerraIndigena({ etnia_nome: valor }), valor).toEqual([]);
    }
    expect(
      povosDaTerraIndigena({ etnia_nome: "Kaingang, Não especificada" }),
    ).toEqual(["Kaingang"]);
    // E não apaga um povo cujo nome só começa parecido.
    expect(povosDaTerraIndigena({ etnia_nome: "Nambikwara" })).toEqual([
      "Nambikwara",
    ]);
  });

  it("não devolve marcação quando não há nada a dizer", () => {
    expect(tooltipDaTerraIndigena({ gid: 9 })).toBe("");
  });

  it("escapa o que vem da Funai antes de virar HTML", () => {
    expect(
      tooltipDaTerraIndigena({ etnia_nome: "<img src=x onerror=alert(1)>" }),
    ).not.toContain("<img");
  });
});

describe("rótulo desenhado sobre a Terra Indígena", () => {
  it("escreve o povo, não o nome da terra", () => {
    expect(
      rotuloDaTerraIndigena({
        etnia_nome: "Potiguara",
        terrai_nome: "Potiguara de Monte-Mór",
      }),
    ).toBe("Potiguara");
  });

  it("escreve dois povos por extenso", () => {
    expect(rotuloDaTerraIndigena({ etnia_nome: "Guaraní e Kaingang" })).toBe(
      "Guaraní, Kaingang",
    );
  });

  it("a partir do terceiro povo, conta em vez de escrever", () => {
    expect(
      rotuloDaTerraIndigena({ etnia_nome: "Guaraní e Kaingang e Xetá" }),
    ).toBe("Guaraní, Kaingang +1");
  });

  it("sem etnia declarada, cai para o nome da terra", () => {
    expect(rotuloDaTerraIndigena({ terrai_nome: "Acapuri de Cima" })).toBe(
      "Acapuri de Cima",
    );
  });

  it("não devolve rótulo quando não há nome nenhum", () => {
    expect(rotuloDaTerraIndigena({ gid: 3 })).toBe("");
  });
});

/*
  A opacidade do preenchimento resolvia terras grandes e não resolvia nada em
  Alagoas e Sergipe: das 21 terras daquele enquadramento, 14 ficam abaixo de
  20 px. O que decide se uma área se lê não é a área em km², é o tamanho dela
  no monitor — e isso muda a cada zoom.
*/
describe("terras pequenas demais para se verem", () => {
  it("mede a maior dimensão em pixels, não em graus", () => {
    // 1 grau de latitude = 111 km = 185 px nesta projeção.
    const tamanho = tamanhoNaTelaEmPixels(
      limitesDe(-10, -37, -9, -37),
      projetarNoZoom8,
    );
    expect(tamanho).toBeCloseTo(185, 0);
  });

  it("Pankararé, a maior do DSEI, dispensa símbolo", () => {
    // 25,6 km na maior dimensão — cerca de 43 px.
    const tamanho = tamanhoNaTelaEmPixels(
      limitesDe(-9.6, -38.3, -9.37, -38.3),
      projetarNoZoom8,
    );
    expect(tamanho).toBeGreaterThan(40);
    expect(terraPrecisaDeSimbolo(tamanho)).toBe(false);
  });

  it("a menor Xucuru-Kariri, de 800 m, precisa de símbolo", () => {
    // 0,8 km — cerca de 1,4 px, invisível a qualquer opacidade.
    const tamanho = tamanhoNaTelaEmPixels(
      limitesDe(-9.4, -36.6, -9.3928, -36.6),
      projetarNoZoom8,
    );
    expect(tamanho).toBeLessThan(2);
    expect(terraPrecisaDeSimbolo(tamanho)).toBe(true);
  });

  it("o limiar é 20 px, e é fechado em cima", () => {
    expect(terraPrecisaDeSimbolo(19.9)).toBe(true);
    expect(terraPrecisaDeSimbolo(20)).toBe(false);
  });

  it("não devolve tamanho quando a projeção falha", () => {
    expect(
      tamanhoNaTelaEmPixels(limitesDe(-10, -37, -9, -36), () => ({})),
    ).toBe(0);
    expect(terraPrecisaDeSimbolo(0)).toBe(true);
  });

  /*
    Um círculo de oito pixels sobre uma terra de 800 m é um marcador de
    posição, não o limite dela. Se alguém o ler como limite, o mapa passou a
    afirmar uma extensão que não tem.
  */
  it("o símbolo diz que não é o limite da terra", () => {
    expect(AVISO_DO_SIMBOLO).toContain("não o limite");
  });
});

describe("instalação da camada", () => {
  it("só se instala nos dois mapas de Saúde Indígena", () => {
    expect(isHealthMapElementId("map")).toBe(true);
    expect(isHealthMapElementId("detailMap")).toBe(true);
    expect(isHealthMapElementId("otherMap")).toBe(false);
    expect(isHealthMapElementId({ id: "detailMap" })).toBe(true);
  });
});
