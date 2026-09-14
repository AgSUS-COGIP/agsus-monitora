import { describe, expect, it, vi } from "vitest";
import {
  RAIO_MAXIMO,
  RAIO_MINIMO,
  agruparCoincidentes,
  agruparPorCelula,
  assinaturaDeCamada,
  criarRegistroDeDescarte,
  grupoCoincidente,
  posicoesSpiderfy,
  raioDaBolha,
} from "../src/lib/mapa-render.js";

describe("raio da bolha do DSEI", () => {
  it("respeita o mínimo e o máximo declarados", () => {
    expect(raioDaBolha(0, 30000)).toBe(RAIO_MINIMO);
    expect(raioDaBolha(30000, 30000)).toBe(RAIO_MAXIMO);
    expect(raioDaBolha(60000, 30000)).toBe(RAIO_MAXIMO); // não estoura o teto
  });

  /*
    A área do círculo cresce com o quadrado do raio. Um raio proporcional à
    raiz da população faz a ÁREA ser proporcional à população — que é o que a
    pessoa lê no mapa. Quadruplicar a população tem de dobrar o raio útil.
  */
  it("mantém a área proporcional à população", () => {
    const opcoes = { minimo: 0, maximo: 20 };
    const r1 = raioDaBolha(2500, 10000, opcoes);
    const r4 = raioDaBolha(10000, 10000, opcoes);
    expect(r4 / r1).toBeCloseTo(2, 5);
  });

  it("não quebra com entrada ausente ou inválida", () => {
    expect(raioDaBolha(null, null)).toBe(RAIO_MINIMO);
    expect(raioDaBolha("x", 100)).toBe(RAIO_MINIMO);
  });

  /*
    O teto antigo era 25 px — 50 px de diâmetro, com 34 bolhas na visão
    nacional a cobrir o território que deviam situar.
  */
  it("o teto novo é bem menor que os 25 px antigos", () => {
    expect(RAIO_MAXIMO).toBeLessThan(25);
  });
});

describe("spiderfy dos pontos coincidentes", () => {
  it("devolve um deslocamento por registo", () => {
    expect(posicoesSpiderfy(0)).toEqual([]);
    expect(posicoesSpiderfy(57)).toHaveLength(57);
  });

  /*
    O deslocamento é em PIXELS e só existe no desenho. O código antigo somava
    0,55° à coordenada — cerca de 61 km — e quem lia o mapa via o DSEI longe de
    onde ele está.
  */
  it("nenhum deslocamento é uma coordenada", () => {
    posicoesSpiderfy(20).forEach((p) => {
      expect(Number.isInteger(p.x)).toBe(true);
      expect(Number.isInteger(p.y)).toBe(true);
      expect(Math.abs(p.x)).toBeLessThan(400);
      expect(Math.abs(p.y)).toBeLessThan(400);
    });
  });

  it("espalha em anéis para caber grupos grandes", () => {
    const p = posicoesSpiderfy(57);
    const raio = (q) => Math.hypot(q.x, q.y);
    expect(raio(p[56])).toBeGreaterThan(raio(p[0]));
  });

  it("não sobrepõe dois pontos do mesmo grupo", () => {
    const chaves = posicoesSpiderfy(24).map((p) => `${p.x},${p.y}`);
    expect(new Set(chaves).size).toBe(24);
  });
});

