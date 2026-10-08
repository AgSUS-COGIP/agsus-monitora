import { describe, expect, it } from "vitest";
import {
  aplicarCoordenada,
  filaDeCoordenadasDosProjetos,
  gravidadeDoLugar,
  pontosEditaveisDosProjetos,
  sugestoesDoLugar,
} from "../src/lib/coordenadas-dos-projetos.js";
import {
  filaDoEditor,
  listaDeSugestoes,
  nivelDaGravidade,
} from "../src/lib/editor-de-coordenadas.ts";
import {
  municipiosDaResposta,
  pontosDosMunicipios,
} from "../src/lib/visao-geral-da-area.ts";

/*
  As regras do editor de coordenadas no mapa de Projetos
  (src/lib/coordenadas-dos-projetos.js) e as partes comuns aos dois mapas
  que elas usam (src/lib/editor-de-coordenadas.js).
*/

// Linhas como a RPC listar_municipios_das_vagas_da_area devolve depois da
// migration 20261002190000 (lugar + coordenada do banco).
const RESPOSTA = [
  {
    lugar: "seropedica/RJ",
    municipio_uf: "Seropédica/RJ",
    uf: "RJ",
    codigo_ibge: 3305554,
    latitude: -22.7526,
    longitude: -43.7155,
    coordenada_origem: "SEDE_IBGE",
    projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
    editais: [
      {
        edital: "30/2026",
        projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
        lotacoes: ["UBS móvel Seropédica/RJ"],
      },
    ],
  },
  {
    lugar: "boa vista/RR",
    municipio_uf: "Boa Vista/RR",
    uf: "RR",
    codigo_ibge: 1400100,
    // 5,5 km ao norte da sede do IBGE (2.8238, -60.6753).
    latitude: 2.8733,
    longitude: -60.6753,
    coordenada_origem: "MANUAL",
    projetos: ["Escritório Distrital e Regional"],
    editais: [
      {
        edital: "62/2025",
        projeto: "Escritório Distrital e Regional",
        lotacoes: ["Escritório Distrital Yanomami"],
      },
    ],
  },
  {
    lugar: "uf:PA",
    municipio_uf: null,
    uf: "PA",
    nivel: "uf",
    latitude: -2.9668,
    longitude: -49.7614,
    coordenada_origem: "CENTRO_UF",
    projetos: ["CCE", "Escritório Distrital e Regional"],
    editais: [{ edital: "97/2025", projeto: "CCE" }],
  },
  {
    lugar: "lugar novo/AM",
    municipio_uf: "Lugar Novo/AM",
    uf: "AM",
    latitude: null,
    longitude: null,
    projetos: ["MFC"],
    editais: [{ edital: "05/2026", projeto: "MFC" }],
  },
];
const LUGARES = municipiosDaResposta(RESPOSTA);
const PONTOS = pontosEditaveisDosProjetos(LUGARES);
const ponto = (lugar) => PONTOS.find((p) => p.id === lugar);
const pendencia = (lugar, motivo_tipo, candidatos = [], extra = {}) => ({
  lugar,
  nome: lugar,
  motivo_tipo,
  motivo: `motivo ${motivo_tipo}`,
  conferido: false,
  candidatos,
  ...extra,
});

