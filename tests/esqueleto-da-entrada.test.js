// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPABASE_AUTH_STORAGE_KEY } from "../src/lib/env.js";
import {
  FORMATOS_DO_ESQUELETO,
  formatoDoEsqueleto,
} from "../src/lib/esqueleto-da-entrada.js";
import {
  AVISO_DO_PAINEL_CARREGANDO,
  AVISO_DO_PAINEL_PRONTO,
  acompanharCarregamentoDoPainel,
  esconderEsqueleto,
  esqueletoAtivo,
  instalarCarregamento,
  marcarAtualizacao,
  mostrarEsqueleto,
} from "../src/modules/carregamento.js";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/styles/carregamento.css", "utf8");
const legado = readFileSync("src/modules/legacy-app.js", "utf8");

const inicio = html.indexOf("(function marcarSessaoGuardada()");
const script = html.slice(inicio, html.indexOf("</script>", inicio));

const TELAS = [
  ["", "painel"],
  ["dashboard", "painel"],
  ["visao-area", "painel"],
  ["panel:bi-rh", "painel"],
  ["calendario", "calendario"],
  ["nucleo", "tabela"],
  ["approved", "tabela"],
  ["config", "tabela"],
  ["acessos", "tabela"],
];

describe("formato do skeleton", () => {
  it.each(TELAS)("tela %j abre no formato %s", (tela, formato) => {
    expect(formatoDoEsqueleto(tela)).toBe(formato);
  });

  it("todo formato tem marcação no index.html e regra no CSS", () => {
    for (const formato of FORMATOS_DO_ESQUELETO) {
      expect(html).toContain(`data-formato="${formato}"`);
      expect(css).toContain(
        `html[data-esqueleto="${formato}"] [data-formato="${formato}"]`,
      );
    }
  });
});

describe("antes da primeira pintura (script do <head>)", () => {
  const raiz = document.documentElement;

  function rodar({ sessao = true, tela, barra, tema } = {}) {
    localStorage.clear();
    raiz.className = "";
    for (const nome of ["data-esqueleto", "data-esqueleto-barra", "data-theme"])
      raiz.removeAttribute(nome);
    if (sessao)
      localStorage.setItem(
        SUPABASE_AUTH_STORAGE_KEY,
        JSON.stringify({ access_token: "a", refresh_token: "r" }),
      );
    if (tela !== undefined)
      localStorage.setItem("agsus_monitora_current_view_v268", tela);
    if (barra !== undefined)
      localStorage.setItem("agsus_monitora_sidebar_collapsed_v1", barra);
    if (tema !== undefined) localStorage.setItem("agsus_dark_mode_v1", tema);
    new Function(script)();
  }

  afterEach(() => {
    localStorage.clear();
    raiz.className = "";
  });

  it("usa as mesmas chaves que o legado", () => {
    const chaveDaTela = legado.match(/const VIEW_STORAGE_KEY = "([^"]+)"/)[1];
    expect(script).toContain(`"${chaveDaTela}"`);
    expect(legado).toContain('"agsus_monitora_sidebar_collapsed_v1"');
    expect(script).toContain('"agsus_monitora_sidebar_collapsed_v1"');
    expect(legado).toContain('"agsus_dark_mode_v1"');
    expect(script).toContain('"agsus_dark_mode_v1"');
  });

  it.each(TELAS)(
    "a regra do <head> concorda com a do lib: %j",
    (tela, formato) => {
      rodar({ tela });
      expect(raiz.getAttribute("data-esqueleto")).toBe(formato);
    },
  );

  it("com sessão guardada, liga o skeleton", () => {
    rodar();
    expect(raiz.classList.contains("esqueleto-ativo")).toBe(true);
    expect(raiz.getAttribute("data-esqueleto")).toBe("painel");
  });

  it("sem sessão, fica a tela de acesso", () => {
    rodar({ sessao: false });
    expect(raiz.classList.contains("esqueleto-ativo")).toBe(false);
    expect(raiz.hasAttribute("data-esqueleto")).toBe(false);
  });

  it("barra aberta e tema escuro já saem na primeira pintura", () => {
    rodar({ barra: "0", tema: "1" });
    expect(raiz.getAttribute("data-esqueleto-barra")).toBe("aberta");
    expect(raiz.getAttribute("data-theme")).toBe("dark");
    rodar({ barra: "1", tema: "0" });
    expect(raiz.hasAttribute("data-esqueleto-barra")).toBe(false);
    expect(raiz.hasAttribute("data-theme")).toBe(false);
  });
});

