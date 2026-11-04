// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fonteDoApp } from "./fonte-do-app.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPABASE_AUTH_STORAGE_KEY } from "../src/lib/env";
import {
  FORMATOS_DO_ESQUELETO,
  formatoDoEsqueleto,
} from "../src/lib/esqueleto-da-entrada";
import {
  esconderEsqueleto,
  esqueletoAtivo,
  instalarCarregamento,
  marcarAtualizacao,
  mostrarEsqueleto,
} from "../src/app/carregamento.ts";
import { CHAVE_DA_TELA_GUARDADA } from "../src/lib/navegacao";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/styles/carregamento.css", "utf8");
const legado = fonteDoApp();

const inicio = html.indexOf("(function marcarSessaoGuardada()");
const script = html.slice(inicio, html.indexOf("</script>", inicio));

const TELAS = [
  ["", "painel"],
  ["dashboard", "painel"],
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
    const chaveDaTela = CHAVE_DA_TELA_GUARDADA;
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
