import { describe, expect, it } from "vitest";
import {
  DIVERGENCIA,
  RECONCILIACAO,
  agruparPorPontoDeRender,
  canonicoUtilizavel,
  classificarDivergencia,
  distanciaKm,
  nomeCanonico,
  reconciliarDsei,
  tipoDeclarado,
  tiposCompativeis,
} from "../src/lib/reconciliacao-unidades.js";

const polo = (nome, lat, lon, extra = {}) => ({
  nome,
  lat,
  lon,
  tipo: "polo",
  ...extra,
});

const estab = (nome, cnes, lat, lon, municipio = "", uf = "") => ({
  nome,
  cnes,
  chave: cnes,
  lat,
  lon,
  municipio,
  uf,
});

describe("nome canónico", () => {
  it("converge os pares reais das duas fontes", () => {
    expect(nomeCanonico("XITEI")).toBe(nomeCanonico("POLO BASE XITEI"));
    expect(nomeCanonico("PB XITEI")).toBe(nomeCanonico("POLO BASE XITEI"));
    expect(nomeCanonico("CASA NOVA")).toBe(nomeCanonico("POLO BASE CASA NOVA"));
    expect(nomeCanonico("SANTA MARIA")).toBe(
      nomeCanonico("POLO BASE SANTA MARIA"),
    );
    expect(nomeCanonico("SÃO FRANCISCO")).toBe(
      nomeCanonico("POLO BASE SAO FRANCISCO"),
    );
  });

  it("não confunde nomes diferentes", () => {
    expect(nomeCanonico("XITEI")).not.toBe(nomeCanonico("XITEI II"));
    expect(nomeCanonico("CANTAGALO")).not.toBe(nomeCanonico("ANTA"));
  });

  it("recusa canónico curto demais para identificar", () => {
    expect(canonicoUtilizavel(nomeCanonico("POLO BASE I"))).toBe(false);
    expect(canonicoUtilizavel(nomeCanonico("POLO BASE"))).toBe(false);
    expect(canonicoUtilizavel(nomeCanonico("XITEI"))).toBe(true);
  });
});

describe("tipo declarado e compatibilidade", () => {
  it("lê o tipo a partir do nome", () => {
    expect(tipoDeclarado("POLO BASE XITEI")).toBe("polo");
    expect(tipoDeclarado("PB XITEI")).toBe("polo");
    expect(tipoDeclarado("UBSI JORDAO")).toBe("ubsi");
    expect(tipoDeclarado("CASAI MANAUS")).toBe("casai");
    expect(tipoDeclarado("POSTO DE SAUDE ARACA")).toBe("posto");
    expect(tipoDeclarado("UNIDADE QUALQUER")).toBe("outro");
  });

  it("polo só reconcilia com polo", () => {
    expect(tiposCompativeis("polo", "polo")).toBe(true);
    expect(tiposCompativeis("polo", "ubsi")).toBe(false);
    expect(tiposCompativeis("polo", "posto")).toBe(false);
    expect(tiposCompativeis("polo", "casai")).toBe(false);
    expect(tiposCompativeis("polo", "outro")).toBe(false);
  });
});

describe("faixas de divergência", () => {
  it("usa os limiares declarados", () => {
    expect(classificarDivergencia(1.2)).toBe(DIVERGENCIA.PROXIMA);
    expect(classificarDivergencia(4.9)).toBe(DIVERGENCIA.PROXIMA);
    expect(classificarDivergencia(5)).toBe(DIVERGENCIA.DIVERGENTE);
    expect(classificarDivergencia(50)).toBe(DIVERGENCIA.DIVERGENTE);
    expect(classificarDivergencia(50.1)).toBe(DIVERGENCIA.PENDENTE);
  });

  it("sem distância não afirma proximidade", () => {
    expect(classificarDivergencia(null)).toBe(DIVERGENCIA.PENDENTE);
  });
});

