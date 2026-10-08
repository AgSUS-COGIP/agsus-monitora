import { readFileSync } from "node:fs";
import { fonteDoApp } from "./fonte-do-app.js";
import { describe, expect, it } from "vitest";
import { BRASIL_BOUNDS, boundsDoGeoJson } from "../src/lib/brasil-bounds.js";
import {
  chaveDoDsei,
  temCoordenada,
} from "../src/lib/mapa-saude-indigena/chaves.js";
import {
  BR_OUTLINE,
  UF_GEO,
} from "../src/lib/mapa-saude-indigena/contornos.js";
import {
  CORES_DO_MAPA,
  FORMAS,
  formaDoTipo,
  TIPOS_DA_LEGENDA,
  tipoDaUnidade,
} from "../src/lib/mapa-saude-indigena/formas.ts";
import {
  classificarRegistros,
  dicaDoRegistro,
  limitesDoDsei,
  linhaDaTerra,
  pontosDoDistrito,
  popupDaSede,
  popupDoRegistro,
  registroDaSede,
  registrosDoDsei,
  registrosExternos,
  registrosLocais,
  resumoDaRede,
  textoDosVinculosExternos,
  tiposDoTerritorio,
  visiveis,
} from "../src/lib/mapa-saude-indigena/mapa-do-dsei.js";
import {
  bolhasDosDsei,
  casaisNacionais,
  contarPorDsei,
  dicaDaBolha,
  enquadramentoNacional,
  popupDaCasaiNacional,
  territoriosPorVagas,
} from "../src/lib/mapa-saude-indigena/mapa-nacional.js";

/*
  O mapa da Saúde Indígena sem Leaflet (src/lib/mapa-saude-indigena/): as
  regras do `legacy-app.js` (bolhas, CASAIs nacionais, "Territórios por
  vagas", pontos do DSEI, vínculos, resumo da dica) como entrada → saída.
*/

const edital = (unidade, vagas_total, vagas_ociosas) => ({
  unidade,
  vagas_total,
  vagas_ociosas,
});

describe("chaves", () => {
  it("casa o nome da unidade do edital com a chave do lmap", () => {
    expect(chaveDoDsei("DSEI Kaiapó de Mato Grosso")).toBe(
      chaveDoDsei("KAIAPO DO MATO GROSSO"),
    );
    expect(chaveDoDsei("DSEI Guamá-Tocantins")).toBe("GUAMA TOCANTINS");
    expect(chaveDoDsei("CASAI Nacional Brasília")).toBe("BRASILIA");
    expect(chaveDoDsei("")).toBe("");
  });

  it("coordenada exige as duas partes numéricas", () => {
    expect(temCoordenada(-3.7, -38.5)).toBe(true);
    expect(temCoordenada("-3.7", "-38.5")).toBe(true);
    expect(temCoordenada(null, -38.5)).toBe(false);
    expect(temCoordenada("", "")).toBe(false);
  });
});

