import { describe, expect, it, vi } from "vitest";
import {
  CLASSE_DA_DICA,
  CLASSE_DA_DICA_DESLOCADA,
  CLASSE_DO_POPUP,
  LARGURA_MAXIMA_DA_DICA,
  LARGURA_MAXIMA_DO_POPUP,
  ajustarDica,
  ajustarPopup,
  deslocamentoParaCaber,
  escolherDirecaoDaDica,
  larguraMaximaDaDica,
  manterDicasDentroDoMapa,
  medirDica,
  opcoesDoPopup,
  ordemDasDirecoes,
  retanguloDaDica,
  transbordamento,
} from "../src/lib/dica-dentro-do-mapa.js";

/*
  "O mapa quebra o nome quando passo o mouse ou clico em algum extremo": a dica
  centrada acima do ponto saía até 134 px para fora do contêiner do mapa (que
  corta o que transborda) — o DSEI Potiguara, na ponta leste, perdia o nome.
  src/lib/dica-dentro-do-mapa.js escolhe a direção que cabe.
*/

const MAPA = { largura: 800, altura: 500 };
// A dica do DSEI Potiguara medida no painel: 268 × 58.
const DICA = { largura: 268, altura: 58 };

const escolher = (x, y, extra = {}) =>
  escolherDirecaoDaDica({ ancora: { x, y }, ...DICA, area: MAPA, ...extra });

describe("a direção da dica", () => {
  it("no meio do mapa fica a pedida (em cima)", () => {
    expect(escolher(400, 250)).toEqual({
      direcao: "top",
      transborda: 0,
      deslocamento: { dx: 0, dy: 0 },
    });
  });

  it("perto do topo desce para baixo do ponto", () => {
    expect(escolher(400, 30).direcao).toBe("bottom");
  });

  it("na borda leste (Potiguara) vai para a esquerda do ponto", () => {
    // Em cima ou embaixo, centrada, sairiam 134 - 10 + 8 px pela direita.
    expect(
      transbordamento(
        retanguloDaDica("top", { ancora: { x: 790, y: 250 }, ...DICA }),
        MAPA,
      ),
    ).toBe(132);
    expect(escolher(790, 250)).toMatchObject({
      direcao: "left",
      transborda: 0,
      deslocamento: { dx: 0, dy: 0 },
    });
  });

  /*
    Medido no navegador: Potiguara na ponta leste de um mapa baixo (590 × 335,
    celular), a 32 px do topo, com a dica de 5 linhas (190 × 106). Nenhuma
    direção cabe inteira; à esquerda é a que menos sai, e ela desce para dentro.
  */
  it("no canto, nenhuma cabe: a que menos sai, empurrada para dentro", () => {
    const r = escolherDirecaoDaDica({
      ancora: { x: 588, y: 32 },
      largura: 190,
      altura: 106,
      area: { largura: 590, altura: 335 },
    });
    expect(r.direcao).toBe("left");
    expect(r.transborda).toBeGreaterThan(0);
    expect(r.deslocamento).toEqual({ dx: 0, dy: 8 - (32 - 53) });
    const dentro = retanguloDaDica("left", {
      ancora: { x: 588 + r.deslocamento.dx, y: 32 + r.deslocamento.dy },
      largura: 190,
      altura: 106,
    });
    expect(transbordamento(dentro, { largura: 590, altura: 335 })).toBe(0);
  });

  it("o deslocamento encosta na borda certa (e no começo se não couber)", () => {
    const area = { largura: 300, altura: 200 };
    expect(
      deslocamentoParaCaber({ x: 250, y: 50, largura: 100, altura: 20 }, area),
    ).toEqual({ dx: -58, dy: 0 });
    expect(
      deslocamentoParaCaber({ x: -20, y: 190, largura: 100, altura: 20 }, area),
    ).toEqual({ dx: 28, dy: -18 });
    expect(
      deslocamentoParaCaber({ x: 40, y: 0, largura: 400, altura: 20 }, area),
    ).toEqual({ dx: -32, dy: 8 });
  });

  it("na borda oeste vai para a direita do ponto", () => {
    expect(escolher(6, 250).direcao).toBe("right");
  });

  it("no canto de cima à direita ainda acha lugar (à esquerda)", () => {
    expect(escolher(795, 40).direcao).toBe("left");
  });

  it("no canto de baixo à esquerda vai para a direita", () => {
    expect(escolher(4, 480).direcao).toBe("right");
  });

  it("pedida embaixo, perto da base, sobe", () => {
    expect(escolher(400, 470, { preferida: "bottom" }).direcao).toBe("top");
  });

  it("mapa pequeno demais: a que menos transborda", () => {
    const r = escolherDirecaoDaDica({
      ancora: { x: 100, y: 40 },
      largura: 260,
      altura: 70,
      area: { largura: 200, altura: 80 },
    });
    expect(r.transborda).toBeGreaterThan(0);
    for (const direcao of ["top", "bottom", "left", "right"]) {
      expect(r.transborda).toBeLessThanOrEqual(
        transbordamento(
          retanguloDaDica(direcao, {
            ancora: { x: 100, y: 40 },
            largura: 260,
            altura: 70,
          }),
          { largura: 200, altura: 80 },
        ),
      );
    }
  });

  it("sem medida (mapa escondido, sem layout) fica a pedida", () => {
    expect(
      escolherDirecaoDaDica({
        ancora: { x: 0, y: 0 },
        largura: 0,
        altura: 0,
        area: { largura: 0, altura: 0 },
      }),
    ).toEqual({
      direcao: "top",
      transborda: 0,
      deslocamento: { dx: 0, dy: 0 },
    });
  });

  it("a ordem: pedida, oposta, o lado com mais espaço e o outro", () => {
    expect(ordemDasDirecoes("top", { x: 100 }, MAPA)).toEqual([
      "top",
      "bottom",
      "right",
      "left",
    ]);
    expect(ordemDasDirecoes("top", { x: 700 }, MAPA)).toEqual([
      "top",
      "bottom",
      "left",
      "right",
    ]);
    expect(ordemDasDirecoes("left", { x: 700 }, MAPA)).toEqual([
      "left",
      "right",
      "top",
      "bottom",
    ]);
    expect(ordemDasDirecoes("auto", { x: 700 }, MAPA)[0]).toBe("top");
  });
});

