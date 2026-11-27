// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import {
  describe,
  expect,
  it,
  vi,
  afterEach,
  beforeEach,
  beforeAll,
} from "vitest";
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
} from "../src/lib/mapas/dica-dentro-do-mapa.ts";
import {
  CHAVE_DOS_FILTROS,
  criarEstadoDaVisaoGeral,
  esquecerVisaoGeral,
} from "../src/modulos/visao-geral/estado.ts";
import {
  esquecerConversaDaAya,
  obterPaginaDaAya,
} from "../src/modulos/aya/estado.ts";
import { salvarConversa } from "../src/modules/aya-memoria.ts";
import { criarLeafletFalso } from "./modulos/leaflet-falso.js";
import {
  adicionarFundo,
  conteudoEmElemento,
  criarMapa,
  obterLeaflet,
  carregarContornos,
  criarMapaDoBrasil,
  ehGestoNaVista,
} from "../src/modulos/mapa-saude-indigena/leaflet.ts";
import { leafletDoMapa } from "../src/modulos/mapa-saude-indigena/tipos-do-leaflet.ts";
import {
  addResilientBaseLayer,
  EVENTO_DO_FUNDO,
  adicionarCamadaDeFundo,
  criarCamadaComRecuo,
} from "../src/modules/map-base-layer-switcher.ts";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  RPC_DOS_MUNICIPIOS,
  criarCarregadorDeMunicipios,
  CACHE_TTL_MS,
} from "../src/modulos/mapa-de-projetos/carregador.ts";
import { MapaDeProjetos } from "../src/modulos/mapa-de-projetos/mapa-de-projetos.tsx";
import { Modal } from "../src/ui/modal.tsx";
import {
  clicar,
  digitar,
  esperar,
  escolher,
  teclar,
} from "./componentes/interacoes.ts";
import { carregarEditorDeCoordenadas } from "../src/modulos/editor-de-coordenadas/editor-sob-demanda.ts";
import { readFileSync } from "node:fs";
import { EVENTO_TEMA_ALTERADO } from "../src/lib/navegacao/eventos-da-barra-lateral.ts";
import { esquecerContornosDosDseis } from "../src/lib/mapas/mapa-saude-indigena/contornos-dos-dseis.ts";
import { MapaSaudeIndigena } from "../src/modulos/mapa-saude-indigena/mapa-saude-indigena.tsx";
import { ESPERA_DO_REALCE_NA_LISTA } from "../src/modulos/mapa-saude-indigena/mapa-nacional.tsx";
import { ordenarTerritorios } from "../src/lib/mapas/mapa-saude-indigena/ordem-dos-territorios.ts";
import { CHAVE_DA_ORDEM } from "../src/modulos/mapa-saude-indigena/ordem-da-lista.tsx";
import {
  RECUO_MAXIMO,
  azulejoDoRecuo,
  podeRecuar,
  semAzulejoDeAviso,
} from "../src/lib/mapas/recuo-de-azulejo.ts";

bloco("dica-dentro-do-mapa", () => {
  /*
  "O mapa quebra o nome quando passo o mouse ou clico em algum extremo": a dica
  centrada acima do ponto saía até 134 px para fora do contêiner do mapa (que
  corta o que transborda) — o DSEI Potiguara, na ponta leste, perdia o nome.
  src/lib/mapas/dica-dentro-do-mapa.ts escolhe a direção que cabe.
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
        deslocamentoParaCaber(
          { x: 250, y: 50, largura: 100, altura: 20 },
          area,
        ),
      ).toEqual({ dx: -58, dy: 0 });
      expect(
        deslocamentoParaCaber(
          { x: -20, y: 190, largura: 100, altura: 20 },
          area,
        ),
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
        medir: () => ({
          ancora: { x: 300, y: 200 },
          largura: 190,
          altura: 106,
        }),
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

  - o `maxBounds` (da guarda do mapa) puxa o mapa de volta se o topo passou do
    limite (`_panInsideMaxBounds`);
  - com `keepInView`, o popup refaz o autoPan se saiu da vista (`_adjustPan`;
    a bandeira `_autopanning` só pula o `moveend` do próprio autoPan).

  Medido no navegador (Leaflet 1.9.4, mapa de 777×390): com `keepInView`, 196
  autoPans em 3 s; sem ele, 2. O modelo abaixo repete essas regras e conta os
  movimentos com as opções que o app usa.
*/
  function movimentosComPopupNaBorda(
    opcoes,
    { limite = 100, teto = 200 } = {},
  ) {
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
});

bloco("esquecer-ao-sair", () => {
  /*
  Sair do sistema (ou ficar sem acesso) esquece o que a pessoa deixou nas
  telas que continuam montadas: o recorte da Visão geral e a conversa da Aya.
  Quem entrar depois na mesma aba não herda nada disso.
*/

  function memoria() {
    const mapa = new Map();
    return {
      mapa,
      getItem: (chave) => (mapa.has(chave) ? mapa.get(chave) : null),
      setItem: (chave, valor) => void mapa.set(chave, String(valor)),
    };
  }

  const dadosVazios = {
    assinar: () => () => {},
    obter: () => ({
      linhas: [],
      unidades: [],
      carregado: false,
      areas: ["saude-indigena"],
      areaAtual: "saude-indigena",
    }),
  };

  describe("Visão geral ao sair", () => {
    it("o recorte e os filtros guardados voltam ao vazio, sem aviso", () => {
      const armazenamento = memoria();
      const estado = criarEstadoDaVisaoGeral({
        dados: dadosVazios,
        armazenamento,
        aberta: false,
      });
      const aviso = vi.fn();
      estado.definirAviso(aviso);
      estado.definirFiltro("unidade", ["DSEI Xingu"]);
      estado.definirBusca("xingu");
      expect(armazenamento.getItem(CHAVE_DOS_FILTROS)).toContain("DSEI Xingu");
      aviso.mockClear();

      esquecerVisaoGeral(estado);

      const agora = estado.obter();
      expect(agora.filtros.unidade).toEqual([]);
      expect(agora.busca).toBe("");
      expect(armazenamento.getItem(CHAVE_DOS_FILTROS)).not.toContain(
        "DSEI Xingu",
      );
      expect(aviso).not.toHaveBeenCalled();
    });
  });

  describe("Aya ao sair", () => {
    it("a conversa guardada na aba sai e o painel é avisado", () => {
      salvarConversa([{ role: "user", content: "Quem decide o recurso?" }]);
      const antes = obterPaginaDaAya().conversa;
      esquecerConversaDaAya();
      expect(sessionStorage.getItem("agsus_aya_conversa_v1")).toBeNull();
      expect(obterPaginaDaAya().conversa).toBe(antes + 1);
    });
  });
});

bloco("guarda-do-mapa-depois-do-remove", () => {
  /*
  O guarda agenda um "estabilizar" 40 ms depois de cada movimento. Se o mapa
  sai antes (StrictMode desmonta logo após montar; trocar de área também), o
  `remove()` do Leaflet já apagou os panes e o `panInsideBounds` lia
  `_leaflet_pos` de undefined — erro no console a cada abertura do mapa.
*/

  function mapaFalso() {
    const ouvintes = {};
    const mapa = {
      options: {},
      on(eventos, fn) {
        for (const nome of eventos.split(" ")) (ouvintes[nome] ||= []).push(fn);
        return mapa;
      },
      disparar(nome) {
        for (const fn of ouvintes[nome] || []) fn();
      },
      whenReady: () => {},
      getContainer: () => null,
      setMaxBounds: vi.fn(),
      fitBounds: vi.fn(),
      setView: vi.fn(),
      invalidateSize: vi.fn(),
      panInsideBounds: vi.fn(),
      getZoom: () => 4,
    };
    return mapa;
  }

  describe("guarda do mapa depois do remove()", () => {
    let mapa;
    beforeEach(() => {
      vi.resetModules();
      vi.useFakeTimers();
      mapa = mapaFalso();
      const tileLayer = vi.fn();
      globalThis.window = {
        L: {
          map: vi.fn(() => mapa),
          tileLayer,
          latLngBounds: vi.fn(() => ({})),
          latLng: vi.fn((lat, lng) => ({ lat, lng })),
        },
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
        requestAnimationFrame: (fn) => globalThis.setTimeout(fn, 0),
      };
    });
    afterEach(() => {
      vi.useRealTimers();
      delete globalThis.window;
    });

    it("não estabiliza um mapa que já foi removido", async () => {
      const { protegerMapa } =
        await import("../src/modulos/mapa-saude-indigena/guarda-do-mapa.ts");
      protegerMapa(window.L, mapa);

      mapa.disparar("move");
      mapa.disparar("unload");
      vi.advanceTimersByTime(100);
      expect(mapa.panInsideBounds).not.toHaveBeenCalled();

      mapa.disparar("resize");
      vi.advanceTimersByTime(100);
      expect(mapa.panInsideBounds).not.toHaveBeenCalled();
      expect(mapa.invalidateSize).not.toHaveBeenCalled();
    });

    it("continua a estabilizar enquanto o mapa existe", async () => {
      const { protegerMapa } =
        await import("../src/modulos/mapa-saude-indigena/guarda-do-mapa.ts");
      protegerMapa(window.L, mapa);

      mapa.disparar("move");
      vi.advanceTimersByTime(100);
      expect(mapa.panInsideBounds).toHaveBeenCalledTimes(1);
    });
  });

  /* Caixa mínima no formato do Leaflet: [[sul, oeste], [norte, leste]] ou outra caixa. */
  function caixa(entrada, segundo) {
    if (entrada?.getSouth) return entrada;
    const [a, b] = segundo ? [entrada, segundo] : entrada;
    const s = Math.min(a[0], b[0]);
    const n = Math.max(a[0], b[0]);
    const w = Math.min(a[1], b[1]);
    const e = Math.max(a[1], b[1]);
    return {
      getSouth: () => s,
      getNorth: () => n,
      getWest: () => w,
      getEast: () => e,
    };
  }

  describe("guarda do mapa: enquadrar um ponto só e o nome do mapa", () => {
    let mapa;
    let flyToBoundsOriginal;
    let container;
    beforeEach(() => {
      vi.resetModules();
      flyToBoundsOriginal = vi.fn();
      container = document.createElement("div");
      mapa = {
        ...mapaFalso(),
        getContainer: () => container,
        flyToBounds: flyToBoundsOriginal,
      };
      globalThis.window = {
        L: {
          map: vi.fn(() => mapa),
          tileLayer: vi.fn(),
          latLngBounds: vi.fn(caixa),
          latLng: vi.fn((lat, lng) => ({ lat, lng })),
        },
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
        requestAnimationFrame: (fn) => globalThis.setTimeout(fn, 0),
      };
    });
    afterEach(() => {
      delete globalThis.window;
    });

    it("ir até um ponto não vira o continente com zoom 4,5", async () => {
      const { protegerMapa } =
        await import("../src/modulos/mapa-saude-indigena/guarda-do-mapa.ts");
      protegerMapa(window.L, mapa);
      mapa.flyToBounds(caixa([-3.1, -60.0], [-3.1, -60.0]), { maxZoom: 11 });
      const [limites, opcoes] = flyToBoundsOriginal.mock.calls.at(-1);
      expect(limites.getSouth()).toBe(-3.1);
      expect(limites.getNorth()).toBe(-3.1);
      expect(opcoes.maxZoom).toBe(11);
    });

    it("não troca o nome que o mapa já tem", async () => {
      container.setAttribute("aria-label", "Mapa de Projetos");
      const { protegerMapa } =
        await import("../src/modulos/mapa-saude-indigena/guarda-do-mapa.ts");
      protegerMapa(window.L, mapa);
      expect(container.getAttribute("aria-label")).toBe("Mapa de Projetos");
    });
  });
});

bloco("guardas-preservam-o-namespace-do-leaflet", () => {
  /*
  A CAMADA DE TERRAS INDÍGENAS NUNCA CORREU EM PRODUÇÃO.

  `installTileLayerGuard` trocava `L.tileLayer` por um invólucro e não copiava
  o que estava pendurado na função original. `L.tileLayer.wms` desaparecia do
  namespace. Nada no guarda usa `.wms`, por isso o apagão era silencioso — sem
  erro, sem aviso no console.

  Quem usava era `installIndigenousTerritoriesLayer`, que verifica
  `L.tileLayer?.wms` antes de se instalar e devolvia false. O efeito visível
  era nenhum: sem polígono, sem rótulo, sem botão de camada. Três correções de
  aparência foram publicadas sobre código que não era executado.

  O teste é de comportamento, não de texto: monta um Leaflet mínimo, instala os
  módulos na ordem real da aplicação e verifica que a camada consegue instalar-se
  no fim. Um teste sobre o texto do ficheiro teria deixado passar.
*/

  function leafletMinimo() {
    const tileLayer = vi.fn(() => ({ tipo: "tiles" }));
    tileLayer.wms = vi.fn(() => ({ tipo: "wms" }));

    return {
      map: vi.fn(() => ({
        getContainer: () => ({ id: "detailMap" }),
        getPane: () => null,
        createPane: () => ({ style: {} }),
        whenReady: () => {},
        on: () => {},
        off: () => {},
        hasLayer: () => false,
        getZoom: () => 8,
        setMaxBounds: () => {},
        fitBounds: () => {},
        setView: () => {},
      })),
      tileLayer,
      latLngBounds: vi.fn(() => ({})),
      latLng: vi.fn((lat, lng) => ({ lat, lng })),
      control: vi.fn(() => ({ addTo: () => {}, onAdd: null })),
      geoJSON: vi.fn(() => ({ clearLayers: () => {}, eachLayer: () => {} })),
      layerGroup: vi.fn(() => ({ clearLayers: () => {}, getLayers: () => [] })),
      marker: vi.fn(),
      circleMarker: vi.fn(),
      divIcon: vi.fn(),
      DomUtil: { create: () => ({ style: {}, dataset: {} }) },
      DomEvent: {
        disableClickPropagation: () => {},
        disableScrollPropagation: () => {},
      },
    };
  }

  describe("a guarda do mapa não mexe no namespace do Leaflet", () => {
    beforeEach(() => {
      vi.resetModules();
      const L = leafletMinimo();
      // A guarda dá nome e teclado ao contêiner: aqui, um elemento de verdade.
      const mapaMinimo = L.map;
      const conteiner = document.createElement("div");
      L.map = vi.fn((...argumentos) => ({
        ...mapaMinimo(...argumentos),
        getContainer: () => conteiner,
      }));
      globalThis.window = {
        L,
        matchMedia: () => ({ matches: false }),
      };
      globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
      };
    });

    it("criar um mapa não troca L.map, L.tileLayer nem L.tileLayer.wms", async () => {
      const { criarMapa } =
        await import("../src/modulos/mapa-saude-indigena/leaflet.ts");
      const { map, tileLayer } = window.L;
      const wms = tileLayer.wms;

      criarMapa(window.L, document.createElement("div"));

      expect(window.L.map).toBe(map);
      expect(window.L.tileLayer).toBe(tileLayer);
      expect(window.L.tileLayer.wms).toBe(wms);
    });

    it("o mapa nasce com os limites e a faixa do zoom da guarda", async () => {
      const { criarMapa } =
        await import("../src/modulos/mapa-saude-indigena/leaflet.ts");
      const { ZOOM_MINIMO, ZOOM_MAXIMO } =
        await import("../src/modulos/mapa-saude-indigena/guarda-do-mapa.ts");

      criarMapa(window.L, document.createElement("div"));

      const opcoes = window.L.map.mock.calls.at(-1)[1];
      expect(opcoes).toMatchObject({
        minZoom: ZOOM_MINIMO,
        maxZoom: ZOOM_MAXIMO,
        worldCopyJump: false,
        zoomSnap: 0.25,
        enquadramentoProprio: true,
      });
      expect(opcoes).toHaveProperty("maxBounds");
      expect([ZOOM_MINIMO, ZOOM_MAXIMO]).toEqual([4.5, 19]);
    });

    /*
    O recorte por `bounds` era a origem do card cinzento: o Leaflet deixava de
    pedir azulejos fora da caixa e dois terços do card ficavam por desenhar. É
    invisível — não dá erro nem aviso. Só um teste o impede de voltar.
  */
    it("o fundo de azulejos sai sem cópias do mundo e sem recorte por bounds", async () => {
      const { adicionarFundo } =
        await import("../src/modulos/mapa-saude-indigena/leaflet.ts");
      const camada = { on: vi.fn(), addTo: vi.fn(() => camada) };
      window.L.tileLayer.mockReturnValueOnce(camada);

      adicionarFundo(window.L, {}, document.createElement("div"));

      const opcoes = window.L.tileLayer.mock.calls.at(-1)[1];
      expect(opcoes).toMatchObject({
        noWrap: true,
        updateWhenIdle: true,
        keepBuffer: 2,
      });
      expect(Object.keys(opcoes)).not.toContain("bounds");
    });
  });

  describe("os módulos que ainda envolvem o Leaflet não o mutilam", () => {
    beforeEach(() => {
      vi.resetModules();
      globalThis.window = {
        L: leafletMinimo(),
        matchMedia: () => ({ matches: false }),
      };
      globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
      };
    });

    /*
    A SEQUÊNCIA REAL DO ARRANQUE, E POR QUE ELA É A ÚNICA QUE CONTA.

    A primeira versão deste teste instalava só o `map-guard` e dava verde — e a
    camada continuou a não existir em produção. Faltavam dois: o switcher de
    base e o zoom-range também envolvem `L.tileLayer`, e ambos correm DEPOIS do
    guarda no arranque dos mapas. O que o guarda restaurava, eles voltavam a apagar.

    Esta ordem é a de `carregarLeaflet`
    (src/modulos/mapa-saude-indigena/carregar-leaflet.ts, quando um mapa monta)
    e o teste chama a função de verdade: um teste que instale um instalador só
    volta a dar verde sobre uma aplicação partida.
  */
    const arrancarComoAAplicacao = async () => {
      const { carregarLeaflet } =
        await import("../src/modulos/mapa-saude-indigena/carregar-leaflet.ts");
      await carregarLeaflet({ janela: window });
      const L = window.L;
      return {
        switcher: L.__agsusBaseLayerSwitcherInstalled === true,
        terras: L.__agsusIndigenousTerritoriesInstalled === true,
      };
    };

    it("o .wms sobrevive aos invólucros, não só ao primeiro", async () => {
      const wmsOriginal = window.L.tileLayer.wms;
      await arrancarComoAAplicacao();

      expect(
        typeof window.L.tileLayer.wms,
        "algum dos invólucros apagou L.tileLayer.wms",
      ).toBe("function");
      expect(window.L.tileLayer.wms).toBe(wmsOriginal);
    });

    it("a camada de Terras Indígenas instala-se no fim da sequência", async () => {
      const resultado = await arrancarComoAAplicacao();

      expect(resultado.switcher).toBe(true);
      expect(
        resultado.terras,
        "a camada desistiu porque o namespace do Leaflet chegou mutilado",
      ).toBe(true);
      expect(window.L.__agsusIndigenousTerritoriesInstalled).toBe(true);
    });
  });
});