describe("contagens e bolhas do mapa nacional", () => {
  const dseis = [
    { k: "CEARA", n: "Ceará", lat: -3.7, lon: -38.5, pop: 400, ufs: ["CE"] },
    { k: "YANOMAMI", n: "Yanomami", lat: 2.8, lon: -60.7, pop: 3600 },
    { k: "SEM COORDENADA", n: "Sem", lat: null, lon: null, pop: 10 },
  ];
  const linhas = [
    edital("DSEI Ceará", 10, 2),
    edital("DSEI CEARÁ", 5, 5),
    edital("DSEI Yanomami", 0, 0),
  ];

  it("conta editais, vagas e ociosas por DSEI", () => {
    const contagens = contarPorDsei(linhas);
    expect(contagens.get("CEARA")).toEqual({
      editais: 2,
      vagas: 15,
      ociosas: 7,
    });
    expect(contagens.get("YANOMAMI").editais).toBe(1);
  });

  it("desenha os DSEIs com coordenada, do maior para o menor", () => {
    const bolhas = bolhasDosDsei({ dseis, contagens: contarPorDsei(linhas) });
    expect(bolhas.map((b) => b.chave)).toEqual(["YANOMAMI", "CEARA"]);
    expect(bolhas[0].raio).toBeGreaterThan(bolhas[1].raio);
    const ceara = bolhas[1];
    expect(ceara.estilo.fillColor).toBe(CORES_DO_MAPA.comEdital.preenchimento);
    expect(ceara.estilo.weight).toBe(3);
    expect(ceara.ociosas).toBe(7);
  });

  it("com filtro ativo, só os DSEIs com edital no recorte", () => {
    const bolhas = bolhasDosDsei({
      dseis,
      contagens: contarPorDsei([edital("DSEI Ceará", 1, 0)]),
      filtroAtivo: true,
    });
    expect(bolhas.map((b) => b.chave)).toEqual(["CEARA"]);
  });

  it("territórios por vagas: ordem, preenchimento e situação", () => {
    const bolhas = bolhasDosDsei({ dseis, contagens: contarPorDsei(linhas) });
    const [primeiro, segundo] = territoriosPorVagas(bolhas);
    expect(primeiro.chave).toBe("CEARA");
    expect(primeiro.posicao).toBe(1);
    expect(primeiro.preenchidas).toBe(53);
    expect(primeiro.situacao).toBe("atencao");
    expect(primeiro.detalhe).toBe("7 ociosas · 2 processos · 400 hab.");
    // Sem vagas, desempata pela população.
    expect(segundo.chave).toBe("YANOMAMI");
    expect(segundo.preenchidas).toBe(0);
  });

  it("a dica da bolha diz população, rede, UFs, processos e ociosas", () => {
    const [ceara] = bolhasDosDsei({
      dseis: [dseis[0]],
      contagens: contarPorDsei(linhas),
    });
    const dica = dicaDaBolha(ceara, ["Polos base: 12"]);
    expect(dica.titulo).toBe("DSEI Ceará");
    expect(dica.linhas).toEqual([
      "População do DSEI: 400 indígenas",
      "Polos base: 12",
      "Estados administrativos: CE",
      "Processos seletivos: 2",
      "Vagas ociosas: 7 de 15",
    ]);
  });

  it("enquadra o Brasil sem filtro, um ponto ou a caixa com filtro", () => {
    const bolhas = bolhasDosDsei({ dseis, contagens: contarPorDsei(linhas) });
    expect(enquadramentoNacional({ bolhas }).modo).toBe("brasil");
    expect(
      enquadramentoNacional({ bolhas: bolhas.slice(0, 1), filtroAtivo: true })
        .modo,
    ).toBe("ponto");
    const caixa = enquadramentoNacional({ bolhas, filtroAtivo: true });
    expect(caixa.modo).toBe("caixa");
    expect(caixa.chave).not.toBe(enquadramentoNacional({ bolhas }).chave);
  });
});

describe("CASAIs nacionais", () => {
  const nac = [
    ["CASAI DF", "", -15.8, -47.9, "BRASILIA", 53, 0, 0, 0, null],
    [
      "CASAI SÃO PAULO",
      "123",
      -23.5,
      -46.6,
      "SAO PAULO",
      "SP",
      0,
      0,
      0,
      { coordenada_compartilhada_qtd: 3 },
    ],
  ];

  it("vêm do rede_cnes.nac, com UF por sigla e busca por cidade", () => {
    const casais = casaisNacionais({ nac });
    expect(casais.map((c) => [c.uf, c.termoDeBusca])).toEqual([
      ["DF", "CASAI BRASILIA"],
      ["SP", "CASAI SAO PAULO"],
    ]);
    expect(popupDaCasaiNacional(casais[1])).toEqual({
      titulo: "CASAI SÃO PAULO",
      linhas: [
        "Casa de Saúde Indígena (referência nacional)",
        "SAO PAULO – SP",
        "CNES: 123",
        "Processos seletivos: 0",
      ],
    });
  });

  it("com filtro, só a que tem edital no recorte", () => {
    const casais = casaisNacionais({
      nac,
      contagens: contarPorDsei([edital("CASAI DF", 1, 0)]),
      filtroAtivo: true,
    });
    expect(casais.map((c) => c.nome)).toEqual(["CASAI DF"]);
  });
});