describe("largura da dica e do popup relativa ao mapa", () => {
  it("a dica tem teto e encolhe em mapa estreito", () => {
    expect(larguraMaximaDaDica(1200)).toBe(LARGURA_MAXIMA_DA_DICA);
    expect(larguraMaximaDaDica(200)).toBe(184);
    expect(larguraMaximaDaDica(0)).toBe(LARGURA_MAXIMA_DA_DICA);
  });

  it("o popup cabe num celular e rola por dentro quando é alto", () => {
    const opcoes = opcoesDoPopup({ largura: 343, altura: 320 });
    expect(opcoes.maxWidth).toBe(343 - 52 - 24 - 40);
    expect(opcoes.minWidth).toBeLessThanOrEqual(opcoes.maxWidth);
    expect(opcoes.maxHeight).toBe(320 - 24 - 24 - 40);
    expect(opcoes.autoPan).toBe(true);
    expect(opcoes.keepInView).toBe(false);
    expect(opcoes.autoPanPaddingTopLeft).toEqual([52, 24]);
    expect(opcoes.autoPanPaddingBottomRight).toEqual([24, 24]);
    expect(opcoes.className).toBe(CLASSE_DO_POPUP);
  });

  it("popup com largura mínima legível no computador", () => {
    const opcoes = opcoesDoPopup({ largura: 1344, altura: 778 });
    expect(opcoes.minWidth).toBeGreaterThanOrEqual(160);
    expect(opcoes.maxWidth).toBeGreaterThanOrEqual(opcoes.minWidth);
  });

  it("no computador o popup fica nos 320 px de sempre", () => {
    const opcoes = opcoesDoPopup({ largura: 1100, altura: 700 });
    expect(opcoes.maxWidth).toBe(LARGURA_MAXIMA_DO_POPUP);
    expect(opcoesDoPopup().maxWidth).toBe(LARGURA_MAXIMA_DO_POPUP);
    expect(opcoesDoPopup()).not.toHaveProperty("maxHeight");
  });
});

/* Dica do Leaflet de mentira: guarda a direção e conta os reposicionamentos. */
function dicaFalsa({ direcao = "top", sticky = false, origem = null } = {}) {
  const elemento = document.createElement("div");
  return {
    elemento,
    options: { direction: direcao, sticky },
    _source: origem,
    getElement: () => elemento,
    getLatLng: () => [-6.9, -35.1],
    setLatLng: vi.fn(),
  };
}

function mapaFalso({ largura = 800, altura = 500 } = {}) {
  const ouvintes = new Map();
  return {
    getContainer: () => ({ clientWidth: largura, clientHeight: altura }),
    on: (evento, fn) => ouvintes.set(evento, fn),
    off: (evento) => ouvintes.delete(evento),
    fire: (evento, dados) => ouvintes.get(evento)?.(dados),
    ouvintes,
  };
}

