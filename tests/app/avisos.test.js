import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  avisar,
  mostrarCarregamento,
  normalizarTom,
  redefinirAvisos,
} from "../../src/app/avisos.ts";
import { montarAvisos } from "../../src/app/casca/avisos.tsx";
import { VISIVEL_DEPOIS_DE_VOLTAR_MS } from "../../src/app/casca/aviso-de-conexao.tsx";
import { DURACAO_MS } from "../../src/app/casca/notificacoes.tsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  Os avisos por cima de tudo (src/app/casca/avisos.tsx): a notificação curta
  (#toastBox), a tela de carregamento dos salvamentos (#loader) e o aviso de
  conexão. Eram marcação fixa do index.html e três módulos do legado; o DOM
  (ids, classes, papéis) é o de antes.
*/

let avisos = null;
const $ = (id) => document.getElementById(id);

function montar() {
  document.body.innerHTML = '<div id="avisosApp"></div>';
  avisos = montarAvisos();
}

function online(valor) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => valor,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T13:00:00Z"));
  redefinirAvisos();
  online(true);
});

afterEach(() => {
  act(() => avisos?.desmontar());
  avisos = null;
  act(() => redefinirAvisos());
  document.body.className = "";
  document.body.innerHTML = "";
  vi.useRealTimers();
  delete window.navigator.onLine;
});

describe("montarAvisos", () => {
  it("desenha na hora, com os ids de antes, e sem #avisosApp não monta", () => {
    montar();
    // Sem act: quem vem depois em src/main.ts já acha os elementos.
    expect($("toastBox").className).toBe("toast-box");
    expect($("toastBox").getAttribute("role")).toBe("status");
    expect($("toastBox").getAttribute("aria-live")).toBe("polite");
    expect($("loader").className).toBe("loader");
    expect($("connectivityStatusNotice")).toBeNull();

    act(() => avisos.desmontar());
    document.body.innerHTML = "";
    avisos = null;
    expect(montarAvisos()).toBeNull();
  });

  it("o index.html não traz mais a marcação, só a raiz vazia", () => {
    const indice = readFileSync("index.html", "utf8");
    expect(indice).toContain('<div id="avisosApp"></div>');
    for (const id of ["loader", "toastBox", "offlineBar"])
      expect(indice).not.toContain(`id="${id}"`);
  });
});

describe("notificação (window.monitoraToast)", () => {
  it("mostra o ícone do tipo, o texto como texto e o fechar com rótulo", () => {
    montar();
    act(() => avisar("<b>oi</b>", "warn"));
    const el = $("toastBox").querySelector(".toast");
    expect(el.className).toBe("toast warn");
    expect(el.querySelector(".fa-triangle-exclamation.toast-icone")).not.toBe(
      null,
    );
    expect(el.querySelector(".toast-texto").innerHTML).toBe(
      "&lt;b&gt;oi&lt;/b&gt;",
    );
    expect(el.querySelector(".toast-fechar").getAttribute("aria-label")).toBe(
      "Fechar notificação",
    );
  });

  it("só o erro interrompe o leitor de tela; tipo desconhecido vira sucesso", () => {
    montar();
    act(() => {
      avisar("x", "error");
      avisar("y", "ok");
      avisar("z", "qualquer");
    });
    const [erro, ok, outro] = $("toastBox").children;
    expect(erro.getAttribute("role")).toBe("alert");
    expect(ok.hasAttribute("role")).toBe(false);
    expect(outro.className).toBe("toast ok");
    expect(normalizarTom("success")).toBe("ok");
  });

  it("some sozinha depois do tempo (com a animação de saída) e fecha pelo botão", () => {
    montar();
    act(() => avisar("a"));
    act(() => vi.advanceTimersByTime(DURACAO_MS));
    expect($("toastBox").querySelector(".toast").className).toBe(
      "toast ok is-saindo",
    );
    act(() => vi.advanceTimersByTime(200));
    expect($("toastBox").children).toHaveLength(0);

    act(() => avisar("b"));
    act(() => $("toastBox").querySelector(".toast-fechar").click());
    act(() => vi.advanceTimersByTime(200));
    expect($("toastBox").children).toHaveLength(0);
  });

  it("parada sob o mouse não some; ao sair, conta o que faltava", () => {
    montar();
    act(() => avisar("c"));
    const el = $("toastBox").querySelector(".toast");
    act(() => vi.advanceTimersByTime(1000));
    act(() => el.dispatchEvent(new Event("mouseenter")));
    act(() => vi.advanceTimersByTime(DURACAO_MS * 2));
    expect(el.isConnected).toBe(true);
    act(() => el.dispatchEvent(new Event("mouseleave")));
    act(() => vi.advanceTimersByTime(DURACAO_MS - 1000 - 10));
    expect(el.isConnected).toBe(true);
    act(() => vi.advanceTimersByTime(10)); // + a animação de saída
    act(() => vi.advanceTimersByTime(200));
    expect(el.isConnected).toBe(false);
  });

  it("avisar antes da montagem não se perde", () => {
    avisar("cedo", "info");
    montar();
    expect(
      $("toastBox").querySelector(".toast.info .toast-texto").textContent,
    ).toBe("cedo");
  });
});

