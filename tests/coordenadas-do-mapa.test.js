import { describe, expect, it } from "vitest";
import {
  chaveDaPendencia,
  filaDeCoordenadas,
  gravidadeDaPendencia,
  pontosEditaveisDoMapa,
  sugestoesDaPendencia,
} from "../src/lib/coordenadas-do-mapa.js";
import {
  correcaoDesfazivel,
  folgaDoEnquadramento,
  formatarDistancia,
  lerCoordenada,
  rotuloDaAcao,
  textoDePendentes,
  validarCorrecaoDoMapa,
} from "../src/lib/editor-de-coordenadas.js";

describe("coordenadas do mapa", () => {
  it("separa pontos de mesmo nome pelo endereço exato da fonte e preserva posição sem coordenada", () => {
    const pontos = pontosEditaveisDoMapa(
      {
        dsei: [
          {
            k: "A",
            n: "Distrito A",
            lat: -10,
            lon: -50,
            polos: [
              { n: "Igual", lat: null, lon: null },
              { n: "Igual", cod: 44, lat: -11, lon: -51 },
            ],
          },
          { k: "B", n: "Outro", polos: [] },
        ],
      },
      { rede: { A: { u: [["Igual", "0012", -10, -50]] } } },
      "A",
    );
    expect(pontos).toHaveLength(4);
    expect(new Set(pontos.map((p) => p.id)).size).toBe(4);
    expect(pontos[1].latitude).toBeNull();
    expect(pontos[2].alvo).toMatchObject({
      fonte: "lmap",
      tipo: "polo",
      indice: 1,
      codigo: "44",
    });
    expect(pontos[3].alvo).toMatchObject({
      fonte: "rede_cnes",
      tipo: "u",
      codigo: "0012",
    });
  });
  it("inclui CASAIs nacionais apenas no catálogo nacional", () => {
    const lmap = { casai: [{ n: "CASAI A", lat: -15, lon: -47 }] };
    const rede = { nac: [["CASAI A", "001", -15, -47]] };
    expect(pontosEditaveisDoMapa(lmap, rede).map((p) => p.alvo.tipo)).toEqual([
      "casai",
      "nac",
    ]);
    expect(pontosEditaveisDoMapa(lmap, rede, "A")).toEqual([]);
  });
  it("aceita decimal com vírgula, recusa branco, símbolos e fora do Brasil", () => {
    expect(lerCoordenada(" -12,34 ")).toBe(-12.34);
    for (const valor of ["", " ", "abc", "Infinity", "-12.3.4"])
      expect(lerCoordenada(valor)).toBeNaN();
    expect(validarCorrecaoDoMapa(-10, -50, "Fonte oficial consultada")).toBe(
      "",
    );
    expect(
      validarCorrecaoDoMapa(45, -50, "Fonte oficial consultada"),
    ).toContain("Brasil");
    expect(validarCorrecaoDoMapa(-10, -50, "curto")).toContain("motivo");
  });
});

const lmapDaFila = {
  dsei: [
    {
      k: "XINGU",
      n: "Xingu",
      lat: -12,
      lon: -53,
      polos: [{ n: "Pavuru", cod: 10, lat: -11.5, lon: -53.2, uf: "MT" }],
    },
    {
      k: "ALTAMIRA",
      n: "Altamira",
      lat: -3.2,
      lon: -52.2,
      polos: [{ n: "Laranjal", cod: 20, lat: -3.5, lon: -52.5 }],
    },
  ],
  casai: [{ n: "CASAI Brasília", lat: -15.8, lon: -47.9 }],
};
const redeDaFila = {
  rede: {
    ALTAMIRA: {
      u: [["POSTO DE SAÚDE IPIXUNA", "921106", -4.6, -52.6, "Altamira", "PA"]],
    },
  },
};
const pendenciasDaFila = [
  {
    fonte: "lmap",
    tipo: "polo",
    dsei: "XINGU",
    codigo: "10",
    nome: "Pavuru",
    conferido: false,
  },
  {
    fonte: "rede_cnes",
    tipo: "u",
    dsei: "ALTAMIRA",
    codigo: "921106",
    nome: "POSTO DE SAÚDE IPIXUNA",
    municipio: "Altamira/PA",
    conferido: false,
  },
  {
    fonte: "lmap",
    tipo: "polo",
    dsei: "ALTAMIRA",
    codigo: "20",
    nome: "Laranjal",
    conferido: true,
  },
];