describe("lugares do mapa de Projetos no editor", () => {
  it("a coordenada vem do banco; sem o campo (banco antigo), da tabela do front", () => {
    expect(LUGARES[0]).toMatchObject({
      lugar: "seropedica/RJ",
      coordenada: {
        latitude: -22.7526,
        longitude: -43.7155,
        origem: "SEDE_IBGE",
      },
    });
    expect(LUGARES[3].coordenada).toBeNull();
    const desenhados = pontosDosMunicipios(LUGARES);
    expect(
      desenhados.find((p) => p.lugar === "boa vista/RR").coordenadas,
    ).toEqual([2.8733, -60.6753]);
    expect(
      desenhados.find((p) => p.lugar === "lugar novo/AM").coordenadas,
    ).toBeNull();
    const [antigo] = municipiosDaResposta([
      { municipio_uf: "Seropédica/RJ", uf: "RJ" },
    ]);
    expect(antigo.coordenada).toBeUndefined();
    expect(antigo.lugar).toBe("");
    expect(pontosDosMunicipios([antigo])[0].coordenadas).toEqual([
      -22.7526, -43.7155,
    ]);
  });

  it("pontos editáveis: só com a chave do lugar, com UF, projetos, editais e lotações", () => {
    expect(PONTOS.map((p) => p.id)).toEqual([
      "seropedica/RJ",
      "boa vista/RR",
      "uf:PA",
      "lugar novo/AM",
    ]);
    expect(ponto("uf:PA")).toMatchObject({
      alvo: { lugar: "uf:PA" },
      nome: "Pará (estado)",
      nivel: "uf",
      localidade: "Escritório Distrital e Regional, CCE",
      latitude: -2.9668,
    });
    expect(ponto("seropedica/RJ").lotacoes).toEqual([
      "UBS móvel Seropédica/RJ",
    ]);
    expect(ponto("lugar novo/AM")).toMatchObject({
      latitude: null,
      longitude: null,
    });
    expect(
      pontosEditaveisDosProjetos(
        municipiosDaResposta([{ municipio_uf: "Irati/PR", uf: "PR" }]),
      ),
    ).toEqual([]);
  });

  it("sugestões: as da pendência e a sede do IBGE (ou o centro da UF), sem repetir", () => {
    const sugestoes = sugestoesDoLugar(
      pendencia("boa vista/RR", "SEDE_MUNICIPAL", [
        { f: "MUNICIPIO", n: "Boa Vista/RR", lat: 2.8238, lon: -60.6753 },
        { f: "DSEI", n: "Sede do DSEI Yanomami", lat: 2.83, lon: -60.69 },
      ]),
      ponto("boa vista/RR"),
    );
    expect(sugestoes.map((s) => [s.fonte, s.nome])).toEqual([
      ["MUNICIPIO", "Boa Vista/RR"],
      ["DSEI", "Sede do DSEI Yanomami"],
    ]);
    expect(sugestoes[0].rotulo).toBe("Sede do município (IBGE)");
    expect(sugestoes[0].distanciaKm).toBeCloseTo(5.5, 0);
    expect(
      sugestoesDoLugar(null, ponto("uf:PA")).map((s) => [s.fonte, s.nome]),
    ).toEqual([["UF", "Pará"]]);
    expect(sugestoesDoLugar(null, ponto("lugar novo/AM"))).toEqual([]);
  });
});

describe("gravidade de um lugar", () => {
  it("só confirmar: na sede do município ou no centro da UF", () => {
    expect(
      gravidadeDoLugar(
        pendencia("seropedica/RJ", "SEDE_MUNICIPAL"),
        ponto("seropedica/RJ"),
      ),
    ).toMatchObject({
      nivel: "confirmar",
      resumo: "Na sede do município · Sede do município (IBGE) a 0 m",
      melhor: { fonte: "MUNICIPIO" },
    });
    expect(
      gravidadeDoLugar(pendencia("uf:PA", "SO_UF"), ponto("uf:PA")),
    ).toMatchObject({
      nivel: "confirmar",
      resumo: "O edital só diz a UF · Centro da UF a 0 m",
    });
  });

  it("revisar: régua entre 2 e 10 km, ou escritório num edital que só diz a UF", () => {
    expect(
      gravidadeDoLugar(
        pendencia("boa vista/RR", "SEDE_MUNICIPAL"),
        ponto("boa vista/RR"),
      ),
    ).toMatchObject({ nivel: "revisar" });
    expect(
      gravidadeDoLugar(pendencia("uf:PA", "ESCRITORIO_SO_UF"), ponto("uf:PA")),
    ).toMatchObject({
      nivel: "revisar",
      resumo: "Escritório num edital que só diz a UF · Centro da UF a 0 m",
    });
  });

  it("provável erro: sem coordenada, motivo de erro ou régua a mais de 10 km; sem sugestão", () => {
    const longe = { ...ponto("seropedica/RJ"), latitude: -22.5 };
    expect(
      gravidadeDoLugar(pendencia("seropedica/RJ", "SEDE_MUNICIPAL"), longe)
        .nivel,
    ).toBe("erro");
    expect(
      gravidadeDoLugar(
        pendencia("seropedica/RJ", "LUGAR_DIVERGE"),
        ponto("seropedica/RJ"),
      ),
    ).toMatchObject({
      nivel: "erro",
      resumo: expect.stringMatching(/^Mesmo município com coordenadas/),
    });
    const semCoordenada = {
      ...ponto("seropedica/RJ"),
      latitude: null,
      longitude: null,
    };
    expect(gravidadeDoLugar(null, semCoordenada)).toMatchObject({
      nivel: "erro",
      resumo: "Sem coordenada · Sede do município (IBGE): Seropédica/RJ",
    });
    expect(gravidadeDoLugar(null, ponto("lugar novo/AM"))).toMatchObject({
      nivel: "sem",
      resumo: "Sem coordenada · nenhuma posição candidata",
      melhor: null,
    });
  });
});

