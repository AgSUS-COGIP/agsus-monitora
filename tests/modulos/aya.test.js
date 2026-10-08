import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { clicar, digitar, teclar } from "../componentes/interacoes.js";

/*
  O painel da Aya (src/modulos/aya/): abre com a saudação e a mensagem da
  página e da área atuais, sem botões de sugestão; a pergunta vai pelo campo;
  o acesso ao suporte é um ícone do cabeçalho; Aprender fica recolhido; Esc
  fecha e devolve o foco à arara; "não ajudou" mostra o cartão do chamado; a
  conversa fica na aba; a resposta pode trazer o botão da tela citada.
*/

const { montarAya, CHAVE_OCULTA, CHAVE_AVALIACOES } =
  await import("../../src/modulos/aya/aya.jsx");
const { definirPaginaDaAya, redefinirPaginaDaAya } =
  await import("../../src/modulos/aya/estado.js");

let raiz;
let controlador;
let perguntar;
let navegar;
let abrirSecao;

const $ = (seletor) => raiz.querySelector(seletor);
const $$ = (seletor) => [...raiz.querySelectorAll(seletor)];
const textoDe = (seletor) => $(seletor)?.textContent || "";
const botao = (rotulo) =>
  $$("button").find(
    (b) =>
      b.getAttribute("aria-label") === rotulo ||
      b.textContent.trim() === rotulo,
  );
async function perguntarNoCampo(texto) {
  await digitar($("textarea"), texto);
  await teclar($("textarea"), "Enter");
}

async function montar() {
  raiz = document.createElement("div");
  document.body.append(raiz);
  await act(async () => {
    controlador = montarAya({
      elemento: raiz,
      perguntar,
      navegar,
      abrirSecao,
      configuracao: (chave) =>
        ({
          support_email: "suporte@agenciasus.org.br",
          app_version_current: "V1",
        })[chave] || "",
    });
  });
}

async function abrirPainel() {
  await clicar($(".aya-arara"));
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  redefinirDadosDoMonitoramento();
  definirAreasDoUsuario(["saude-indigena", "sede", "projetos"]);
  definirAreaAtual("sede");
  redefinirPaginaDaAya();
  definirPaginaDaAya("recursos", "Recursos");
  perguntar = vi.fn(async ({ question }) => ({
    answer: `Resposta para: ${question}`,
    provider: "curated-official",
    sources: [],
    acao: "config:acessos",
  }));
  navegar = vi.fn();
  abrirSecao = vi.fn();
});

afterEach(async () => {
  await act(async () => controlador?.desmontar());
  raiz?.remove();
});