describe("fila do editor de coordenadas", () => {
  const pontos = pontosEditaveisDoMapa(lmapDaFila, redeDaFila);

  it("liga a pendência ao ponto por fonte, tipo, DSEI e código", () => {
    expect(chaveDaPendencia(pendenciasDaFila[0])).toBe("lmap|polo|XINGU|10");
    const polo = pontos.find((p) => p.nome === "Polo · Pavuru");
    expect(chaveDaPendencia(polo.alvo)).toBe("lmap|polo|XINGU|10");
  });

  it("Só pendentes: tira conferidos e sem pendência, conta e ordena por DSEI", () => {
    const { itens, pendentes } = filaDeCoordenadas(pontos, pendenciasDaFila);
    expect(pendentes).toBe(2);
    expect(itens.map((i) => i.nome)).toEqual([
      "Unidade CNES · POSTO DE SAÚDE IPIXUNA",
      "Polo · Pavuru",
    ]);
    expect(itens.every((i) => i.pendente)).toBe(true);
  });

  it("sem o filtro: todos, DSEI em ordem e os sem DSEI no fim", () => {
    const { itens } = filaDeCoordenadas(pontos, pendenciasDaFila, {
      soPendentes: false,
    });
    expect(itens.map((i) => i.nome)).toEqual([
      "Polo · Laranjal",
      "Sede · Altamira",
      "Unidade CNES · POSTO DE SAÚDE IPIXUNA",
      "Polo · Pavuru",
      "Sede · Xingu",
      "CASAI · CASAI Brasília",
    ]);
    const laranjal = itens[0];
    expect(laranjal.pendencia.conferido).toBe(true);
    expect(laranjal.pendente).toBe(false);
  });

  it("busca por nome, CNES, município e DSEI, sem acento nem caixa", () => {
    const nomes = (busca) =>
      filaDeCoordenadas(pontos, pendenciasDaFila, {
        busca,
        soPendentes: false,
      }).itens.map((i) => i.nome);
    expect(nomes("saude ipixuna")).toEqual([
      "Unidade CNES · POSTO DE SAÚDE IPIXUNA",
    ]);
    expect(nomes("921106")).toEqual(["Unidade CNES · POSTO DE SAÚDE IPIXUNA"]);
    expect(nomes("xingu")).toEqual(["Polo · Pavuru", "Sede · Xingu"]);
    expect(nomes("ALTAMIRA PA")).toEqual([
      "Unidade CNES · POSTO DE SAÚDE IPIXUNA",
    ]);
    expect(
      filaDeCoordenadas(pontos, pendenciasDaFila, { busca: "zzz" }).pendentes,
    ).toBe(2);
  });

  it("textos de contagem e de ação", () => {
    expect(textoDePendentes(0)).toBe("0 pendentes");
    expect(textoDePendentes(1)).toBe("1 pendente");
    expect(textoDePendentes(249)).toBe("249 pendentes");
    expect(rotuloDaAcao("CONFERENCIA")).toBe("Conferido");
    expect(rotuloDaAcao("DESFAZER")).toBe("Desfeito");
    expect(rotuloDaAcao("CORRECAO")).toBe("Correção");
  });
});

describe("sugestões da pendência", () => {
  const ponto = { latitude: -4.6, longitude: -52.6 };

  it("CNES primeiro, depois aldeias por distância; repetidos saem", () => {
    const sugestoes = sugestoesDaPendencia(
      {
        candidatos: [
          { f: "IBGE", n: "Longe", lat: -5.6, lon: -52.6 },
          { f: "FUNAI", n: "Perto", lat: -4.65, lon: -52.6, ti: "Araweté" },
          { f: "CNES", n: "Cadastro", lat: -4.6, lon: -52.6 },
          { f: "IBGE", n: "Longe de novo", lat: -5.6, lon: -52.6 },
        ],
      },
      ponto,
    );
    expect(sugestoes.map((s) => s.nome)).toEqual([
      "Cadastro",
      "Perto",
      "Longe",
    ]);
    expect(sugestoes.map((s) => s.rotulo)).toEqual([
      "CNES/DATASUS",
      "Aldeia · Funai",
      "Aldeia · IBGE",
    ]);
    expect(sugestoes[0].distanciaKm).toBe(0);
    expect(sugestoes[1].terra).toBe("Araweté");
    expect(Math.round(sugestoes[2].distanciaKm)).toBe(111);
  });

  it("acrescenta a sede do município quando a tabela a conhece", () => {
    const sugestoes = sugestoesDaPendencia(
      { municipio: "Seropédica/RJ", candidatos: [] },
      ponto,
    );
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].rotulo).toBe("Sede do município");
    expect(sugestoes[0].nome).toBe("Seropédica/RJ");
    expect(sugestoesDaPendencia({ municipio: "Lugar/XX" }, ponto)).toEqual([]);
  });

  it("sem posição atual não há distância; sem pendência, nada", () => {
    const [s] = sugestoesDaPendencia(
      { candidatos: [{ f: "OSM", n: "Lugar", lat: -3, lon: -50 }] },
      { latitude: null, longitude: null },
    );
    expect(s.distanciaKm).toBeNull();
    expect(formatarDistancia(s.distanciaKm)).toBe("—");
    expect(sugestoesDaPendencia(null, ponto)).toEqual([]);
  });

  it("formata a distância em metros ou quilômetros", () => {
    expect(formatarDistancia(0.35)).toBe("350 m");
    expect(formatarDistancia(4.21)).toBe("4,2 km");
    expect(formatarDistancia(73.8)).toBe("74 km");
  });
});