describe("ajustar a dica aberta", () => {
  it("na borda leste troca para a esquerda e reposiciona pelo Leaflet", () => {
    const mapa = mapaFalso();
    const dica = dicaFalsa();
    const medir = vi.fn(() => ({ ancora: { x: 790, y: 250 }, ...DICA }));
    expect(ajustarDica(mapa, dica, { medir })).toBe("left");
    expect(dica.options.direction).toBe("left");
    expect(dica.setLatLng).toHaveBeenCalledWith([-6.9, -35.1]);
    expect(dica.elemento.classList.contains(CLASSE_DA_DICA)).toBe(true);
    expect(dica.elemento.style.maxWidth).toBe("280px");
    expect(medir).toHaveBeenCalledWith(mapa, dica, dica.elemento, "top");
  });

  it("reaberta no meio, volta à direção pedida", () => {
    const mapa = mapaFalso();
    const dica = dicaFalsa();
    ajustarDica(mapa, dica, {
      medir: () => ({ ancora: { x: 790, y: 250 }, ...DICA }),
    });
    ajustarDica(mapa, dica, {
      medir: () => ({ ancora: { x: 400, y: 250 }, ...DICA }),
    });
    expect(dica.options.direction).toBe("top");
  });

  it("mapa estreito, dica estreita", () => {
    const dica = dicaFalsa();
    ajustarDica(mapaFalso({ largura: 300, altura: 300 }), dica, {
      medir: () => null,
    });
    expect(dica.elemento.style.maxWidth).toBe("280px");
    const estreita = dicaFalsa();
    ajustarDica(mapaFalso({ largura: 200, altura: 300 }), estreita, {
      medir: () => null,
    });
    expect(estreita.elemento.style.maxWidth).toBe("184px");
  });

  it("no canto, empurra a dica para dentro e esconde a seta; no meio, volta", () => {
    const mapa = mapaFalso({ largura: 590, altura: 335 });
    const dica = dicaFalsa();
    ajustarDica(mapa, dica, {
      medir: () => ({ ancora: { x: 588, y: 32 }, largura: 190, altura: 106 }),
    });
    expect(dica.options.direction).toBe("left");
    expect(dica.options.offset).toEqual([0, 29]);
    expect(dica.elemento.classList.contains(CLASSE_DA_DICA_DESLOCADA)).toBe(
      true,
    );
    ajustarDica(mapa, dica, {
      medir: () => ({ ancora: { x: 300, y: 200 }, largura: 190, altura: 106 }),
    });
    expect(dica.options.direction).toBe("top");
    expect(dica.options.offset).toEqual([0, 0]);
    expect(dica.elemento.classList.contains(CLASSE_DA_DICA_DESLOCADA)).toBe(
      false,
    );
  });

  it("'center' e 'auto' ficam como o Leaflet faz", () => {
    const dica = dicaFalsa({ direcao: "center" });
    expect(ajustarDica(mapaFalso(), dica, { medir: vi.fn() })).toBeNull();
    expect(dica.setLatLng).not.toHaveBeenCalled();
  });

  it("mede a dica posicionada e devolve a ponta da seta", () => {
    const moldura = document.createElement("div");
    moldura.getBoundingClientRect = () => ({ left: 100, top: 50 });
    const elemento = document.createElement("div");
    elemento.getBoundingClientRect = () => ({
      left: 400,
      top: 200,
      width: 200,
      height: 40,
    });
    const mapa = { getContainer: () => moldura };
    expect(medirDica(mapa, null, elemento, "top")).toEqual({
      ancora: { x: 400, y: 196 },
      largura: 200,
      altura: 40,
    });
    expect(medirDica(mapa, null, elemento, "left").ancora).toEqual({
      x: 506,
      y: 170,
    });
    expect(medirDica(mapa, null, elemento, "right").ancora).toEqual({
      x: 294,
      y: 170,
    });
    expect(medirDica(mapa, null, elemento, "bottom").ancora).toEqual({
      x: 400,
      y: 144,
    });
  });
});