describe("agrupamento de coincidentes", () => {
  const ponto = (nome, lat, lon) => ({ name: nome, lat, lon });

  it("junta o mesmo ponto e preserva todos os registos", () => {
    const grupos = agruparCoincidentes([
      ponto("A", 4.596, -60.168),
      ponto("B", 4.596, -60.168),
      ponto("C", -2.5, -60.9),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos.reduce((s, g) => s + g.registros.length, 0)).toBe(3);
  });

  it("ignora registo sem coordenada em vez de inventar ponto", () => {
    expect(agruparCoincidentes([ponto("X", null, null)])).toHaveLength(0);
  });
});

describe("registo de descarte", () => {
  it("desfaz um ouvinte de DOM", () => {
    const alvo = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const registo = criarRegistroDeDescarte();
    const h = () => {};
    registo.ouvir(alvo, "click", h);
    expect(alvo.addEventListener).toHaveBeenCalledWith("click", h, undefined);
    expect(registo.pendentes).toBe(1);
    registo.descartarTudo();
    expect(alvo.removeEventListener).toHaveBeenCalledWith(
      "click",
      h,
      undefined,
    );
    expect(registo.pendentes).toBe(0);
  });

  /*
    No `legacy-app.js` há um ResizeObserver por mapa e nenhum `disconnect()`.
    São dois ao todo, não um vazamento sem teto — as duas inicializações são
    guardadas. Ainda assim, quem cria tem de saber desfazer.
  */
  it("desconecta o observador de tamanho", () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(cb) {
        this.cb = cb;
      }
      observe(...a) {
        observe(...a);
      }
      disconnect() {
        disconnect();
      }
    };
    try {
      const registo = criarRegistroDeDescarte();
      registo.observarTamanho({}, () => {});
      registo.descartarTudo();
      expect(observe).toHaveBeenCalled();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it("desfaz ouvinte do Leaflet com off", () => {
    const mapa = { on: vi.fn(), off: vi.fn() };
    const registo = criarRegistroDeDescarte();
    const h = () => {};
    registo.ouvirMapa(mapa, "moveend", h);
    registo.descartarTudo();
    expect(mapa.off).toHaveBeenCalledWith("moveend", h);
  });

  /*
    Uma limpeza que rebenta não pode impedir as seguintes — senão um erro só
    deixa observadores presos e o vazamento volta pela porta dos fundos.
  */
  it("uma limpeza que falha não trava as outras", () => {
    const registo = criarRegistroDeDescarte();
    const boa = vi.fn();
    registo.aoDescartar(boa);
    registo.aoDescartar(() => {
      throw new Error("falhou");
    });
    registo.aoDescartar(boa);
    expect(registo.descartarTudo()).toBe(2);
    expect(boa).toHaveBeenCalledTimes(2);
    expect(registo.pendentes).toBe(0);
  });
});

describe("assinatura de camada", () => {
  const r = (nome, lat, lon) => ({
    name: nome,
    lat,
    lon,
    type: { key: "polo" },
  });

  it("é igual para o mesmo conteúdo e diferente para conteúdo diferente", () => {
    expect(assinaturaDeCamada([r("A", 1, 2)])).toBe(
      assinaturaDeCamada([r("A", 1, 2)]),
    );
    expect(assinaturaDeCamada([r("A", 1, 2)])).not.toBe(
      assinaturaDeCamada([r("A", 1, 3)]),
    );
    expect(assinaturaDeCamada([r("A", 1, 2)])).not.toBe(
      assinaturaDeCamada([r("A", 1, 2), r("B", 3, 4)]),
    );
  });

  it("não rebenta com entrada ausente", () => {
    expect(assinaturaDeCamada(null)).toBe("");
  });
});

describe("agrupamento por célula de pixel", () => {
  // Projeção grosseira só para o teste: graus para pixels, linear.
  const paraPonto = (r) => ({ x: (r.lon + 180) * 100, y: (90 - r.lat) * 100 });
  const p = (lat, lon, nome) => ({ lat, lon, name: nome });

  it("junta o que cai na mesma célula e separa o resto", () => {
    const g = agruparPorCelula(
      [p(1, 1, "A"), p(1.001, 1.001, "B"), p(-20, -50, "C")],
      paraPonto,
    );
    expect(g).toHaveLength(2);
    expect(g.reduce((s, x) => s + x.quantidade, 0)).toBe(3);
  });

  /*
    A âncora é a média das coordenadas REAIS dos membros. Um grupo de um só tem
    de ficar exactamente onde o registo está — senão o agrupamento vira mais uma
    forma de mover o ponto, que é o que esta rodada veio eliminar.
  */
  it("um grupo de um só não desloca o registo", () => {
    const [g] = agruparPorCelula([p(-9.4451, -70.4877, "X")], paraPonto);
    expect(g.lat).toBe(-9.4451);
    expect(g.lon).toBe(-70.4877);
    expect(g.unico.name).toBe("X");
  });

  it("expõe o registo original quando o grupo tem um só", () => {
    const g = agruparPorCelula([p(1, 1, "A"), p(1.001, 1.001, "B")], paraPonto);
    expect(g[0].unico).toBeNull();
    expect(g[0].registros).toHaveLength(2);
  });

  it("ignora registo sem coordenada ou sem projeção", () => {
    expect(agruparPorCelula([p(null, null, "N")], paraPonto)).toHaveLength(0);
    expect(agruparPorCelula([p(1, 1, "N")], () => null)).toHaveLength(0);
  });

  /*
    A célula é em pixels do ecrã, de propósito. Agrupar por graus juntaria
    demais perto do equador e de menos no sul, porque um grau de longitude
    encolhe com a latitude.
  */
  it("célula maior agrupa mais", () => {
    const pontos = [p(1, 1, "A"), p(1, 1.4, "B")];
    expect(agruparPorCelula(pontos, paraPonto, 20)).toHaveLength(2);
    expect(agruparPorCelula(pontos, paraPonto, 200)).toHaveLength(1);
  });
});

describe("grupo coincidente", () => {
  const p = (lat, lon) => ({ lat, lon });

  /*
    Esta é a distinção que decide entre aproximar e abrir em leque. Medido na
    base real: 9 grupos de polos com coordenada idêntica no mesmo DSEI, 40
    polos, o maior com 19 no Alto Rio Negro. Zoom nenhum os separa.
  */
  it("reconhece a mesma coordenada", () => {
    expect(grupoCoincidente([p(0.3318, -68.0903), p(0.3318, -68.0903)])).toBe(
      true,
    );
  });

  it("não confunde proximidade com coincidência", () => {
    expect(grupoCoincidente([p(0.3318, -68.0903), p(0.3319, -68.0903)])).toBe(
      false,
    );
  });

  it("um registo sozinho não é grupo", () => {
    expect(grupoCoincidente([p(1, 2)])).toBe(false);
    expect(grupoCoincidente([])).toBe(false);
  });

  it("basta um membro fora para deixar de ser coincidente", () => {
    expect(grupoCoincidente([p(1, 2), p(1, 2), p(1, 2), p(1.5, 2)])).toBe(
      false,
    );
  });

  it("não afirma coincidência sem coordenada", () => {
    expect(grupoCoincidente([p(null, null), p(null, null)])).toBe(false);
  });
});