describe("desfazer do histórico", () => {
  const correcao = {
    id: 3,
    acao: "CORRECAO",
    latitude_anterior: -1,
    longitude_anterior: -50,
    desfeito: false,
  };
  it("só a mais recente, se não for desfazer, não desfeita e com posição anterior", () => {
    expect(correcaoDesfazivel([correcao, { ...correcao, id: 2 }])).toBe(
      correcao,
    );
    expect(correcaoDesfazivel([{ ...correcao, acao: "DESFAZER" }])).toBeNull();
    expect(correcaoDesfazivel([{ ...correcao, desfeito: true }])).toBeNull();
    expect(
      correcaoDesfazivel([{ ...correcao, latitude_anterior: null }]),
    ).toBeNull();
    expect(correcaoDesfazivel([])).toBeNull();
    expect(
      correcaoDesfazivel([{ ...correcao, acao: "CONFERENCIA" }]).acao,
    ).toBe("CONFERENCIA");
  });
});

describe("gravidade da pendência", () => {
  const ponto = { latitude: -4.6, longitude: -52.6 };
  const nivel = (pendencia) => gravidadeDaPendencia(pendencia, ponto)?.nivel;

  it("provável erro pelo motivo da auditoria (sede do município), mesmo com aldeia perto", () => {
    const g = gravidadeDaPendencia(
      {
        motivo_tipo: "SEDE_MUNICIPAL",
        candidatos: [{ f: "FUNAI", n: "Koiupanká", lat: -4.6, lon: -52.61 }],
      },
      ponto,
    );
    expect(g.nivel).toBe("erro");
    expect(g.resumo).toBe(
      "Na sede do município · aldeia Koiupanká a 1,1 km (Funai)",
    );
    expect(g.melhor.nome).toBe("Koiupanká");
  });

  it("a régua é a aldeia mais perto, não o CNES (que costuma ser a posição atual)", () => {
    const comCnes = (aldeiaLat) => ({
      motivo_tipo: "FONTES_DIVERGEM",
      candidatos: [
        { f: "CNES", n: "Posto", lat: -4.6, lon: -52.6 },
        { f: "IBGE", n: "Aldeia", lat: aldeiaLat, lon: -52.6 },
      ],
    });
    expect(nivel(comCnes(-4.8))).toBe("erro"); // ~22 km
    expect(nivel(comCnes(-4.65))).toBe("revisar"); // ~5,6 km
    expect(nivel(comCnes(-4.61))).toBe("confirmar"); // ~1,1 km
  });

  it("só CNES, sem aldeia: revisar; sem candidato: sem sugestão; sem pendência: nada", () => {
    expect(
      nivel({
        motivo_tipo: "UMA_FONTE",
        candidatos: [{ f: "CNES", n: "Posto", lat: -4.6, lon: -52.6 }],
      }),
    ).toBe("revisar");
    expect(nivel({ motivo_tipo: "SEM_CANDIDATO", candidatos: [] })).toBe("sem");
    expect(gravidadeDaPendencia(null, ponto)).toBeNull();
  });
});

describe("folga do enquadramento no modo de edição", () => {
  const mapa = { left: 0, top: 60, right: 1240, bottom: 760 };
  it("painel à direita: desconta a largura coberta no padding de baixo/direita", () => {
    const painel = { left: 828, top: 72, right: 1228, bottom: 748 };
    expect(folgaDoEnquadramento(mapa, painel)).toEqual({
      paddingTopLeft: [72, 72],
      paddingBottomRight: [412 + 72, 72],
    });
  });
  it("folha embaixo (celular): desconta a altura coberta", () => {
    const celular = { left: 14, top: 100, right: 376, bottom: 831 };
    const folha = { left: 14, top: 578, right: 376, bottom: 831 };
    expect(folgaDoEnquadramento(celular, folha)).toEqual({
      paddingTopLeft: [72, 72],
      paddingBottomRight: [72, 253 + 72],
    });
  });
  it("sem painel, painel fora do mapa, medida zero ou área livre pequena: só a base", () => {
    const base = { paddingTopLeft: [72, 72], paddingBottomRight: [72, 72] };
    expect(folgaDoEnquadramento(mapa, null)).toEqual(base);
    expect(folgaDoEnquadramento(undefined, mapa)).toEqual(base);
    expect(
      folgaDoEnquadramento(mapa, {
        left: 1300,
        top: 0,
        right: 1400,
        bottom: 800,
      }),
    ).toEqual(base);
    const zero = { left: 0, top: 0, right: 0, bottom: 0 };
    expect(folgaDoEnquadramento(zero, zero)).toEqual(base);
    expect(
      folgaDoEnquadramento(
        { left: 0, top: 0, right: 400, bottom: 300 },
        { left: 120, top: 0, right: 400, bottom: 300 },
      ),
    ).toEqual(base);
    expect(folgaDoEnquadramento(mapa, null, { base: 30 })).toEqual({
      paddingTopLeft: [30, 30],
      paddingBottomRight: [30, 30],
    });
  });
});
