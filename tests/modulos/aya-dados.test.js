import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { clicar, digitar, teclar } from "../componentes/interacoes.js";
import { consumirPedidoDeFiltro } from "../../src/app/pedido-de-filtro.js";

/*
  A Aya mais esperta no painel (src/modulos/aya/aya.jsx): a resposta com
  número traz "Abrir", que navega com o filtro pedido; "não ajudou" e "não
  entendi" guardam a pergunta (sem dado pessoal) e o administrador global
  copia a lista; "me mostra esta tela" digitado começa o tour; o perfil vai
  junto da pergunta.
*/

const { montarAya, CHAVE_SEM_RESPOSTA } =
  await import("../../src/modulos/aya/aya.jsx");
const { definirPaginaDaAya, redefinirPaginaDaAya } =
  await import("../../src/modulos/aya/estado.js");

let raiz;
let controlador;
let perguntar;
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

async function montar() {
  raiz = document.createElement("div");
  document.body.append(raiz);
  await act(async () => {
    controlador = montarAya({
      elemento: raiz,
      perguntar,
      navegar,
      abrirSecao: vi.fn(),
      obterPerfil: () => perfil,
      configuracao: () => "",
    });
  });
}

async function perguntarNoCampo(texto) {
  await digitar($("textarea"), texto);
  await teclar($("textarea"), "Enter");
}

let paginaFalsa;
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  // Sem os convites (primeiros passos e tour da tela) no meio do teste.
  localStorage.setItem("agsus_aya_primeiros_passos_oferecidos_v1", "1");
  localStorage.setItem(
    "agsus_aya_convites_de_tour_v1",
    JSON.stringify(["recursos"]),
  );
  localStorage.setItem("agsus_monitora_arara_oculta_v1", "0");
  redefinirDadosDoMonitoramento();
  definirAreasDoUsuario(["saude-indigena", "sede", "projetos"]);
  definirAreaAtual("sede");
  redefinirPaginaDaAya();
  definirPaginaDaAya("recursos", "Recursos");
  perfil = {
    ativo: true,
    perfil: "usuario",
    admin_global: false,
    permissoes: { recursos: "leitor" },
  };
  navegar = vi.fn();
  perguntar = vi.fn(async () => ({
    answer: "Há 3 recursos aguardando parecer no edital 93/2026.",
    provider: "monitora-dados",
    acaoDados: {
      view: "recursos",
      filtro: { edital: "93/2026", metrica: "aguardandoParecer" },
    },
  }));
  paginaFalsa = document.createElement("section");
  paginaFalsa.id = "page-recursos";
  paginaFalsa.className = "page active";
  paginaFalsa.innerHTML =
    '<div data-tour="recursos-kpis">KPIs</div><div data-tour="recursos-fila">Fila</div>';
  document.body.append(paginaFalsa);
});

afterEach(async () => {
  await act(async () => controlador?.desmontar());
  raiz?.remove();
  paginaFalsa?.remove();
});

describe("dados ao vivo", () => {
  it("o perfil vai junto e o Abrir navega com o filtro", async () => {
    await montar();
    await perguntarNoCampo("quantos recursos aguardando parecer no 93/2026?");
    expect(perguntar.mock.calls[0][0].perfil).toBe(perfil);
    expect($(".aya-mensagem__origem").textContent).toBe("Dados ao vivo");
    await clicar(botao("Abrir"));
    expect(navegar).toHaveBeenCalledWith("recursos");
    expect(consumirPedidoDeFiltro("recursos")).toEqual({
      edital: "93/2026",
      metrica: "aguardandoParecer",
    });
  });
});

describe("perguntas sem resposta", () => {
  it("não ajudou guarda a pergunta sem dado pessoal; só o admin copia", async () => {
    await montar();
    await perguntarNoCampo("recurso do CPF 123.456.789-09 sumiu?");
    await clicar(botao("Não ajudou"));
    const guardadas = JSON.parse(localStorage.getItem(CHAVE_SEM_RESPOSTA));
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]).toMatchObject({
      pergunta: "recurso do CPF [número] sumiu?",
      pagina: "recursos",
      motivo: "nao-ajudou",
    });
    expect(botao("Copiar perguntas sem resposta")).toBeFalsy();
  });

  it("não entendi também guarda, e o admin global copia a lista", async () => {
    perfil = { ...perfil, admin_global: true };
    perguntar.mockResolvedValueOnce({
      answer: "Não encontrei exatamente isso. Você quis dizer…?",
      semResposta: true,
      sugestoes: [],
    });
    const escrever = vi.fn(async () => {});
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: escrever },
    });
    await montar();
    await perguntarNoCampo("xpto da planilha?");
    await clicar(botao("Copiar perguntas sem resposta"));
    expect(escrever).toHaveBeenCalledWith(
      expect.stringContaining("- xpto da planilha? (recursos; não entendi"),
    );
  });
});

describe("educação guiada pelo texto", () => {
  it('"me mostra esta tela" começa o tour, sem perguntar à base', async () => {
    await montar();
    await perguntarNoCampo("me mostra esta tela");
    expect(perguntar).not.toHaveBeenCalled();
    expect($(".aya-tour__contador").textContent).toMatch(/^Passo 1 de \d+$/);
    expect($(".aya-tour__titulo").textContent).toBe("Indicadores");
  });
});
