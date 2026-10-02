import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chaveDoMunicipio,
  coordenadasDaUf,
  coordenadasDoMunicipio,
} from "../src/lib/coordenadas-dos-municipios.js";
import {
  MAPA_DOS_DSEIS,
  MAPA_DOS_MUNICIPIOS,
  RAIO_MAXIMO,
  RAIO_MINIMO,
  TEXTOS_DO_MAPA,
  PROJETOS_DO_MAPA,
  cabecalhoDaVisaoGeral,
  gruposPorProjeto,
  mapaDaVisaoGeral,
  municipiosDaResposta,
  pontosDosMunicipios,
  projetoDoMapa,
  projetosDosMunicipios,
  raioDoPonto,
  resultadoDoMunicipio,
  resumoDoLugar,
  rotuloDoLugar,
  textoDasVagas,
} from "../src/lib/visao-geral-da-area.js";

const html = readFileSync("index.html", "utf8").replace(/\s+/g, " ");

describe("uma Visão geral para as três áreas", () => {
  it("DSEIs na Saúde Indígena, municípios em Projetos, nenhum mapa na SEDE", () => {
    expect(mapaDaVisaoGeral("saude-indigena")).toBe(MAPA_DOS_DSEIS);
    expect(mapaDaVisaoGeral("projetos")).toBe(MAPA_DOS_MUNICIPIOS);
    expect(mapaDaVisaoGeral("sede")).toBe("");
    expect(mapaDaVisaoGeral(undefined)).toBe("");
  });

  it("a Saúde Indígena segue a configuração; as outras dizem o nome delas", () => {
    const configuracao = {
      titulo: "Saúde Indígena",
      subtitulo: "Monitoramento DSEI/CASAI",
    };
    expect(cabecalhoDaVisaoGeral("saude-indigena", configuracao)).toEqual(
      configuracao,
    );
    expect(cabecalhoDaVisaoGeral("sede", configuracao)).toEqual({
      titulo: "SEDE",
      subtitulo: "Monitoramento dos processos seletivos",
    });
    expect(cabecalhoDaVisaoGeral("projetos", configuracao).titulo).toBe(
      "Projetos",
    );
  });

  it("os textos do mapa de Projetos são do componente React, não do index.html", () => {
    const textos = TEXTOS_DO_MAPA[MAPA_DOS_MUNICIPIOS];
    expect(Object.keys(textos)).toEqual(["area", "titulo", "mapa", "lista"]);
    for (const valor of Object.values(textos))
      expect(html).not.toContain(valor);
    const componente = readFileSync(
      "src/modulos/mapa-de-projetos/mapa-de-projetos.jsx",
      "utf8",
    );
    expect(componente).toContain("TEXTOS_DO_MAPA[MAPA_DOS_MUNICIPIOS]");
  });
});

