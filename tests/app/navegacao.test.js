import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarNavegacao, TELAS_REACT } from "../../src/app/navegacao.js";
import { CHAVE_DA_TELA_GUARDADA } from "../../src/lib/navegacao.js";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import {
  obterEstadoDaBarraLateral,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.js";
import {
  obterPaginaDaAya,
  redefinirPaginaDaAya,
} from "../../src/modulos/aya/estado.js";

/*
  A navegação do app (src/app/navegacao.js): troca de tela, título, menu,
  permissões, guarda de saída, versão nova esperando, painel externo e os
  avisos para quem acompanha (auditoria e presença).
*/

const TELAS = [
  "dashboard",
  "nucleo",
  "calendario",
  "approved",
  "recursos",
  "entrevistas",
  "analises",
  "classificacao",
  "selecao",
  "config",
  "external",
];

function montarPaginas() {
  document.body.className = "";
  document.body.innerHTML = `
    <h1 id="pageTitle"></h1><p id="pageSubtitle"></p>
    <div class="content">
      ${TELAS.map((tela) => `<section id="page-${tela}" class="page"></section>`).join("")}
    </div>`;
}

const GESTOR = { id: "g", ativo: true, perfil: "edital_gestor" };
const SO_EDITAIS = { id: "e", ativo: true, permissoes: { nucleo: "leitor" } };

function criar(opcoes = {}) {
  const janela = {
    recursosController: { render: vi.fn() },
    nucleoController: { render: vi.fn() },
    location: { reload: vi.fn() },
  };
  const paineis = {
    podeAbrir: (codigo) => codigo === "bi",
    primeiro: () => ({ codigo: "bi" }),
    doMenu: () => [],
    mostrar: vi.fn(),
    esquecerAtual: vi.fn(),
  };
  const avisar = vi.fn();
  const navegacao = criarNavegacao({
    janela,
    obterPerfil: () => GESTOR,
    paineis,
    avisar,
    configuracao: (chave) =>
      ({ nucleo_page_subtitle: "Editais da área" })[chave] || "",
    confirmarSaida: () => true,
    aplicarAtualizacao: () => false,
    ...opcoes,
  });
  return { navegacao, janela, paineis, avisar };
}

const ativas = () =>
  [...document.querySelectorAll(".page.active")].map((pagina) => pagina.id);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  montarPaginas();
});
afterEach(() => {
  redefinirDadosDoMonitoramento();
  redefinirBarraLateral();
  redefinirPaginaDaAya();
});

describe("troca de tela", () => {
  it("render que falha vira aviso amigável, sem rejeição solta", async () => {
    const { navegacao, janela, avisar } = criar();
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    janela.recursosController.render.mockRejectedValue(
      new Error("tabela fora do ar"),
    );
    navegacao.irPara("recursos");
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(avisar).toHaveBeenCalledWith(
      "Não foi possível abrir Recursos: tabela fora do ar",
      "error",
    );
    expect(navegacao.obter().view).toBe("recursos");
    erro.mockRestore();
  });

  it("deixa só a página pedida ativa, com título, menu e render do controlador", () => {
    const { navegacao, janela } = criar();
    navegacao.irPara("recursos");
    expect(ativas()).toEqual(["page-recursos"]);
    expect(document.getElementById("pageTitle").textContent).toBe("Recursos");
    expect(document.getElementById("pageSubtitle").textContent).toBe(
      "Saúde Indígena",
    );
    expect(janela.recursosController.render).toHaveBeenCalledTimes(1);
    expect(navegacao.obter().view).toBe("recursos");
    expect(obterEstadoDaBarraLateral().ativo.view).toBe("recursos");
    expect(localStorage.getItem(CHAVE_DA_TELA_GUARDADA)).toBe("recursos");
    expect(obterPaginaDaAya()).toMatchObject({
      view: "recursos",
      titulo: "Recursos",
    });
  });

  it("o subtítulo das telas React vem depois da área", () => {
    const { navegacao } = criar();
    navegacao.irPara("nucleo");
    expect(document.getElementById("pageSubtitle").textContent).toBe(
      "Saúde Indígena · Editais da área",
    );
  });

  it("toda tela React tem título e controlador em window", () => {
    for (const [view, montar] of Object.entries(TELAS_REACT)) {
      const [titulo] = montar(() => "", {});
      expect(titulo, view).toBeTruthy();
    }
  });

  it("sem view, abre a tela de entrada (a guardada, se permitida)", () => {
    localStorage.setItem(CHAVE_DA_TELA_GUARDADA, "nucleo");
    const { navegacao } = criar();
    expect(navegacao.telaDeEntrada()).toBe("nucleo");
    navegacao.irPara("");
    expect(ativas()).toEqual(["page-nucleo"]);
  });

  it("sem permissão, avisa e fica onde está", () => {
    const { navegacao, avisar } = criar({ obterPerfil: () => SO_EDITAIS });
    navegacao.irPara("nucleo");
    navegacao.irPara("config");
    expect(avisar).toHaveBeenCalledWith(
      "Sem permissão para Configurações.",
      "warn",
    );
    expect(ativas()).toEqual(["page-nucleo"]);
    expect(navegacao.obter().view).toBe("nucleo");
  });

  it("sem módulo liberado, mostra o aviso de sem acesso", () => {
    const { navegacao } = criar();
    navegacao.irPara("sem-acesso");
    expect(ativas()).toEqual(["page-sem-acesso"]);
    expect(document.getElementById("page-sem-acesso").textContent).toContain(
      "não tem módulos liberados",
    );
    expect(document.getElementById("pageTitle").textContent).toBe(
      "Acesso aos módulos",
    );
  });
});