bloco("integracao-do-leaflet", () => {
  describe("integração compartilhada do Leaflet", () => {
    it("preserva o namespace e recusa a ausência de fábricas essenciais", () => {
      const { L } = criarLeafletFalso();
      expect(leafletDoMapa(L)).toBe(L);
      expect(leafletDoMapa({ ...L, tileLayer: undefined })).toBeNull();
      expect(leafletDoMapa({ ...L, divIcon: undefined })).toBeNull();
      const original = globalThis.L;
      try {
        globalThis.L = L;
        expect(obterLeaflet()).toBe(L);
        globalThis.L = { map() {} };
        expect(obterLeaflet()).toBeNull();
      } finally {
        if (original === undefined) delete globalThis.L;
        else globalThis.L = original;
      }
    });

    it("troca o fundo depois de quatro falhas consecutivas e encerra o aviso ao carregar", () => {
      const { L } = criarLeafletFalso();
      const elemento = document.createElement("div");
      const mapa = criarMapa(L, elemento);
      const inicial = adicionarFundo(L, mapa, elemento);
      inicial.fire("tileerror").fire("tileerror").fire("tileerror");
      expect(mapa.hasLayer(inicial)).toBe(true);
      inicial.fire("tileload");
      inicial.fire("tileerror").fire("tileerror").fire("tileerror");
      expect(mapa.hasLayer(inicial)).toBe(true);
      inicial.fire("tileerror");
      expect(mapa.hasLayer(inicial)).toBe(false);
      expect(elemento.classList.contains("map-tiles-recovering")).toBe(true);
      const [reserva] = [...mapa.camadas];
      expect(reserva.latlng).toContain("World_Imagery");
      reserva.fire("tileload");
      expect(elemento.classList.contains("map-tiles-recovering")).toBe(false);
      mapa.remove();
    });

    it("mostra caracteres HTML como texto nos balões", () => {
      const titulo = '<img src=x onerror="alert(1)">';
      const linha = "<script>texto</script>";
      const caixa = conteudoEmElemento(document, {
        titulo,
        linhas: [linha],
        nota: "<b>nota</b>",
      });
      expect(caixa.querySelector("strong").textContent).toBe(titulo);
      expect(caixa.querySelector("span").textContent).toBe(linha);
      expect(caixa.querySelector("small").textContent).toBe("<b>nota</b>");
      expect(caixa.querySelector("img, script, b")).toBeNull();
    });
  });
});

bloco("map-base-layer-recovery", () => {
  function fixture() {
    const layers = new Set();
    const listeners = {};
    const element = document.createElement("div");
    const map = {
      on: (event, fn) => {
        listeners[event] = fn;
      },
      whenReady: () => {},
      hasLayer: (layer) => layers.has(layer),
      removeLayer: (layer) => layers.delete(layer),
      eachLayer: (fn) => layers.forEach(fn),
      getContainer: () => element,
    };
    const L = {
      control: () => ({
        addTo() {
          element.append(this.onAdd());
        },
      }),
      DomUtil: {
        create(tag, className) {
          const el = document.createElement(tag);
          el.className = className;
          return el;
        },
      },
      DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
      /*
      O satélite passou a ser `criarCamadaComRecuo`, que estende `L.TileLayer`.
      Aqui a extensão devolve a mesma camada de mentira de `tileLayer`: o que
      estes casos medem é a troca entre fundos, não o recuo de azulejo — esse
      tem teste próprio em `tests/mapas-e-visao-geral-na-tela.test.js` (bloco `recuo-de-azulejo`).
    */
      TileLayer: {
        extend: () =>
          function CamadaDeMentira(url, options) {
            return L.tileLayer(url, options);
          },
      },
      tileLayer(url, options) {
        const events = {};
        return {
          url,
          options,
          on(event, fn) {
            events[event] = fn;
          },
          fire(event) {
            events[event]?.();
          },
          addTo() {
            layers.add(this);
            listeners.layeradd?.({ layer: this });
            return this;
          },
        };
      },
    };
    const base = addResilientBaseLayer(L, map);
    return { map, base, layers, element };
  }

  describe("recuperação das camadas do mapa", () => {
    it("troca a camada e o estado do botão juntos, preservando os pontos", () => {
      const { map, base, layers, element } = fixture();
      const marker = { lat: 2.8563, lon: -60.6527 };
      layers.add(marker);
      for (let i = 0; i < 4; i++) base.fire("tileerror");
      expect(map.hasLayer(base)).toBe(false);
      expect(layers.size).toBe(2);
      expect(layers.has(marker)).toBe(true);
      expect(
        element
          .querySelector('[data-map-mode="satellite"]')
          .getAttribute("aria-pressed"),
      ).toBe("true");
    });
    it("ignora erros atrasados e não alterna sem parar quando ambos falham", () => {
      const { map, base, layers } = fixture();
      for (let i = 0; i < 4; i++) base.fire("tileerror");
      const satellite = map.__agsusSatelliteLayer;
      for (let i = 0; i < 20; i++) {
        base.fire("tileerror");
        satellite.fire("tileerror");
      }
      expect([...layers]).toEqual([satellite]);
      expect(map.__agsusBaseMapMode).toBe("satellite");
    });
    it("permite tentar novamente pelo botão sem acumular fundos", () => {
      const { base, layers, element } = fixture();
      for (let i = 0; i < 4; i++) base.fire("tileerror");
      element.querySelector('[data-map-mode="map"]').click();
      expect([...layers]).toEqual([base]);
      base.fire("tileload");
      element.querySelector('[data-map-mode="satellite"]').click();
      expect(layers.size).toBe(1);
    });
  });
});

bloco("map-base-layer-simples", () => {
  /*
  O terceiro botão do seletor do fundo, "Mapa DSEIs": só no mapa nacional
  da Saúde Indígena (#map), sem azulejo nenhum, lembrado no navegador.
*/

  function fixture(id = "map") {
    const layers = new Set();
    const listeners = {};
    const element = document.createElement("div");
    element.id = id;
    const map = {
      on: (event, fn) => {
        listeners[event] = fn;
      },
      whenReady: () => {},
      hasLayer: (layer) => layers.has(layer),
      removeLayer: (layer) => layers.delete(layer),
      eachLayer: (fn) => layers.forEach(fn),
      getContainer: () => element,
    };
    const tileLayer = (url, options) => {
      const events = {};
      return {
        url,
        options,
        on(event, fn) {
          events[event] = fn;
        },
        fire(event) {
          events[event]?.();
        },
        addTo() {
          layers.add(this);
          listeners.layeradd?.({ layer: this });
          return this;
        },
      };
    };
    const L = {
      control: () => ({
        addTo() {
          element.append(this.onAdd());
        },
      }),
      DomUtil: {
        create(tag, className) {
          const el = document.createElement(tag);
          el.className = className;
          return el;
        },
      },
      DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
      TileLayer: {
        extend: () =>
          function CamadaDeMentira(url, options) {
            return tileLayer(url, options);
          },
      },
      tileLayer,
    };
    const azulejos = () => [...layers].filter((l) => l.url);
    const botao = (modo) => element.querySelector(`[data-map-mode="${modo}"]`);
    return { L, map, element, layers, azulejos, botao, tileLayer };
  }

  afterEach(() => {
    localStorage.clear();
  });

  describe("Mapa DSEIs no seletor do fundo", () => {
    it("o mapa nacional da Saúde Indígena ganha o terceiro botão; os outros, não", () => {
      const nacional = fixture("map");
      addResilientBaseLayer(nacional.L, nacional.map);
      expect(
        [...nacional.element.querySelectorAll("[data-map-mode]")].map(
          (b) => b.textContent,
        ),
      ).toEqual(["Mapa", "Satélite", "Mapa DSEIs"]);

      const projetos = fixture("mapaDosProjetos");
      addResilientBaseLayer(projetos.L, projetos.map);
      expect(projetos.botao("simple")).toBeNull();
    });

    it("troca de modo sem azulejos: tira o fundo, marca o contêiner, avisa e lembra", () => {
      const { L, map, element, azulejos, botao } = fixture();
      const base = addResilientBaseLayer(L, map);
      const avisos = [];
      element.addEventListener(EVENTO_DO_FUNDO, (e) =>
        avisos.push(e.detail.mode),
      );

      botao("simple").click();
      expect(azulejos()).toEqual([]);
      expect(map.hasLayer(base)).toBe(false);
      expect(element.classList.contains("map-simple-mode")).toBe(true);
      expect(botao("simple").getAttribute("aria-pressed")).toBe("true");
      expect(botao("map").getAttribute("aria-pressed")).toBe("false");
      expect(avisos).toEqual(["simple"]);
      expect(localStorage.getItem("agsus_map_base_layer_v2")).toBe("simple");

      botao("map").click();
      expect(azulejos()).toEqual([base]);
      expect(element.classList.contains("map-simple-mode")).toBe(false);
      expect(avisos).toEqual(["simple", "map"]);

      botao("simple").click();
      botao("satellite").click();
      expect(azulejos()).toHaveLength(1);
      expect(azulejos()[0]).not.toBe(base);
      expect(element.classList.contains("map-simple-mode")).toBe(false);
    });

    it("falha de azulejo no Mapa DSEIs não troca o fundo", () => {
      const { L, map, element, azulejos, botao } = fixture();
      const base = addResilientBaseLayer(L, map);
      botao("simple").click();
      for (let i = 0; i < 4; i += 1) base.fire("tileerror");
      expect(azulejos()).toEqual([]);
      expect(element.classList.contains("map-simple-mode")).toBe(true);
    });

    it("com o Mapa DSEIs guardado, a camada do fundo nem entra (nenhum azulejo baixado)", () => {
      localStorage.setItem("agsus_map_base_layer_v2", "simple");
      const { L, map, azulejos, botao, tileLayer } = fixture();
      addResilientBaseLayer(L, map);
      const osm = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
      osm.__agsusBaseMapKind = "map";
      // O primeiro fundo entra pelo addResilientBaseLayer; o seguinte, pelo app.
      map.removeLayer([...azulejos()][0]);
      expect(adicionarCamadaDeFundo(map, osm)).toBe(osm);
      expect(azulejos()).toEqual([]);
      expect(map.__agsusDesiredBaseMapMode).toBe("simple");
      botao("map").click();
      expect(azulejos()).toContain(osm);
    });

    it("noutro mapa, o Mapa DSEIs guardado vale como Mapa", () => {
      localStorage.setItem("agsus_map_base_layer_v2", "simple");
      const { L, map, azulejos, tileLayer } = fixture("detailMap");
      addResilientBaseLayer(L, map);
      expect(map.__agsusDesiredBaseMapMode).toBe("map");
      const osm = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
      adicionarCamadaDeFundo(map, osm);
      expect(azulejos()).toContain(osm);
    });

    it("sem o seletor instalado, a camada entra como sempre", () => {
      const { map, azulejos, tileLayer } = fixture();
      const osm = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
      adicionarCamadaDeFundo(map, osm);
      expect(azulejos()).toEqual([osm]);
    });
  });

  describe("Mapa DSEIs é o padrão do mapa nacional (11/11/2026)", () => {
    it("sem escolha guardada, o mapa nacional abre no Mapa DSEIs, sem azulejo", () => {
      const { L, map, azulejos, tileLayer } = fixture();
      addResilientBaseLayer(L, map);
      expect(map.__agsusDesiredBaseMapMode).toBe("simple");
      // Como no teste do Mapa DSEIs guardado: o fundo do app (leaflet.ts) nem entra.
      map.removeLayer([...azulejos()][0]);
      const osm = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
      osm.__agsusBaseMapKind = "map";
      adicionarCamadaDeFundo(map, osm);
      expect(azulejos()).toEqual([]);
    });

    it("os outros mapas continuam abrindo no Mapa", () => {
      for (const id of ["detailMap", "mapaDosProjetos"]) {
        const { L, map } = fixture(id);
        addResilientBaseLayer(L, map);
        expect(map.__agsusDesiredBaseMapMode).toBe("map");
      }
    });

    it("quem escolhe Mapa ou Satélite tem a escolha respeitada", () => {
      for (const modo of ["map", "satellite"]) {
        localStorage.setItem("agsus_map_base_layer_v2", modo);
        const { L, map } = fixture();
        addResilientBaseLayer(L, map);
        expect(map.__agsusDesiredBaseMapMode).toBe(modo);
      }
    });

    it("a escolha da chave antiga (v1) não vale mais: todo mundo começa no Mapa DSEIs", () => {
      localStorage.setItem("agsus_map_base_layer_v1", "map");
      const { L, map } = fixture();
      addResilientBaseLayer(L, map);
      expect(map.__agsusDesiredBaseMapMode).toBe("simple");
    });
  });
});