describe("municípios do mapa", () => {
  it("acha a coordenada sem ligar para acento, caixa ou espaço", () => {
    expect(chaveDoMunicipio(" Seropédica / rj ")).toBe("seropedica/rj");
    expect(coordenadasDoMunicipio("SEROPEDICA/RJ")).toMatchObject({
      municipio: "Seropédica",
      uf: "RJ",
      ibge: 3305554,
    });
    // Mesmo nome, outra UF: não é o mesmo lugar.
    expect(coordenadasDoMunicipio("Irati/SC")).toBeNull();
    expect(coordenadasDoMunicipio("Seropédica")).toBeNull();
    expect(chaveDoMunicipio(undefined)).toBe("");
  });

  it("todos os municípios de hoje têm coordenada dentro do Brasil", () => {
    for (const nome of [
      "Seropédica/RJ",
      "Talismã/TO",
      "Cubatão/SP",
      "Palhoça/SC",
      "Irati/PR",
    ]) {
      const lugar = coordenadasDoMunicipio(nome);
      expect(lugar, nome).not.toBeNull();
      expect(lugar.latitude).toBeGreaterThan(-33.75);
      expect(lugar.latitude).toBeLessThan(5.27);
      expect(lugar.longitude).toBeGreaterThan(-73.99);
      expect(lugar.longitude).toBeLessThan(-32.42);
    }
  });

  it("lê a resposta da RPC, com números e sem linha vazia", () => {
    expect(
      municipiosDaResposta([
        {
          municipio_uf: "Irati/PR",
          municipio: "Irati",
          uf: "PR",
          vagas: 5,
          candidatos: "70",
          aprovados: 43,
          reprovados: 27,
        },
        { municipio_uf: "  " },
      ]),
    ).toMatchObject([
      {
        chave: "Irati/PR",
        municipioUf: "Irati/PR",
        nivel: "municipio",
        vagas: 5,
        vagasEdital: null,
        candidatos: 70,
        aprovados: 43,
        reprovados: 27,
        projetos: [],
        editais: [],
      },
    ]);
    expect(municipiosDaResposta(null)).toEqual([]);
  });

  it("o raio cresce pela raiz e não passa o das bolhas dos DSEIs", () => {
    expect(raioDoPonto(0, 100)).toBe(RAIO_MINIMO);
    expect(raioDoPonto(100, 100)).toBe(RAIO_MAXIMO);
    expect(RAIO_MAXIMO).toBe(15);
    expect(raioDoPonto(25, 100)).toBe(11);
    expect(raioDoPonto(10, 0)).toBe(RAIO_MINIMO);
  });

  it("ordena por vagas (candidatos desempatam) e marca quem não tem coordenada", () => {
    const pontos = pontosDosMunicipios(
      municipiosDaResposta([
        { municipio_uf: "Irati/PR", vagas: 5, candidatos: 70 },
        { municipio_uf: "Seropédica/RJ", vagas: 12, candidatos: 647 },
        { municipio_uf: "Cubatão/SP", vagas: 5, candidatos: 90 },
        { municipio_uf: "Lugar Novo/AM", vagas: 1, candidatos: 10 },
      ]),
    );
    expect(pontos.map((ponto) => ponto.municipioUf)).toEqual([
      "Seropédica/RJ",
      "Cubatão/SP",
      "Irati/PR",
      "Lugar Novo/AM",
    ]);
    expect(pontos[0].coordenadas).toEqual([-22.7526, -43.7155]);
    expect(pontos[0].raio).toBe(RAIO_MAXIMO);
    expect(pontos[3].coordenadas).toBeNull();
  });

  it("o resultado é a parte aprovada entre as decididas", () => {
    expect(resultadoDoMunicipio({ aprovados: 43, reprovados: 27 })).toEqual({
      pct: 61,
      decididos: 70,
    });
    expect(resultadoDoMunicipio({ aprovados: 0, reprovados: 0 })).toBeNull();
    expect(resultadoDoMunicipio()).toBeNull();
  });
});

/*
  Todos os projetos no mapa de Projetos: os lugares vêm de TB_LOCAL_VAGA_EDITAL
  (lidos dos PDFs) e do "UBS móvel" do nome da vaga; cada lugar diz os
  projetos e editais dele.
*/
const SQL_DOS_LOCAIS = readFileSync(
  "supabase/correcoes/20261001-locais-das-vagas-dos-projetos.sql",
  "utf8",
);

