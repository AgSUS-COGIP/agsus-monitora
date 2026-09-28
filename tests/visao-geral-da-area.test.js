import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chaveDoMunicipio,
  coordenadasDoMunicipio,
} from "../src/lib/coordenadas-dos-municipios.js";
import {
  MAPA_DOS_DSEIS,
  MAPA_DOS_MUNICIPIOS,
  RAIO_MAXIMO,
  RAIO_MINIMO,
  TEXTOS_DO_MAPA,
  cabecalhoDaVisaoGeral,
  mapaDaVisaoGeral,
  municipiosDaResposta,
  pontosDosMunicipios,
  raioDoPonto,
  resultadoDoMunicipio,
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

  it("os textos do mapa da Saúde Indígena são os do index.html", () => {
    const textos = TEXTOS_DO_MAPA[MAPA_DOS_DSEIS];
    for (const valor of Object.values(textos)) expect(html).toContain(valor);
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
    ).toEqual([
      {
        municipioUf: "Irati/PR",
        vagas: 5,
        candidatos: 70,
        aprovados: 43,
        reprovados: 27,
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