describe("tela de carregamento (window.monitoraLoader)", () => {
  it("na entrada (config-loading) não aparece", () => {
    document.body.className = "config-loading";
    montar();
    act(() => mostrarCarregamento(true));
    const loader = $("loader");
    expect(loader.classList.contains("show")).toBe(false);
    expect(loader.getAttribute("role")).toBe("status");
    expect(loader.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.getAttribute("aria-busy")).toBe("false");
    expect($("loaderMeta")).toBeNull();
  });

  it("troca o texto genérico pela etapa, mostra o percentual e, na demora, Tentar novamente", () => {
    montar();
    act(() => mostrarCarregamento(true));
    expect($("loader").className).toBe("loader show");
    expect($("loader").getAttribute("aria-hidden")).toBe("false");
    expect(document.body.getAttribute("aria-busy")).toBe("true");
    expect($("loaderTitle").textContent).toBe("Preparando o AgSUS Monitora");
    expect($("loaderPct").textContent).toBe("0%");
    expect($("loaderMeta").textContent).toBe("Etapa 1 de 5");
    expect($("loaderRetry").hidden).toBe(true);

    act(() => vi.advanceTimersByTime(25_000));
    expect($("loaderRetry").hidden).toBe(false);
    expect($("loaderMeta").textContent).toContain(
      "demorando mais que o normal",
    );
    expect($("loaderMeta").className).toBe("loader-meta is-delayed");
  });

  it("título próprio fica; subtítulo genérico vira o detalhe da etapa; barra limitada a 100%", () => {
    montar();
    act(() => mostrarCarregamento(true, "Salvando edital", "Aguarde...", 40));
    expect($("loaderTitle").textContent).toBe("Salvando edital");
    expect($("loaderSub").textContent).toBe(
      "Consultando indicadores e registros do monitoramento.",
    );
    expect($("loaderPct").textContent).toBe("40%");
    expect($("loaderBar").style.width).toBe("40%");
    expect($("loaderMeta").textContent).toBe("Etapa 3 de 5");

    act(() => mostrarCarregamento(true, "Salvando edital", "Quase", 140));
    expect($("loaderBar").style.width).toBe("100%");
  });

  it("sem carregamento, nenhum relógio fica rodando", () => {
    montar();
    expect(vi.getTimerCount()).toBe(0);

    act(() => mostrarCarregamento(true, "Editais", "Salvando…", 70));
    expect(document.body.getAttribute("aria-busy")).toBe("true");
    expect(vi.getTimerCount()).toBe(1);

    act(() => mostrarCarregamento(false));
    expect(document.body.getAttribute("aria-busy")).toBe("false");
    expect($("loader").classList.contains("show")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("aviso de conexão", () => {
  it("ao cair, avisa com Tentar novamente; ao voltar, avisa e some em 3,2s", () => {
    montar();
    act(() => window.dispatchEvent(new Event("offline")));
    const aviso = $("connectivityStatusNotice");
    expect(aviso.className).toBe("connectivity-status");
    expect(aviso.dataset.state).toBe("offline");
    expect(aviso.getAttribute("role")).toBe("status");
    expect(aviso.querySelector(".connectivity-status__title").textContent).toBe(
      "Sem conexão com a internet",
    );
    expect(
      aviso.querySelector(".connectivity-status__action").textContent,
    ).toBe("Tentar novamente");

    act(() => window.dispatchEvent(new Event("online")));
    expect(aviso.dataset.state).toBe("online");
    expect(aviso.querySelector(".connectivity-status__title").textContent).toBe(
      "Conexão restabelecida",
    );
    expect(aviso.querySelector(".connectivity-status__action")).toBeNull();

    act(() => vi.advanceTimersByTime(VISIVEL_DEPOIS_DE_VOLTAR_MS));
    expect(aviso.className).toBe("connectivity-status hidden");
  });

  it("uma queda antes do prazo não é escondida pelo prazo antigo", () => {
    montar();
    act(() => window.dispatchEvent(new Event("offline")));
    act(() => window.dispatchEvent(new Event("online")));
    act(() => vi.advanceTimersByTime(1000));
    act(() => window.dispatchEvent(new Event("offline")));
    act(() => vi.advanceTimersByTime(VISIVEL_DEPOIS_DE_VOLTAR_MS * 2));
    const aviso = $("connectivityStatusNotice");
    expect(aviso.dataset.state).toBe("offline");
    expect(aviso.classList.contains("hidden")).toBe(false);
  });

  it("'online' sem queda antes não mostra nada; página aberta sem rede já avisa", () => {
    montar();
    act(() => window.dispatchEvent(new Event("online")));
    expect($("connectivityStatusNotice")).toBeNull();
    act(() => avisos.desmontar());

    online(false);
    montar();
    expect($("connectivityStatusNotice").dataset.state).toBe("offline");
  });
});