const RESPOSTA_COM_PROJETOS = [
  {
    municipio_uf: "Boa Vista/RR",
    municipio: "Boa Vista",
    uf: "RR",
    codigo_ibge: 1400100,
    nivel: "municipio",
    vagas: 0,
    candidatos: 0,
    vagas_edital: 52,
    cadastro_reserva: true,
    projetos: ["Saúde nas Fronteiras", "Escritório Distrital e Regional"],
    editais: [
      {
        id: "e62",
        edital: "62/2025",
        projeto: "Escritório Distrital e Regional",
        vagas: 16,
        cadastro_reserva: false,
        origens: ["PDF"],
        lotacoes: ["Escritório Distrital Yanomami"],
      },
      {
        id: "e23",
        edital: "23/2025",
        projeto: "Saúde nas Fronteiras",
        vagas: 22,
        cadastro_reserva: false,
        origens: ["PDF"],
        lotacoes: ["Boa Vista/RR"],
      },
    ],
  },
  {
    municipio_uf: null,
    uf: "PA",
    nivel: "uf",
    vagas_edital: 1,
    cadastro_reserva: true,
    projetos: ["CCE"],
    editais: [{ edital: "97/2025", projeto: "CCE", vagas: 1 }],
  },
  {
    municipio_uf: "Seropédica/RJ",
    uf: "RJ",
    vagas: 12,
    candidatos: 647,
    vagas_edital: null,
    cadastro_reserva: true,
    projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
    editais: [
      {
        edital: "30/2026",
        projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
        vagas: null,
        cadastro_reserva: true,
        origens: ["NOME_VAGA", "PDF"],
      },
    ],
  },
];

