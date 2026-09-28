import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PAINEL = `
  <div id="loading" class="loading"><span id="loadingText"></span></div>
  <main class="content">
    <section class="filter-grid"><select id="fUnidade"></select></section>
    <section id="kpiGrid"><article class="kpi"><b id="kTotal">0</b></article></section>
    <div id="attentionList"></div>
    <table><tbody id="tableBody"></tbody></table>
  </main>
  <button id="refreshBtn"></button>
  <button id="applyBtn"></button>
  <button id="scopeGuardLoad" disabled></button>
`;

async function carregarModulo() {
  vi.resetModules();
  return import("../../src/analises/analises-loading-feedback.js");
}

const aviso = () => document.getElementById("analisesAvisoDoCarregamento");

beforeEach(() => {
  document.body.className = "";
  document.body.innerHTML = PAINEL;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("skeleton do painel de análises", () => {
  it("liga na primeira carga com linhas de marcação e desliga sem deixar rastro", async () => {
    const { definirCarregamentoDoPainel } = await carregarModulo();
    const refresh = document.getElementById("refreshBtn");
    const guarda = document.getElementById("scopeGuardLoad");

    definirCarregamentoDoPainel(true);

    expect(document.body.classList.contains("analises-is-loading")).toBe(true);
    expect(document.querySelector("main").getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(refresh.disabled).toBe(true);
    expect(refresh.getAttribute("aria-busy")).toBe("true");
    expect(
      document.querySelectorAll("#tableBody tr[data-esqueleto]"),
    ).toHaveLength(8);
    expect(
      document.querySelectorAll("#tableBody tr[data-esqueleto] td"),
    ).toHaveLength(64);
    expect(
      document.querySelectorAll("#attentionList [data-esqueleto]"),
    ).toHaveLength(4);

    definirCarregamentoDoPainel(false);

    expect(document.body.classList.contains("analises-is-loading")).toBe(false);
    expect(document.querySelector("main").getAttribute("aria-busy")).toBe(
      "false",
    );
    expect(refresh.disabled).toBe(false);
    expect(guarda.disabled).toBe(true);
    expect(document.querySelectorAll("[data-esqueleto]")).toHaveLength(0);
  });

  it("na recarga, mantém as linhas reais e só marca o painel como carregando", async () => {
    const { definirCarregamentoDoPainel } = await carregarModulo();
    document.getElementById("tableBody").innerHTML =
      "<tr><td>Real</td></tr><tr><td>Outra</td></tr>";
    document.getElementById("attentionList").innerHTML =
      '<div class="attention-item"><b>Pendentes</b><small>3</small></div>';

    definirCarregamentoDoPainel(true);

    expect(document.body.classList.contains("analises-is-loading")).toBe(true);
    expect(document.querySelectorAll("#tableBody tr")).toHaveLength(2);
    expect(document.querySelectorAll("[data-esqueleto]")).toHaveLength(0);

    definirCarregamentoDoPainel(false);
    expect(document.getElementById("tableBody").textContent).toBe("RealOutra");
  });

  it("avisa a demora aos 12 s e oferece tentar de novo aos 25 s", async () => {
    vi.useFakeTimers();
    const { definirCarregamentoDoPainel } = await carregarModulo();

    definirCarregamentoDoPainel(true);
    expect(aviso()).toBeNull();

    vi.advanceTimersByTime(12_000);
    expect(aviso().hidden).toBe(false);
    expect(aviso().querySelector("button").hidden).toBe(true);

    vi.advanceTimersByTime(13_000);
    expect(aviso().querySelector("button").hidden).toBe(false);

    definirCarregamentoDoPainel(false);
    expect(aviso().hidden).toBe(true);
  });

  it("no erro, tira o skeleton e mostra a mensagem com Tentar novamente", async () => {
    const { definirCarregamentoDoPainel, mostrarErroDoCarregamento } =
      await carregarModulo();
    const tentar = vi.fn();

    definirCarregamentoDoPainel(true);
    mostrarErroDoCarregamento("Erro ao carregar o painel: rede", tentar);

    expect(document.body.classList.contains("analises-is-loading")).toBe(false);
    expect(document.querySelectorAll("[data-esqueleto]")).toHaveLength(0);
    expect(aviso().hidden).toBe(false);
    expect(aviso().querySelector("p").textContent).toBe(
      "Erro ao carregar o painel: rede",
    );

    // O fim do carregamento que falhou não esconde o erro.
    definirCarregamentoDoPainel(false);
    expect(aviso().hidden).toBe(false);

    aviso().querySelector("button").click();
    expect(tentar).toHaveBeenCalledTimes(1);
    expect(aviso().hidden).toBe(true);
  });

  it("dentro do MONITORA, avisa que começou e, uma vez só, que ficou pronto", async () => {
    const postMessage = vi.fn();
    const topo = vi
      .spyOn(window, "top", "get")
      .mockReturnValue({ postMessage });
    try {
      const { definirCarregamentoDoPainel } = await carregarModulo();
      expect(postMessage).toHaveBeenCalledWith(
        { tipo: "agsus:painel-carregando" },
        "*",
      );

      definirCarregamentoDoPainel(true);
      definirCarregamentoDoPainel(false);
      definirCarregamentoDoPainel(true);
      definirCarregamentoDoPainel(false);

      const prontos = postMessage.mock.calls.filter(
        ([mensagem]) => mensagem.tipo === "agsus:painel-pronto",
      );
      expect(prontos).toHaveLength(1);
    } finally {
      topo.mockRestore();
    }
  });
});
