import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAVE_DA_BARRA_RECOLHIDA,
  CHAVE_DO_TEMA,
  criarMoldura,
} from "../../src/app/moldura.ts";
import type { OpcoesDaMoldura } from "../../src/app/moldura.ts";
import { filtrosVazios } from "../../src/lib/visao-geral.ts";
import {
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../../src/lib/eventos-da-barra-lateral.ts";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { definido } from "../definido.ts";
import { janelaCom } from "./janela-falsa.ts";
import type { OuvinteDaJanela, OuvintesDaJanela } from "./janela-falsa.ts";

/*
  A moldura do app (src/app/moldura.ts): um store (barra, tema, tela cheia e
  o cabeçalho do PDF) que a casca liga à página (`ligarNaPagina`: classes de
  body/html, eventos da barra, largura, outra aba e tela cheia).
*/

let desligar: (() => void) | null = null;

function janelaFalsa({ celular = false }: { celular?: boolean } = {}) {
  const ouvintes: OuvintesDaJanela = {};
  return janelaCom({
    matchMedia: () => ({ matches: celular }),
    addEventListener: (nome: string, funcao: OuvinteDaJanela) => {
      (ouvintes[nome] ||= new Set()).add(funcao);
    },
    removeEventListener: (nome: string, funcao: OuvinteDaJanela) =>
      ouvintes[nome]?.delete(funcao),
    dispatchEvent: vi.fn(),
    print: vi.fn(),
    emitir: (nome: string, evento: unknown = {}) =>
      ouvintes[nome]?.forEach((funcao) => funcao(evento)),
  });
}

function montar(
  opcoes: { celular?: boolean; extras?: Partial<OpcoesDaMoldura> } = {},
) {
  const janela = janelaFalsa(opcoes);
  const avisar = vi.fn();
  const moldura = criarMoldura({
    janela,
    avisar,
    relatorio: () => ({
      filtros: filtrosVazios(),
      busca: "",
      filtradas: [{ vagas_total: 10, contratados: 4, vagas_ociosas: 2 }],
    }),
    ...opcoes.extras,
  });
  // Como a casca faz ao montar (src/app/casca/pecas.tsx, MolduraNaPagina).
  desligar?.();
  desligar = moldura.ligarNaPagina();
  return { moldura, janela, avisar };
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = "";
  document.documentElement.setAttribute("data-theme", "");
  document.body.innerHTML = `<i id="fullscreenActionIcon"></i><div class="content"><p>conteúdo</p></div>`;
});
afterEach(() => {
  desligar?.();
  desligar = null;
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
    janela.emitir("storage", { key: CHAVE_DO_TEMA, newValue: "1" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    janela.emitir("storage", { key: "outra", newValue: "0" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("tela cheia", () => {
  it("sem a do navegador, expande o app (o ícone lê o estado)", () => {
    const { moldura, avisar } = montar();
    moldura.alternarTelaCheia();
    expect(document.body.classList).toContain("app-fullscreen-fallback");
    expect(document.body.classList).toContain("system-fullscreen-mode");
    expect(moldura.obter().telaCheiaDoApp).toBe(true);
    expect(avisar).toHaveBeenCalledWith("Modo expandido ativado.");
    moldura.sairDaTelaCheia();
    expect(document.body.classList).not.toContain("app-fullscreen-fallback");
  });

  it("pede a tela cheia do alvo (o painel externo aberto)", () => {
    const alvo = Object.assign(document.createElement("div"), {
      requestFullscreen: vi.fn(() => Promise.resolve()),
    });
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true,
    });
    const { moldura } = montar({ extras: { alvoDaTelaCheia: () => alvo } });
    moldura.alternarTelaCheia();
    expect(alvo.requestFullscreen).toHaveBeenCalled();
    Reflect.deleteProperty(document, "fullscreenEnabled");
  });
});

describe("relatório em PDF", () => {
  it("publica o cabeçalho do relatório, imprime e limpa", () => {
    vi.useFakeTimers();
    const { moldura, janela, avisar } = montar();
    moldura.exportarPdf();
    const { relatorio } = moldura.obter();
    expect(relatorio?.vagas).toBe(10);
    expect(relatorio?.contratados).toBe(4);
    expect(relatorio?.filtros).toContain("Nenhum filtro aplicado");
    vi.advanceTimersByTime(120);
    expect(janela.print).toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(moldura.obter().relatorio).toBeNull();
    expect(avisar).toHaveBeenCalled();
  });

  it.each([
    ["saude-indigena", "Yeendé — Saúde Indígena"],
    ["sede", "Yeendé — SEDE"],
    ["projetos", "Yeendé — Projetos"],
  ])("o título do relatório é o da área aberta (%s)", (area, titulo) => {
    definirAreaAtual(area);
    const { moldura } = montar();
    moldura.exportarPdf();
    expect(moldura.obter().relatorio?.titulo).toBe(titulo);
  });
});

describe("a página", () => {
  it("desligada (a casca desmontou), as mudanças não mexem mais na página", () => {
    const { moldura, janela } = montar();
    definido(desligar)();
    desligar = null;
    moldura.alternarTema();
    expect(document.documentElement.getAttribute("data-theme")).toBe("");
    janela.emitir("storage", { key: CHAVE_DO_TEMA, newValue: "1" });
    expect(moldura.obter().temaEscuro).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("");
  });

  it("o estado começa no que o primeiro quadro pintou (body e html)", () => {
    document.body.className = "sidebar-collapsed";
    document.documentElement.setAttribute("data-theme", "dark");
    const moldura = criarMoldura({ janela: janelaFalsa() });
    expect(moldura.obter()).toMatchObject({
      barraRecolhida: true,
      temaEscuro: true,
    });
  });
});
