import { describe, expect, it } from "vitest";
import {
  chaveDoMunicipio,
  coordenadasDoMunicipio,
} from "../src/lib/coordenadas-dos-municipios.js";
import {
  RAIO_MAXIMO,
  RAIO_MINIMO,
  contarEncerrados,
  diaEMes,
  editaisDaTabela,
  municipiosDaResposta,
  pontosDosMunicipios,
  quandoDaEtapa,
  raioDoPonto,
  temMapaDeMunicipios,
  totalDosMunicipios,
} from "../src/lib/visao-geral-da-area.js";

const HOJE = new Date(2026, 8, 28, 10);

describe("áreas com mapa", () => {
  it("só Projetos tem mapa de municípios; a SEDE fica em Brasília", () => {
    expect(temMapaDeMunicipios("projetos")).toBe(true);
    expect(temMapaDeMunicipios("sede")).toBe(false);
    expect(temMapaDeMunicipios("saude-indigena")).toBe(false);
  });
});

describe("tabela dos editais", () => {
  const LINHAS = [
    { id: 1, status: "Concluído", risco: "Alto", vagas_ociosas: 9 },
    { id: 2, status: "Em andamento", risco: "Baixo", vagas_ociosas: 1 },
    { id: 3, status: "Em andamento", risco: "Alto", vagas_ociosas: 2 },
    { id: 4, status: "Em andamento", risco: "Baixo", vagas_ociosas: 5 },
    { id: 5, status: "Em andamento", risco: "Médio", vagas_ociosas: 0 },
  ];
  const ids = (linhas) => linhas.map((linha) => linha.id);

  it("esconde os encerrados e segue a fila do Núcleo (risco, depois ociosas)", () => {
    expect(ids(editaisDaTabela(LINHAS))).toEqual([3, 5, 4, 2]);
    expect(contarEncerrados(LINHAS)).toBe(1);
  });

  it("com os encerrados, eles vão para o fim", () => {
    expect(ids(editaisDaTabela(LINHAS, { mostrarEncerrados: true }))).toEqual([
      3, 5, 4, 2, 1,
    ]);
  });

  it("o filtro de críticos deixa só risco médio ou alto em aberto", () => {
    expect(
      ids(
        editaisDaTabela(LINHAS, { soCriticos: true, mostrarEncerrados: true }),
      ),
    ).toEqual([3, 5]);
  });
});

describe("próximas etapas", () => {
  it("diz quando, em relação a hoje", () => {
    expect(quandoDaEtapa("2026-09-28", HOJE)).toBe("Hoje");
    expect(quandoDaEtapa("2026-09-29T00:00:00", HOJE)).toBe("Amanhã");
    expect(quandoDaEtapa("2026-10-02", HOJE)).toBe("Em 4 dias");
    expect(quandoDaEtapa("", HOJE)).toBe("");
  });

  it("escreve dia e mês", () => {
    expect(diaEMes("2026-10-02")).toBe("02/10");
    expect(diaEMes(null)).toBe("");
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
    expect(coordenadasDoMunicipio("Talismã/TO").latitude).toBeCloseTo(
      -12.79,
      1,
    );
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
        municipio: "Irati",
        uf: "PR",
        vagas: 5,
        candidatos: 70,
        aprovados: 43,
        reprovados: 27,
      },
    ]);
    expect(municipiosDaResposta(null)).toEqual([]);
  });

  it("o raio cresce pela raiz: a área do círculo acompanha os candidatos", () => {
    expect(raioDoPonto(0, 100)).toBe(RAIO_MINIMO);
    expect(raioDoPonto(100, 100)).toBe(RAIO_MAXIMO);
    expect(raioDoPonto(25, 100)).toBe(16);
    expect(raioDoPonto(10, 0)).toBe(RAIO_MINIMO);
  });

  it("ordena por candidatos e marca quem não tem coordenada", () => {
    const pontos = pontosDosMunicipios(
      municipiosDaResposta([
        { municipio_uf: "Irati/PR", candidatos: 70 },
        { municipio_uf: "Seropédica/RJ", candidatos: 647 },
        { municipio_uf: "Lugar Novo/AM", candidatos: 10 },
      ]),
    );
    expect(pontos.map((ponto) => ponto.municipioUf)).toEqual([
      "Seropédica/RJ",
      "Irati/PR",
      "Lugar Novo/AM",
    ]);
    expect(pontos[0].coordenadas).toEqual([-22.7526, -43.7155]);
    expect(pontos[0].raio).toBe(RAIO_MAXIMO);
    expect(pontos[2].coordenadas).toBeNull();
    expect(totalDosMunicipios(pontos, "candidatos")).toBe(727);
  });
});