describe("projetos no mapa de Projetos", () => {
  it("cada projeto tem uma série fixa, reconhecida pela unidade do edital", () => {
    expect(PROJETOS_DO_MAPA.map((projeto) => projeto.serie)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(
      projetoDoMapa("Projeto Agora Tem Especialistas Caminhoneiros"),
    ).toEqual({ nome: "Caminhoneiros", serie: 1 });
    expect(projetoDoMapa("ESCRITÓRIO DISTRITAL E REGIONAL").serie).toBe(3);
    expect(projetoDoMapa("MFC")).toEqual({ nome: "MFC", serie: 5 });
    expect(projetoDoMapa("Projeto Novo")).toEqual({
      nome: "Projeto Novo",
      serie: 0,
    });
    expect(projetoDoMapa("")).toEqual({ nome: "Sem projeto", serie: 0 });
  });

  it("lê lugar de UF, projetos e editais da resposta", () => {
    const [boaVista, para, seropedica] = municipiosDaResposta(
      RESPOSTA_COM_PROJETOS,
    );
    expect(boaVista).toMatchObject({
      chave: "Boa Vista/RR",
      codigoIbge: 1400100,
      vagasEdital: 52,
      cadastroReserva: true,
    });
    // Na ordem das séries, não na da resposta.
    expect(boaVista.projetos.map((projeto) => projeto.nome)).toEqual([
      "Saúde nas Fronteiras",
      "Escritório Distrital e Regional",
    ]);
    expect(boaVista.editais.map((edital) => edital.edital)).toEqual([
      "23/2025",
      "62/2025",
    ]);
    expect(para).toMatchObject({ chave: "uf:PA", nivel: "uf", uf: "PA" });
    expect(rotuloDoLugar(para)).toBe("Pará (estado)");
    expect(seropedica.projetos).toEqual([{ nome: "Caminhoneiros", serie: 1 }]);
    expect(seropedica.editais[0].origens).toEqual(["NOME_VAGA", "PDF"]);
  });

  it("as vagas publicadas por extenso", () => {
    expect(textoDasVagas({ vagas: 4, cadastroReserva: true })).toBe(
      "4 vagas + cadastro reserva",
    );
    expect(textoDasVagas({ vagas: 1 })).toBe("1 vaga");
    expect(textoDasVagas({ vagas: null, cadastroReserva: true })).toBe(
      "Cadastro reserva",
    );
    expect(textoDasVagas()).toBe("");
  });

  it("ponto na cor do primeiro projeto; com filtro, só os do projeto e na cor dele", () => {
    const lugares = municipiosDaResposta(RESPOSTA_COM_PROJETOS);
    const todos = pontosDosMunicipios(lugares);
    // Ordem pelo tamanho: vagas publicadas ou, se maiores, as das análises.
    expect(todos.map((ponto) => ponto.rotulo)).toEqual([
      "Boa Vista/RR",
      "Seropédica/RJ",
      "Pará (estado)",
    ]);
    expect(todos[0]).toMatchObject({
      serie: 2,
      variosProjetos: true,
      tamanho: 52,
      coordenadas: [2.8238, -60.6753],
    });
    // UF: o ponto é o meio do estado.
    const centroDoPara = coordenadasDaUf("PA");
    expect(todos[2].coordenadas).toEqual([
      centroDoPara.latitude,
      centroDoPara.longitude,
    ]);

    const escritorio = pontosDosMunicipios(lugares, {
      projeto: "Escritório Distrital e Regional",
    });
    expect(escritorio).toHaveLength(1);
    expect(escritorio[0]).toMatchObject({ serie: 3, variosProjetos: false });
  });

  it("os projetos presentes e a lista agrupada por projeto", () => {
    const lugares = municipiosDaResposta(RESPOSTA_COM_PROJETOS);
    expect(projetosDosMunicipios(lugares)).toEqual([
      { nome: "Caminhoneiros", serie: 1, lugares: 1 },
      { nome: "Saúde nas Fronteiras", serie: 2, lugares: 1 },
      { nome: "Escritório Distrital e Regional", serie: 3, lugares: 1 },
      { nome: "CCE", serie: 6, lugares: 1 },
    ]);
    const grupos = gruposPorProjeto(pontosDosMunicipios(lugares));
    expect(grupos.map((grupo) => grupo.nome)).toEqual([
      "Caminhoneiros",
      "Saúde nas Fronteiras",
      "Escritório Distrital e Regional",
      "CCE",
    ]);
    // Boa Vista é de dois projetos: aparece nos dois grupos.
    expect(grupos[1].pontos[0].rotulo).toBe("Boa Vista/RR");
    expect(grupos[2].pontos[0].rotulo).toBe("Boa Vista/RR");
  });

  it("o popup diz projeto, edital, vagas, lotação e candidatos", () => {
    const [boaVista, para] = pontosDosMunicipios(
      municipiosDaResposta(RESPOSTA_COM_PROJETOS),
    ).filter((ponto) => ponto.rotulo !== "Seropédica/RJ");
    const resumo = resumoDoLugar(boaVista);
    expect(resumo.titulo).toBe("Boa Vista/RR");
    expect(resumo.editais).toEqual([
      {
        projeto: "Saúde nas Fronteiras",
        serie: 2,
        texto: "Edital 23/2025 · 22 vagas · Boa Vista/RR",
      },
      {
        projeto: "Escritório Distrital e Regional",
        serie: 3,
        texto: "Edital 62/2025 · 16 vagas · Escritório Distrital Yanomami",
      },
    ]);
    // Boa Vista não casou com vaga nenhuma das análises: sem "Candidatos: 0" falso.
    expect(resumo.linhas.join(" ")).not.toMatch(
      /Candidatos|Vagas nas análises/,
    );
    expect(
      resumoDoLugar({ ...boaVista, vagas: 2, candidatos: 9 }).linhas,
    ).toContain("Candidatos: 9");
    expect(resumoDoLugar(para).linhas).toContain("O edital diz só o estado");
  });

  it("todo município do levantamento dos PDFs tem coordenada no Brasil", () => {
    const codigos = [
      ...SQL_DOS_LOCAIS.matchAll(
        /^\s*\('[^']+', '[^']+', (\d{7}), '([^']+)', '([A-Z]{2})'/gm,
      ),
    ];
    expect(codigos.length).toBeGreaterThan(50);
    for (const [, codigo, municipio, uf] of codigos) {
      const lugar = coordenadasDoMunicipio(`${municipio}/${uf}`, codigo);
      expect(lugar, `${municipio}/${uf}`).not.toBeNull();
      expect(lugar.ibge).toBe(Number(codigo));
      expect(lugar.uf).toBe(uf);
      expect(lugar.latitude).toBeGreaterThan(-33.75);
      expect(lugar.latitude).toBeLessThan(5.27);
    }
  });

  it("toda UF tem ponto", () => {
    for (const uf of "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(
      " ",
    )) {
      expect(coordenadasDaUf(uf), uf).not.toBeNull();
    }
    expect(coordenadasDaUf("XX")).toBeNull();
  });
});
