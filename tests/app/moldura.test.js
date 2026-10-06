import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAVE_DA_BARRA_RECOLHIDA,
  CHAVE_DO_TEMA,
  criarMoldura,
} from "../../src/app/moldura.js";
import {
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../../src/lib/eventos-da-barra-lateral.js";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";

/* A moldura do app (src/app/moldura.js): barra, tema, tela cheia e PDF. */

function janelaFalsa({ celular = false } = {}) {
  const ouvintes = {};
  return {
    matchMedia: () => ({ matches: celular }),
    addEventListener: (nome, funcao) => {
      (ouvintes[nome] ||= new Set()).add(funcao);
    },
    removeEventListener: (nome, funcao) => ouvintes[nome]?.delete(funcao),
    dispatchEvent: vi.fn(),
    print: vi.fn(),
    emitir: (nome, evento = {}) =>
      ouvintes[nome]?.forEach((funcao) => funcao(evento)),
  };
}

function montar(opcoes = {}) {
  const janela = janelaFalsa(opcoes);
  const avisar = vi.fn();
  const moldura = criarMoldura({
    janela,
    avisar,
    relatorio: () => ({
      filtros: {},
      busca: "",
      filtradas: [{ vagas_total: 10, contratados: 4, vagas_ociosas: 2 }],
    }),
    ...opcoes.extras,
  });
  return { moldura, janela, avisar };
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = "";
  document.documentElement.setAttribute("data-theme", "");
  document.body.innerHTML = `<i id="fullscreenActionIcon"></i><div class="content"><p>conteúdo</p></div>`;
});
afterEach(() => {
  vi.useRealTimers();
  redefinirDadosDoMonitoramento();
});

describe("barra lateral", () => {
  it("no computador, recolhe/expande, guarda e avisa a barra React", () => {
    const { moldura } = montar();
    const aviso = vi.fn();
    document.addEventListener(EVENTO_BARRA_ALTERNADA, aviso);
    moldura.alternarBarra();
    expect(document.body.classList).toContain("sidebar-collapsed");
    expect(localStorage.getItem(CHAVE_DA_BARRA_RECOLHIDA)).toBe("1");
    moldura.alternarBarra();
    expect(localStorage.getItem(CHAVE_DA_BARRA_RECOLHIDA)).toBe("0");
    expect(aviso).toHaveBeenCalled();
    document.removeEventListener(EVENTO_BARRA_ALTERNADA, aviso);
  });

  it("reaplica a escolha guardada (só no computador)", () => {
    localStorage.setItem(CHAVE_DA_BARRA_RECOLHIDA, "1");
    montar().moldura.aplicarBarraGuardada();
    expect(document.body.classList).toContain("sidebar-collapsed");
    document.body.className = "";
    montar({ celular: true }).moldura.aplicarBarraGuardada();
    expect(document.body.classList).not.toContain("sidebar-collapsed");
  });

  it("no celular, abre por cima e recolhe ao mudar a largura", () => {
    vi.useFakeTimers();
    const { moldura, janela } = montar({ celular: true });
    moldura.ajustarBarra();
    expect(document.body.classList).toContain("sidebar-collapsed");
    moldura.alternarBarra();
    expect(document.body.classList).toContain("sidebar-open");
    expect(document.body.classList).not.toContain("sidebar-collapsed");
    expect(localStorage.getItem(CHAVE_DA_BARRA_RECOLHIDA)).toBeNull();
    moldura.alternarBarra();
    moldura.acompanharLargura();
    janela.emitir("resize");
    vi.advanceTimersByTime(220);
    expect(document.body.classList).toContain("sidebar-collapsed");
  });
});

describe("tema", () => {
  it("alterna, guarda, marca o html e o body e avisa", () => {
    const { moldura } = montar();
    const aviso = vi.fn();
    document.addEventListener(EVENTO_TEMA_ALTERADO, aviso);
    moldura.alternarTema();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.body.classList).toContain("dark-mode");
    expect(localStorage.getItem(CHAVE_DO_TEMA)).toBe("1");
    expect(aviso).toHaveBeenCalled();
    moldura.alternarTema();
    expect(document.documentElement.getAttribute("data-theme")).toBe("");
    document.removeEventListener(EVENTO_TEMA_ALTERADO, aviso);
  });

  it("sem preferência, claro; o tema trocado em outra aba vale aqui", () => {
    const { moldura, janela } = montar();
    moldura.aplicarTemaGuardado();
    expect(document.documentElement.getAttribute("data-theme")).toBe("");
    moldura.acompanharTemaDeOutraAba();
    janela.emitir("storage", { key: CHAVE_DO_TEMA, newValue: "1" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    janela.emitir("storage", { key: "outra", newValue: "0" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("tela cheia", () => {
  it("sem a do navegador, expande o app e troca o ícone", () => {
    const { moldura, avisar } = montar();
    moldura.alternarTelaCheia();
    expect(document.body.classList).toContain("app-fullscreen-fallback");
    expect(document.getElementById("fullscreenActionIcon").className).toBe(
      "fa-solid fa-compress",
    );
    expect(avisar).toHaveBeenCalledWith("Modo expandido ativado.");
    moldura.sairDaTelaCheia();
    expect(document.body.classList).not.toContain("app-fullscreen-fallback");
  });

  it("pede a tela cheia do alvo (o painel externo aberto)", () => {
    const alvo = { requestFullscreen: vi.fn(() => Promise.resolve()) };
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true,
    });
    const { moldura } = montar({ extras: { alvoDaTelaCheia: () => alvo } });
    moldura.alternarTelaCheia();
    expect(alvo.requestFullscreen).toHaveBeenCalled();
    delete document.fullscreenEnabled;
  });
});

describe("relatório em PDF", () => {
  it("põe o cabeçalho do relatório como texto, imprime e limpa", () => {
    vi.useFakeTimers();
    const { moldura, janela, avisar } = montar();
    moldura.exportarPdf();
    const cabecalho = document.getElementById("printReportHeader");
    expect(cabecalho.className).toBe("print-only");
    expect(cabecalho.textContent).toContain("Relatório de processos seletivos");
    expect(cabecalho.textContent).toContain("10 vagas previstas");
    expect(document.querySelector(".content").firstChild).toBe(cabecalho);
    vi.advanceTimersByTime(120);
    expect(janela.print).toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(document.getElementById("printReportHeader")).toBeNull();
    expect(avisar).toHaveBeenCalled();
  });

  it.each([
    ["saude-indigena", "AgSUS Monitora — Saúde Indígena"],
    ["sede", "AgSUS Monitora — SEDE"],
    ["projetos", "AgSUS Monitora — Projetos"],
  ])("o título do relatório é o da área aberta (%s)", (area, titulo) => {
    definirAreaAtual(area);
    montar().moldura.exportarPdf();
    const cabecalho = document.getElementById("printReportHeader");
    expect(cabecalho.firstChild.firstChild.textContent).toBe(titulo);
  });
});
