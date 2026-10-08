import { act } from "react";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../componentes/interacoes.js";
import {
  CHAVE_COMEMORACOES_PESSOAIS,
  definirEstadoDaAya,
  INATIVIDADE_PARA_DORMIR_MS,
} from "../../src/lib/estado-da-aya.ts";

/*
  A mascote da Aya (src/modulos/aya/mascote/): troca de estados, o evento
  global aya:estado, movimento reduzido (só pisca), piscar com sorteio fixo,
  aceno uma vez por sessão, sono por inatividade e pausa com a aba oculta.
*/

const { Mascote, TAMANHO_DA_VERSAO_SIMPLES, carregarDesenhoDaMascote } =
  await import("../../src/modulos/aya/mascote/mascote.tsx");
// O desenho vem num pedaço próprio (import dinâmico): carregado antes dos testes.
await carregarDesenhoDaMascote();
const { reiniciarPedidoDaAya } =
  await import("../../src/modulos/aya/mascote/estado.ts");
const { CartaoDaMascote } =
  await import("../../src/modulos/configuracoes/cartao-da-mascote.tsx");

let raiz;
let elemento;
let animar;
const svg = () => elemento.querySelector("svg.mascote");
const estado = () => svg()?.getAttribute("data-estado");

async function montar(props = {}) {
  await act(async () => raiz.render(createElement(Mascote, props)));
}