describe("pontos de um DSEI", () => {
  const dsei = {
    k: "TESTE",
    n: "Teste",
    lat: -9.6,
    lon: -35.7,
    sedeuf: "AL",
    ufs: ["AL", "SE"],
    sede_municipio: "Maceió",
    sede_endereco: "Rua A, 1",
    sede_cnes: "999",
    polos: [
      { n: "XITEI", lat: -9.9, lon: -36.0, uf: "AL" },
      { n: "LONGE", lat: -8.0, lon: -35.0, uf: "PE" },
    ],
  };
  const redeCnes = {
    rede: {
      TESTE: {
        u: [
          ["POLO BASE XITEI", "111", -9.9, -36.0, "TRAIPU", 27],
          ["UBSI ALDEIA <b>", "222", -10.1, -36.4, "PORTO REAL", 27],
          ["UBSI ALDEIA <b>", "222", -10.1, -36.4, "PORTO REAL", 27],
        ],
        c: [["CASAI AL/SE", "333", -9.62, -35.73, "MACEIO", 27]],
      },
    },
  };

  it("reconcilia o polo com o CNES e não repete estabelecimento", () => {
    const registros = registrosDoDsei(dsei, redeCnes);
    const nomes = registros.map((r) => `${r.type.key}:${r.name}`);
    expect(nomes.filter((n) => n.includes("XITEI"))).toHaveLength(1);
    expect(nomes.filter((n) => n.includes("ALDEIA"))).toHaveLength(1);
    expect(nomes).toContain("casai:CASAI AL/SE");
    expect(nomes).toContain("polo:LONGE");
    expect(new Set(registros.map((r) => r.id)).size).toBe(registros.length);
  });

  it("vínculo: fora das UFs do DSEI é externo; o enquadramento do território o deixa de fora", () => {
    const classificados = classificarRegistros(
      registrosDoDsei(dsei, redeCnes),
      dsei,
    );
    const externos = registrosExternos(classificados);
    expect(externos.map((r) => r.name)).toEqual(["LONGE"]);
    expect(registrosLocais(classificados)).toHaveLength(
      classificados.length - 1,
    );
    const limites = limitesDoDsei(dsei, classificados);
    expect(limites.completo).toHaveLength(limites.territorio.length + 1);
    expect(limites.territorio[0]).toEqual([-9.6, -35.7]);
    expect(textoDosVinculosExternos(1)).toBe("1 vínculo fora da área");
    expect(textoDosVinculosExternos(3)).toBe("3 vínculos fora da área");
    expect(textoDosVinculosExternos(0)).toBe("");
  });

  it("tipos do território, do mais frequente ao menos, e filtro por ocultos", () => {
    const registros = registrosDoDsei(dsei, redeCnes);
    const tipos = tiposDoTerritorio(registros);
    expect(tipos[0].tipo.key).toBe("polo");
    expect(
      visiveis(registros, new Set(["polo"])).every(
        (r) => r.type.key !== "polo",
      ),
    ).toBe(true);
  });

  it("resumo da dica: polos que o distrito tem e pontos que o mapa mostra", () => {
    const registros = registrosDoDsei(dsei, redeCnes);
    expect(resumoDaRede(dsei, registros)).toEqual([
      "Polos base: 2",
      "No mapa: 4 pontos (2 polos, 1 unidades, 1 CASAIs)",
    ]);
    expect(resumoDaRede({ k: "X" }, [])).toEqual(["Sem unidades cadastradas"]);
  });

  it("popups e dicas são texto (sem HTML) e não falam de validação", () => {
    const [registro] = classificarRegistros(
      registrosDoDsei(dsei, redeCnes).filter((r) => r.name.includes("ALDEIA")),
      dsei,
    );
    const popup = popupDoRegistro(registro);
    expect(popup.titulo).toBe("UBSI");
    expect(popup.linhas).toEqual([
      "UBSI ALDEIA <b>",
      "PORTO REAL – AL",
      "CNES: 222",
    ]);
    expect(popup.nota).toBeUndefined();
    expect(dicaDoRegistro(registro, dsei).linhas).toEqual([
      "Vinculado ao DSEI Teste",
      "Localização: AL",
    ]);
  });

  it("a sede: estrela fora dos totais, popup com endereço e origem", () => {
    expect(registroDaSede(dsei).type.key).toBe("sede");
    expect(registroDaSede({ k: "X" })).toBeNull();
    expect(popupDaSede(dsei)).toEqual({
      titulo: "Sede do DSEI Teste",
      linhas: ["Rua A, 1", "Maceió – AL"],
      nota: "Endereço do CNES 999",
    });
    expect(pontosDoDistrito(dsei, [])).toEqual([{ lat: -9.6, lon: -35.7 }]);
  });

  it("a linha da terra: povo não declarado é dito, não inventado", () => {
    expect(
      linhaDaTerra({
        nome: "Xucuru",
        povos: [],
        ufs: ["PE"],
        fase: "Regularizada",
        caixa: { oeste: 1, sul: 2, leste: 3, norte: 4 },
      }),
    ).toEqual({
      nome: "Xucuru",
      povos: "povo não declarado pela Funai",
      povoDeclarado: false,
      detalhe: "PE · Regularizada",
      caixa: { oeste: 1, sul: 2, leste: 3, norte: 4 },
    });
  });
});