describe("abrir e fechar", () => {
  it("começa fechada, só com a arara (sem o ponto Beta)", async () => {
    await montar();
    expect($(".aya-painel")).toBeNull();
    expect($(".aya-arara")).not.toBeNull();
    expect($(".aya-arara .aya-selo-beta")).toBeNull();
  });

  it("abre com a saudação e a mensagem da página, sem sugestões", async () => {
    await montar();
    await abrirPainel();
    const painel = $(".aya-painel");
    expect(painel.getAttribute("role")).toBe("dialog");
    expect(textoDe(".aya-balao")).toBe("Olá, sou a Aya.");
    expect(textoDe(".aya-painel__pagina")).toBe("Recursos · SEDE");
    expect(painel.textContent).toContain(
      "Posso explicar o fluxo do parecer jurídico, os prazos e os indicadores desta tela.",
    );
    expect(painel.textContent).toContain("Para começar, digite sua pergunta.");
    // Só o chip do tour da tela; as sugestões de pergunta não aparecem.
    expect(
      [...document.querySelectorAll(".aya-sugestao")].map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(["Me mostra esta tela, item por item"]);
    expect($(".aya-selo-beta--nome").textContent).toContain("Beta");
    expect($(".aya-arara")).toBeNull();
    expect(localStorage.getItem(CHAVE_OCULTA)).toBe("0");
  });

  it("feedback e suporte pelo Gmail num ícone do cabeçalho, sem rodapé fixo", async () => {
    await montar();
    await abrirPainel();
    expect($(".aya-aviso")).toBeNull();
    expect($(".aya-painel__rodape").textContent).not.toContain("chamado");
    const suporte = $(".aya-painel__acoes .aya-suporte");
    expect(suporte.getAttribute("aria-label")).toBe("Feedback e suporte");
    const gmail = new URL(suporte.href);
    expect(gmail.origin).toBe("https://mail.google.com");
    expect(gmail.searchParams.get("to")).toBe("suporte@agenciasus.org.br");
    expect(gmail.searchParams.get("body")).toContain("Página: Recursos");
    expect(suporte.target).toBe("_blank");
    expect($$("a[href^='mailto:']")).toHaveLength(0);
    expect($("textarea").getAttribute("placeholder")).toBe("Pergunte à Aya…");
    expect(botao("Enviar pergunta").disabled).toBe(true);
    await digitar($("textarea"), "oi");
    expect(botao("Enviar pergunta").disabled).toBe(false);
  });

  it("Esc fecha e devolve o foco à arara", async () => {
    await montar();
    await abrirPainel();
    await teclar($("textarea"), "Escape");
    expect($(".aya-painel")).toBeNull();
    expect(document.activeElement).toBe($(".aya-arara"));
    expect(localStorage.getItem(CHAVE_OCULTA)).toBe("1");
  });

  it("o × fecha", async () => {
    await montar();
    await abrirPainel();
    await clicar(botao("Fechar a Aya"));
    expect($(".aya-painel")).toBeNull();
  });
});

describe("página e área atuais", () => {
  it("trocar de página troca a mensagem", async () => {
    await montar();
    await abrirPainel();
    expect($(".aya-painel").textContent).toContain("parecer jurídico");
    await act(async () =>
      definirPaginaDaAya("entrevistas", "Painel de entrevistas"),
    );
    expect($(".aya-painel").textContent).not.toContain("parecer jurídico");
    expect(textoDe(".aya-painel__pagina")).toBe("Painel de entrevistas · SEDE");
  });

  it("a Visão geral segue a área: SEDE sem mapa, Projetos com o mapa", async () => {
    await montar();
    await abrirPainel();
    await act(async () => definirPaginaDaAya("dashboard", "SEDE"));
    expect(textoDe(".aya-painel__pagina")).toBe("Visão geral · SEDE");
    expect($(".aya-painel").textContent).not.toContain("Saúde Indígena");
    await act(async () => definirAreaAtual("projetos"));
    expect(textoDe(".aya-painel__pagina")).toBe("Visão geral · Projetos");
    expect($(".aya-painel").textContent).toContain("mapa");
  });
});

describe("conversa", () => {
  it("a pergunta vai com página, área e seção", async () => {
    await montar();
    await abrirPainel();
    await perguntarNoCampo("Quem pode decidir um recurso?");
    expect(perguntar).toHaveBeenCalledTimes(1);
    expect(perguntar.mock.calls[0][0]).toMatchObject({
      question: "Quem pode decidir um recurso?",
      section: "recursos",
      area: "sede",
      secao: "",
    });
    const log = $('[role="log"]');
    expect(log.getAttribute("aria-live")).toBe("polite");
    expect(log.textContent).toContain("Quem pode decidir um recurso?");
    expect(log.textContent).toContain(
      "Resposta para: Quem pode decidir um recurso?",
    );
    expect(log.textContent).toContain("Fonte oficial");
  });

  it("Enter envia; a conversa fica guardada na aba", async () => {
    await montar();
    await abrirPainel();
    await digitar($("textarea"), "Como dar acesso a alguém?");
    await teclar($("textarea"), "Enter");
    expect(perguntar).toHaveBeenCalledTimes(1);
    const guardada = JSON.parse(
      sessionStorage.getItem("agsus_aya_conversa_v1"),
    );
    expect(guardada.map((t) => t.role)).toEqual(["user", "assistant"]);
  });

  it("a resposta traz o botão da tela citada, que navega no app", async () => {
    await montar();
    await abrirPainel();
    await perguntarNoCampo("Quem pode decidir um recurso?");
    await clicar(botao("Ir para Configurações › Acessos"));
    expect(navegar).toHaveBeenCalledWith("config");
    expect(abrirSecao).toHaveBeenCalledWith("acessos");
  });

  it("em Configurações manda a seção aberta", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<section id="page-config" data-subgrupo="modulos"></section>',
    );
    await act(async () => definirPaginaDaAya("config", "Configurações"));
    await montar();
    await abrirPainel();
    expect(textoDe(".aya-painel__pagina")).toBe(
      "Configurações › Módulos e abas",
    );
    await perguntarNoCampo("O que é o selo BETA?");
    expect(perguntar.mock.calls[0][0]).toMatchObject({
      section: "config",
      secao: "modulos",
    });
    document.getElementById("page-config").remove();
  });

  it("Limpar conversa apaga a conversa e volta o Aprender", async () => {
    await montar();
    await abrirPainel();
    await perguntarNoCampo("Quem pode decidir um recurso?");
    await clicar(botao("Limpar conversa"));
    expect($('[role="log"]').textContent).toBe("");
    expect(sessionStorage.getItem("agsus_aya_conversa_v1")).toBe("[]");
  });
});