describe("guarda de saída e versão nova", () => {
  it("alteração não salva confirmada como não: não sai da tela", () => {
    const confirmarSaida = vi.fn(() => false);
    const { navegacao } = criar({ confirmarSaida });
    navegacao.irPara("dashboard");
    confirmarSaida.mockClear();
    navegacao.irPara("recursos");
    expect(confirmarSaida).toHaveBeenCalledTimes(1);
    expect(navegacao.obter().view).toBe("dashboard");
  });

  it("reabrir a mesma tela não pergunta", () => {
    const confirmarSaida = vi.fn(() => false);
    const { navegacao } = criar({ confirmarSaida });
    navegacao.irPara("dashboard");
    expect(confirmarSaida).not.toHaveBeenCalled();
  });

  it("a guarda padrão consulta os controladores de Acessos e Módulos", () => {
    const janela = {
      acessosController: { confirmarSaida: vi.fn(() => false) },
      modulosController: { confirmarSaida: vi.fn(() => true) },
      location: { reload: vi.fn() },
    };
    const navegacao = criarNavegacao({
      janela,
      obterPerfil: () => GESTOR,
      aplicarAtualizacao: () => false,
    });
    navegacao.irPara("nucleo");
    expect(janela.acessosController.confirmarSaida).toHaveBeenCalled();
    expect(navegacao.obter().view).toBe("dashboard");
  });

  it("versão nova esperando: guarda a tela pedida e recarrega", () => {
    const { navegacao, janela } = criar({
      aplicarAtualizacao: (recarregar) => {
        recarregar();
        return true;
      },
    });
    navegacao.irPara("nucleo");
    expect(localStorage.getItem(CHAVE_DA_TELA_GUARDADA)).toBe("nucleo");
    expect(janela.location.reload).toHaveBeenCalled();
    expect(ativas()).toEqual([]);
  });
});

describe("painel externo", () => {
  it("abre pelo dono dos painéis; outra tela esquece o painel", () => {
    const { navegacao, paineis } = criar();
    navegacao.irPara("panel:bi");
    expect(paineis.mostrar).toHaveBeenCalledWith("bi");
    expect(paineis.esquecerAtual).not.toHaveBeenCalled();
    navegacao.irPara("nucleo");
    expect(paineis.esquecerAtual).toHaveBeenCalled();
  });

  it("tira o modo de painel externo ao trocar de tela", () => {
    const { navegacao } = criar();
    document.body.classList.add("external-panel-mode", "external-clean");
    navegacao.irPara("nucleo");
    expect(document.body.classList.contains("external-panel-mode")).toBe(false);
    expect(document.body.classList.contains("external-clean")).toBe(false);
  });
});

describe("quem acompanha a navegação", () => {
  it("recebe a abertura (com a anterior) e a marcação do menu", () => {
    const { navegacao } = criar();
    const eventos = [];
    navegacao.assinar((evento) => eventos.push(evento));
    navegacao.irPara("nucleo");
    navegacao.irPara("recursos");
    expect(eventos.filter((e) => e.tipo === "abertura")).toEqual([
      { tipo: "abertura", view: "nucleo", anterior: "dashboard" },
      { tipo: "abertura", view: "recursos", anterior: "nucleo" },
    ]);
    expect(eventos.some((e) => e.tipo === "menu")).toBe(true);
  });

  it("a troca de área refaz o cabeçalho da Visão geral", () => {
    const { navegacao } = criar();
    definirAreasDoUsuario(["saude-indigena", "sede"]);
    const parar = navegacao.acompanharArea();
    navegacao.irPara("dashboard");
    const antes = document.getElementById("pageTitle").textContent;
    definirAreaAtual("sede");
    expect(document.getElementById("pageTitle").textContent).not.toBe(antes);
    parar();
  });
});
