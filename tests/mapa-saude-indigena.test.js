import { readFileSync } from "node:fs";
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
  TIPOS_DA_LEGENDA,
  corDoCalor,
  tipoDaUnidade,
} from "../src/lib/mapa-saude-indigena/formas.js";
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
  textoDaFonteDaCoordenada,
} from "../src/lib/mapa-saude-indigena/mapa-nacional.js";
import { applyLotacoesGeograficas } from "../src/modules/lotacoes-geograficas-transport.js";

/*
  O mapa da Saúde Indígena sem Leaflet (src/lib/mapa-saude-indigena/): as
  regras do `legacy-app.js` (bolhas, CASAIs nacionais, "Territórios por
  vagas", pontos do DSEI, vínculos, resumo da dica) como entrada → saída.
*/

/* Fixture com dados reais: as Lotações públicas sobre um `lmap` só com os 34 DSEIs. */
function dadosReais() {
  const dataset = Object.assign(
    {},
    ...Array.from({ length: 8 }, (_, i) =>
      JSON.parse(
        readFileSync(
          `public/data/lotacoes-geograficas-${String(i + 1).padStart(2, "0")}.json`,
          "utf8",
        ),
      ),
    ),
  );
  const dsei = Object.entries(dataset)
    .filter(([k]) => !k.startsWith("CASAI "))
    .map(([k, registros]) => ({
      k,
      n: k,
      sedeuf: (registros.find((r) => r[0] === "SEDE") || registros[0])[5],
      ufs: [...new Set(registros.map((r) => r[5]).filter(Boolean))],
      pop: registros.length * 100,
      polos: [],
    }));
  const [lmap, rede] = applyLotacoesGeograficas(
    [
      { chave: "lmap", payload: { dsei } },
      { chave: "rede_cnes", payload: { rede: {}, nac: [] } },
    ],
    dataset,
  );
  return { lmap: lmap.payload, redeCnes: rede.payload };
}

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
    expect(ceara.pctOciosas).toBe(47);
  });

  it("com filtro ativo, só os DSEIs com edital no recorte", () => {
    const bolhas = bolhasDosDsei({
      dseis,
      contagens: contarPorDsei([edital("DSEI Ceará", 1, 0)]),
      filtroAtivo: true,
    });
    expect(bolhas.map((b) => b.chave)).toEqual(["CEARA"]);
  });

  it("no calor, a cor é a faixa de ociosidade; sem edital, cinza", () => {
    const bolhas = bolhasDosDsei({
      dseis,
      contagens: contarPorDsei([edital("DSEI Ceará", 10, 7)]),
      calor: true,
    });
    const ceara = bolhas.find((b) => b.chave === "CEARA");
    expect(ceara.estilo.fillColor).toBe(corDoCalor(70));
    expect(ceara.estilo.fillColor).toBe("#d92d3a");
    expect(bolhas.find((b) => b.chave === "YANOMAMI").estilo.fillColor).toBe(
      CORES_DO_MAPA.semEditalNoCalor.preenchimento,
    );
    expect([corDoCalor(10), corDoCalor(25), corDoCalor(45)]).toEqual([
      "#0b8f58",
      "#f2b705",
      "#f2730c",
    ]);
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
    const dica = dicaDaBolha(ceara, ["Polos base: 12"], { calor: true });
    expect(dica.titulo).toBe("DSEI Ceará");
    expect(dica.linhas).toEqual([
      "População do DSEI: 400 indígenas",
      "Polos base: 12",
      "Estados administrativos: CE",
      "Processos seletivos: 2",
      "Ociosidade: 47% (7 de 15 vagas)",
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
    expect(popupDaCasaiNacional(casais[1]).nota).toBe(
      "Localização em validação · 3 estabelecimentos usam este ponto",
    );
  });

  it("com filtro, só a que tem edital no recorte", () => {
    const casais = casaisNacionais({
      nac,
      contagens: contarPorDsei([edital("CASAI DF", 1, 0)]),
      filtroAtivo: true,
    });
    expect(casais.map((c) => c.nome)).toEqual(["CASAI DF"]);
  });

  it("frase da coordenada", () => {
    expect(textoDaFonteDaCoordenada({ confirmacao_independente: true })).toBe(
      "Localização validada por fonte independente",
    );
    expect(textoDaFonteDaCoordenada(null)).toBe(
      "Localização em validação · coordenada cadastral CNES",
    );
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

  it("popups e dicas são texto (sem HTML) e dizem o veredito", () => {
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
    expect(popup.nota).toBe("Localização em validação");
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

describe("com os dados reais das Lotações (fixture de public/data)", () => {
  const { lmap, redeCnes } = dadosReais();

  it("34 DSEIs, todos com sede desenhável, e as duas CASAIs nacionais", () => {
    expect(lmap.dsei).toHaveLength(34);
    expect(lmap.dsei.every((d) => temCoordenada(d.lat, d.lon))).toBe(true);
    expect(
      casaisNacionais({ nac: redeCnes.nac }).map((c) => c.termoDeBusca),
    ).toEqual(["CASAI BRASILIA", "CASAI SAO PAULO"]);
  });

  it("os pontos de cada DSEI têm coordenada e não se repetem", () => {
    let total = 0;
    for (const d of lmap.dsei) {
      const registros = registrosDoDsei(d, redeCnes);
      total += registros.length;
      const chaves = registros.map((r) => `${r.name}|${r.lat}|${r.lon}`);
      expect(new Set(chaves).size, d.k).toBe(chaves.length);
      expect(
        registros.every(
          (r) => Number.isFinite(r.lat) && Number.isFinite(r.lon),
        ),
        d.k,
      ).toBe(true);
    }
    expect(total).toBe(550);
  });

  it("Alagoas e Sergipe e Yanomami: o que o mapa mostra", () => {
    const alse = lmap.dsei.find((d) => d.k === "ALAGOAS E SERGIPE");
    expect(resumoDaRede(alse, registrosDoDsei(alse, redeCnes))).toEqual([
      "Polos base: 13",
      "No mapa: 14 pontos (13 polos, 1 CASAIs)",
    ]);
    const yanomami = lmap.dsei.find((d) => d.k === "YANOMAMI");
    expect(
      tiposDoTerritorio(registrosDoDsei(yanomami, redeCnes)).map((t) => [
        t.tipo.key,
        t.quantidade,
      ]),
    ).toEqual([
      ["polo", 37],
      ["ubsi", 24],
      ["unit", 20],
      ["casai", 1],
    ]);
  });

  it("os editais da área viram bolhas, ranking e enquadramento", () => {
    const linhas = [
      edital("DSEI Yanomami", 40, 10),
      edital("DSEI Alagoas e Sergipe", 12, 0),
      edital("DSEI Kaiapó do Pará", 3, 3),
    ];
    const bolhas = bolhasDosDsei({
      dseis: lmap.dsei,
      contagens: contarPorDsei(linhas),
      filtroAtivo: true,
    });
    expect(bolhas).toHaveLength(3);
    expect(
      territoriosPorVagas(bolhas).map((t) => [t.dsei.k, t.situacao]),
    ).toEqual([
      ["YANOMAMI", "atencao"],
      ["ALAGOAS E SERGIPE", "ok"],
      ["KAIAPO DO PARA", "critico"],
    ]);
    expect(
      enquadramentoNacional({ bolhas, filtroAtivo: true }).pontos,
    ).toHaveLength(3);
  });
});

describe("formas, cores e contornos (a cópia única, desde que o legado saiu)", () => {
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
    const app = readFileSync("src/modules/legacy-app.js", "utf8");
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
