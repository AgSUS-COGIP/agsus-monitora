import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clicar, digitar, teclar } from "./interacoes.js";
import {
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { EVENTO_ESCOLHA_DA_BUSCA } from "../../src/lib/busca-global.js";

/*
  Busca global (React): Ctrl+K abre só com usuário conectado, Esc e o fundo
  fecham, digitar filtra as linhas do monitoramento, setas + Enter e clique
  escolhem, e a escolha vai ao legado pelo evento com o id da linha.
*/

const { montarBuscaGlobal } =
  await import("../../src/componentes/busca-global/busca-global.jsx");

const LINHAS = [
  {
    id: 10,
    edital: "Edital 01/2026",
    unidade: "DSEI Xavante",
    etapa: "Inscrições",
    uf: "MT",
    risco: "Alto",
  },
  {
    id: 11,
    edital: "Edital 02/2026",
    unidade: "DSEI Yanomami",
    etapa: "Resultado",
    uf: "RR",
    risco: "Médio",
  },
  {
    id: 12,
    edital: "Edital 03/2026",
    unidade: "DSEI Xingu",
    etapa: "Homologação",
    uf: "MT",
    risco: "Baixo",
  },
];

let raiz;
let controlador;
let conectado;
let escolhidos;
const aoEvento = (evento) => escolhidos.push(evento.detail.id);

async function montar() {
  raiz = document.createElement("div");
  document.body.append(raiz);
  await act(async () => {
    controlador = montarBuscaGlobal({
      raizDaTela: raiz,
      estaConectado: () => conectado,
    });
  });
}

const dialogo = () => document.querySelector('[role="dialog"].search-modal');
const campo = () => dialogo()?.querySelector("input");
const itens = () => [...document.querySelectorAll(".search-result-item")];
const ativo = () => document.querySelector(".search-result-item.active");
const ctrlK = (opcoes = { ctrlKey: true }) => teclar(document, "k", opcoes);

beforeEach(async () => {
  conectado = true;
  escolhidos = [];
  document.addEventListener(EVENTO_ESCOLHA_DA_BUSCA, aoEvento);
  publicarLinhasDoMonitoramento(LINHAS);
  await montar();
});

afterEach(async () => {
  document.removeEventListener(EVENTO_ESCOLHA_DA_BUSCA, aoEvento);
  await act(async () => controlador?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  redefinirDadosDoMonitoramento();
});

describe("Busca global", () => {
  it("Ctrl+K abre com o campo vazio e em foco, trava a rolagem e não lista nada", async () => {
    expect(dialogo()).toBeNull();
    await ctrlK();
    expect(dialogo()).not.toBeNull();
    expect(dialogo().getAttribute("aria-label")).toBe("Busca global");
    expect(document.activeElement).toBe(campo());
    expect(campo().value).toBe("");
    expect(itens()).toHaveLength(0);
    expect(document.body.textContent).not.toContain("Nenhum resultado");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("Cmd+K também abre, e o atalho com a busca aberta fecha", async () => {
    await ctrlK({ metaKey: true });
    expect(dialogo()).not.toBeNull();
    await ctrlK();
    expect(dialogo()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("sem usuário conectado, o atalho não abre", async () => {
    conectado = false;
    await ctrlK();
    expect(dialogo()).toBeNull();
  });

  it("Esc, o botão Esc e o clique no fundo fecham", async () => {
    await ctrlK();
    await teclar(campo(), "Escape");
    expect(dialogo()).toBeNull();

    await ctrlK();
    await clicar(document.querySelector(".search-modal-fechar"));
    expect(dialogo()).toBeNull();

    await ctrlK();
    await clicar(dialogo());
    expect(dialogo()).toBeNull();
  });

  it("digitar filtra, mostra título, subtítulo e risco e realça o termo", async () => {
    await ctrlK();
    await digitar(campo(), "xavante");
    expect(itens()).toHaveLength(1);
    const item = itens()[0];
    expect(item.querySelector(".search-result-title").textContent).toBe(
      "Edital 01/2026 — DSEI Xavante",
    );
    expect(item.querySelector(".search-result-sub").textContent).toBe(
      "Inscrições · MT",
    );
    expect(item.querySelector(".search-result-chip").textContent).toBe("Alto");
    expect(item.querySelector(".search-result-chip").className).toContain(
      "risco-red",
    );
    expect(item.querySelector("mark").textContent).toBe("Xavante");

    await digitar(campo(), "mt");
    expect(itens()).toHaveLength(2);
  });

  it("sem resultado, mensagem curta", async () => {
    await ctrlK();
    await digitar(campo(), "nada disso");
    expect(itens()).toHaveLength(0);
    expect(document.body.textContent).toContain("Nenhum resultado encontrado");
  });

  it("setas movem a escolha sem passar das pontas e Enter escolhe", async () => {
    await ctrlK();
    await digitar(campo(), "dsei");
    expect(ativo()).toBeNull();
    await teclar(campo(), "Enter");
    expect(escolhidos).toEqual([]);
    expect(dialogo()).not.toBeNull();

    await teclar(campo(), "ArrowDown");
    await teclar(campo(), "ArrowDown");
    await teclar(campo(), "ArrowDown");
    await teclar(campo(), "ArrowDown");
    expect(ativo()).toBe(itens()[2]);
    expect(campo().getAttribute("aria-activedescendant")).toBe(itens()[2].id);
    await teclar(campo(), "ArrowUp");
    expect(ativo()).toBe(itens()[1]);
    expect(itens()[1].getAttribute("aria-selected")).toBe("true");

    await teclar(campo(), "Enter");
    expect(dialogo()).toBeNull();
    expect(escolhidos).toEqual([11]);
  });

  it("digitar de novo desmarca a escolha", async () => {
    await ctrlK();
    await digitar(campo(), "dsei");
    await teclar(campo(), "ArrowDown");
    expect(ativo()).not.toBeNull();
    await digitar(campo(), "dsei x");
    expect(ativo()).toBeNull();
  });

  it("passar o mouse marca e o clique escolhe", async () => {
    await ctrlK();
    await digitar(campo(), "edital");
    await act(async () => {
      itens()[2].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(ativo()).toBe(itens()[2]);
    await clicar(itens()[0]);
    expect(dialogo()).toBeNull();
    expect(escolhidos).toEqual([10]);
  });

  it("reabrir começa do zero", async () => {
    await ctrlK();
    await digitar(campo(), "xingu");
    await teclar(campo(), "Escape");
    await ctrlK();
    expect(campo().value).toBe("");
    expect(itens()).toHaveLength(0);
  });

  it("acompanha as linhas que o legado publica depois de aberta", async () => {
    await ctrlK();
    await digitar(campo(), "kayapó");
    expect(itens()).toHaveLength(0);
    await act(async () => {
      publicarLinhasDoMonitoramento([
        ...LINHAS,
        { id: 13, edital: "Edital 04", unidade: "DSEI Kayapó", risco: "" },
      ]);
    });
    expect(itens()).toHaveLength(1);
    expect(itens()[0].querySelector(".search-result-chip").textContent).toBe(
      "Baixo",
    );
  });
});

describe("o legado recebe a escolha", () => {
  const legado = readFileSync("src/app/sistema.js", "utf8");

  it("escuta o evento e localiza a linha no painel", () => {
    expect(legado).toMatch(
      /addEventListener\(EVENTO_ESCOLHA_DA_BUSCA,[\s\S]{0,80}localizarLinhaDoMonitoramento\(evento\.detail\?\.id\)/,
    );
    const corpo = legado.slice(
      legado.indexOf("function localizarLinhaDoMonitoramento"),
    );
    expect(corpo).toMatch(/if \(!perfil\.pode\("ind"\)\)/);
    expect(corpo).toMatch(/irPara\("dashboard"\)/);
    // O recorte (unidade e edital da linha) e o destaque são da Visão geral.
    expect(corpo).toMatch(/estadoDaVisaoGeral\.localizar\(linha\)/);
  });

  it("a busca antiga saiu", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).not.toContain("searchModal");
    expect(html).toContain('id="buscaGlobalApp"');
    for (const nome of [
      "openSearchModal",
      "closeSearchModal",
      "runGlobalSearch",
      "searchModalKey",
      "selectSearchResult",
      "highlightSearchItems",
      "searchIdx",
    ])
      expect(legado).not.toContain(nome);
  });
});