async function avancar(ms) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function oculto(valor) {
  Object.defineProperty(document, "hidden", {
    value: valor,
    configurable: true,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  localStorage.clear();
  reiniciarPedidoDaAya();
  oculto(false);
  animar = vi.fn();
  Element.prototype.animate = animar;
  elemento = document.createElement("div");
  document.body.append(elemento);
  raiz = createRoot(elemento);
});

afterEach(async () => {
  await act(async () => raiz.unmount());
  elemento.remove();
  delete Element.prototype.animate;
  delete window.matchMedia;
  vi.useRealTimers();
});

describe("desenho", () => {
  it("o svg já nasce no tamanho final, antes do desenho chegar", async () => {
    await montar({ tamanho: 84 });
    expect(svg().getAttribute("width")).toBe("84");
    expect(svg().getAttribute("height")).toBe("84");
  });

  it("decorativa por padrão; com rótulo vira imagem com nome", async () => {
    await montar();
    expect(svg().getAttribute("aria-hidden")).toBe("true");
    expect(svg().getAttribute("data-versao")).toBe("completa");
    for (const parte of [
      "corpo",
      "cabeca",
      "olho",
      "palpebra",
      "bico-superior",
      "bico-inferior",
      "asa",
      "cauda",
      "pes",
      "poleiro",
    ])
      expect(svg().querySelector(`.mascote__${parte}`), parte).not.toBeNull();
    await montar({ rotulo: "Aya" });
    expect(svg().getAttribute("role")).toBe("img");
    expect(svg().getAttribute("aria-label")).toBe("Aya");
  });

  it("sempre de corpo inteiro; abaixo de 40px, a versão simples (também inteira)", async () => {
    await montar({ tamanho: 84 });
    expect(svg().getAttribute("data-versao")).toBe("completa");
    expect(svg().getAttribute("viewBox")).toBe("0 0 200 190");
    await montar({ tamanho: TAMANHO_DA_VERSAO_SIMPLES - 1 });
    expect(svg().getAttribute("data-versao")).toBe("simples");
    expect(svg().getAttribute("viewBox")).toBe("0 0 200 190");
    expect(svg().querySelector(".mascote__palpebra")).not.toBeNull();
    expect(svg().querySelector(".mascote__asa-aberta")).not.toBeNull();
    await montar({ tamanho: TAMANHO_DA_VERSAO_SIMPLES });
    expect(svg().getAttribute("data-versao")).toBe("completa");
    // Os fogos voam sem poleiro.
    await montar({ poleiro: false });
    expect(svg().querySelector(".mascote__poleiro")).toBeNull();
  });

  it("cada parte recorta os mesmos tons (sem emenda entre cabeça, corpo e asas)", async () => {
    await montar();
    const recortes = [...svg().querySelectorAll("clipPath")].map((c) =>
      c.id.replace(/^.*-c-/, ""),
    );
    expect(recortes).toEqual(
      expect.arrayContaining([
        "cauda",
        "asaAberta",
        "corpo",
        "asa",
        "coxa",
        "cabeca",
        "bicoSuperior",
        "bicoInferior",
        "pes",
      ]),
    );
    const usos = [...svg().querySelectorAll("use")].map((u) =>
      u.getAttribute("href"),
    );
    expect(
      new Set(usos.map((h) => h.replace(/^#.*-/, ""))).size,
    ).toBeLessThanOrEqual(3);
  });

  it("gradientes com prefixo próprio em cada arara", async () => {
    await act(async () =>
      raiz.render(
        createElement("div", null, [
          createElement(Mascote, { key: 1 }),
          createElement(Mascote, { key: 2 }),
        ]),
      ),
    );
    const ids = [...elemento.querySelectorAll("[id]")].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("troca de estados", () => {
  it("o painel diz falando/pensando; fixo vence tudo", async () => {
    await montar({ proprio: "pensando" });
    expect(estado()).toBe("pensando");
    await montar({ proprio: "falando" });
    expect(estado()).toBe("falando");
    await montar({ proprio: null });
    expect(estado()).toBe("parada");
    await montar({ estado: "dormindo", proprio: "falando" });
    expect(estado()).toBe("dormindo");
  });

  it("momento inicial vale pelo tempo pedido", async () => {
    await montar({ momentoInicial: { estado: "atenta", duracaoMs: 2000 } });
    expect(estado()).toBe("atenta");
    await avancar(2100);
    expect(estado()).toBe("parada");
  });

  it("acena ao entrar uma vez por sessão", async () => {
    await montar({ acenarAoEntrar: true });
    expect(estado()).toBe("acenando");
    await avancar(3000);
    expect(estado()).toBe("parada");
    await act(async () => raiz.unmount());
    raiz = createRoot(elemento);
    await montar({ acenarAoEntrar: true });
    expect(estado()).toBe("parada");
  });

  it("dorme depois de muito tempo parada e acorda ao interagir", async () => {
    await montar();
    await avancar(INATIVIDADE_PARA_DORMIR_MS - 1000);
    expect(estado()).toBe("parada");
    await avancar(2000);
    expect(estado()).toBe("dormindo");
    await act(async () => {
      window.dispatchEvent(new Event("keydown"));
    });
    expect(estado()).toBe("parada");
  });

  it("fica atenta com o ponteiro perto e o olho acompanha", async () => {
    await montar();
    svg().getBoundingClientRect = () => ({
      left: 100,
      top: 100,
      width: 64,
      height: 64,
      right: 164,
      bottom: 164,
    });
    await act(async () => {
      window.dispatchEvent(
        Object.assign(new Event("pointermove"), { clientX: 300, clientY: 132 }),
      );
      vi.advanceTimersByTime(20);
    });
    expect(estado()).toBe("atenta");
    await act(async () => {
      window.dispatchEvent(
        Object.assign(new Event("pointermove"), { clientX: 200, clientY: 132 }),
      );
      vi.advanceTimersByTime(20);
    });
    expect(Number(svg().style.getPropertyValue("--olho-x"))).toBeGreaterThan(0);
    await act(async () => {
      window.dispatchEvent(
        Object.assign(new Event("pointermove"), { clientX: 900, clientY: 900 }),
      );
      vi.advanceTimersByTime(20);
    });
    expect(estado()).toBe("parada");
    expect(svg().style.getPropertyValue("--olho-x")).toBe("");
  });
});

describe("evento global aya:estado", () => {
  it("qualquer tela pede um estado; ele expira sozinho", async () => {
    await montar();
    await act(async () => {
      definirEstadoDaAya("comemorando", 1500);
    });
    expect(estado()).toBe("comemorando");
    await avancar(1600);
    expect(estado()).toBe("parada");
  });

  it("pelo CustomEvent direto, e 'parada' limpa o pedido", async () => {
    await montar({ proprio: "falando" });
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("aya:estado", { detail: { estado: "pensando" } }),
      );
    });
    expect(estado()).toBe("pensando");
    await avancar(60000);
    expect(estado()).toBe("pensando");
    await act(async () => {
      definirEstadoDaAya("parada");
    });
    expect(estado()).toBe("falando");
  });

  it("estado fixo (prévia, fogos) não ouve o evento", async () => {
    await montar({ estado: "acenando" });
    await act(async () => {
      definirEstadoDaAya("dormindo", 1000);
    });
    expect(estado()).toBe("acenando");
  });

  it("comemorações desligadas pela pessoa: não comemora", async () => {
    localStorage.setItem(CHAVE_COMEMORACOES_PESSOAIS, "1");
    await montar();
    await act(async () => {
      definirEstadoDaAya("comemorando", 1500);
    });
    expect(estado()).toBe("parada");
  });
});

describe("movimento reduzido e aba oculta", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("só pisca: os estados de movimento viram parada", async () => {
    await montar({ proprio: "falando", rng: () => 0 });
    expect(svg().getAttribute("data-reduzido")).toBe("sim");
    expect(estado()).toBe("parada");
    expect(svg().getAttribute("data-pedido")).toBe("falando");
    await act(async () => {
      definirEstadoDaAya("comemorando", 2000);
    });
    expect(estado()).toBe("parada");
    await avancar(3000);
    // Pisca mesmo assim; o arrepio das penas não acontece.
    const alvos = animar.mock.contexts.map((el) => el.getAttribute("class"));
    expect(alvos).toContain("mascote__palpebra");
    expect(alvos).not.toContain("mascote__penas-da-cabeca");
  });

  it("dormindo continua de olhos fechados", async () => {
    await montar({ estado: "dormindo" });
    expect(estado()).toBe("dormindo");
  });
});

describe("piscar com sorteio fixo", () => {
  it("rng 0 → pisca a cada 3 s; nada antes", async () => {
    await montar({ rng: () => 0, atencao: false });
    await avancar(2999);
    expect(
      animar.mock.contexts.filter((el) =>
        el.classList.contains("mascote__palpebra"),
      ),
    ).toHaveLength(0);
    await avancar(1);
    expect(svg().dataset.piscadas).toBe("1");
    const [quadros, opcoes] = animar.mock.calls.find((_, i) =>
      animar.mock.contexts[i].classList.contains("mascote__palpebra"),
    );
    expect(quadros[0]).toEqual({ transform: "scaleY(0)" });
    expect(opcoes.duration).toBeGreaterThan(100);
    await avancar(3000);
    expect(svg().dataset.piscadas).toBe("2");
  });

  it("rng 1 → espera 7 s; dormindo não pisca", async () => {
    await montar({ rng: () => 0.99999 });
    await avancar(6900);
    expect(svg().dataset.piscadas).toBeUndefined();
    await avancar(200);
    expect(svg().dataset.piscadas).toBe("1");
    await montar({ estado: "dormindo", rng: () => 0 });
    await avancar(20000);
    expect(svg().dataset.piscadas).toBe("1");
  });

  it("com a aba oculta não pisca e as animações pausam", async () => {
    await montar({ rng: () => 0 });
    oculto(true);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(svg().dataset.pausada).toBe("sim");
    await avancar(3000);
    expect(svg().dataset.piscadas).toBeUndefined();
    oculto(false);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(svg().dataset.pausada).toBeUndefined();
    await avancar(3000);
    expect(svg().dataset.piscadas).toBe("1");
  });
});

describe("Configurações › Marca › Mascote (prévia para o administrador)", () => {
  it("um botão por estado; 'Ver na arara do canto' manda o estado pelo evento", async () => {
    await act(async () => raiz.render(createElement(CartaoDaMascote)));
    const opcoes = [...elemento.querySelectorAll("[role=radio]")];
    expect(opcoes.map((b) => b.textContent.trim())).toEqual([
      "Parada",
      "Atenta",
      "Falando",
      "Pensando",
      "Comemorando",
      "Dormindo",
      "Acenando",
    ]);
    const grande = () =>
      elemento.querySelector(".cartao-da-mascote__palco > svg");
    expect(grande().getAttribute("data-estado")).toBe("parada");
    await act(async () => opcoes[4].click());
    expect(grande().getAttribute("data-estado")).toBe("comemorando");
    // As araras pequenas acompanham.
    for (const arara of elemento.querySelectorAll(
      ".cartao-da-mascote__tamanhos svg",
    ))
      expect(arara.getAttribute("data-estado")).toBe("comemorando");
    const ouvinte = vi.fn();
    window.addEventListener("aya:estado", ouvinte);
    await act(async () =>
      [...elemento.querySelectorAll("button")]
        .find((b) => b.textContent === "Ver na arara do canto")
        .click(),
    );
    window.removeEventListener("aya:estado", ouvinte);
    expect(ouvinte.mock.calls[0][0].detail).toEqual({
      estado: "comemorando",
      duracaoMs: 4000,
    });
  });
});