describe("reconciliação dentro do DSEI", () => {
  it("junta o par real e preserva os dois identificadores", () => {
    const r = reconciliarDsei({
      dseiChave: "Yanomami",
      polos: [polo("XITEI", 2.5, -63.5, { cod: "P-101", uf: "RR" })],
      estabelecimentos: [
        estab("POLO BASE XITEI", "2600123", 2.52, -63.52, "Alto Alegre", "RR"),
      ],
    });

    expect(r.reconciliados).toHaveLength(1);
    const u = r.reconciliados[0];
    expect(u.reconciliacao).toBe(RECONCILIACAO.AUTOMATICA);
    expect(u.cnes).toBe("2600123");
    expect(u.cod).toBe("P-101");
    expect(u.nomes).toEqual({ lmap: "XITEI", rede_cnes: "POLO BASE XITEI" });
    expect(u.origens).toEqual(["lmap", "rede_cnes"]);
  });

  it("usa o CNES como identidade mesmo quando o nome cadastral tem ordinal", () => {
    const r = reconciliarDsei({
      dseiChave: "ALAGOAS E SERGIPE",
      polos: [
        polo("XUCURU-KARIRI", -9.408696, -36.650698, {
          cnes: "2010674",
          uf: "AL",
          mun_lotacao: "PALMEIRA DOS INDIOS",
        }),
      ],
      estabelecimentos: [
        estab(
          "POLO BASE II XUCURU KARIRI",
          "2010674",
          -9.417027,
          -36.632751,
          "PALMEIRA DOS INDIOS",
          "27",
        ),
      ],
    });

    expect(r.reconciliados).toHaveLength(1);
    expect(r.polosSemPar).toHaveLength(0);
    expect(r.reconciliados[0].cnes).toBe("2010674");
    expect(r.reconciliados[0].nome_exibicao).toContain("XUCURU KARIRI");
  });

  it("mantém as duas coordenadas e a distância entre elas", () => {
    const r = reconciliarDsei({
      dseiChave: "Yanomami",
      polos: [polo("XITEI", 2.5, -63.5)],
      estabelecimentos: [estab("POLO BASE XITEI", "1", 2.52, -63.52)],
    });
    const u = r.reconciliados[0];
    expect(u.coordenadas.lmap).toEqual({ lat: 2.5, lon: -63.5 });
    expect(u.coordenadas.rede_cnes).toEqual({ lat: 2.52, lon: -63.52 });
    expect(u.distancia_entre_fontes_km).toBeGreaterThan(0);
    expect(u.divergencia).toBe(DIVERGENCIA.PROXIMA);
  });

  it("exibe sempre a coordenada do CNES, e diz que foi essa", () => {
    const r = reconciliarDsei({
      dseiChave: "Yanomami",
      polos: [polo("XITEI", 2.5, -63.5)],
      estabelecimentos: [estab("POLO BASE XITEI", "1", -5.9, -67.9)],
    });
    const u = r.reconciliados[0];
    expect(u.lat).toBe(-5.9);
    expect(u.lon).toBe(-67.9);
    expect(u.coordenada_exibida).toBe("rede_cnes");
  });

  it("marca como pendente quando as fontes discordam muito", () => {
    const r = reconciliarDsei({
      dseiChave: "Yanomami",
      polos: [polo("XITEI", 2.5, -63.5)],
      estabelecimentos: [estab("POLO BASE XITEI", "1", -5.9, -67.9)],
    });
    expect(r.reconciliados[0].divergencia).toBe(DIVERGENCIA.PENDENTE);
    expect(r.reconciliados[0].distancia_entre_fontes_km).toBeGreaterThan(50);
  });
});

