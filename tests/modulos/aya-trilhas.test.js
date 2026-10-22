import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { clicar, teclar } from "../componentes/interacoes.js";

/*
  Tours e trilhas no painel da Aya (src/modulos/aya/): o botão "Me mostra
  esta tela" no cabeçalho e a sugestão do mesmo nome, a seção "Aprender" com
  as trilhas do perfil e o progresso, a trilha que retoma de onde parou e
  marca concluída, e a oferta de "Primeiros passos" só na primeira entrada.
*/

const { montarAya } = await import("../../src/modulos/aya/aya.jsx");
const { definirPaginaDaAya, redefinirPaginaDaAya } =
  await import("../../src/modulos/aya/estado.js");
const { CHAVE_PROGRESSO_DAS_TRILHAS, CHAVE_OFERTA_DE_PRIMEIROS_PASSOS } =
  await import("../../src/modulos/aya/tour/progresso.js");

let raiz;
let controlador;
let paginaFalsa;
let navegar;
let perfil;

const $ = (seletor) => document.querySelector(seletor);
const $$ = (seletor) => [...document.querySelectorAll(seletor)];
const botao = (rotulo) =>
  $$("button").find(
    (b) =>
      b.getAttribute("aria-label") === rotulo ||
      b.textContent.trim() === rotulo,
  );
const tituloDoPasso = () => $(".aya-tour__titulo")?.textContent;
const progressoGuardado = () =>
  JSON.parse(localStorage.getItem(CHAVE_PROGRESSO_DAS_TRILHAS) || "{}");

const LEITOR = {
  ativo: true,
  perfil: "usuario",
  admin_global: false,
  permissoes: {
    dashboard: "leitor",
    nucleo: "leitor",
    calendario: "leitor",
    analises: "leitor",
    aprovados: "leitor",
    entrevistas: "leitor",
    recursos: "leitor",
    selecao: "leitor",
  },
};

/* Uma Visão geral e um Recursos de mentira, com os seletores dos roteiros. */
function montarPaginasFalsas() {
  paginaFalsa = document.createElement("div");
  const pedacos = [
    [
      "section",
      { id: "page-dashboard", class: "page active" },
      [
        ["div", { "data-seletor-de-area": "" }],
        ["div", { class: "visao-geral-filtros" }],
        ["div", { class: "visao-geral-kpis" }],
      ],
    ],
    [
      "section",
      { id: "page-recursos", class: "page active" },
      [
        ["div", { class: "recursos-kpis" }],
        ["section", { "aria-labelledby": "recursosFilaTitulo" }],
      ],
    ],
  ];
  for (const [tag, atributos, filhos] of pedacos) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
    for (const [t, a] of filhos) {
      const filho = document.createElement(t);
      for (const [k, v] of Object.entries(a)) filho.setAttribute(k, v);
      el.append(filho);
    }
    paginaFalsa.append(el);
  }
  document.body.append(paginaFalsa);
}

async function montar() {
  raiz = document.createElement("div");
  document.body.append(raiz);
  await act(async () => {
    controlador = montarAya({
      elemento: raiz,
      perguntar: vi.fn(async () => ({ answer: "ok" })),
      navegar,
      abrirSecao: vi.fn(),
      obterPerfil: () => perfil,
      configuracao: () => "",
    });
  });
}

const abrirPainel = () => clicar($(".aya-arara"));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  // Quem já recebeu a oferta não a vê de novo (os testes da oferta limpam isto).
  localStorage.setItem(CHAVE_OFERTA_DE_PRIMEIROS_PASSOS, "1");
  redefinirDadosDoMonitoramento();
  definirAreasDoUsuario(["saude-indigena", "sede"]);
  definirAreaAtual("sede");
  redefinirPaginaDaAya();
  definirPaginaDaAya("recursos", "Recursos");
  navegar = vi.fn((view) => definirPaginaDaAya(view, view));
  perfil = LEITOR;
  Element.prototype.scrollIntoView = vi.fn();
  montarPaginasFalsas();
});

afterEach(async () => {
  await act(async () => controlador?.desmontar());
  raiz?.remove();
  paginaFalsa?.remove();
  vi.useRealTimers();
});

describe("Me mostra esta tela", () => {
  it("botão no cabeçalho; abrir fecha o painel e mostra o 1º passo existente", async () => {
    await montar();
    await abrirPainel();
    expect($(".aya-sugestao--tour")).toBeNull();
    await clicar(botao("Me mostra esta tela"));
    expect($(".aya-painel")).toBeNull();
    // "Novo recurso" não existe para o leitor: o tour começa nos filtros/indicadores.
    expect(tituloDoPasso()).toBe("Indicadores");
    await teclar(document.activeElement, "Escape");
    expect($(".aya-tour")).toBeNull();
    expect(document.activeElement).toBe($(".aya-arara"));
  });

  it("tela sem roteiro não oferece o tour", async () => {
    definirPaginaDaAya("external", "Painel externo");
    await montar();
    await abrirPainel();
    expect(botao("Me mostra esta tela")).toBeFalsy();
  });
});