describe("ligar e desligar", () => {
  const raiz = document.documentElement;
  const aviso = () => document.querySelector(".esqueleto-aviso");
  const tentar = () => aviso().querySelector("button");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const pagina = new DOMParser().parseFromString(html, "text/html");
    document.body.replaceChildren(
      document.importNode(pagina.querySelector(".esqueleto-da-entrada"), true),
    );
    document.body.className = "sidebar-collapsed";
  });

  afterEach(() => {
    esconderEsqueleto();
    marcarAtualizacao(false);
    vi.useRealTimers();
  });

  it("liga no formato da tela e desliga", () => {
    mostrarEsqueleto("nucleo");
    expect(esqueletoAtivo()).toBe(true);
    expect(raiz.dataset.esqueleto).toBe("tabela");
    expect(raiz.dataset.esqueletoBarra).toBe("recolhida");
    esconderEsqueleto();
    expect(esqueletoAtivo()).toBe(false);
  });

  it("acompanha a barra lateral aberta", () => {
    document.body.className = "";
    mostrarEsqueleto("dashboard");
    expect(raiz.dataset.esqueletoBarra).toBe("aberta");
  });

  it("na demora, avisa; depois, oferece tentar de novo", () => {
    mostrarEsqueleto("dashboard");
    expect(aviso().hidden).toBe(true);
    vi.advanceTimersByTime(12_000);
    expect(aviso().hidden).toBe(false);
    expect(aviso().textContent).toContain("mais de tempo");
    expect(tentar().hidden).toBe(true);
    vi.advanceTimersByTime(13_000);
    expect(tentar().hidden).toBe(false);
  });

  it("desligar some com o aviso e para a contagem", () => {
    mostrarEsqueleto("dashboard");
    vi.advanceTimersByTime(12_000);
    esconderEsqueleto();
    expect(aviso().hidden).toBe(true);
    vi.advanceTimersByTime(20_000);
    expect(aviso().hidden).toBe(true);
  });

  it("religar no meio da espera não zera a contagem", () => {
    mostrarEsqueleto("dashboard");
    vi.advanceTimersByTime(8_000);
    mostrarEsqueleto("nucleo");
    vi.advanceTimersByTime(4_000);
    expect(aviso().hidden).toBe(false);
  });

  it("ligado pelo <head>, conta a demora desde o início da navegação", () => {
    raiz.classList.add("esqueleto-ativo");
    instalarCarregamento();
    vi.advanceTimersByTime(12_000);
    expect(aviso().hidden).toBe(false);
  });

  it("marca e desmarca a atualização dos dados", () => {
    marcarAtualizacao(true);
    expect(raiz.classList.contains("dados-atualizando")).toBe(true);
    marcarAtualizacao(false);
    expect(raiz.classList.contains("dados-atualizando")).toBe(false);
  });
});