describe("o que a reconciliação se recusa a fazer", () => {
  it("não encontra par de outro DSEI, porque nem o vê", () => {
    const r = reconciliarDsei({
      dseiChave: "Yanomami",
      polos: [polo("SANTA MARIA", 2.5, -63.5)],
      estabelecimentos: [],
    });
    expect(r.reconciliados).toHaveLength(0);
    expect(r.polosSemPar[0].motivo).toMatch(/sem par/);
  });

  it("não funde polo com UBSI, mesmo de nome idêntico", () => {
    const r = reconciliarDsei({
      dseiChave: "D",
      polos: [polo("MARARI", -3.3, -64.7)],
      estabelecimentos: [estab("UBSI MARARI", "9", -3.3, -64.7)],
    });
    expect(r.reconciliados).toHaveLength(0);
    expect(r.rejeitados).toHaveLength(1);
    expect(r.rejeitados[0].motivo).toMatch(/nenhum candidato é do tipo polo/);
  });

  it("não funde polo com posto", () => {
    const r = reconciliarDsei({
      dseiChave: "D",
      polos: [polo("ARACA", -0.9, -63.1)],
      estabelecimentos: [estab("POSTO DE SAUDE ARACA", "9", -0.9, -63.1)],
    });
    expect(r.rejeitados).toHaveLength(1);
    expect(r.reconciliados).toHaveLength(0);
  });

  it("não casa por substring", () => {
    const r = reconciliarDsei({
      dseiChave: "D",
      polos: [polo("ANTA", -1, -60)],
      estabelecimentos: [estab("POLO BASE CANTAGALO", "9", -1, -60)],
    });
    expect(r.reconciliados).toHaveLength(0);
    expect(r.polosSemPar).toHaveLength(1);
  });

  it("não adivinha entre candidatos empatados — devolve o caso", () => {
    const r = reconciliarDsei({
      dseiChave: "D",
      polos: [polo("SANTA MARIA", -1, -60)],
      estabelecimentos: [
        estab("POLO BASE SANTA MARIA", "1", -1.0, -60.0, "Alfa"),
        estab("POLO BASE SANTA MARIA", "2", -1.9, -60.9, "Beta"),
      ],
    });
    expect(r.reconciliados).toHaveLength(0);
    expect(r.ambiguos).toHaveLength(1);
    expect(r.ambiguos[0].candidatos).toHaveLength(2);
  });

  it("resolve sem ambiguidade quando só um candidato é do tipo certo", () => {
    const r = reconciliarDsei({
      dseiChave: "D",
      polos: [polo("MARARI", -3.3, -64.7)],
      estabelecimentos: [
        estab("POLO BASE MARARI", "1", -3.3, -64.7),
        estab("UBSI MARARI", "2", -3.4, -64.8),
      ],
    });
    expect(r.ambiguos).toHaveLength(0);
    expect(r.reconciliados).toHaveLength(1);
    expect(r.reconciliados[0].cnes).toBe("1");
  });
});

describe("agrupamento de render — o caso que NÃO se funde", () => {
  it("junta o ponto sem perder nenhum registo", () => {
    const registos = [
      estab("UBSI A", "1", 4.596, -60.168),
      estab("UBSI B", "2", 4.596, -60.168),
      estab("UBSI C", "3", 4.596, -60.168),
      estab("UBSI LONGE", "4", -2.5, -60.9),
    ];
    const pontos = agruparPorPontoDeRender(registos);
    expect(pontos).toHaveLength(2);
    const maior = pontos.find((p) => p.registros.length > 1);
    expect(maior.registros).toHaveLength(3);
    expect(pontos.reduce((s, p) => s + p.registros.length, 0)).toBe(4);
  });

  it("não inventa ponto para registo sem coordenada", () => {
    const pontos = agruparPorPontoDeRender([
      estab("SEM COORD", "1", null, null),
    ]);
    expect(pontos).toHaveLength(0);
  });
});

describe("distância", () => {
  it("mede o que se espera entre dois pontos conhecidos", () => {
    const km = distanciaKm(2.8235, -60.6758, -3.119, -60.0217);
    expect(km).toBeGreaterThan(640);
    expect(km).toBeLessThan(680);
  });

  it("devolve nulo sem coordenada", () => {
    expect(distanciaKm(null, -60, -3, -60)).toBeNull();
  });
});