bloco("modulos/editor-de-coordenadas-projetos", () => {
  // O editor chega sob demanda (fora do pacote principal): carregado antes, desenha na hora.
  beforeAll(async () => {
    await carregarEditorDeCoordenadas();
  });

  /*
  O botão "Coordenadas" do mapa de Projetos e o editor comum com as regras e
  as RPCs deste mapa: só o administrador global vê; a fila traz os lugares
  pendentes com a gravidade (lugar sem coordenada também); as sugestões
  aparecem no painel e no mapa; "Salvar coordenada" e "Conferido" mandam a
  chave do lugar e a posição anterior; o mapa e o cache passam a ter a nova
  posição; o histórico tem o "Desfazer".
*/

  const RPC_SALVAR = "salvar_coordenada_mapa_projetos";
  const RPC_DESFAZER = "desfazer_coordenada_mapa_projetos";
  const RPC_PENDENCIAS = "listar_pendencias_coordenada_mapa_projetos";
  const RPC_HISTORICO = "listar_historico_coordenada_mapa_projetos";

  const LUGARES = [
    {
      lugar: "seropedica/RJ",
      municipio_uf: "Seropédica/RJ",
      uf: "RJ",
      codigo_ibge: 3305554,
      latitude: -22.7526,
      longitude: -43.7155,
      coordenada_origem: "SEDE_IBGE",
      vagas_edital: 4,
      projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
      editais: [
        {
          edital: "30/2026",
          projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
          vagas: 4,
          lotacoes: ["UBS móvel Seropédica/RJ"],
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
      vagas_edital: 1,
      projetos: ["CCE"],
      editais: [{ edital: "97/2025", projeto: "CCE", vagas: 1 }],
    },
    {
      lugar: "lugar novo/AM",
      municipio_uf: "Lugar Novo/AM",
      uf: "AM",
      latitude: null,
      longitude: null,
      vagas_edital: 2,
      projetos: ["MFC"],
      editais: [{ edital: "05/2026", projeto: "MFC", vagas: 2 }],
    },
  ];
  const PENDENCIAS = () => [
    {
      lugar: "seropedica/RJ",
      nome: "Seropédica/RJ",
      uf: "RJ",
      motivo_tipo: "SEDE_MUNICIPAL",
      motivo: "O ponto é a sede do município (IBGE).",
      conferido: false,
      candidatos: [
        { f: "MUNICIPIO", n: "Seropédica/RJ", lat: -22.7526, lon: -43.7155 },
      ],
    },
    {
      lugar: "uf:PA",
      nome: "Pará",
      uf: "PA",
      motivo_tipo: "ESCRITORIO_SO_UF",
      motivo: "O edital só diz a UF.",
      conferido: false,
      candidatos: [
        { f: "UF", n: "Pará", lat: -2.9668, lon: -49.7614 },
        { f: "LUGAR", n: "Belém/PA", lat: -1.4554, lon: -48.4898 },
      ],
    },
  ];
  const HISTORICO = () => [
    {
      id: 9,
      em: "2026-10-02T15:00:00Z",
      por: "Ana Admin",
      acao: "CORRECAO",
      latitude_anterior: -22.7,
      longitude_anterior: -43.7155,
      latitude: -22.7526,
      longitude: -43.7155,
      motivo: "Ajuste pela sede do IBGE",
      conferido: false,
      desfeito: false,
    },
  ];
  const ADMIN = { ativo: true, perfil: "admin", admin_global: true };

  let host, raiz, leaflet, supabase, carregador, respostas;

  beforeEach(async () => {
    leaflet = criarLeafletFalso();
    globalThis.L = leaflet.L;
    const original = leaflet.L.marker;
    leaflet.L.marker = (...args) => {
      const pin = original(...args);
      pin.getLatLng = () => ({ lat: pin.latlng[0], lng: pin.latlng[1] });
      return pin;
    };
    respostas = {
      [RPC_DOS_MUNICIPIOS]: () => ({ data: LUGARES, error: null }),
      [RPC_PENDENCIAS]: () => ({ data: PENDENCIAS(), error: null }),
      [RPC_HISTORICO]: () => ({ data: HISTORICO(), error: null }),
      [RPC_SALVAR]: (args) => ({
        data: {
          lugar: args.p_lugar,
          latitude: args.p_latitude,
          longitude: args.p_longitude,
          conferido: args.p_conferido ? true : null,
          historico: 10,
        },
        error: null,
      }),
      [RPC_DESFAZER]: () => ({
        data: {
          lugar: "seropedica/RJ",
          latitude: -22.7,
          longitude: -43.7155,
          conferido: false,
        },
        error: null,
      }),
    };
    supabase = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "teste" } },
          error: null,
        }),
      },
      rpc: vi.fn(async (nome, args) => respostas[nome](args)),
    };
    carregador = criarCarregadorDeMunicipios({ obterSupabase: () => supabase });
    await esperar(() => carregador.carregar("projetos"));
    host = document.createElement("div");
    document.body.append(host);
    raiz = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    host.remove();
    delete globalThis.L;
    vi.restoreAllMocks();
  });

  const aguardar = () =>
    act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0));
    });
  async function montar(perfil = ADMIN) {
    await act(async () =>
      raiz.render(
        createElement(
          StrictMode,
          null,
          createElement(MapaDeProjetos, {
            area: "projetos",
            carregadoEm: 1,
            carregador,
            perfil,
            supabase,
          }),
        ),
      ),
    );
    await aguardar();
  }
  const botao = (texto) =>
    [...host.querySelectorAll("button")].find(
      (b) => b.textContent.replace(/\s+/g, " ").trim() === texto,
    );
  const itens = () =>
    [...host.querySelectorAll(".mapa-si-coordenadas__nome")].map(
      (e) => e.textContent,
    );
  const item = (nome) =>
    [...host.querySelectorAll(".mapa-si-coordenadas__item")].find(
      (b) => b.querySelector(".mapa-si-coordenadas__nome").textContent === nome,
    );
  const chamadas = (nome) =>
    supabase.rpc.mock.calls.filter(([n]) => n === nome);
  const motivo = () =>
    [...host.querySelectorAll("textarea")].find(
      (t) =>
        t.closest(".ui-campo").querySelector("label").textContent ===
        "Motivo e fonte da correção *",
    );
  const latitude = () => host.querySelectorAll("input[inputmode]")[0];
  const longitude = () => host.querySelectorAll("input[inputmode]")[1];
  const mapaVivo = () =>
    leaflet.vivos().find((m) => m.elemento.id === "mapaDosProjetos");
  async function abrirEditor() {
    await clicar(botao("Coordenadas"));
    await aguardar();
  }
  async function escolher(nome) {
    await clicar(item(nome));
    await aguardar();
  }

  describe("Coordenadas no mapa de Projetos", () => {
    it("só o administrador global e o Gestor veem o botão; ninguém mais lê as pendências", async () => {
      await montar({ ativo: true, perfil: "usuario" });
      expect(botao("Coordenadas")).toBeUndefined();
      await montar({ ativo: true, perfil: "leitor" });
      expect(botao("Coordenadas")).toBeUndefined();
      expect(chamadas(RPC_PENDENCIAS)).toHaveLength(0);
      await montar(ADMIN);
      expect(botao("Coordenadas")).toBeTruthy();
      expect(chamadas(RPC_PENDENCIAS)).toHaveLength(0);
      await montar({
        ativo: true,
        perfil: "edital_gestor",
        admin_global: false,
      });
      expect(botao("Coordenadas")).toBeTruthy();
      await abrirEditor();
      expect(chamadas(RPC_PENDENCIAS).length).toBeGreaterThan(0);
    });

    it("abre a fila no lugar da lista, com gravidade e o lugar sem coordenada", async () => {
      await montar();
      await abrirEditor();
      expect(host.querySelector(".mapa-projetos-lugar")).toBeNull();
      expect(chamadas(RPC_PENDENCIAS).length).toBeGreaterThan(0);
      expect(
        host.querySelector(".mapa-si-coordenadas__contagem").textContent,
      ).toBe("3 pendentes");
      // Lugar sem coordenada e sem sugestão; escritório num edital só com UF;
      // a sede do município, só confirmar.
      expect(itens()).toEqual([
        "Pará (estado)",
        "Lugar Novo/AM",
        "Seropédica/RJ",
      ]);
      expect(item("Pará (estado)").textContent).toContain("Revisar");
      expect(item("Lugar Novo/AM").textContent).toContain("Sem sugestão");
      expect(item("Seropédica/RJ").textContent).toContain("Só confirmar");
      const niveis = [
        ...host.querySelectorAll(".mapa-si-coordenadas__nivel"),
      ].map((b) => b.textContent);
      expect(niveis).toEqual([
        "Provável erro 0",
        "Revisar 1",
        "Sem sugestão 1",
        "Só confirmar 1",
      ]);
      await clicar(botao("Voltar à lista"));
      expect(host.querySelector(".mapa-projetos-lugar")).toBeTruthy();
    });

    it("busca por edital e lotação", async () => {
      await montar();
      await abrirEditor();
      await digitar(host.querySelector('input[type="search"]'), "30/2026");
      expect(itens()).toEqual(["Seropédica/RJ"]);
      await digitar(host.querySelector('input[type="search"]'), "ubs movel");
      expect(itens()).toEqual(["Seropédica/RJ"]);
    });

    it("conferido sem mudar a posição manda a chave do lugar e a posição anterior", async () => {
      await montar();
      await abrirEditor();
      await escolher("Seropédica/RJ");
      expect(host.textContent).toContain("Sede do município (IBGE)");
      expect(chamadas(RPC_HISTORICO).at(-1)[1]).toEqual({
        p_lugar: "seropedica/RJ",
        p_limite: 5,
      });
      await digitar(motivo(), "Sede do município confere com o edital");
      await clicar(botao("Conferido"));
      await clicar(botao("Confirmar conferência"));
      expect(chamadas(RPC_SALVAR).at(-1)[1]).toEqual({
        p_lugar: "seropedica/RJ",
        p_latitude: -22.7526,
        p_longitude: -43.7155,
        p_latitude_anterior: -22.7526,
        p_longitude_anterior: -43.7155,
        p_motivo: "Sede do município confere com o edital",
        p_conferido: true,
      });
      expect(host.textContent).toContain("Ponto conferido.");
      expect(
        host.querySelector(".mapa-si-coordenadas__contagem").textContent,
      ).toBe("2 pendentes");
    });

    it("lugar sem coordenada: salvar cria a posição; o mapa e o cache passam a ter o ponto", async () => {
      await montar();
      const antes = leaflet
        .desenhadas(mapaVivo(), "circleMarker")
        .filter((c) =>
          String(c.opcoes.className).includes("marcador-de-projeto"),
        ).length;
      expect(antes).toBe(2);
      await abrirEditor();
      await escolher("Lugar Novo/AM");
      expect(botao("Conferido")).toBeUndefined();
      await digitar(latitude(), "-3,1");
      await digitar(longitude(), "-60");
      await digitar(motivo(), "Endereço do escritório no edital");
      await clicar(botao("Salvar coordenada"));
      await clicar(botao("Confirmar correção"));
      expect(chamadas(RPC_SALVAR).at(-1)[1]).toMatchObject({
        p_lugar: "lugar novo/AM",
        p_latitude: -3.1,
        p_longitude: -60,
        p_latitude_anterior: null,
        p_longitude_anterior: null,
        p_conferido: false,
      });
      expect(host.textContent).toContain("Coordenada salva.");
      const pontosDoMapa = leaflet
        .desenhadas(mapaVivo(), "circleMarker")
        .filter((c) =>
          String(c.opcoes.className).includes("marcador-de-projeto"),
        );
      expect(pontosDoMapa).toHaveLength(antes + 1);
      expect(pontosDoMapa.map((c) => c.latlng)).toContainEqual([-3.1, -60]);
      const noCache = carregador
        .emCache("projetos")
        .municipios.find((m) => m.lugar === "lugar novo/AM");
      expect(noCache.coordenada).toEqual({
        latitude: -3.1,
        longitude: -60,
        origem: "MANUAL",
      });
    });

    it("sugestões no painel e no mapa; Usar esta preenche a prévia", async () => {
      await montar();
      await abrirEditor();
      await escolher("Pará (estado)");
      const sugestoes = [
        ...host.querySelectorAll(".mapa-si-coordenadas__sugestoes li"),
      ].map((li) => li.textContent);
      expect(sugestoes[0]).toContain("Centro da UF");
      expect(sugestoes.some((s) => s.includes("Belém/PA"))).toBe(true);
      await clicar(
        host.querySelector(
          'button[aria-label="Usar esta: Outro lugar das vagas na UF Belém/PA"]',
        ),
      );
      expect(latitude().value).toBe("-1.455400");
      const pin = [...mapaVivo().camadas].find((c) => c.opcoes?.draggable);
      expect(pin.latlng).toEqual([-1.4554, -48.4898]);
    });

    it("histórico com Desfazer: pede motivo e chama a RPC com o id", async () => {
      await montar();
      await abrirEditor();
      await escolher("Seropédica/RJ");
      expect(host.textContent).toContain("Ajuste pela sede do IBGE");
      await clicar(botao("Desfazer última alteração"));
      await clicar(botao("Confirmar desfazer"));
      expect(chamadas(RPC_DESFAZER)).toHaveLength(0);
      const campo = [...host.querySelectorAll("textarea")].find(
        (t) =>
          t.closest(".ui-campo").querySelector("label").textContent ===
          "Motivo do desfazer *",
      );
      await digitar(campo, "A correção usou a fonte errada");
      await clicar(botao("Confirmar desfazer"));
      expect(chamadas(RPC_DESFAZER).at(-1)[1]).toEqual({
        p_historico: 9,
        p_motivo: "A correção usou a fonte errada",
      });
      expect(host.textContent).toContain("Alteração desfeita.");
    });
  });

  describe("Coordenadas no mapa de Projetos: respostas malformadas", () => {
    it("descarta pendências sem registro e candidatos sem posição sem derrubar o editor", async () => {
      respostas[RPC_PENDENCIAS] = () => ({
        data: [
          null,
          [],
          {
            lugar: "lugar novo/AM",
            nome: "Lugar Novo/AM",
            uf: "AM",
            motivo: {},
            candidatos: {},
          },
        ],
        error: null,
      });
      await montar();
      await abrirEditor();
      await escolher("Lugar Novo/AM");
      expect(host.querySelector('[aria-label="Correção"]')).not.toBeNull();
      expect(host.textContent).toContain("Sem posição candidata.");
    });

    it("não oferece desfazer uma alteração antiga quando a mais recente é inválida", async () => {
      respostas[RPC_HISTORICO] = () => ({
        data: [null, ...HISTORICO()],
        error: null,
      });
      await montar();
      await abrirEditor();
      await escolher("Seropédica/RJ");
      expect(host.textContent).toContain("Sem alterações.");
      expect(botao("Desfazer última alteração")).toBeUndefined();
    });

    it("exibe erro e não atualiza o mapa nem o cache quando a gravação devolve resposta inválida", async () => {
      respostas[RPC_SALVAR] = () => ({ data: { latitude: [] }, error: null });
      await montar();
      await abrirEditor();
      await escolher("Seropédica/RJ");
      await digitar(latitude(), "-22,8");
      await digitar(motivo(), "Ajuste conforme fonte oficial");
      await clicar(botao("Salvar coordenada"));
      await clicar(botao("Confirmar correção"));
      await aguardar();
      expect(chamadas(RPC_SALVAR)).toHaveLength(1);
      expect(host.querySelector('[role="alert"]').textContent).toContain(
        "Resposta inválida ao salvar coordenada.",
      );
      expect(host.textContent).not.toContain("Coordenada salva.");
      const noCache = carregador
        .emCache("projetos")
        .municipios.find((m) => m.lugar === "seropedica/RJ");
      expect(noCache.coordenada.latitude).toBe(-22.7526);
    });
  });

  describe("Coordenadas no mapa de Projetos: prévia", () => {
    it("arrasta só o pin de prévia, desfaz sem gravar e exige confirmação antes de salvar", async () => {
      await montar();
      await abrirEditor();
      await escolher("Seropédica/RJ");
      const pin = [...mapaVivo().camadas].find((c) => c.opcoes?.draggable);
      await act(async () => {
        pin.setLatLng([-22.9, -43.7155]);
        pin.fire("dragend");
      });
      expect(latitude().value).toBe("-22.900000");
      expect(
        carregador
          .emCache("projetos")
          .municipios.find((m) => m.lugar === "seropedica/RJ").coordenada
          .latitude,
      ).toBe(-22.7526);
      await clicar(botao("Desfazer prévia"));
      expect(pin.latlng).toEqual([-22.7526, -43.7155]);
      expect(chamadas(RPC_SALVAR)).toHaveLength(0);
      await digitar(latitude(), "-22,8");
      await digitar(motivo(), "Ajuste conforme fonte oficial");
      await clicar(botao("Salvar coordenada"));
      expect(chamadas(RPC_SALVAR)).toHaveLength(0);
      await clicar(botao("Confirmar correção"));
      expect(chamadas(RPC_SALVAR).at(-1)[1]).toMatchObject({
        p_lugar: "seropedica/RJ",
        p_latitude: -22.8,
        p_longitude: -43.7155,
        p_latitude_anterior: -22.7526,
        p_longitude_anterior: -43.7155,
        p_conferido: false,
      });
      expect(host.textContent).toContain("Coordenada salva.");
      // Corrigir sem marcar "Conferido" não tira o lugar das pendências.
      expect(
        host.querySelector(".mapa-si-coordenadas__contagem").textContent,
      ).toBe("3 pendentes");
    });

    it("preserva a prévia e comunica conflito sem anunciar sucesso", async () => {
      respostas[RPC_SALVAR] = () => ({
        error: {
          message: "Coordenada alterada por outra pessoa. Atualize o mapa.",
        },
      });
      await montar();
      await abrirEditor();
      await escolher("Seropédica/RJ");
      await digitar(latitude(), "-22,8");
      await digitar(motivo(), "Nova fonte oficial consultada");
      await clicar(botao("Salvar coordenada"));
      await clicar(botao("Confirmar correção"));
      expect(host.querySelector('[role="alert"]').textContent).toContain(
        "outra pessoa",
      );
      expect(host.textContent).not.toContain("Coordenada salva.");
      expect(latitude().value).toBe("-22,8");
      expect(
        carregador
          .emCache("projetos")
          .municipios.find((m) => m.lugar === "seropedica/RJ").coordenada
          .latitude,
      ).toBe(-22.7526);
    });

    it("não tem os parágrafos de instrução genérica nem o select antigo", async () => {
      await montar();
      await abrirEditor();
      await escolher("Seropédica/RJ");
      expect(host.textContent).not.toMatch(/Escolha um ponto para ajustar/);
      expect(host.textContent).not.toMatch(/Arraste o pin de prévia/);
      expect(host.querySelector("select")).toBeNull();
    });
  });

  describe("Coordenadas no mapa de Projetos: fila e sugestões", () => {
    it("filtra por gravidade e desliga o filtro ao clicar de novo", async () => {
      await montar();
      await abrirEditor();
      const revisar = host.querySelector('[data-nivel="revisar"]');
      expect(revisar.textContent).toContain("1");
      expect(host.querySelector('[data-nivel="erro"]').disabled).toBe(true);
      await clicar(revisar);
      expect(revisar.getAttribute("aria-pressed")).toBe("true");
      expect(itens()).toEqual(["Pará (estado)"]);
      await clicar(revisar);
      expect(revisar.getAttribute("aria-pressed")).toBe("false");
      expect(itens()).toHaveLength(3);
    });

    it("avisa quando as pendências não carregam e a lista completa continua", async () => {
      respostas[RPC_PENDENCIAS] = () => ({ error: { message: "Sem rede." } });
      await montar();
      await abrirEditor();
      expect(host.querySelector('[role="alert"]').textContent).toBe(
        "Sem rede.",
      );
      await clicar(
        host.querySelector(
          '.mapa-si-coordenadas__caixa input[type="checkbox"]',
        ),
      );
      expect(itens()).toHaveLength(3);
    });

    it("a dica do círculo de sugestão é texto: nome de base externa não vira HTML", async () => {
      respostas[RPC_PENDENCIAS] = () => {
        const pendencias = PENDENCIAS();
        pendencias[1].candidatos[1].n = '<img src=x onerror="alert(1)">';
        return { data: pendencias, error: null };
      };
      await montar();
      await abrirEditor();
      await escolher("Pará (estado)");
      const circulos = leaflet
        .desenhadas(mapaVivo(), "circleMarker")
        .filter((c) => c.dica);
      expect(circulos.length).toBeGreaterThan(0);
      for (const c of circulos) expect(typeof c.dica).not.toBe("string");
      const dicas = circulos.map((c) => c.dica.textContent).join(" ");
      expect(dicas).toContain('<img src=x onerror="alert(1)">');
    });
  });

  describe("Coordenadas no mapa de Projetos: desfazer", () => {
    it("não oferece desfazer de um desfazer nem de alteração já desfeita", async () => {
      respostas[RPC_HISTORICO] = () => ({
        data: [
          { ...HISTORICO()[0], id: 10, acao: "DESFAZER", desfaz: 9 },
          { ...HISTORICO()[0], desfeito: true },
        ],
        error: null,
      });
      await montar();
      await abrirEditor();
      await escolher("Seropédica/RJ");
      expect(host.textContent).toContain("(desfeita)");
      expect(botao("Desfazer última alteração")).toBeUndefined();
    });
  });
});