describe("o ouvinte do mapa", () => {
  it("ajusta toda dica e todo popup que abrem, e desliga", () => {
    const mapa = mapaFalso({ largura: 343, altura: 320 });
    const desligar = manterDicasDentroDoMapa(mapa, {
      medir: () => ({ ancora: { x: 340, y: 160 }, ...DICA }),
    });
    const dica = dicaFalsa();
    mapa.fire("tooltipopen", { tooltip: dica });
    expect(dica.options.direction).toBe("left");

    const popup = {
      options: { maxWidth: 300 },
      update: vi.fn(),
      getElement: () => document.createElement("div"),
    };
    mapa.fire("popupopen", { popup });
    expect(popup.options.maxWidth).toBe(343 - 52 - 24 - 40);
    expect(popup.options.autoPan).toBe(true);
    expect(popup.update).toHaveBeenCalledTimes(1);

    desligar();
    expect(mapa.ouvintes.size).toBe(0);
  });

  it("a dica que segue o ponteiro é reajustada a cada movimento", () => {
    const mapa = mapaFalso();
    const ouvintesDaOrigem = new Map();
    const origem = {
      on: (e, fn) => ouvintesDaOrigem.set(e, fn),
      off: (e) => ouvintesDaOrigem.delete(e),
    };
    let x = 400;
    manterDicasDentroDoMapa(mapa, {
      medir: () => ({ ancora: { x, y: 250 }, ...DICA }),
    });
    const dica = dicaFalsa({ sticky: true, origem });
    mapa.fire("tooltipopen", { tooltip: dica });
    expect(dica.options.direction).toBe("top");
    x = 795;
    ouvintesDaOrigem.get("mousemove")();
    expect(dica.options.direction).toBe("left");
    mapa.fire("tooltipclose", { tooltip: dica });
    expect(ouvintesDaOrigem.size).toBe(0);
  });

  it("popup sem medida do mapa usa as opções de sempre", () => {
    const popup = { options: {}, update: vi.fn() };
    ajustarPopup(mapaFalso({ largura: 0, altura: 0 }), popup);
    expect(popup.options.maxWidth).toBe(LARGURA_MAXIMA_DO_POPUP);
    expect(popup.options.autoPanPaddingTopLeft).toEqual([52, 24]);
  });

  it("sem mapa não liga nada", () => {
    expect(manterDicasDentroDoMapa(null)).toBeTypeOf("function");
  });
});

/*
  "O mapa de projetos fica saltitando": popup aberto em Pacaraima/RR, perto do
  norte dos limites de navegação. O que o Leaflet 1.9 faz a cada `moveend`,
  em uma dimensão (o topo do mapa, em px do mundo):

  - o `maxBounds` (do `map-guard`) puxa o mapa de volta se o topo passou do
    limite (`_panInsideMaxBounds`);
  - com `keepInView`, o popup refaz o autoPan se saiu da vista (`_adjustPan`;
    a bandeira `_autopanning` só pula o `moveend` do próprio autoPan).

  Medido no navegador (Leaflet 1.9.4, mapa de 777×390): com `keepInView`, 196
  autoPans em 3 s; sem ele, 2. O modelo abaixo repete essas regras e conta os
  movimentos com as opções que o app usa.
*/
function movimentosComPopupNaBorda(opcoes, { limite = 100, teto = 200 } = {}) {
  const folga = opcoes.autoPanPaddingTopLeft[1];
  const topoDoPopup = 120; // acima do topo permitido: o popup não cabe inteiro
  const mapa = { topo: limite, fila: [], movimentos: 0 };
  let autopanEmCurso = false;
  const mover = (novoTopo) => {
    mapa.topo = novoTopo;
    mapa.movimentos += 1;
    mapa.fila.push("moveend");
  };
  const ajustarPan = () => {
    if (!opcoes.autoPan) return;
    if (autopanEmCurso) {
      autopanEmCurso = false;
      return;
    }
    const sobra = topoDoPopup - mapa.topo - folga;
    if (sobra < 0) {
      if (opcoes.keepInView) autopanEmCurso = true;
      mover(mapa.topo + sobra);
    }
  };
  // Abertura: o autoPan da abertura sempre acontece.
  ajustarPan();
  while (mapa.fila.length && mapa.movimentos < teto) {
    mapa.fila.shift();
    if (mapa.topo < limite) mover(limite); // maxBounds
    if (opcoes.keepInView) ajustarPan();
  }
  return mapa.movimentos;
}

describe("popup perto do limite do mapa", () => {
  it("o modelo reproduz o laço do keepInView com o maxBounds", () => {
    const comKeepInView = { ...opcoesDoPopup(), keepInView: true };
    expect(movimentosComPopupNaBorda(comKeepInView)).toBeGreaterThanOrEqual(
      200,
    );
  });

  it("com as opções do app, o mapa mexe no máximo duas vezes e para", () => {
    expect(
      movimentosComPopupNaBorda(opcoesDoPopup({ largura: 777, altura: 390 })),
    ).toBeLessThanOrEqual(2);
    expect(movimentosComPopupNaBorda(opcoesDoPopup())).toBeLessThanOrEqual(2);
  });

  it("ajustar o popup aberto não religa o keepInView", () => {
    const popup = { options: { keepInView: true }, update: vi.fn() };
    const mapa = {
      getContainer: () => ({ clientWidth: 800, clientHeight: 500 }),
    };
    ajustarPopup(mapa, popup);
    expect(popup.options.keepInView).toBe(false);
  });
});
