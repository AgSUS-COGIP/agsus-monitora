import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AVISO_DO_PAINEL_CARREGANDO,
  AVISO_DO_PAINEL_ERRO,
  AVISO_DO_PAINEL_PRONTO,
  DEMORA_DO_PAINEL_MS,
  ESPERA_MAXIMA_DO_PAINEL_MS,
  origensParaPreconectar,
  rotuloDoCarregamento,
  servicoDoPainel,
} from "../../src/lib/carregamento-do-painel.ts";
import { acompanharCarregamentoDoPainel } from "../../src/modulos/paineis-externos/carregamento-do-painel.tsx";

/*
  A cobertura do painel externo (src/modulos/paineis-externos/): o que está
  carregando até o `load` do iframe, a demora aos 20 s com "Abrir em nova
  aba" e o erro.
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const LOOKER =
  "https://datastudio.google.com/embed/reporting/55b4277a/page/14ECG";

describe("regras do carregamento do painel", () => {
  it("o nome do serviço sai do endereço", () => {
    expect(servicoDoPainel(LOOKER)).toBe("Looker Studio");
    expect(
      servicoDoPainel("https://lookerstudio.google.com/embed/reporting/x"),
    ).toBe("Looker Studio");
    expect(servicoDoPainel("https://app.powerbi.com/view?r=x")).toBe(
      "Power BI",
    );
    expect(servicoDoPainel("https://bi.exemplo/rh")).toBeNull();
    expect(servicoDoPainel("javascript:alert(1)")).toBeNull();
  });

  it("o rótulo diz o serviço quando o conhece", () => {
    expect(rotuloDoCarregamento(LOOKER)).toBe(
      "Carregando o painel do Looker Studio…",
    );
    expect(rotuloDoCarregamento("https://bi.exemplo/rh")).toBe(
      "Carregando o painel…",
    );
  });

  it("pré-conexão: a origem do painel e, no Looker Studio, as estáticas do Google", () => {
    expect(origensParaPreconectar(LOOKER)).toEqual([
      "https://datastudio.google.com",
      "https://www.gstatic.com",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ]);
    expect(origensParaPreconectar("https://bi.exemplo/rh?x=1")).toEqual([
      "https://bi.exemplo",
    ]);
    expect(origensParaPreconectar("")).toEqual([]);
    expect(origensParaPreconectar("ftp://x")).toEqual([]);
  });
});

describe("cobertura do painel externo", () => {
  let holder;
  let quadro;
  let desmontar;
  const cobertura = () => holder.querySelector(".carregamento-do-painel");
  const texto = () => cobertura()?.textContent ?? "";
  const avancar = async (ms) => {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  };
  const disparar = async (alvo, evento) => {
    await act(async () => {
      alvo.dispatchEvent(evento);
    });
  };
  const avisar = (tipo, source = quadro.contentWindow) =>
    disparar(window, new MessageEvent("message", { data: { tipo }, source }));
  const montar = (opcoes = {}) => {
    act(() => {
      desmontar = acompanharCarregamentoDoPainel(holder, {
        endereco: LOOKER,
        ...opcoes,
      });
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    holder = document.createElement("div");
    holder.className = "external-panel";
    quadro = document.createElement("iframe");
    holder.append(quadro);
    document.body.replaceChildren(holder);
  });

  afterEach(() => {
    act(() => desmontar?.());
    vi.useRealTimers();
  });

  it("mostra o que está carregando, com o giro, até o load do iframe", async () => {
    montar();
    expect(cobertura()).not.toBeNull();
    expect(texto()).toContain("Carregando o painel do Looker Studio…");
    expect(cobertura().querySelector("[role='status']")).not.toBeNull();
    expect(cobertura().querySelector(".botao-girando")).not.toBeNull();
    expect(texto()).not.toContain("demorando");
    await disparar(quadro, new Event("load"));
    // Folga para o painel dizer que ainda está a carregar os dados.
    await avancar(300);
    expect(cobertura().classList).toContain("carregamento-do-painel--saindo");
    await avancar(200);
    expect(cobertura()).toBeNull();
    // O iframe fica: as próximas aberturas são na hora.
    expect(holder.querySelector("iframe")).toBe(quadro);
  });

  it("aos 20 s avisa a demora, com Abrir em nova aba e Tentar novamente", async () => {
    const aoTentarDeNovo = vi.fn();
    montar({ aoTentarDeNovo });
    await avancar(DEMORA_DO_PAINEL_MS - 1);
    expect(texto()).not.toContain("Está demorando mais que o normal");
    await avancar(1);
    expect(texto()).toContain("Carregando o painel do Looker Studio…");
    expect(texto()).toContain("Está demorando mais que o normal.");
    const link = [...cobertura().querySelectorAll("a")].find(
      (a) => a.textContent === "Abrir em nova aba",
    );
    expect(link.href).toBe(LOOKER);
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
    const tentar = [...cobertura().querySelectorAll("button")].find(
      (b) => b.textContent === "Tentar novamente",
    );
    await act(async () => tentar.click());
    expect(aoTentarDeNovo).toHaveBeenCalledOnce();
    // Carregou depois da demora: sai do mesmo jeito.
    await disparar(quadro, new Event("load"));
    await avancar(300);
    await avancar(200);
    expect(cobertura()).toBeNull();
  });

  it("carregou antes da demora: o aviso não aparece depois", async () => {
    montar();
    await disparar(quadro, new Event("load"));
    await avancar(300);
    await avancar(200);
    expect(cobertura()).toBeNull();
    await avancar(30_000);
    expect(holder.textContent).not.toContain("demorando");
  });

  it("erro do iframe: a mensagem e as saídas, sem o giro", async () => {
    montar({ aoTentarDeNovo: () => {} });
    await disparar(quadro, new Event("error"));
    expect(cobertura().querySelector("[role='alert']")).not.toBeNull();
    expect(texto()).toContain("Não foi possível carregar o painel.");
    expect(texto()).toContain("Abrir em nova aba");
    expect(texto()).toContain("Tentar novamente");
    expect(cobertura().querySelector(".botao-girando")).toBeNull();
    // A demora não troca o erro de volta.
    await avancar(DEMORA_DO_PAINEL_MS);
    expect(texto()).toContain("Não foi possível carregar o painel.");
  });

  it("sem conexão: o erro", async () => {
    montar();
    await disparar(window, new Event("offline"));
    expect(texto()).toContain("Não foi possível carregar o painel.");
  });

  describe("painel que avisa (Apps Script)", () => {
    const saindo = () =>
      cobertura()?.classList.contains("carregamento-do-painel--saindo");

    it("avisou que está a carregar: a cobertura fica até o pronto", async () => {
      montar();
      await avisar(AVISO_DO_PAINEL_CARREGANDO);
      await disparar(quadro, new Event("load"));
      await avancar(5_000);
      expect(saindo()).toBe(false);
      await avisar(AVISO_DO_PAINEL_PRONTO);
      expect(saindo()).toBe(true);
    });

    it("o aviso de erro do painel mostra o erro", async () => {
      montar();
      await avisar(AVISO_DO_PAINEL_ERRO);
      expect(texto()).toContain("Não foi possível carregar o painel.");
    });

    it("aceita o aviso de um iframe dentro do iframe", async () => {
      const interno = quadro.contentDocument.createElement("iframe");
      quadro.contentDocument.body.append(interno);
      montar();
      await avisar(AVISO_DO_PAINEL_PRONTO, interno.contentWindow);
      expect(saindo()).toBe(true);
    });

    it("ignora aviso que não veio deste painel", async () => {
      const outro = document.createElement("iframe");
      document.body.append(outro);
      montar();
      await avisar(AVISO_DO_PAINEL_PRONTO, outro.contentWindow);
      await avisar(AVISO_DO_PAINEL_PRONTO, null);
      expect(saindo()).toBe(false);
    });

    it("avisou e travou: a cobertura sai depois da espera máxima", async () => {
      montar();
      await avisar(AVISO_DO_PAINEL_CARREGANDO);
      await disparar(quadro, new Event("load"));
      await avancar(ESPERA_MAXIMA_DO_PAINEL_MS - 1_000);
      expect(saindo()).toBe(false);
      await avancar(1_000);
      expect(saindo()).toBe(true);
    });
  });

  it("descartado antes de carregar: a cobertura sai com o quadro", () => {
    montar();
    act(() => desmontar());
    expect(cobertura()).toBeNull();
    expect(holder.querySelector(".carregamento-do-painel-raiz")).toBeNull();
  });

  it("sem iframe (painel em manutenção ou sem endereço), não cobre nada", () => {
    holder.replaceChildren();
    montar();
    expect(cobertura()).toBeNull();
  });

  it("o app liga a cobertura ao criar o iframe do painel", () => {
    const paineis = readFileSync("src/app/paineis-externos.ts", "utf8");
    const inicio = paineis.indexOf("function montarQuadro(holder");
    const corpo = paineis.slice(
      inicio,
      paineis.indexOf("function removerQuadro(", inicio),
    );
    expect(
      corpo.indexOf("acompanharCarregamentoDoPainel(holder"),
    ).toBeGreaterThan(corpo.indexOf('createElement("iframe")'));
  });
});