bloco("modulos/mapa-de-projetos", () => {
  /*
  O mapa de Projetos em React (src/modulos/mapa-de-projetos/), irmão do da
  Saúde Indígena, com o Leaflet falso: a carga (um pedido por área, cache),
  um ponto por lugar na cor do projeto (UF no meio do estado), a lista
  "Municípios por vagas" com filtro e agrupamento por projeto, popup e dica
  em DOM, legenda, Brasil, tela cheia, tema, StrictMode limpo e nada de HTML
  em texto.
*/

  const normalizar = (texto) => texto.replace(/\s+/g, " ").trim();

  function supabaseFalso(resposta) {
    return {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "teste" } },
          error: null,
        }),
      },
      rpc: vi.fn(async () => resposta),
    };
  }

  const SIMPLES = {
    data: [
      {
        municipio_uf: "Irati/PR",
        vagas: 5,
        candidatos: 70,
        aprovados: 43,
        reprovados: 27,
      },
      {
        municipio_uf: "Seropédica/RJ",
        vagas: 12,
        candidatos: 647,
        aprovados: 0,
        reprovados: 0,
      },
      { municipio_uf: "Lugar Novo/AM", vagas: 1, candidatos: 3 },
    ],
    error: null,
  };

  const PROJETOS = {
    data: [
      {
        municipio_uf: "Boa Vista/RR",
        uf: "RR",
        codigo_ibge: 1400100,
        vagas_edital: 38,
        projetos: ["Saúde nas Fronteiras", "Escritório Distrital e Regional"],
        editais: [
          {
            edital: "23/2025",
            projeto: "Saúde nas Fronteiras",
            vagas: 22,
            lotacoes: ["Boa Vista/RR"],
          },
          {
            edital: "62/2025",
            projeto: "Escritório Distrital e Regional",
            vagas: 16,
          },
        ],
      },
      {
        municipio_uf: "Brasília/DF",
        uf: "DF",
        codigo_ibge: 5300108,
        vagas_edital: 5,
        cadastro_reserva: true,
        projetos: ["MFC", "Rio Doce"],
        editais: [
          { edital: "05/2026", projeto: "MFC", vagas: 5 },
          {
            edital: "04/2026",
            projeto: "Rio Doce",
            vagas: null,
            cadastro_reserva: true,
          },
        ],
      },
      {
        municipio_uf: null,
        uf: "PA",
        nivel: "uf",
        vagas_edital: 1,
        projetos: ["CCE"],
        editais: [{ edital: "97/2025", projeto: "CCE", vagas: 1 }],
      },
      {
        municipio_uf: "Irati/PR",
        uf: "PR",
        vagas: 5,
        candidatos: 70,
        aprovados: 43,
        reprovados: 27,
        projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
        editais: [
          {
            edital: "30/2026",
            projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
            cadastro_reserva: true,
          },
        ],
      },
    ],
    error: null,
  };

  // ── Carga ────────────────────────────────────────────────────────────────

  describe("carga dos municípios", () => {
    it("um pedido por área, guardado pelo tempo do cache", async () => {
      let agora = 0;
      const supabase = supabaseFalso(SIMPLES);
      const carregador = criarCarregadorDeMunicipios({
        obterSupabase: () => supabase,
        relogio: () => agora,
      });
      const [a, b] = await Promise.all([
        carregador.carregar("projetos"),
        carregador.carregar("projetos"),
      ]);
      expect(a).toBe(b);
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith(RPC_DOS_MUNICIPIOS, {
        p_area: "projetos",
      });
      expect(a.municipios).toHaveLength(3);
      expect(carregador.emCache("projetos")).toBe(a);
      await carregador.carregar("projetos");
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      agora = CACHE_TTL_MS + 1;
      expect(carregador.emCache("projetos")).toBeNull();
      await carregador.carregar("projetos");
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
    });

    it("banco sem a função não é erro; erro não fica guardado", async () => {
      const semFuncao = criarCarregadorDeMunicipios({
        obterSupabase: () =>
          supabaseFalso({ data: null, error: { code: "PGRST202" } }),
      });
      expect(await semFuncao.carregar("projetos")).toMatchObject({
        indisponivel: true,
        erro: "",
      });
      const comErro = criarCarregadorDeMunicipios({
        obterSupabase: () =>
          supabaseFalso({ data: null, error: { message: "falhou" } }),
      });
      expect((await comErro.carregar("projetos")).erro).toBe("falhou");
      expect(comErro.emCache("projetos")).toBeNull();
      const semCliente = criarCarregadorDeMunicipios();
      expect((await semCliente.carregar("projetos")).erro).toBe("Sem conexão.");
    });

    it("guarda a escolha da lista enquanto vive", () => {
      const carregador = criarCarregadorDeMunicipios();
      expect(carregador.obterEscolha()).toEqual({
        projeto: "",
        agrupar: false,
      });
      carregador.guardarEscolha({ agrupar: true });
      carregador.guardarEscolha({ projeto: "MFC" });
      expect(carregador.obterEscolha()).toEqual({
        projeto: "MFC",
        agrupar: true,
      });
    });
  });

  // ── Componente ───────────────────────────────────────────────────────────

  let raiz = null;
  let host = null;
  let leaflet = null;

  async function carregadorCom(resposta) {
    const supabase = supabaseFalso(resposta);
    const carregador = criarCarregadorDeMunicipios({
      obterSupabase: () => supabase,
    });
    // Já em cache: o componente desenha na primeira renderização.
    await esperar(() => carregador.carregar("projetos"));
    return { carregador, supabase };
  }

  function Pai(props) {
    return createElement(
      StrictMode,
      null,
      createElement(MapaDeProjetos, {
        area: "projetos",
        carregadoEm: 1,
        ...props,
      }),
    );
  }

  async function montar(props) {
    host = document.createElement("div");
    document.body.append(host);
    raiz = createRoot(host);
    await act(async () => raiz.render(createElement(Pai, props)));
    return host;
  }

  async function rerender(props) {
    await act(async () => raiz.render(createElement(Pai, props)));
  }

  async function desmontar() {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    host?.remove();
    host = null;
  }

  const mapaVivo = () =>
    leaflet.vivos().find((m) => m.elemento.id === "mapaDosProjetos") || null;
  const pontos = () => leaflet.desenhadas(mapaVivo(), "circleMarker");
  const linhas = () => [...host.querySelectorAll(".mapa-projetos-lugar")];
  const nomes = () =>
    linhas().map((linha) => linha.querySelector("strong").textContent);
  const botao = (texto) =>
    [...host.querySelectorAll("button")].find(
      (b) => normalizar(b.textContent) === texto,
    );

  beforeEach(() => {
    leaflet = criarLeafletFalso();
    globalThis.L = leaflet.L;
  });

  afterEach(async () => {
    await desmontar();
    delete globalThis.L;
    delete window.matchMedia;
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  describe("o mapa", () => {
    it("um mapa só no #mapaDosProjetos, enquadrado no Brasil, mesmo com o StrictMode", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      expect(leaflet.vivos()).toHaveLength(1);
      expect(leaflet.mapas.filter((m) => m.removido)).toHaveLength(
        leaflet.mapas.length - 1,
      );
      const mapa = mapaVivo();
      expect(host.querySelectorAll("#mapaDosProjetos")).toHaveLength(1);
      expect(host.querySelector("#map, #detailMap")).toBeNull();
      expect(mapa.chamadas[0][0]).toBe("fitBounds");
      // Fundo, contorno do Brasil e divisas das UFs. Os contornos chegam por
      // import() sob demanda (src/modulos/mapa-saude-indigena/leaflet.ts): no
      // primeiro teste o módulo ainda é transformado, e o `act` da montagem não
      // espera por ele. Espera a mesma promessa que o mapa espera, não o relógio.
      await esperar(() => carregarContornos());
      expect([...mapa.camadas].some((c) => c.tipo === "tileLayer")).toBe(true);
      expect(leaflet.desenhadas(mapa, "geoJSON")).toHaveLength(2);
      // Dicas e popups ficam dentro do mapa (src/lib/mapas/dica-dentro-do-mapa.ts).
      expect(mapa.ouvintes("tooltipopen")).toBe(1);
      expect(mapa.ouvintes("popupopen")).toBe(1);
      // Desmontar remove o Leaflet.
      await desmontar();
      expect(leaflet.vivos()).toHaveLength(0);
    });

    it("antes da primeira carga da página não pede nada e mostra o esqueleto", async () => {
      const supabase = supabaseFalso(SIMPLES);
      const carregador = criarCarregadorDeMunicipios({
        obterSupabase: () => supabase,
      });
      await montar({ carregador, carregadoEm: 0 });
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(host.querySelector(".mapa-si-lista__esqueleto")).not.toBeNull();
      expect(host.querySelector(".mapa-si-painel__contagem").textContent).toBe(
        "…",
      );
      // A página carregou: pede uma vez e desenha.
      await rerender({ carregador, carregadoEm: 1 });
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(nomes()).toHaveLength(3);
      // Atualizar dados com o cache fresco não vai ao banco.
      await rerender({ carregador, carregadoEm: 2 });
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(nomes()).toHaveLength(3);
    });

    it("um ponto por município com coordenada e a lista por vagas", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      expect(pontos()).toHaveLength(2);
      expect(host.querySelector(".mapa-si-painel__contagem").textContent).toBe(
        "3 municípios",
      );
      expect(host.querySelector(".mapa-si-lista__topo b").textContent).toBe(
        "3",
      );
      expect(nomes()).toEqual(["Seropédica/RJ", "Irati/PR", "Lugar Novo/AM"]);
      const [seropedica, irati, novo] = linhas();
      // Mesmo formato de "Territórios por vagas": posição, nome, vagas, barra.
      expect(irati.classList).toContain("mapa-si-territorio");
      expect(
        irati.querySelector(".mapa-si-territorio__posicao").textContent,
      ).toBe("2");
      expect(normalizar(irati.textContent)).toContain("5 vagas");
      expect(normalizar(irati.textContent)).toContain("70 candidatos");
      expect(
        irati.querySelector(".mapa-projetos-lugar__resultado i").style.width,
      ).toBe("61%");
      expect(normalizar(irati.textContent)).toContain("61% aprovados");
      expect(irati.getAttribute("aria-label")).toBe(
        "Irati/PR, 5 vagas, 70 candidatos, 61% aprovados",
      );
      // Sem nenhuma análise decidida, sem barra; sem coordenada, sem clique.
      expect(
        seropedica.querySelector(".mapa-projetos-lugar__resultado"),
      ).toBeNull();
      expect(novo.disabled).toBe(true);
      expect(normalizar(novo.textContent)).toContain("sem coordenada no mapa");
      // A lista leva ao ponto: aproxima e abre o popup.
      const mapa = mapaVivo();
      mapa.chamadas.length = 0;
      await clicar(irati);
      expect(mapa.chamadas).toContainEqual([
        "setView",
        [-25.4697, -50.6493],
        7,
        { animate: true },
      ]);
      const marcador = pontos().find((p) => p.latlng[0] === -25.4697);
      expect(marcador.popupAberto).toBe(true);
    });

    /*
    A regra do mapa da Saúde Indígena: sem filtro, o Brasil (não a caixa dos
    pontos); com o recorte da Visão geral, só os lugares com edital do
    recorte, enquadrados na caixa deles (ou zoom 7 num lugar só).
  */
    it("sem filtro fica no Brasil; com o recorte da página, enquadra os lugares dele", async () => {
      const { carregador } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      const caixas = () =>
        mapaVivo().chamadas.filter(
          ([nome, , opcoes]) => nome === "fitBounds" && opcoes?.maxZoom === 7,
        );
      expect(caixas()).toHaveLength(0);
      expect(nomes()).toHaveLength(4);

      const doRecorte = [
        { id: 1, edital: "Edital 23/2025" },
        { id: 2, edital: "05/2026" },
      ];
      await rerender({ carregador, linhas: doRecorte, filtroAtivo: true });
      expect(nomes()).toEqual(["Boa Vista/RR", "Brasília/DF"]);
      expect(pontos()).toHaveLength(2);
      // Cada lugar só com o edital do recorte.
      expect(
        normalizar(
          linhas()
            .map((linha) => linha.textContent)
            .join(" "),
        ),
      ).not.toContain("Rio Doce");
      expect(caixas()).toHaveLength(1);
      expect(caixas()[0][1].pontos).toHaveLength(2);

      // Recorte sem lugar nenhum: vazio "no recorte" e o Brasil.
      await rerender({
        carregador,
        linhas: [{ id: 3, edital: "1/2020" }],
        filtroAtivo: true,
      });
      expect(nomes()).toEqual([]);
      expect(host.querySelector(".mapa-si-lista").textContent).toContain(
        "Nenhum município no recorte.",
      );
    });

    it("lugares no mesmo pixel abrem em leque, com traço até o ponto real", async () => {
      const { carregador } = await carregadorCom({
        data: [
          {
            lugar: "a",
            municipio_uf: "Boa Vista/RR",
            uf: "RR",
            vagas: 3,
            latitude: 2.82,
            longitude: -60.67,
          },
          {
            lugar: "b",
            municipio_uf: "Cantá/RR",
            uf: "RR",
            vagas: 2,
            latitude: 2.82,
            longitude: -60.67,
          },
        ],
        error: null,
      });
      await montar({ carregador });
      const mapa = mapaVivo();
      expect(leaflet.desenhadas(mapa, "polyline")).toHaveLength(2);
      // A coordenada do dado não muda: o traço parte do ponto real.
      expect(leaflet.desenhadas(mapa, "polyline")[0].latlng[0]).toEqual([
        2.82, -60.67,
      ]);
    });

    it("o botão Brasil voa de volta ao país inteiro (salta com menos movimento)", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      const mapa = mapaVivo();
      // O remedir da montagem vem no quadro seguinte; espera para não contá-lo.
      await act(() => new Promise((pronto) => requestAnimationFrame(pronto)));
      mapa.chamadas.length = 0;
      await clicar(botao("Brasil"));
      expect(mapa.chamadas.map(([nome]) => nome)).toEqual([
        "stop",
        "flyToBounds",
      ]);
      window.matchMedia = (consulta) => ({
        matches: consulta.includes("prefers-reduced-motion"),
      });
      mapa.chamadas.length = 0;
      await clicar(botao("Brasil"));
      expect(mapa.chamadas.map(([nome]) => nome)).toEqual([
        "stop",
        "fitBounds",
      ]);
    });

    it("escapa o nome do município (lista, dica e popup)", async () => {
      window.matchMedia = () => ({ matches: true });
      const { carregador } = await carregadorCom({
        data: [
          {
            municipio_uf: '<img src=x onerror="alert(1)">/XX',
            uf: "RR",
            codigo_ibge: 1400100,
            editais: [{ edital: "<b>1</b>", projeto: "<script>x</script>" }],
          },
        ],
        error: null,
      });
      await montar({ carregador });
      expect(host.querySelector("img, script")).toBeNull();
      expect(nomes()[0]).toContain("<img");
      for (const ponto of pontos()) {
        expect(ponto.popup.querySelector("img, script")).toBeNull();
        expect(ponto.dica.querySelector("img, script")).toBeNull();
      }
    });

    it("sem Leaflet (offline) a lista continua", async () => {
      delete globalThis.L;
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      expect(host.textContent).toContain("Mapa indisponível sem conexão");
      expect(nomes()).toHaveLength(3);
    });

    it("banco sem a função e erro: uma linha na lista, sem filtros", async () => {
      const { carregador } = await carregadorCom({
        data: null,
        error: { code: "PGRST202" },
      });
      await montar({ carregador });
      expect(host.textContent).toContain(
        "Municípios indisponíveis: falta uma atualização do banco.",
      );
      await desmontar();
      const comErro = await carregadorCom({
        data: null,
        error: { message: "falhou" },
      });
      await montar({ carregador: comErro.carregador });
      expect(host.textContent).toContain(
        "Não foi possível carregar os municípios.",
      );
      expect(host.querySelector(".mapa-projetos__filtros")).toBeNull();
    });
  });

  describe("todos os projetos no mapa", () => {
    it("um ponto por lugar, na cor do projeto, e UF no meio do estado", async () => {
      const { carregador } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      expect(pontos()).toHaveLength(4);
      // Irati e Brasília empatam em 5 vagas: os candidatos desempatam.
      expect(nomes()).toEqual([
        "Boa Vista/RR",
        "Irati/PR",
        "Brasília/DF",
        "Pará (estado)",
      ]);
      const classe = (indice) => pontos()[indice].opcoes.className;
      // Boa Vista: Fronteiras (série 2) e mais um projeto (contorno tracejado).
      expect(classe(0)).toBe(
        "marcador-de-projeto marcador-de-projeto--2 is-varios-projetos",
      );
      expect(classe(1)).toBe("marcador-de-projeto marcador-de-projeto--1");
      // Brasília: Rio Doce (série 4) vem antes de MFC (série 5).
      expect(classe(2)).toBe(
        "marcador-de-projeto marcador-de-projeto--4 is-varios-projetos",
      );
      expect(classe(3)).toBe("marcador-de-projeto marcador-de-projeto--6");
      // Popup montado no DOM: projeto, edital, vagas, lotação.
      const popup = pontos()[0].popup;
      expect(popup).toBeInstanceOf(HTMLElement);
      expect(normalizar(popup.textContent)).toContain(
        "Saúde nas Fronteiras · Edital 23/2025 · 22 vagas · Boa Vista/RR",
      );
      expect(popup.querySelector(".mapa-projeto__cor--3")).not.toBeNull();
      expect(pontos()[0].opcoesDoPopup.autoPan).toBe(true);
      // A linha da lista diz os projetos e as vagas publicadas.
      const primeira = linhas()[0];
      expect(normalizar(primeira.textContent)).toContain("38 vagas");
      expect(
        [...primeira.querySelectorAll(".mapa-projetos-lugar__projeto")].map(
          (projeto) => normalizar(projeto.textContent),
        ),
      ).toEqual(["Saúde nas Fronteiras", "Escritório Distrital e Regional"]);
    });

    it("dica só onde há ponteiro que flutua; ela fecha quando o popup abre", async () => {
      const { carregador } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      expect(pontos()[0].dica).toBeUndefined();
      await desmontar();
      window.matchMedia = () => ({ matches: true });
      await montar({ carregador });
      const [ponto] = pontos();
      expect(ponto.dica).toBeInstanceOf(HTMLElement);
      expect(ponto.dica).not.toBe(ponto.popup);
      expect(ponto.ouvintes("popupopen")).toBe(1);
    });

    it("a legenda começa recolhida e mostra a cor e o nome de cada projeto", async () => {
      const { carregador } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      const corpo = host.querySelector(".mapa-si-legenda__corpo");
      // Recolhida também no computador: aberta, tapava o Sul e o Sudeste.
      expect(corpo.hidden).toBe(true);
      await clicar(host.querySelector(".mapa-si-legenda__alternar"));
      expect(corpo.hidden).toBe(false);
      const itens = [...corpo.querySelectorAll(".mapa-si-legenda__item")];
      expect(itens.map((item) => normalizar(item.textContent))).toEqual([
        "Caminhoneiros",
        "Saúde nas Fronteiras",
        "Escritório Distrital e Regional",
        "Rio Doce",
        "MFC",
        "CCE",
        "tamanho = nº de vagas",
        "mais de um projeto",
      ]);
      expect(itens[0].querySelector(".mapa-projeto__cor--1")).not.toBeNull();
    });

    it("filtrar por projeto redesenha sem novo pedido, mantém a cor e enquadra o recorte", async () => {
      const { carregador, supabase } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      const seletor = host.querySelector(".mapa-projetos__seletor");
      expect([...seletor.options].map((opcao) => opcao.textContent)).toEqual([
        "Todos os projetos",
        "Caminhoneiros (1)",
        "Saúde nas Fronteiras (1)",
        "Escritório Distrital e Regional (1)",
        "Rio Doce (1)",
        "MFC (1)",
        "CCE (1)",
      ]);
      const mapa = mapaVivo();
      mapa.chamadas.length = 0;
      await escolher(seletor, "Escritório Distrital e Regional");
      expect(nomes()).toEqual(["Boa Vista/RR"]);
      expect(pontos()).toHaveLength(1);
      expect(pontos()[0].opcoes.className).toBe(
        "marcador-de-projeto marcador-de-projeto--3",
      );
      expect(host.querySelector(".mapa-si-painel__contagem").textContent).toBe(
        "1 município",
      );
      // Um lugar só no recorte: zoom 7 nele, como o DSEI único na Saúde Indígena.
      expect(mapa.chamadas).toContainEqual([
        "setView",
        pontos()[0].latlng,
        7,
        { animate: false },
      ]);
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      // O campo é o mesmo: o foco não se perde.
      expect(host.querySelector(".mapa-projetos__seletor")).toBe(seletor);
      expect(carregador.obterEscolha().projeto).toBe(
        "Escritório Distrital e Regional",
      );
      await escolher(seletor, "");
      expect(nomes()).toHaveLength(4);
    });

    it('lista compacta: sem "0 candidatos" falso, selos só quando mistura projetos, filtros no padrão', async () => {
      const { carregador } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      const boaVista = linhas().find((l) =>
        l.textContent.includes("Boa Vista/RR"),
      );
      // Boa Vista não casou com vaga das análises: nada de "0 candidatos".
      expect(normalizar(boaVista.textContent)).not.toMatch(/candidato/);
      expect(boaVista.getAttribute("aria-label")).not.toMatch(/candidato/);
      // Irati casou (UBS móvel): os candidatos aparecem.
      const irati = linhas().find((l) => l.textContent.includes("Irati/PR"));
      expect(normalizar(irati.textContent)).toContain("70 candidatos");
      // Nome e vagas na primeira linha; projetos como selos na segunda.
      expect(
        boaVista.querySelector(
          ".mapa-projetos-lugar__segunda .mapa-projetos-lugar__projeto",
        ),
      ).not.toBeNull();
      // "Projeto" é o Campo de src/ui; "Agrupar por projeto" é a caixa normal.
      const campo = host.querySelector(".mapa-projetos__filtros .ui-campo");
      expect(campo.querySelector("label").textContent).toBe("Projeto");
      expect(campo.querySelector("select")).toBe(
        host.querySelector(".mapa-projetos__seletor"),
      );
      expect(
        normalizar(host.querySelector(".mapa-projetos__agrupar").textContent),
      ).toBe("Agrupar por projeto");
      // Com o filtro de um projeto, os selos (todos iguais) somem.
      await escolher(host.querySelector(".mapa-projetos__seletor"), "MFC");
      expect(host.querySelector(".mapa-projetos-lugar__projeto")).toBeNull();
      // Agrupada, também.
      await escolher(host.querySelector(".mapa-projetos__seletor"), "");
      await clicar(host.querySelector(".mapa-projetos__agrupar input"));
      expect(host.querySelector(".mapa-projetos-lugar__projeto")).toBeNull();
    });

    it("agrupar por projeto: um bloco por projeto, lugar de dois projetos nos dois", async () => {
      const { carregador } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      const mapa = mapaVivo();
      mapa.chamadas.length = 0;
      await clicar(host.querySelector(".mapa-projetos__agrupar input"));
      const grupos = [
        ...host.querySelectorAll(".mapa-projetos__grupo-titulo strong"),
      ].map((grupo) => grupo.textContent);
      expect(grupos).toEqual([
        "Caminhoneiros",
        "Saúde nas Fronteiras",
        "Escritório Distrital e Regional",
        "Rio Doce",
        "MFC",
        "CCE",
      ]);
      expect(nomes().filter((nome) => nome === "Boa Vista/RR")).toHaveLength(2);
      // Agrupar não reenquadra o mapa.
      expect(mapa.chamadas.some(([nome]) => nome === "fitBounds")).toBe(false);
      // Clicar na linha do grupo abre o ponto certo.
      await clicar(
        linhas().find((linha) => linha.textContent.includes("Irati/PR")),
      );
      expect(mapa.chamadas).toContainEqual([
        "setView",
        [-25.4697, -50.6493],
        7,
        { animate: true },
      ]);
    });

    it("a escolha sobrevive a desmontar (troca de área) e projeto que sumiu volta a todos", async () => {
      const { carregador } = await carregadorCom(PROJETOS);
      carregador.guardarEscolha({ projeto: "MFC", agrupar: true });
      await montar({ carregador });
      expect(host.querySelector(".mapa-projetos__seletor").value).toBe("MFC");
      expect(host.querySelector(".mapa-projetos__agrupar input").checked).toBe(
        true,
      );
      // Agrupado, o lugar de dois projetos aparece nos dois grupos.
      expect([...new Set(nomes())]).toEqual(["Brasília/DF"]);
      await desmontar();
      carregador.guardarEscolha({ projeto: "Projeto que acabou" });
      await montar({ carregador });
      expect(host.querySelector(".mapa-projetos__seletor").value).toBe("");
      expect(nomes().length).toBeGreaterThan(4);
    });

    it("com um projeto só, sem filtros", async () => {
      const { carregador } = await carregadorCom({
        data: [PROJETOS.data[3]],
        error: null,
      });
      await montar({ carregador });
      expect(host.querySelector(".mapa-projetos__filtros")).toBeNull();
    });
  });

  /*
  Reenquadrar ao mudar de tamanho (tela cheia, barra lateral, janela) só
  enquanto a pessoa não mexeu no mapa; "Brasil" volta a acompanhar. ResizeObserver
  e medidas falsos: o jsdom não tem layout.
*/
  describe("tamanho do contêiner", () => {
    let observadores;
    let medida;
    const originais = {};

    beforeEach(() => {
      observadores = [];
      medida = { largura: 800, altura: 500 };
      originais.ResizeObserver = globalThis.ResizeObserver;
      originais.raf = globalThis.requestAnimationFrame;
      originais.caf = globalThis.cancelAnimationFrame;
      globalThis.ResizeObserver = class {
        constructor(aoMudar) {
          this.aoMudar = aoMudar;
          observadores.push(this);
        }
        observe() {}
        disconnect() {
          observadores.splice(observadores.indexOf(this), 1);
        }
      };
      globalThis.requestAnimationFrame = (fn) => {
        fn();
        return 1;
      };
      globalThis.cancelAnimationFrame = () => {};
      for (const [prop, chave] of [
        ["offsetWidth", "largura"],
        ["offsetHeight", "altura"],
      ])
        Object.defineProperty(HTMLElement.prototype, prop, {
          configurable: true,
          get: () => medida[chave],
        });
    });

    afterEach(() => {
      globalThis.ResizeObserver = originais.ResizeObserver;
      globalThis.requestAnimationFrame = originais.raf;
      globalThis.cancelAnimationFrame = originais.caf;
      delete HTMLElement.prototype.offsetWidth;
      delete HTMLElement.prototype.offsetHeight;
    });

    async function redimensionar(largura, altura) {
      medida = { largura, altura };
      await act(async () => observadores.forEach((o) => o.aoMudar([])));
    }

    const enquadramentos = (mapa) =>
      mapa.chamadas.filter(([nome]) => nome === "fitBounds").length;

    it("reenquadra ao mudar de tamanho até a pessoa mexer; Brasil volta a acompanhar", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      const mapa = mapaVivo();
      const antes = enquadramentos(mapa);
      await redimensionar(1200, 700);
      expect(enquadramentos(mapa)).toBe(antes + 1);

      // A pessoa arrastou: a vista dela fica, o Leaflet só remede.
      mapa.elemento.dispatchEvent(new Event("pointerdown"));
      mapa.chamadas.length = 0;
      await redimensionar(800, 500);
      expect(enquadramentos(mapa)).toBe(0);
      expect(mapa.chamadas.some(([nome]) => nome === "invalidateSize")).toBe(
        true,
      );

      // "Brasil" é do app: volta a acompanhar o tamanho.
      await clicar(botao("Brasil"));
      mapa.chamadas.length = 0;
      await redimensionar(1000, 600);
      expect(enquadramentos(mapa)).toBe(1);
    });

    it("ir à lista de um ponto conta como mexer; sair da tela cheia sem mexer reenquadra", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      const mapa = mapaVivo();
      await clicar(botao("Tela cheia"));
      mapa.chamadas.length = 0;
      await redimensionar(1400, 900);
      await clicar(botao("Sair da tela cheia"));
      await redimensionar(800, 500);
      expect(enquadramentos(mapa)).toBe(2);

      await clicar(linhas()[1]);
      mapa.chamadas.length = 0;
      await redimensionar(1100, 650);
      expect(enquadramentos(mapa)).toBe(0);
    });

    /*
    O "saltitar" de produção: com um popup aberto, nada do app pode mover o
    mapa de novo — nem o observador avisando a mesma medida várias vezes, nem
    o popup abrindo e fechando. O popup não liga o `keepInView` (o autoPan a
    cada `moveend`, que brigava com o `maxBounds`; ver
    tests/mapas-e-visao-geral-na-tela.test.js (bloco dica-dentro-do-mapa)).
  */
    it("popup aberto e o observador repetindo a mesma medida não movem o mapa", async () => {
      const { carregador } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      const mapa = mapaVivo();
      const [ponto] = pontos();
      expect(ponto.opcoesDoPopup.keepInView).not.toBe(true);
      mapa.chamadas.length = 0;
      const movimentos = () =>
        mapa.chamadas.filter(([nome]) =>
          ["fitBounds", "setView", "flyTo", "flyToBounds"].includes(nome),
        ).length;
      await act(async () => {
        ponto.openPopup();
        mapa.fire("popupopen", { popup: { options: {}, update() {} } });
      });
      for (let vez = 0; vez < 20; vez += 1) await redimensionar(800, 500);
      expect(movimentos()).toBe(0);
      await act(async () => mapa.fire("popupclose"));
      await redimensionar(800, 500);
      expect(movimentos()).toBe(0);
    });

    it("desmontar desliga o observador", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      expect(observadores.length).toBeGreaterThan(0);
      await desmontar();
      expect(observadores).toHaveLength(0);
    });
  });

  describe("tela cheia e tema", () => {
    it("tela cheia liga e o Esc desliga", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      await clicar(botao("Tela cheia"));
      expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
      expect(botao("Sair da tela cheia").getAttribute("aria-pressed")).toBe(
        "true",
      );
      await teclar(document, "Escape");
      expect(host.querySelector(".mapa-si--tela-cheia")).toBeNull();
    });

    it("com um modal aberto por cima, o Esc fecha o modal e o mapa segue em tela cheia", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      await clicar(botao("Tela cheia"));
      const caixa = document.createElement("div");
      document.body.append(caixa);
      const raiz = createRoot(caixa);
      const fechar = vi.fn();
      await act(async () =>
        raiz.render(
          createElement(
            Modal,
            { rotulo: "Buscar", aoFechar: fechar },
            "conteúdo",
          ),
        ),
      );
      await teclar(document, "Escape");
      expect(fechar).toHaveBeenCalledTimes(1);
      expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
      expect(document.body.style.overflow).toBe("hidden");
      await act(async () => raiz.unmount());
      caixa.remove();
      await teclar(document, "Escape");
      expect(host.querySelector(".mapa-si--tela-cheia")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("recolhe e mostra o mapa, com a mesma escolha do mapa da Saúde Indígena", async () => {
      localStorage.removeItem("agsus_yeende_mapa_recolhido_v1");
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      await clicar(botao("Recolher mapa"));
      expect(host.querySelector(".mapa-si--recolhido")).not.toBeNull();
      expect(botao("Mostrar mapa").getAttribute("aria-expanded")).toBe("false");
      expect(botao("Tela cheia")).toBeUndefined();
      expect(localStorage.getItem("agsus_yeende_mapa_recolhido_v1")).toBe(
        "recolhido",
      );
      await clicar(botao("Mostrar mapa"));
      expect(host.querySelector(".mapa-si--recolhido")).toBeNull();
      expect(localStorage.getItem("agsus_yeende_mapa_recolhido_v1")).toBeNull();
    });

    it("segue o tema do app e aceita o tema forçado pelo pai", async () => {
      const { carregador } = await carregadorCom(SIMPLES);
      await montar({ carregador });
      expect(host.querySelector(".mapa-si--escuro")).toBeNull();
      await act(async () => {
        document.documentElement.setAttribute("data-theme", "dark");
        document.dispatchEvent(new Event(EVENTO_TEMA_ALTERADO));
      });
      expect(host.querySelector(".mapa-si--escuro")).not.toBeNull();
      await rerender({ carregador, tema: "claro" });
      expect(host.querySelector(".mapa-si--escuro")).toBeNull();
    });
  });

  describe("fonte", () => {
    const pasta = "src/modulos/mapa-de-projetos/";
    const arquivos = [
      "mapa-de-projetos.tsx",
      "lista.tsx",
      "balao.ts",
      "carregador.ts",
    ].map((nome) => readFileSync(pasta + nome, "utf8"));

    it("sem HTML em string nem MutationObserver", () => {
      for (const fonte of arquivos) {
        expect(fonte).not.toMatch(/innerHTML|dangerouslySetInnerHTML/);
        expect(fonte).not.toContain("MutationObserver");
      }
    });

    /*
    O popup de Pacaraima/RR mostrava "Saúde nas Fronteiras" letra a letra: a
    linha do edital era flex (o texto solto virava item ao lado do nome) e o
    balão tinha `overflow-wrap: anywhere` + `white-space: normal`, que levam a
    menor largura do conteúdo a uma letra — e é essa a medida que o Leaflet
    usa para escolher a largura do popup. O jsdom não tem layout: a regra fica
    no CSS e na estrutura.
  */
    it("o nome do projeto no balão é texto corrido, não uma coluna estreita", async () => {
      const css = readFileSync(pasta + "mapa-de-projetos.css", "utf8")
        .replace(/\r\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const regras = (seletor) =>
        [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
          .filter(([, seletores]) =>
            seletores.split(",").some((s) => s.trim() === seletor),
          )
          .map(([, , corpo]) => corpo)
          .join("\n");
      const linha = regras(".mapa-projetos__balao-edital");
      expect(linha).toMatch(/display:\s*block/);
      expect(linha).not.toMatch(/display:\s*(inline-)?(flex|grid)/);
      expect(css).not.toMatch(/overflow-wrap:\s*anywhere/);
      expect(regras(".mapa-projetos__balao")).not.toMatch(/white-space/);

      const { carregador } = await carregadorCom(PROJETOS);
      await montar({ carregador });
      const edital = pontos()[0].popup.querySelector(
        ".mapa-projetos__balao-edital",
      );
      // Bolinha, nome e o resto na mesma linha de texto, nesta ordem.
      expect([...edital.childNodes].map((no) => no.nodeName)).toEqual([
        "SPAN",
        "B",
        "#text",
      ]);
      expect(edital.querySelector("b").textContent).toBe(
        "Saúde nas Fronteiras",
      );
    });

    it("as cores são as séries do design system", () => {
      const css = readFileSync(pasta + "mapa-de-projetos.css", "utf8").replace(
        /\r\n/g,
        "\n",
      );
      for (let serie = 1; serie <= 6; serie += 1) {
        expect(css).toContain(
          `.marcador-de-projeto--${serie} {\n  fill: var(--series-${serie});`,
        );
        expect(css).toContain(
          `.mapa-projeto__cor--${serie} {\n  background: var(--series-${serie});`,
        );
      }
    });
  });
});

bloco("modulos/mapa-gesto-nos-controles", () => {
  /*
  TROCAR O FUNDO NÃO É PEGAR O MAPA

  O mapa nacional reenquadra o Brasil quando o card muda de tamanho, até a
  pessoa mexer nele (arrastar, zoom, teclado). Todo `pointerdown` dentro do
  contêiner contava — inclusive o clique em "Mapa DSEIs", "Satélite" ou
  "Terras Indígenas", que moram no canto do Leaflet e não mexem na vista. Daí
  em diante o mapa deixava de reenquadrar e o Brasil saía cortado no card
  mais baixo. O "+ −" continua contando: ele mexe na vista.
*/

  function controle(elemento, classes) {
    const caixa = document.createElement("div");
    caixa.className = `leaflet-control ${classes}`;
    const botao = document.createElement("button");
    caixa.append(botao);
    elemento.append(caixa);
    return botao;
  }

  const gesto = (alvo, tipo = "pointerdown") =>
    alvo.dispatchEvent(new Event(tipo, { bubbles: true }));

  describe("gestos nos controles do mapa", () => {
    let medida;
    let observado;
    let elemento;

    beforeEach(() => {
      medida = { largura: 724, altura: 778 };
      observado = null;
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(fn) {
            observado = fn;
          }
          observe() {}
          disconnect() {}
        },
      );
      vi.stubGlobal("requestAnimationFrame", (fn) => {
        fn();
        return 1;
      });
      vi.stubGlobal("cancelAnimationFrame", () => {});
      elemento = document.createElement("div");
      Object.defineProperty(elemento, "offsetWidth", {
        get: () => medida.largura,
      });
      Object.defineProperty(elemento, "offsetHeight", {
        get: () => medida.altura,
      });
      document.body.append(elemento);
    });

    afterEach(() => {
      elemento.remove();
      vi.unstubAllGlobals();
    });

    const encolher = () => {
      medida = { ...medida, altura: medida.altura - 100 };
      observado();
    };

    it("o seletor do fundo e o botão das terras não contam; o '+ −' e o mapa contam", () => {
      const fundo = controle(elemento, "agsus-basemap-switcher");
      const terras = controle(elemento, "agsus-indigenous-territories-control");
      const zoom = controle(elemento, "leaflet-control-zoom leaflet-bar");
      expect(ehGestoNaVista({ target: fundo })).toBe(false);
      expect(ehGestoNaVista({ target: terras })).toBe(false);
      expect(ehGestoNaVista({ target: zoom })).toBe(true);
      expect(ehGestoNaVista({ target: elemento })).toBe(true);
    });

    it("depois de trocar o fundo, o card que muda de tamanho ainda reenquadra o Brasil", () => {
      const { L } = criarLeafletFalso();
      const aoReenquadrar = vi.fn();
      criarMapaDoBrasil(L, elemento, { aoReenquadrar });
      const fundo = controle(elemento, "agsus-basemap-switcher");
      const terras = controle(elemento, "agsus-indigenous-territories-control");

      gesto(fundo);
      gesto(terras, "keydown");
      encolher();
      expect(aoReenquadrar).toHaveBeenCalledTimes(1);

      // Arrastar o mapa é pegar nele: a vista da pessoa fica.
      gesto(elemento);
      encolher();
      expect(aoReenquadrar).toHaveBeenCalledTimes(1);
    });

    it("o '+ −' conta como gesto", () => {
      const { L } = criarLeafletFalso();
      const aoReenquadrar = vi.fn();
      criarMapaDoBrasil(L, elemento, { aoReenquadrar });
      gesto(controle(elemento, "leaflet-control-zoom leaflet-bar"));
      encolher();
      expect(aoReenquadrar).not.toHaveBeenCalled();
    });
  });
});