describe("fila do editor de Projetos", () => {
  const PENDENCIAS = [
    pendencia("seropedica/RJ", "SEDE_MUNICIPAL"),
    pendencia("boa vista/RR", "SEDE_MUNICIPAL"),
    pendencia("uf:PA", "SO_UF", [], { conferido: true }),
  ];

  it("lugar sem coordenada é pendente mesmo sem pendência; provável erro primeiro", () => {
    const fila = filaDeCoordenadasDosProjetos(PONTOS, PENDENCIAS);
    expect(fila.pendentes).toBe(3);
    expect(fila.porGravidade).toEqual({
      erro: 0,
      revisar: 1,
      sem: 1,
      confirmar: 1,
    });
    expect(fila.itens.map((i) => i.id)).toEqual([
      "boa vista/RR",
      "lugar novo/AM",
      "seropedica/RJ",
    ]);
    const todos = filaDeCoordenadasDosProjetos(PONTOS, PENDENCIAS, {
      soPendentes: false,
    });
    expect(todos.itens.map((i) => i.id)).toEqual([
      "lugar novo/AM",
      "uf:PA",
      "seropedica/RJ",
      "boa vista/RR",
    ]);
    expect(todos.itens.find((i) => i.id === "uf:PA")).toMatchObject({
      pendente: false,
      gravidade: null,
    });
  });

  it("busca por lugar, UF, projeto, edital e lotação, sem acento nem caixa", () => {
    const busca = (texto) =>
      filaDeCoordenadasDosProjetos(PONTOS, PENDENCIAS, {
        busca: texto,
        soPendentes: false,
      }).itens.map((i) => i.id);
    expect(busca("seropedica")).toEqual(["seropedica/RJ"]);
    expect(busca("62/2025")).toEqual(["boa vista/RR"]);
    expect(busca("yanomami")).toEqual(["boa vista/RR"]);
    expect(busca("cce")).toEqual(["uf:PA"]);
    expect(busca("PARÁ")).toEqual(["uf:PA"]);
    expect(busca("mfc am")).toEqual(["lugar novo/AM"]);
  });

  it("filtra pelo nível da gravidade", () => {
    expect(
      filaDeCoordenadasDosProjetos(PONTOS, PENDENCIAS, {
        gravidade: "revisar",
      }).itens.map((i) => i.id),
    ).toEqual(["boa vista/RR"]);
  });

  it("aplicarCoordenada troca só o lugar gravado", () => {
    const novos = aplicarCoordenada(LUGARES, "lugar novo/AM", -3.1, -60);
    expect(novos[3].coordenada).toEqual({
      latitude: -3.1,
      longitude: -60,
      origem: "MANUAL",
    });
    expect(novos[0]).toBe(LUGARES[0]);
    expect(aplicarCoordenada(LUGARES, "x", Number.NaN, 1)).toBe(LUGARES);
    expect(aplicarCoordenada(undefined, "x", 1, 1)).toBeUndefined();
  });
});

describe("partes comuns do editor", () => {
  it("nivelDaGravidade: revisar nunca vira confirmar", () => {
    expect(nivelDaGravidade({ temSugestao: true, km: 1 })).toBe("confirmar");
    expect(nivelDaGravidade({ temSugestao: true, km: 1, revisar: true })).toBe(
      "revisar",
    );
    expect(nivelDaGravidade({ temSugestao: true, km: 11, revisar: true })).toBe(
      "erro",
    );
    expect(nivelDaGravidade({ temSugestao: false, motivoDeErro: "x" })).toBe(
      "sem",
    );
  });

  it("listaDeSugestoes: ordem do grupo, repetidas e posições inválidas fora", () => {
    const grupos = {
      A: { ordem: 1, rotulo: "A" },
      B: { ordem: 0, rotulo: "B" },
    };
    const lista = listaDeSugestoes(
      [
        { fonte: "A", nome: "x", latitude: -10, longitude: -50 },
        { fonte: "A", nome: "y", latitude: -10.0001, longitude: -50 },
        { fonte: "B", nome: "z", latitude: -11, longitude: -50 },
        { fonte: "C", nome: "w", latitude: "nada", longitude: -50 },
        { fonte: "C", nome: "v", latitude: -12, longitude: -50 },
      ],
      { latitude: -10, longitude: -50 },
      grupos,
    );
    expect(lista.map((s) => [s.fonte, s.nome, s.rotulo])).toEqual([
      ["B", "z", "B"],
      ["A", "x", "A"],
      ["OUTRA", "v", "Outra fonte"],
    ]);
  });

  it("filaDoEditor usa as regras de quem chama", () => {
    const fila = filaDoEditor(
      [
        { id: "1", nome: "Um" },
        { id: "2", nome: "Dois" },
      ],
      [{ chave: "1", conferido: false }],
      {},
      {
        chaveDoPonto: (p) => p.id,
        chaveDaPendencia: (p) => p.chave,
        gravidade: () => ({ nivel: "revisar", resumo: "", melhor: null }),
        pendenteSemPendencia: (p) => p.id === "2",
        textoDeBusca: (i) => i.nome,
        comparar: (a, b) => a.nome.localeCompare(b.nome),
      },
    );
    expect(fila.itens.map((i) => i.id)).toEqual(["2", "1"]);
    expect(fila.porGravidade.revisar).toBe(2);
  });
});