/*
  O iframe do painel externo nasce na primeira abertura e fica em branco até o
  site de fora responder: sem isto, a aba de Painéis não tinha carregamento.
*/
describe("skeleton do painel externo", () => {
  let holder;
  let quadro;
  const esqueleto = () => holder.querySelector(".esqueleto-do-painel");
  const aviso = () => esqueleto().querySelector(".esqueleto-aviso");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    holder = document.createElement("div");
    holder.className = "external-panel";
    quadro = document.createElement("iframe");
    holder.append(quadro);
    document.body.replaceChildren(holder);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cobre o quadro até o iframe carregar", () => {
    acompanharCarregamentoDoPainel(holder);
    expect(esqueleto()).not.toBeNull();
    expect(esqueleto().getAttribute("role")).toBe("status");
    expect(esqueleto().querySelectorAll(".esqueleto-cartao--kpi")).toHaveLength(
      4,
    );
    quadro.dispatchEvent(new Event("load"));
    // Folga para o painel dizer que ainda está a carregar os dados.
    vi.advanceTimersByTime(300);
    expect(esqueleto().classList).toContain("esqueleto-do-painel--saindo");
    vi.advanceTimersByTime(200);
    expect(esqueleto()).toBeNull();
  });

  it("na demora, avisa e oferece tentar de novo pelo painel", () => {
    const aoTentarDeNovo = vi.fn();
    acompanharCarregamentoDoPainel(holder, { aoTentarDeNovo });
    expect(aviso().hidden).toBe(true);
    vi.advanceTimersByTime(12_000);
    expect(aviso().hidden).toBe(false);
    vi.advanceTimersByTime(13_000);
    const tentar = aviso().querySelector("button");
    expect(tentar.hidden).toBe(false);
    tentar.click();
    expect(aoTentarDeNovo).toHaveBeenCalledOnce();
  });

  it("carregou antes da demora: o aviso não aparece depois", () => {
    acompanharCarregamentoDoPainel(holder);
    const avisoDoPainel = aviso();
    quadro.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(30_000);
    expect(avisoDoPainel.hidden).toBe(true);
  });

  describe("painel que avisa quando fica pronto (Apps Script)", () => {
    const avisar = (tipo, source = quadro.contentWindow) =>
      window.dispatchEvent(
        new MessageEvent("message", { data: { tipo }, source }),
      );
    const saindo = () =>
      esqueleto()?.classList.contains("esqueleto-do-painel--saindo");

    it("avisou que está a carregar: o skeleton fica até o pronto", () => {
      acompanharCarregamentoDoPainel(holder);
      avisar(AVISO_DO_PAINEL_CARREGANDO);
      quadro.dispatchEvent(new Event("load"));
      vi.advanceTimersByTime(5_000);
      expect(saindo()).toBe(false);
      avisar(AVISO_DO_PAINEL_PRONTO);
      expect(saindo()).toBe(true);
    });

    it("o aviso pode chegar logo depois do load", () => {
      acompanharCarregamentoDoPainel(holder);
      quadro.dispatchEvent(new Event("load"));
      vi.advanceTimersByTime(100);
      avisar(AVISO_DO_PAINEL_CARREGANDO);
      vi.advanceTimersByTime(5_000);
      expect(saindo()).toBe(false);
      avisar(AVISO_DO_PAINEL_PRONTO);
      expect(saindo()).toBe(true);
    });

    it("aceita o aviso de um iframe dentro do iframe", () => {
      const interno = quadro.contentDocument.createElement("iframe");
      quadro.contentDocument.body.append(interno);
      acompanharCarregamentoDoPainel(holder);
      avisar(AVISO_DO_PAINEL_PRONTO, interno.contentWindow);
      expect(saindo()).toBe(true);
    });

    it("ignora aviso que não veio deste painel", () => {
      const outro = document.createElement("iframe");
      document.body.append(outro);
      acompanharCarregamentoDoPainel(holder);
      avisar(AVISO_DO_PAINEL_PRONTO, outro.contentWindow);
      avisar(AVISO_DO_PAINEL_PRONTO, null);
      expect(saindo()).toBe(false);
    });

    it("avisou e travou: o skeleton sai depois da espera máxima", () => {
      acompanharCarregamentoDoPainel(holder);
      avisar(AVISO_DO_PAINEL_CARREGANDO);
      quadro.dispatchEvent(new Event("load"));
      vi.advanceTimersByTime(44_000);
      expect(saindo()).toBe(false);
      vi.advanceTimersByTime(1_000);
      expect(saindo()).toBe(true);
    });
  });

  it("sem iframe (painel em manutenção ou sem endereço), não cobre nada", () => {
    holder.replaceChildren();
    acompanharCarregamentoDoPainel(holder);
    expect(esqueleto()).toBeNull();
  });

  it("o legado liga o skeleton ao criar o iframe do painel", () => {
    const inicio = legado.indexOf("function buildExternalPanel(holder, panel)");
    const fim = legado.slice(inicio + 1).search(/\n(async )?function /);
    const corpo = legado.slice(inicio, inicio + 1 + fim);
    expect(
      corpo.indexOf("acompanharCarregamentoDoPainel(holder"),
    ).toBeGreaterThan(corpo.indexOf('class="external-frame"'));
  });
});