bloco("modulos/mapa-simples", () => {
  /*
  O "Mapa DSEIs" no mapa nacional da Saúde Indígena (mapa-simples.tsx), com
  o Leaflet falso e contornos de mentira no lugar do arquivo local: os DSEIs
  chapados e numerados, a cor pelos números da lista, o realce lista ↔
  polígono, o clique, a dica e a volta ao Mapa.
*/

  const LMAP = {
    dsei: [
      {
        k: "ALAGOAS E SERGIPE",
        n: "Alagoas e Sergipe",
        lat: -9.6,
        lon: -35.7,
        pop: 12000,
        ufs: ["AL", "SE"],
        polos: [],
      },
      {
        k: "YANOMAMI",
        n: "Yanomami",
        lat: 2.81,
        lon: -60.67,
        pop: 30000,
        ufs: ["RR", "AM"],
        polos: [],
      },
      {
        k: "LESTE DE RORAIMA",
        n: "Leste de Roraima",
        lat: 2.82,
        lon: -60.67,
        pop: 50000,
        ufs: ["RR"],
        polos: [],
      },
    ],
  };

  const LINHAS = [
    {
      unidade: "DSEI Alagoas e Sergipe",
      vagas_total: 10,
      contratados: 9,
      status: "Concluído",
    },
    {
      unidade: "DSEI Yanomami",
      vagas_total: 40,
      contratados: 10,
      status: "Concluído",
    },
  ];

  const quadrado = (x, y) => [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ];
  const CONTORNOS = {
    type: "FeatureCollection",
    features: [
      [1, -36, -10],
      [16, -61, 2],
      [34, -63, 2],
    ].map(([numero, x, y]) => ({
      type: "Feature",
      properties: { numero, nome: "x", rotulo: [y + 0.5, x + 0.5] },
      geometry: { type: "Polygon", coordinates: quadrado(x, y) },
    })),
  };

  let raiz = null;
  let host = null;
  let leaflet = null;

  async function montar(props = {}) {
    host = document.createElement("div");
    document.body.append(host);
    raiz = createRoot(host);
    await act(async () =>
      raiz.render(
        createElement(
          StrictMode,
          null,
          createElement(MapaSaudeIndigena, {
            lmap: LMAP,
            redeCnes: {
              rede: {},
              nac: [["CASAI DF", "", -15.8, -47.9, "BRASILIA", 53]],
            },
            linhas: LINHAS,
            ...props,
          }),
        ),
      ),
    );
    // Os contornos (fetch) e o contorno do Brasil (import) chegam depois.
    await vi.waitFor(() => expect(poligonos()).toHaveLength(3));
    await esperar();
    return host;
  }

  const mapaVivo = () => leaflet.vivos().find((m) => m.elemento.id === "map");
  const poligonos = () =>
    leaflet
      .desenhadas(mapaVivo() || { camadas: new Set() }, "geoJSON")
      .filter((c) => c.opcoes?.className === "mapa-simples__dsei");
  const poligono = (numero) =>
    poligonos().find((c) => c.latlng.properties.numero === numero);
  const linha = (numero) =>
    host.querySelector(`.mapa-si-territorio[data-numero="${numero}"]`);
  // O realce que vem do mapa chega à lista depois de uma pequena espera.
  const esperarOrealceDaLista = () =>
    act(
      () =>
        new Promise((pronto) =>
          setTimeout(pronto, ESPERA_DO_REALCE_NA_LISTA + 30),
        ),
    );

  beforeEach(() => {
    esquecerContornosDosDseis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => CONTORNOS,
      })),
    );
    window.matchMedia = (consulta) => ({
      matches: consulta.includes("hover"),
      addEventListener() {},
      removeEventListener() {},
    });
    leaflet = criarLeafletFalso({
      aoCriarMapa: (m) => {
        // O que o seletor do fundo faz ao nascer o mapa, com "Mapa DSEIs" guardado.
        m.__agsusDesiredBaseMapMode = "simple";
      },
    });
    globalThis.L = leaflet.L;
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    host?.remove();
    host = null;
    delete globalThis.L;
    delete window.matchMedia;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("Mapa DSEIs", () => {
    it("desenha os DSEIs com número; sedes e CASAIs começam ligadas (11/11/2026)", async () => {
      await montar();
      const mapa = mapaVivo();
      expect(fetch).toHaveBeenCalledWith(
        "/data/contornos-dos-dseis.json",
        expect.anything(),
      );
      const rotulos = leaflet
        .desenhadas(mapa, "marker")
        .map((m) => m.opcoes.icon?.html?.textContent)
        .filter(Boolean);
      expect(rotulos).toEqual(["1", "16", "34"]);
      expect(leaflet.desenhadas(mapa, "circleMarker").length).toBeGreaterThan(
        0,
      );
      await clicar(host.querySelector(".mapa-simples__pontos"));
      expect(leaflet.desenhadas(mapa, "circleMarker")).toHaveLength(0);
    });

    it("começa na cor do DSEI; % preenchidas colore pelos números da lista e marca o DSEI sem dado", async () => {
      await montar();
      expect(poligono(16).elemento.style.fill).toBe(
        "var(--mapa-simples-dsei-16)",
      );
      await clicar(host.querySelector('input[value="preenchidas"]'));
      expect(localStorage.getItem("agsus_mapa_simples_colorir_v2")).toBe(
        "preenchidas",
      );
      expect(poligono(34).elemento.style.fill).toBe(
        "var(--mapa-simples-seq-2)",
      );
      expect(poligono(1).elemento.style.fill).toBe("var(--mapa-simples-seq-5)");
      expect(poligono(16).elemento.style.fill).toBe(
        "var(--mapa-simples-sem-dado)",
      );
      const legenda = host.querySelector(".mapa-simples__faixas");
      expect(legenda.getAttribute("aria-label")).toBe(
        "Faixas de % preenchidas",
      );
      expect(legenda.textContent).toContain("80–100%");
      expect(legenda.textContent).toContain("sem dado");
    });

    it("a lista mostra o número do DSEI; focar a linha realça o polígono e vice-versa", async () => {
      await montar();
      expect(
        linha(34).querySelector(".mapa-si-territorio__numero").textContent,
      ).toBe("34");
      expect(linha(34).getAttribute("aria-label")).toBe(
        "Abrir o DSEI 34, Yanomami: 40 vagas, 25% preenchidas",
      );

      await act(async () => {
        linha(34).dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      });
      expect(poligono(34).elemento.classList.contains("is-realce")).toBe(true);
      expect(poligono(1).elemento.classList.contains("is-realce")).toBe(false);

      await act(async () => poligono(1).fire("mouseover"));
      // O polígono acende na hora; a linha, depois de o mouse parar no DSEI.
      expect(poligono(1).elemento.classList.contains("is-realce")).toBe(true);
      await esperarOrealceDaLista();
      expect(linha(1).classList.contains("is-realce")).toBe(true);
      expect(linha(34).classList.contains("is-realce")).toBe(false);

      await act(async () => poligono(1).fire("mouseout"));
      await esperarOrealceDaLista();
      expect(linha(1).classList.contains("is-realce")).toBe(false);
    });

    /*
    O bug: passar o cursor pelo mapa fazia a lista "piscar". Cada polígono
    atravessado trocava o realce, redesenhava as linhas e rolava a lista até
    a linha do DSEI (`scrollIntoView`). Agora o mouse no mapa não rola, não
    reordena nem remonta a lista; só acende a linha de quem parou nele.
  */
    it("passar o cursor pelo mapa não rola, não reordena nem remonta a lista", async () => {
      await montar();
      const rolar = vi.fn();
      HTMLElement.prototype.scrollIntoView = rolar;
      const lista = host.querySelector(".mapa-si-lista");
      const antes = [...host.querySelectorAll(".mapa-si-territorio")];
      const mudancas = [];
      const observador = new MutationObserver((m) => mudancas.push(...m));
      observador.observe(host.querySelector(".mapa-si-lista__itens"), {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      const resumo = () =>
        mudancas
          .map((m) => [m.type, m.attributeName, m.target.dataset?.numero])
          .sort();

      try {
        // Atravessar polígonos a caminho de outro lugar: a lista fica intacta.
        for (const numero of [34, 16, 1]) {
          await act(async () => poligono(numero).fire("mouseover"));
          await act(async () => poligono(numero).fire("mouseout"));
        }
        await esperarOrealceDaLista();
        expect(resumo()).toEqual([]);

        // Parar num DSEI: só a classe da linha dele muda.
        await act(async () => poligono(34).fire("mouseover"));
        await esperarOrealceDaLista();
        expect(linha(34).classList.contains("is-realce")).toBe(true);
        expect(resumo()).toEqual([["attributes", "class", "34"]]);

        // O inverso: o mouse na lista acende o polígono e só troca a classe das
        // duas linhas envolvidas.
        mudancas.length = 0;
        await act(async () => {
          linha(1).dispatchEvent(
            new MouseEvent("mouseover", { bubbles: true, relatedTarget: null }),
          );
        });
        await act(async () => {});
        expect(poligono(1).elemento.classList.contains("is-realce")).toBe(true);
        expect(resumo()).toEqual([
          ["attributes", "class", "1"],
          ["attributes", "class", "34"],
        ]);

        const depois = [...host.querySelectorAll(".mapa-si-territorio")];
        expect(depois).toHaveLength(antes.length);
        depois.forEach((botao, i) => expect(botao).toBe(antes[i]));
        expect(rolar).not.toHaveBeenCalled();
        expect(lista.scrollTop).toBe(0);
      } finally {
        observador.disconnect();
        delete HTMLElement.prototype.scrollIntoView;
      }
    });

    it("o clique no polígono abre o DSEI, como a linha da lista; a dica traz os números", async () => {
      const aoEscolherDsei = vi.fn();
      await montar({ aoEscolherDsei });
      await act(async () => poligono(34).fire("click"));
      expect(aoEscolherDsei).toHaveBeenCalledWith(LMAP.dsei[1]);
      await clicar(linha(1));
      expect(aoEscolherDsei).toHaveBeenLastCalledWith(LMAP.dsei[0]);
      expect(poligono(34).dica().textContent).toBe(
        "34 · Yanomami — 40 vagas, 30 ociosas, 25% preenchidas",
      );
      expect(poligono(16).dica().textContent).toBe(
        "16 · Leste de Roraima — sem dado",
      );
    });

    /*
    O bug: o interruptor era o chip das fases das terras
    (`.mapa-si-terra-fase`), que desligado (`aria-pressed="false"`) sai
    riscado e esmaecido. (Desde 11/11/2026 os pontos começam ligados.)
  */
    it("'Sedes e CASAIs' é um liga/desliga com aria-pressed, não o chip riscado das fases", async () => {
      await montar();
      const legenda = host.querySelector(".mapa-simples__legenda");
      const pontos = legenda.querySelector(".mapa-simples__pontos");
      expect(pontos.tagName).toBe("BUTTON");
      expect(pontos.textContent).toBe("Sedes e CASAIs");
      expect(pontos.getAttribute("aria-pressed")).toBe("true");
      expect(legenda.querySelector(".mapa-si-terra-fase")).toBeNull();
    });

    /*
    As dicas se acumulavam: o realce subia o próprio polígono
    (`bringToFront`, que reanexa o <path>) no meio do `mouseover`, o
    navegador perdia o `mouseout` e a dica "sticky" não fechava — passando
    o mouse pelo mapa, dez caixas abertas. Agora o polígono não sai do lugar,
    o traço do realce vai num pane próprio e só o DSEI realçado fica com dica.
  */
    it("só o DSEI realçado fica com a dica; o realce não reanexa o polígono", async () => {
      await montar();
      const mapa = mapaVivo();
      const subiu = vi.fn();
      for (const p of poligonos()) {
        p.bringToFront = subiu;
        p.closeTooltip = vi.fn();
      }
      const tracos = () =>
        [...mapa.camadas].filter(
          (c) => c.opcoes?.className === "mapa-simples__realce",
        );

      // Do 34 para o 1 sem `mouseout` no meio (o que o navegador perdia).
      await act(async () => poligono(34).fire("mouseover"));
      for (const p of poligonos()) p.closeTooltip.mockClear();
      await act(async () => poligono(1).fire("mouseover"));
      expect(poligono(34).closeTooltip).toHaveBeenCalled();
      expect(poligono(1).closeTooltip).not.toHaveBeenCalled();
      expect(subiu).not.toHaveBeenCalled();
      expect(tracos()).toHaveLength(1);
      expect(tracos()[0].latlng.properties.numero).toBe(1);
      expect(tracos()[0].opcoes).toMatchObject({
        pane: "agsus-mapa-simples-realce",
        interactive: false,
      });

      await act(async () => poligono(1).fire("mouseout"));
      expect(poligono(1).closeTooltip).toHaveBeenCalled();
      expect(tracos()).toHaveLength(0);
    });

    it("'Sedes e CASAIs' tira e devolve os pontos; voltar ao Mapa tira os polígonos", async () => {
      await montar();
      const mapa = mapaVivo();
      const pontos = host.querySelector(".mapa-simples__pontos");
      expect(pontos.getAttribute("aria-pressed")).toBe("true");
      await clicar(pontos);
      expect(pontos.getAttribute("aria-pressed")).toBe("false");
      expect(leaflet.desenhadas(mapa, "circleMarker")).toHaveLength(0);
      await clicar(pontos);
      expect(pontos.getAttribute("aria-pressed")).toBe("true");
      expect(leaflet.desenhadas(mapa, "circleMarker").length).toBeGreaterThan(
        0,
      );

      await act(async () => {
        mapa.elemento.dispatchEvent(
          new CustomEvent(EVENTO_DO_FUNDO, {
            bubbles: true,
            detail: { mode: "map" },
          }),
        );
      });
      expect(poligonos()).toHaveLength(0);
      expect(host.querySelector(".mapa-simples__legenda")).toBeNull();
      expect(host.querySelector(".mapa-si-territorio__numero")).toBeNull();
    });
  });
});