describe("Aprender", () => {
  it("nasce recolhido: só o botão Aprender; clicar mostra as trilhas", async () => {
    await montar();
    await abrirPainel();
    const abrir = $(".aya-aprender__abrir");
    expect(abrir.textContent).toContain("Aprender");
    expect(abrir.getAttribute("aria-expanded")).toBe("false");
    expect($(".aya-aprender__lista").hidden).toBe(true);
    await clicar(abrir);
    expect(abrir.getAttribute("aria-expanded")).toBe("true");
    expect($(".aya-aprender__lista").hidden).toBe(false);
  });

  it("lista só as trilhas do perfil, com o total de passos", async () => {
    await montar();
    await abrirPainel();
    const trilhas = $$(".aya-trilha").map((b) => b.dataset.trilha);
    expect(trilhas).toEqual([
      "primeiros-passos",
      "do-edital-ao-aprovado",
      "conduzir-entrevista",
    ]);
    expect(
      $(".aya-trilha[data-trilha='primeiros-passos']").textContent,
    ).toContain("8 passos");
  });

  it("a trilha navega, guarda o passo e retoma de onde parou", async () => {
    await montar();
    await abrirPainel();
    await clicar($(".aya-trilha[data-trilha='primeiros-passos']"));
    expect(navegar).toHaveBeenCalledWith("dashboard");
    expect(tituloDoPasso()).toBe("Boas-vindas ao MONITORA");
    await clicar(botao("Próximo"));
    expect(tituloDoPasso()).toBe("Área atual");
    await clicar(botao("Próximo"));
    // "Menu" (#nav) não existe aqui: pula para os filtros.
    expect(tituloDoPasso()).toBe("Visão geral: filtros");
    expect(progressoGuardado()["primeiros-passos"]).toEqual({
      passo: 3,
      concluida: false,
    });
    await clicar(botao("Pular"));

    await abrirPainel();
    expect(
      $(".aya-trilha[data-trilha='primeiros-passos']").textContent,
    ).toContain("4 de 8");
    await clicar($(".aya-trilha[data-trilha='primeiros-passos']"));
    expect(tituloDoPasso()).toBe("Visão geral: filtros");
  });

  it("chegar ao fim marca a trilha como concluída", async () => {
    localStorage.setItem(
      CHAVE_PROGRESSO_DAS_TRILHAS,
      JSON.stringify({ "primeiros-passos": { passo: 7, concluida: false } }),
    );
    definirPaginaDaAya("dashboard", "Visão geral");
    await montar();
    await abrirPainel();
    await clicar($(".aya-trilha[data-trilha='primeiros-passos']"));
    expect(tituloDoPasso()).toBe("Peça ajuda à Aya");
    await clicar(botao("Concluir"));
    expect(progressoGuardado()["primeiros-passos"].concluida).toBe(true);
    await abrirPainel();
    expect(
      $(".aya-trilha[data-trilha='primeiros-passos']").textContent,
    ).toContain("Concluída");
  });

  it("sem localStorage, a trilha funciona e só não lembra", async () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("bloqueado");
    };
    try {
      await montar();
      await abrirPainel();
      await clicar($(".aya-trilha[data-trilha='primeiros-passos']"));
      expect(tituloDoPasso()).toBe("Boas-vindas ao MONITORA");
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe("primeira entrada", () => {
  beforeEach(() => localStorage.removeItem(CHAVE_OFERTA_DE_PRIMEIROS_PASSOS));

  it("oferece Primeiros passos uma vez, sem abrir nada sozinha", async () => {
    await montar();
    expect($(".aya-oferta--balao")).not.toBeNull();
    expect($(".aya-tour")).toBeNull();
    expect($(".aya-painel")).toBeNull();
    expect(localStorage.getItem(CHAVE_OFERTA_DE_PRIMEIROS_PASSOS)).toBe("1");
    await clicar(botao("Agora não"));
    expect($(".aya-oferta[aria-label='Primeiros passos']")).toBeNull();
    // Depois dela, o convite discreto para o tour desta tela (uma vez só).
    expect($(".aya-oferta--balao").getAttribute("aria-label")).toMatch(
      /^Tour: /,
    );
    await clicar(botao("Agora não"));
    expect($(".aya-oferta")).toBeNull();

    // Recarregou: não oferece de novo.
    await act(async () => controlador.desmontar());
    raiz.remove();
    await montar();
    expect($(".aya-oferta")).toBeNull();
  });

  it("aceitar começa a trilha", async () => {
    await montar();
    await clicar(botao("Mostrar"));
    expect(tituloDoPasso()).toBe("Boas-vindas ao MONITORA");
  });

  it("sem perfil (antes de entrar), não oferece", async () => {
    perfil = null;
    await montar();
    expect($(".aya-oferta")).toBeNull();
    expect(localStorage.getItem(CHAVE_OFERTA_DE_PRIMEIROS_PASSOS)).toBeNull();
  });
});