describe("avaliação e chamado", () => {
  it("na dúvida oferece perguntas clicáveis e Gmail em outra aba", async () => {
    perguntar.mockResolvedValueOnce({
      answer: "Não encontrei exatamente isso. Você quis dizer…?",
      sugestoes: [
        {
          rotulo: "Prazo do recurso",
          pergunta: "De onde vem o prazo do recurso?",
        },
      ],
      oferecerChamado: true,
    });
    await montar();
    await abrirPainel();
    await digitar($("textarea"), "prazo");
    await clicar(botao("Enviar pergunta"));
    const principal = $(".aya-chamado__botao");
    expect(principal.getAttribute("target")).toBe("_blank");
    expect(principal.getAttribute("rel")).toContain("noopener");
    expect($(".aya-chamado a[href^='mailto:']")).toBeNull();
    await clicar(botao("Prazo do recurso"));
    expect(perguntar).toHaveBeenLastCalledWith(
      expect.objectContaining({ question: "De onde vem o prazo do recurso?" }),
    );
  });

  it("'não ajudou' guarda a avaliação no navegador e mostra o cartão do chamado", async () => {
    await montar();
    await abrirPainel();
    await perguntarNoCampo("Quem pode decidir um recurso?");
    expect($(".aya-chamado")).toBeNull();
    await clicar(botao("Não ajudou"));
    const cartao = $(".aya-chamado");
    expect(cartao.textContent).toContain(
      "Vou abrir o Gmail com a conversa preenchida.",
    );
    const link = cartao.querySelector("a");
    expect(link.textContent).toContain("Abrir chamado");
    const href = link.getAttribute("href");
    expect(
      href.startsWith(
        "https://mail.google.com/mail/?view=cm&fs=1&to=suporte%40agenciasus.org.br",
      ),
    ).toBe(true);
    expect(decodeURIComponent(href)).toContain(
      "MONITORA · Chamado · Recursos · SEDE",
    );
    expect(decodeURIComponent(href)).toContain(
      "Pergunta: Quem pode decidir um recurso?",
    );
    const avaliacoes = JSON.parse(localStorage.getItem(CHAVE_AVALIACOES));
    expect(avaliacoes).toEqual([
      expect.objectContaining({
        pagina: "recursos",
        area: "sede",
        util: false,
      }),
    ]);
  });

  it("'ajudou' agradece, sem cartão", async () => {
    await montar();
    await abrirPainel();
    await perguntarNoCampo("Quem pode decidir um recurso?");
    await clicar(botao("Ajudou"));
    expect($(".aya-chamado")).toBeNull();
    expect($(".aya-avaliacao__obrigado").textContent).toContain("Obrigada");
  });

  it("pedir o suporte mostra o cartão do chamado", async () => {
    await montar();
    await abrirPainel();
    await digitar($("textarea"), "Quero falar com o suporte");
    await teclar($("textarea"), "Enter");
    expect($(".aya-chamado")).not.toBeNull();
  });
});

describe("foco preso no painel", () => {
  it("Tab no último controle volta ao primeiro", async () => {
    await montar();
    await abrirPainel();
    await digitar($("textarea"), "oi");
    const enviar = botao("Enviar pergunta");
    enviar.focus();
    await teclar(enviar, "Tab");
    // O primeiro do cabeçalho é "Me mostra esta tela" (Recursos tem tour).
    expect(document.activeElement).toBe(botao("Me mostra esta tela"));
  });
});