bloco("modulos/modo-de-edicao", () => {
  // O editor chega sob demanda (fora do pacote principal): carregado antes, desenha na hora.
  beforeAll(async () => {
    await carregarEditorDeCoordenadas();
  });

  /*
  O modo de edição de coordenadas (src/modulos/editor-de-coordenadas/
  modo-de-edicao.jsx) nos dois mapas: "Coordenadas" leva o painel para a tela
  inteira com o editor flutuando sobre o mapa; "Recolher editor" deixa a faixa
  sem desmontar o editor; o enquadramento desconta o painel (paddings do
  Leaflet); Esc e "Voltar à lista" restauram o layout de sempre.
*/
  const lmap = {
    dsei: [
      {
        k: "A",
        n: "Distrito A",
        lat: -10,
        lon: -50,
        ufs: ["MT"],
        polos: [{ n: "Polo A", cod: 7, lat: -11, lon: -51 }],
      },
    ],
  };
  const admin = { ativo: true, perfil: "admin", admin_global: true };

  let host, raiz, leaflet, supabase;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    raiz = createRoot(host);
    leaflet = criarLeafletFalso();
    globalThis.L = leaflet.L;
    const original = leaflet.L.marker;
    leaflet.L.marker = (...args) => {
      const pin = original(...args);
      pin.getLatLng = () => ({ lat: pin.latlng[0], lng: pin.latlng[1] });
      return pin;
    };
    supabase = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: "teste" } },
          error: null,
        }),
      },
      rpc: vi.fn(async () => ({ data: [], error: null })),
    };
  });
  afterEach(async () => {
    await act(async () => raiz.unmount());
    host.remove();
    delete globalThis.L;
    document.body.style.overflow = "";
  });

  const aguardar = () =>
    act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 0));
    });
  // Só os botões do painel à vista (o nacional fica escondido com o DSEI aberto).
  const botao = (texto) =>
    [...host.querySelectorAll(".mapa-si-painel:not([hidden]) button")].find(
      (b) => b.textContent.replace(/\s+/g, " ").trim() === texto,
    );
  const item = (nome) =>
    [...host.querySelectorAll(".mapa-si-coordenadas__item")].find(
      (b) => b.querySelector(".mapa-si-coordenadas__nome").textContent === nome,
    );
  const painel = () => host.querySelector(".mapa-si-painel:not([hidden])");
  const editor = () => host.querySelector(".mapa-si-editor");
  const mapaVivo = (id) => leaflet.vivos().find((m) => m.elemento.id === id);
  const chamadasDe = (m, nome) => m.chamadas.filter(([n]) => n === nome);
  const retangulo = (left, top, right, bottom) => () => ({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  });
  const esc = () => teclar(document, "Escape", { cancelable: true });

  /*
  A Saúde Indígena não tem mais editor (17/11/2026): os pontos vêm do SIGEPSI,
  e a correção é feita lá.
*/
  describe("o mapa da Saúde Indígena não edita coordenadas", () => {
    it("nem o administrador vê Coordenadas, no mapa nacional ou no do DSEI", async () => {
      await act(async () =>
        raiz.render(
          createElement(
            StrictMode,
            null,
            createElement(MapaSaudeIndigena, {
              lmap,
              casaisNacionais: [],
              dseiSelecionado: "A",
            }),
          ),
        ),
      );
      await aguardar();
      expect(host.querySelector(".mapa-si")).not.toBeNull();
      expect(
        [...host.querySelectorAll("button")].some(
          (b) => b.textContent.trim() === "Coordenadas",
        ),
      ).toBe(false);
      expect(host.querySelector(".mapa-si-painel--editando")).toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("modo de edição no mapa de Projetos", () => {
    const LUGARES = [
      {
        lugar: "uf:PA",
        municipio_uf: null,
        uf: "PA",
        nivel: "uf",
        latitude: -2.9668,
        longitude: -49.7614,
        coordenada_origem: "CENTRO_UF",
        vagas_edital: 1,
        projetos: ["CCE"],
        editais: [{ edital: "97/2025", projeto: "CCE", vagas: 1 }],
      },
    ];
    const PENDENCIAS = [
      {
        lugar: "uf:PA",
        nome: "Pará",
        uf: "PA",
        motivo_tipo: "ESCRITORIO_SO_UF",
        motivo: "O edital só diz a UF.",
        conferido: false,
        candidatos: [
          { f: "LUGAR", n: "Belém/PA", lat: -1.4554, lon: -48.4898 },
        ],
      },
    ];

    async function montarProjetos(pendencias = PENDENCIAS) {
      supabase.rpc.mockImplementation(async (nome) => {
        if (nome === RPC_DOS_MUNICIPIOS) return { data: LUGARES, error: null };
        if (nome === "listar_pendencias_coordenada_mapa_projetos")
          return { data: pendencias, error: null };
        return { data: [], error: null };
      });
      const carregador = criarCarregadorDeMunicipios({
        obterSupabase: () => supabase,
      });
      await esperar(() => carregador.carregar("projetos"));
      await act(async () =>
        raiz.render(
          createElement(MapaDeProjetos, {
            area: "projetos",
            carregadoEm: 1,
            carregador,
            perfil: admin,
            supabase,
          }),
        ),
      );
      await aguardar();
    }

    it("entra no modo, recolhe, enquadra com o painel descontado e fecha restaurando", async () => {
      await montarProjetos();
      const mapa = mapaVivo("mapaDosProjetos");
      await clicar(botao("Coordenadas"));
      await aguardar();
      expect(painel().classList.contains("mapa-si-painel--editando")).toBe(
        true,
      );
      expect(editor().id).toBe("mapaDosProjetos-painel-lateral");
      expect(host.querySelector(".mapa-projetos-lugar")).toBeNull();
      expect(botao("Tela cheia")).toBeUndefined();
      expect(document.body.style.overflow).toBe("hidden");
      mapa.elemento.getBoundingClientRect = retangulo(0, 60, 1240, 760);
      editor().getBoundingClientRect = retangulo(828, 72, 1228, 748);
      await clicar(item("Pará (estado)"));
      await aguardar();
      expect(chamadasDe(mapa, "flyToBounds").at(-1)[2]).toMatchObject({
        paddingTopLeft: [104, 104],
        paddingBottomRight: [484, 72],
      });
      await clicar(botao("Recolher editor"));
      expect(editor().classList.contains("mapa-si-editor--recolhido")).toBe(
        true,
      );
      await clicar(botao("Abrir editor"));
      await esc();
      expect(editor()).toBeNull();
      expect(painel().classList.contains("mapa-si-painel--editando")).toBe(
        false,
      );
      expect(host.querySelector(".mapa-projetos-lugar")).toBeTruthy();
      expect(document.body.style.overflow).toBe("");
      expect(botao("Tela cheia")).toBeTruthy();
    });

    it("no celular, desconta a folha de baixo; ponto sem sugestão centra na área livre", async () => {
      await montarProjetos([{ ...PENDENCIAS[0], candidatos: [] }]);
      await clicar(botao("Coordenadas"));
      await aguardar();
      const mapa = mapaVivo("mapaDosProjetos");
      mapa.elemento.getBoundingClientRect = retangulo(14, 100, 376, 831);
      editor().getBoundingClientRect = retangulo(14, 578, 376, 831);
      await clicar(item("Pará (estado)"));
      await aguardar();
      const voo = chamadasDe(mapa, "flyToBounds").at(-1);
      expect(voo[1].pontos).toEqual([
        [-2.9668, -49.7614],
        [-2.9668, -49.7614],
      ]);
      expect(voo[2]).toMatchObject({
        paddingTopLeft: [104, 104],
        paddingBottomRight: [72, 253 + 72],
      });
      expect(chamadasDe(mapa, "flyTo")).toHaveLength(0);
    });

    it("fechar restaura o layout de sempre: lista, rolagem, tela cheia e invalidateSize", async () => {
      document.body.style.overflow = "auto";
      await montarProjetos();
      const mapa = mapaVivo("mapaDosProjetos");
      await clicar(botao("Coordenadas"));
      await aguardar();
      const antes = chamadasDe(mapa, "invalidateSize").length;
      await clicar(botao("Voltar à lista"));
      expect(painel().classList.contains("mapa-si-painel--editando")).toBe(
        false,
      );
      expect(editor()).toBeNull();
      expect(host.querySelector(".mapa-projetos-lugar")).toBeTruthy();
      expect(botao("Coordenadas").getAttribute("aria-pressed")).toBe("false");
      expect(botao("Tela cheia")).toBeTruthy();
      expect(document.body.style.overflow).toBe("auto");
      expect(chamadasDe(mapa, "invalidateSize").length).toBeGreaterThan(antes);
      // O botão do cabeçalho também abre e fecha.
      await clicar(botao("Coordenadas"));
      expect(editor()).not.toBeNull();
      await clicar(botao("Coordenadas"));
      expect(editor()).toBeNull();
      expect(document.body.style.overflow).toBe("auto");
    });

    it("Esc num campo não fecha o editor; fora dele, fecha antes da tela cheia", async () => {
      await montarProjetos();
      await clicar(botao("Tela cheia"));
      await clicar(botao("Coordenadas"));
      await aguardar();
      await teclar(host.querySelector('input[type="search"]'), "Escape", {
        cancelable: true,
      });
      expect(editor()).not.toBeNull();
      await esc();
      expect(editor()).toBeNull();
      expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
      expect(document.body.style.overflow).toBe("hidden");
    });
  });
});

bloco("modulos/ordem-dos-territorios", () => {
  /*
  "Ordenar" da lista de territórios ao lado do mapa nacional da Saúde
  Indígena: cada ordem, o título que acompanha, o padrão por fundo (Vagas no
  Mapa, Nº do DSEI no Mapa DSEIs) e a escolha guardada no navegador, que
  passa a valer para os dois.
*/

  const dsei = (k, n, lat, lon, pop) => ({
    k,
    n,
    lat,
    lon,
    pop,
    ufs: [],
    polos: [],
  });

  const LMAP = {
    dsei: [
      dsei("ALAGOAS E SERGIPE", "Alagoas e Sergipe", -9.6, -35.7, 12000),
      dsei("YANOMAMI", "Yanomami", 2.81, -60.67, 30000),
      dsei("LESTE DE RORAIMA", "Leste de Roraima", 2.82, -60.67, 50000),
    ],
  };

  /*
  Vagas: Yanomami 40 (30 ociosas, 25%), Alagoas e Sergipe 10 (1 ociosa, 90%),
  Leste de Roraima sem vaga. Números do mapa: 1, 16 e 34.
*/
  const LINHAS = [
    {
      unidade: "DSEI Alagoas e Sergipe",
      vagas_total: 10,
      contratados: 9,
      status: "Concluído",
    },
    {
      unidade: "DSEI Yanomami",
      vagas_total: 40,
      contratados: 10,
      status: "Concluído",
    },
  ];

  const CONTORNOS = {
    type: "FeatureCollection",
    features: [
      [1, -36, -10],
      [16, -61, 2],
      [34, -63, 2],
    ].map(([numero, x, y]) => ({
      type: "Feature",
      properties: { numero, nome: "x", rotulo: [y + 0.5, x + 0.5] },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [x, y],
            [x + 1, y],
            [x + 1, y + 1],
            [x, y + 1],
            [x, y],
          ],
        ],
      },
    })),
  };

  let raiz = null;
  let host = null;
  let leaflet = null;

  function preparar({ simples = false } = {}) {
    leaflet = criarLeafletFalso(
      simples
        ? {
            aoCriarMapa: (m) => {
              m.__agsusDesiredBaseMapMode = "simple";
            },
          }
        : {},
    );
    globalThis.L = leaflet.L;
  }

  async function montar() {
    host = document.createElement("div");
    document.body.append(host);
    raiz = createRoot(host);
    await act(async () =>
      raiz.render(
        createElement(
          StrictMode,
          null,
          createElement(MapaSaudeIndigena, {
            lmap: LMAP,
            redeCnes: { rede: {}, nac: [] },
            linhas: LINHAS,
          }),
        ),
      ),
    );
    await esperar();
    return host;
  }

  const nomes = () =>
    [...host.querySelectorAll(".mapa-si-territorio strong")].map(
      (s) => s.textContent,
    );
  const titulo = () => host.querySelector("#map-lista").textContent;
  const seletor = () => host.querySelector(".mapa-si-lista__ordem select");
  const mapaVivo = () => leaflet.vivos().find((m) => m.elemento.id === "map");

  async function trocarFundo(mode) {
    await act(async () => {
      mapaVivo().elemento.dispatchEvent(
        new CustomEvent(EVENTO_DO_FUNDO, { bubbles: true, detail: { mode } }),
      );
    });
  }

  beforeEach(() => {
    localStorage.clear();
    esquecerContornosDosDseis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => CONTORNOS,
      })),
    );
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    host?.remove();
    host = null;
    delete globalThis.L;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("Ordenar a lista de territórios", () => {
    it("o seletor é um select com rótulo acessível e as cinco ordens", async () => {
      preparar();
      await montar();
      const select = seletor();
      expect(select.getAttribute("aria-label")).toBe("Ordenar os territórios");
      expect([...select.options].map((o) => o.textContent)).toEqual([
        "Vagas",
        "A–Z",
        "Nº do DSEI",
        "% preenchidas",
        "Ociosas",
      ]);
    });

    it("no Mapa, o padrão é por vagas", async () => {
      preparar();
      await montar();
      expect(seletor().value).toBe("vagas");
      expect(titulo()).toBe("Territórios por vagas");
      expect(nomes()).toEqual([
        "Yanomami",
        "Alagoas e Sergipe",
        "Leste de Roraima",
      ]);
      expect(localStorage.getItem(CHAVE_DA_ORDEM)).toBeNull();
    });

    it.each([
      [
        "alfabetica",
        "Territórios — A–Z",
        ["Alagoas e Sergipe", "Leste de Roraima", "Yanomami"],
      ],
      [
        "numero",
        "Territórios por nº do DSEI",
        ["Alagoas e Sergipe", "Leste de Roraima", "Yanomami"],
      ],
      [
        "preenchidas",
        "Territórios por % preenchidas",
        ["Alagoas e Sergipe", "Yanomami", "Leste de Roraima"],
      ],
      [
        "ociosas",
        "Territórios por vagas ociosas",
        ["Yanomami", "Alagoas e Sergipe", "Leste de Roraima"],
      ],
      [
        "vagas",
        "Territórios por vagas",
        ["Yanomami", "Alagoas e Sergipe", "Leste de Roraima"],
      ],
    ])(
      "ordem %s: título e linhas acompanham",
      async (ordem, esperado, linhas) => {
        preparar();
        await montar();
        await escolher(seletor(), ordem);
        expect(titulo()).toBe(esperado);
        expect(nomes()).toEqual(linhas);
        // Fora do Mapa DSEIs, o número da linha é a posição na nova ordem.
        expect(
          [...host.querySelectorAll(".mapa-si-territorio__posicao")].map(
            (p) => p.textContent,
          ),
        ).toEqual(["1", "2", "3"]);
      },
    );

    it("no Mapa DSEIs, o padrão é pelo nº do DSEI; ao voltar ao Mapa, por vagas", async () => {
      preparar({ simples: true });
      await montar();
      await vi.waitFor(() =>
        expect(
          host.querySelector(".mapa-si-territorio__numero"),
        ).not.toBeNull(),
      );
      expect(seletor().value).toBe("numero");
      expect(titulo()).toBe("Territórios por nº do DSEI");
      expect(
        [...host.querySelectorAll(".mapa-si-territorio")].map(
          (b) => b.dataset.numero,
        ),
      ).toEqual(["1", "16", "34"]);

      await trocarFundo("map");
      expect(seletor().value).toBe("vagas");
      expect(nomes()).toEqual([
        "Yanomami",
        "Alagoas e Sergipe",
        "Leste de Roraima",
      ]);
    });

    it("guarda a escolha no navegador, e ela vale para os dois fundos", async () => {
      preparar();
      await montar();
      await escolher(seletor(), "alfabetica");
      expect(localStorage.getItem(CHAVE_DA_ORDEM)).toBe("alfabetica");

      await trocarFundo("simple");
      expect(seletor().value).toBe("alfabetica");
      expect(titulo()).toBe("Territórios — A–Z");

      // Montado de novo (outra visita), a escolha volta.
      await act(async () => raiz.unmount());
      raiz = null;
      host.remove();
      preparar({ simples: true });
      await montar();
      expect(seletor().value).toBe("alfabetica");
      expect(nomes()).toEqual([
        "Alagoas e Sergipe",
        "Leste de Roraima",
        "Yanomami",
      ]);
    });

    it("sem armazenamento, a escolha vale até recarregar", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("bloqueado");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("bloqueado");
      });
      preparar();
      await montar();
      expect(seletor().value).toBe("vagas");
      await escolher(seletor(), "ociosas");
      expect(seletor().value).toBe("ociosas");
    });
  });

  describe("ordenarTerritorios", () => {
    const t = (n, vagas, ociosas) => ({
      dsei: { k: n.toUpperCase(), n },
      chave: n,
      vagas,
      ociosas,
      preenchidas: vagas ? Math.round(((vagas - ociosas) / vagas) * 100) : 0,
      posicao: 0,
    });

    it("A–Z respeita os acentos do português", () => {
      const lista = [
        t("Médio Rio Purus", 1, 0),
        t("Xavante", 1, 0),
        t("Maranhão", 1, 0),
        t("Manaus", 1, 0),
      ];
      expect(
        ordenarTerritorios(lista, "alfabetica").map((x) => x.dsei.n),
      ).toEqual(["Manaus", "Maranhão", "Médio Rio Purus", "Xavante"]);
    });

    it("empate: desempata pelo nome", () => {
      const lista = [t("Xingu", 10, 5), t("Bahia", 4, 2), t("Ceará", 10, 5)];
      expect(ordenarTerritorios(lista, "ociosas").map((x) => x.dsei.n)).toEqual(
        ["Ceará", "Xingu", "Bahia"],
      );
      expect(
        ordenarTerritorios(lista, "preenchidas").map((x) => x.dsei.n),
      ).toEqual(["Bahia", "Ceará", "Xingu"]);
    });

    it("'Vagas' mantém a ordem de chegada e não muda a lista original", () => {
      const lista = [t("Xingu", 10, 5), t("Bahia", 4, 2)];
      const copia = [...lista];
      expect(ordenarTerritorios(lista, "vagas")).toEqual(lista);
      ordenarTerritorios(lista, "alfabetica");
      expect(lista).toEqual(copia);
    });
  });
});