describe("formas, cores e contornos (a cópia única, desde que o legado saiu)", () => {
  it("tipos desconhecidos ou herdados do protótipo usam a forma de unidade", () => {
    for (const tipo of [
      null,
      {},
      "desconhecido",
      "__proto__",
      "constructor",
      "toString",
    ]) {
      expect(formaDoTipo(tipo)).toBe(FORMAS.unit);
    }
    expect(formaDoTipo("sede")).toBe(FORMAS.sede);
  });
  it("cada tipo tem a sua forma e a sua cor, na ordem da legenda", () => {
    expect([...TIPOS_DA_LEGENDA]).toEqual([
      "sede",
      "polo",
      "casai",
      "ubsi",
      "unit",
    ]);
    expect(
      Object.fromEntries(
        TIPOS_DA_LEGENDA.map((tipo) => [
          tipo,
          [FORMAS[tipo].forma, FORMAS[tipo].cor],
        ]),
      ),
    ).toEqual({
      sede: ["estrela", "#1f2937"],
      polo: ["circulo", "#e49a1b"],
      casai: ["casa", "#d92d3a"],
      ubsi: ["cruz", "#6d28d9"],
      unit: ["losango", "#0d8192"],
    });
  });

  it("o tipo vem do nome da unidade", () => {
    expect(tipoDaUnidade("CASA DE SAÚDE INDÍGENA").key).toBe("casai");
    expect(tipoDaUnidade("POLO BASE X").key).toBe("polo");
    expect(tipoDaUnidade("UNIDADE BÁSICA Y").key).toBe("ubsi");
    expect(tipoDaUnidade("POSTO").key).toBe("unit");
  });

  it("os contornos moram só em contornos.js (o legado não tem mais cópia)", () => {
    const app = fonteDoApp();
    expect(app).not.toContain("const UF_GEO");
    expect(app).not.toContain("const BR_OUTLINE");
    expect(UF_GEO.features).toHaveLength(27);
    expect(BR_OUTLINE.type).toBe("MultiPolygon");
  });

  it("BRASIL_BOUNDS bate com os vértices do contorno", () => {
    const medido = boundsDoGeoJson(BR_OUTLINE);
    const arredondar = (v) => Number(v.toFixed(2));
    expect(medido.bounds.map((par) => par.map(arredondar))).toEqual([
      [...BRASIL_BOUNDS[0]],
      [...BRASIL_BOUNDS[1]],
    ]);
  });
});