bloco("recuo-de-azulejo", () => {
  /*
  "QUANDO DOU MUITO ZOOM A IMAGEM QUEBRA"

  No satélite, acima do zoom 17 nos territórios indígenas, a Esri devolvia um
  azulejo pronto escrito "Map data not yet available" (HTTP 200, 2.521 bytes).
  Medido no Xingu, no Yanomami e no Vale do Javari; em Maceió há foto até 19.
*/
  describe("a conta do recuo", () => {
    it("sem recuo, é o próprio azulejo", () => {
      expect(azulejoDoRecuo({ x: 10, y: 20, z: 18 }, 0)).toEqual({
        x: 10,
        y: 20,
        z: 18,
        escala: 1,
        dx: 0,
        dy: 0,
      });
    });

    it("um nível acima, cada azulejo é um quarto do de cima", () => {
      // (11, 21) no zoom 18 é o quadrante inferior direito de (5, 10) no 17.
      expect(azulejoDoRecuo({ x: 11, y: 21, z: 18 }, 1)).toEqual({
        x: 5,
        y: 10,
        z: 17,
        escala: 2,
        dx: 1,
        dy: 1,
      });
      expect(azulejoDoRecuo({ x: 10, y: 20, z: 18 }, 1)).toMatchObject({
        dx: 0,
        dy: 0,
      });
    });

    it("dois níveis acima, um dezasseis avos", () => {
      expect(azulejoDoRecuo({ x: 23, y: 6, z: 19 }, 2)).toEqual({
        x: 5,
        y: 1,
        z: 17,
        escala: 4,
        dx: 3,
        dy: 2,
      });
    });

    it("pára no máximo de recuos e no zoom mínimo", () => {
      const c = { x: 0, y: 0, z: 18 };
      expect(podeRecuar(c, 0)).toBe(true);
      expect(podeRecuar(c, RECUO_MAXIMO)).toBe(false);
      expect(podeRecuar({ x: 0, y: 0, z: 1 }, 0, 1)).toBe(false);
    });

    it("desliga o aviso em forma de imagem, sem duplicar", () => {
      expect(semAzulejoDeAviso("https://x/tile/1/2/3")).toBe(
        "https://x/tile/1/2/3?blankTile=false",
      );
      expect(semAzulejoDeAviso("https://x/tile?a=1")).toBe(
        "https://x/tile?a=1&blankTile=false",
      );
      expect(semAzulejoDeAviso("https://x/t?blankTile=false")).toBe(
        "https://x/t?blankTile=false",
      );
    });
  });

  /*
  Um Leaflet de mentira, só com o que a camada usa: `TileLayer.extend`, o
  molde de URL e o tamanho do azulejo. O jsdom não carrega imagem nenhuma; os
  eventos de carga e de erro disparam-se à mão, que é o que interessa medir.
*/
  function leafletDeMentira() {
    const removidos = [];
    const TileLayer = {
      prototype: {
        _removeTile(key) {
          removidos.push(key);
        },
      },
      extend(proto) {
        function Camada(url, options) {
          this._url = url;
          this.options = options;
          this._tiles = {};
        }
        Camada.prototype = Object.assign(Object.create(TileLayer.prototype), {
          getTileSize: () => ({ x: 256, y: 256 }),
          ...proto,
        });
        return Camada;
      },
    };
    return {
      removidos,
      TileLayer,
      Util: {
        template: (molde, dados) =>
          molde.replace(/\{(\w+)\}/g, (_, chave) => dados[chave]),
        extend: Object.assign,
        emptyImageUrl: "data:,",
      },
    };
  }

  const URL_ESRI = "https://esri/tile/{z}/{y}/{x}";

  describe("a camada de satélite com recuo", () => {
    it("pede o azulejo com o aviso desligado", () => {
      const L = leafletDeMentira();
      const camada = criarCamadaComRecuo(L, URL_ESRI, { minZoom: 0 });
      const caixa = camada.createTile({ x: 11, y: 21, z: 18 }, vi.fn());
      expect(caixa.firstChild.src).toBe(
        "https://esri/tile/18/21/11?blankTile=false",
      );
    });

    /*
    O caso do print: zoom 18 no Xingu, sem foto. Sobe para o 17, amplia 2x e
    desloca até o quadrante certo — e o Leaflet não fica a saber de erro
    nenhum, senão ao quarto trocava o satélite pelo mapa comum.
  */
    it("sem foto no nível pedido, usa a do nível de cima, recortada", () => {
      const L = leafletDeMentira();
      const done = vi.fn();
      const camada = criarCamadaComRecuo(L, URL_ESRI, { minZoom: 0 });
      const caixa = camada.createTile({ x: 11, y: 21, z: 18 }, done);
      const img = caixa.firstChild;

      img.onerror();

      expect(img.src).toBe("https://esri/tile/17/10/5?blankTile=false");
      expect(img.style.width).toBe("512px");
      expect(img.style.height).toBe("512px");
      expect(img.style.transform).toBe("translate(-256px, -256px)");
      expect(caixa.style.overflow).toBe("hidden");
      expect(done).not.toHaveBeenCalled();

      img.onload();
      expect(done).toHaveBeenCalledWith(null, caixa);
      expect(caixa.complete).toBe(true);
    });

    it("só avisa erro depois de esgotar o recuo", () => {
      const L = leafletDeMentira();
      const done = vi.fn();
      const camada = criarCamadaComRecuo(L, URL_ESRI, { minZoom: 0 });
      const img = camada.createTile({ x: 100, y: 100, z: 18 }, done).firstChild;

      for (let i = 0; i < RECUO_MAXIMO; i += 1) {
        img.onerror();
        expect(done).not.toHaveBeenCalled();
      }
      img.onerror();
      expect(done).toHaveBeenCalledTimes(1);
      expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it("a imagem não é encolhida pelo CSS global de imagens", () => {
      const L = leafletDeMentira();
      const img = criarCamadaComRecuo(L, URL_ESRI, {}).createTile(
        { x: 0, y: 0, z: 18 },
        vi.fn(),
      ).firstChild;
      expect(img.style.maxWidth).toBe("none");
    });

    it("ao remover o azulejo, o pedido em curso é cancelado", () => {
      const L = leafletDeMentira();
      const camada = criarCamadaComRecuo(L, URL_ESRI, {});
      const caixa = camada.createTile({ x: 0, y: 0, z: 18 }, vi.fn());
      camada._tiles["0:0:18"] = { el: caixa };
      camada._removeTile("0:0:18");
      expect(caixa.firstChild.getAttribute("src")).toBe("data:,");
      expect(caixa.firstChild.onload).toBeNull();
      expect(L.removidos).toEqual(["0:0:18"]);
    });
  });
});

bloco("terras-no-mapa-simples", () => {
  /*
  AS TERRAS INDÍGENAS NO "MAPA DSEIs"

  O print da produção: no Mapa DSEIs, as terras (manchas e pontinhos cor
  de terra) por cima dos DSEIs chapados; no Mapa, o botão "Terras Indígenas"
  com `aria-pressed="false"` e as terras desenhadas. Quem desligava as terras
  ao entrar no Mapa DSEIs era um efeito do React, que só soube do modo
  depois de o mapa nascer e de cada troca avisada — duas fontes de verdade
  para o mesmo estado.

  A regra agora mora na camada (indigenous-territories-layer.ts): ela lê o
  modo pedido ao seletor quando o mapa nasce e segue o aviso de troca
  (`agsus:map-base-layer-changed`) no mesmo instante. No Mapa DSEIs as
  terras começam desligadas e o botão liga e desliga só enquanto ele durar;
  ao sair, volta a preferência guardada do Mapa/Satélite.
*/

  const CHAVE = "agsus_map_terras_indigenas_v1";

  function camada() {
    const filhas = new Set();
    const c = {
      addTo(alvo) {
        alvo.addLayer(c);
        return c;
      },
      addLayer: (f) => filhas.add(f),
      removeLayer: (f) => filhas.delete(f),
      clearLayers: () => filhas.clear(),
      getLayers: () => [...filhas],
      eachLayer: (fn) => filhas.forEach(fn),
      addData: () => c,
      setStyle: () => c,
      on: () => c,
      bindTooltip: () => c,
    };
    return c;
  }

  function leafletFalso(modoPedido) {
    const tileLayer = () => camada();
    tileLayer.wms = () => camada();
    return {
      map(elemento) {
        const ouvintes = {};
        const camadas = new Set();
        const panes = new Map();
        const canto = document.createElement("div");
        elemento.append(canto);
        const mapa = {
          // O seletor do fundo (map-base-layer-switcher.ts) grava o modo pedido.
          __agsusDesiredBaseMapMode: modoPedido,
          getContainer: () => elemento,
          getPane: (nome) => panes.get(nome),
          createPane: (nome) => {
            const pane = document.createElement("div");
            panes.set(nome, pane);
            return pane;
          },
          on(eventos, fn) {
            for (const e of eventos.split(" ")) (ouvintes[e] ||= []).push(fn);
            return mapa;
          },
          fire(evento, dados) {
            for (const fn of ouvintes[evento] || []) fn(dados);
            return mapa;
          },
          whenReady: () => mapa,
          addLayer: (c) => camadas.add(c),
          removeLayer: (c) => camadas.delete(c),
          hasLayer: (c) => camadas.has(c),
          getZoom: () => 4.5,
          canto,
        };
        return mapa;
      },
      tileLayer,
      geoJSON: () => camada(),
      layerGroup: () => camada(),
      circleMarker: () => camada(),
      marker: () => camada(),
      divIcon: (o) => o,
      control: () => {
        const controle = {
          addTo(mapa) {
            mapa.canto.append(controle.onAdd());
            return controle;
          },
        };
        return controle;
      },
      DomUtil: {
        create(tag, classe, pai) {
          const el = document.createElement(tag);
          el.className = classe;
          pai?.append(el);
          return el;
        },
      },
      DomEvent: {
        disableClickPropagation: () => {},
        disableScrollPropagation: () => {},
      },
    };
  }

  let elemento;
  let mapa;

  async function montar(modoPedido = "map") {
    window.L = leafletFalso(modoPedido);
    const { installIndigenousTerritoriesLayer } =
      await import("../src/modules/indigenous-territories-layer.ts");
    installIndigenousTerritoriesLayer();
    elemento = document.createElement("div");
    elemento.id = "map";
    document.body.append(elemento);
    mapa = window.L.map(elemento);
  }

  const botao = () =>
    elemento.querySelector(".agsus-indigenous-territories-control__button");
  const ligado = () => botao().getAttribute("aria-pressed");
  const trocarFundo = (mode) =>
    elemento.dispatchEvent(
      new CustomEvent("agsus:map-base-layer-changed", {
        bubbles: true,
        detail: { mode },
      }),
    );

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })),
    );
    localStorage.clear();
  });

  afterEach(() => {
    elemento?.remove();
    delete window.L;
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe("Terras Indígenas no Mapa DSEIs", () => {
    it("abrir a página já no Mapa DSEIs: terras e botão desligados, preferência intacta", async () => {
      await montar("simple");
      expect(mapa.__agsusIndigenousTerritoriesVisible).toBe(false);
      expect(ligado()).toBe("false");
      expect(localStorage.getItem(CHAVE)).toBeNull();
    });

    it("entrar no Mapa DSEIs desliga; sair devolve o que estava guardado", async () => {
      await montar("map");
      expect(ligado()).toBe("true");

      trocarFundo("simple");
      expect(mapa.__agsusIndigenousTerritoriesVisible).toBe(false);
      expect(ligado()).toBe("false");

      trocarFundo("map");
      expect(mapa.__agsusIndigenousTerritoriesVisible).toBe(true);
      expect(ligado()).toBe("true");
      expect(localStorage.getItem(CHAVE)).toBeNull();
    });

    it("o botão no Mapa DSEIs vale só enquanto ele durar", async () => {
      await montar("map");
      botao().click(); // desliga no Mapa: isto se guarda
      expect(localStorage.getItem(CHAVE)).toBe("0");

      trocarFundo("simple");
      botao().click(); // liga no Mapa DSEIs: não se guarda
      expect(ligado()).toBe("true");
      expect(localStorage.getItem(CHAVE)).toBe("0");

      trocarFundo("satellite");
      expect(mapa.__agsusIndigenousTerritoriesVisible).toBe(false);
      expect(ligado()).toBe("false");

      // Voltar ao Mapa DSEIs recomeça sem terras.
      botao().click();
      trocarFundo("simple");
      expect(ligado()).toBe("false");
    });

    it("o contorno leve dos DSEIs sai no Mapa DSEIs (que pinta os mesmos) e volta ao sair", async () => {
      const pane = () => mapa.getPane("agsus-dsei-coverage");
      await montar("map");
      expect(pane().style.display).toBe("");

      trocarFundo("simple");
      expect(pane().style.display).toBe("none");

      trocarFundo("satellite");
      expect(pane().style.display).toBe("");
    });

    it("abrir a página já no Mapa DSEIs: o contorno leve começa escondido", async () => {
      await montar("simple");
      expect(mapa.getPane("agsus-dsei-coverage").style.display).toBe("none");
    });

    it("o mesmo aviso repetido não mexe no estado", async () => {
      await montar("simple");
      botao().click();
      trocarFundo("simple");
      expect(ligado()).toBe("true");
    });
  });
});
