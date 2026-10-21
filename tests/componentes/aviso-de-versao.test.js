import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AVISO_DE_PENDENCIA,
  CHAVE_DO_FECHAMENTO,
  INTERVALO_DA_CONFERENCIA_MS,
  criarAvisoDeVersao,
} from "../../src/app/aviso-de-versao.ts";
import { montarAvisoDeVersao } from "../../src/componentes/aviso-de-versao/aviso-de-versao.tsx";
import { EVENTO_TELA_ANTIGA } from "../../src/lib/versao-do-sistema.ts";
import { clicar } from "./interacoes.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOVIDADE = {
  id: "2026-10-22-motivo",
  data: "2026-10-22",
  texto: "motivo padronizado na reabertura",
  visivel: true,
};

function documentoFalso(visibilidade = "visible") {
  const alvo = new EventTarget();
  return {
    visibilityState: visibilidade,
    addEventListener: alvo.addEventListener.bind(alvo),
    removeEventListener: alvo.removeEventListener.bind(alvo),
    mudar(estado) {
      this.visibilityState = estado;
      alvo.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

function armazenamentoFalso() {
  const dados = new Map();
  return {
    getItem: (chave) => (dados.has(chave) ? dados.get(chave) : null),
    setItem: (chave, valor) => dados.set(chave, String(valor)),
  };
}

function montarCenario({
  publicada = { versao: "v2", novidades: [] },
  visibilidade = "visible",
  temPendencia = () => false,
  armazenamento = armazenamentoFalso(),
} = {}) {
  const documento = documentoFalso(visibilidade);
  const janela = new EventTarget();
  const recarregar = vi.fn();
  let tempo = 1_000_000;
  const buscar = vi.fn(async () =>
    typeof publicada === "function" ? publicada() : publicada,
  );
  const aviso = criarAvisoDeVersao({
    versaoAtual: "v1",
    buscar,
    documento,
    janela,
    armazenamento: () => armazenamento,
    novidadesDesteBuild: [],
    temPendencia,
    recarregar,
    agora: () => tempo,
  });
  return {
    aviso,
    documento,
    janela,
    recarregar,
    buscar,
    armazenamento,
    passar(ms) {
      tempo += ms;
    },
  };
}

describe("detecção de versão nova", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("confere a cada 5 minutos com a aba visível e para com a aba oculta", async () => {
    const c = montarCenario({ publicada: { versao: "v1", novidades: [] } });
    c.aviso.iniciar();
    expect(c.buscar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONFERENCIA_MS);
    expect(c.buscar).toHaveBeenCalledTimes(1);
    expect(c.buscar).toHaveBeenCalledWith("/versao.json");

    c.documento.mudar("hidden");
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONFERENCIA_MS * 3);
    expect(c.buscar).toHaveBeenCalledTimes(1);

    // Volta para a aba: confere na hora (passou mais de um minuto) e o relógio recomeça.
    c.passar(INTERVALO_DA_CONFERENCIA_MS * 3);
    c.documento.mudar("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(c.buscar).toHaveBeenCalledTimes(2);
    c.aviso.parar();
  });

  it("voltar o foco confere de novo, no máximo uma vez por minuto", async () => {
    const c = montarCenario();
    c.aviso.iniciar();
    c.passar(61_000);
    c.janela.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    c.janela.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(c.buscar).toHaveBeenCalledTimes(1);
    expect(c.aviso.obter().versaoNova).toBe("v2");
    c.aviso.parar();
  });

  it("começa parado com a aba oculta", async () => {
    const c = montarCenario({ visibilidade: "hidden" });
    c.aviso.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONFERENCIA_MS * 2);
    expect(c.buscar).not.toHaveBeenCalled();
    c.aviso.parar();
  });

  it("mesma versão, arquivo inválido ou sem rede: nada muda", async () => {
    const c = montarCenario({ publicada: { versao: "v1" } });
    expect(await c.aviso.conferir()).toBe(false);
    const d = montarCenario({ publicada: "<html>" });
    expect(await d.aviso.conferir()).toBe(false);
    const e = montarCenario({
      publicada: () => {
        throw new Error("Failed to fetch");
      },
    });
    expect(await e.aviso.conferir()).toBe(false);
    expect(e.aviso.obter().versaoNova).toBeNull();
  });

  it("sem versão gravada no build (dev, teste) não confere nada", async () => {
    const buscar = vi.fn();
    const aviso = criarAvisoDeVersao({ versaoAtual: null, buscar });
    aviso.iniciar();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_CONFERENCIA_MS * 2);
    expect(await aviso.conferir()).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe("faixa de versão nova", () => {
  let elemento;
  let montado;

  beforeEach(() => {
    elemento = document.createElement("div");
    document.body.append(elemento);
  });
  afterEach(() => {
    act(() => montado?.desmontar());
    montado = null;
    elemento.remove();
  });

  async function montar(aviso) {
    await act(async () => {
      montado = montarAvisoDeVersao({ elemento, aviso });
    });
  }
  const faixa = () => elemento.querySelector(".aviso-de-versao");
  const botao = (acao) => elemento.querySelector(`[data-acao="${acao}"]`);

  it("não aparece enquanto a versão aberta é a vigente", async () => {
    const c = montarCenario({ publicada: { versao: "v1" } });
    await montar(c.aviso);
    await act(() => c.aviso.conferir());
    expect(faixa()).toBeNull();
  });

  it("aparece discreta com versão nova e fecha só para aquela versão", async () => {
    let publicada = { versao: "v2", novidades: [] };
    const c = montarCenario({ publicada: () => publicada });
    await montar(c.aviso);
    await act(() => c.aviso.conferir());

    expect(faixa().textContent).toContain("Há uma versão nova do MONITORA.");
    expect(faixa().getAttribute("data-tone")).toBe("info");
    expect(faixa().textContent).not.toContain("Novo:");

    await clicar(botao("fechar-aviso-de-versao"));
    expect(faixa()).toBeNull();
    expect(c.armazenamento.getItem(CHAVE_DO_FECHAMENTO)).toBe("v2");

    // Outra página (ou recarga) com a mesma v2: continua fechado.
    const outra = montarCenario({ armazenamento: c.armazenamento });
    await act(() => outra.aviso.conferir());
    expect(outra.aviso.obter().fechado).toBe(true);

    // Versão mais nova: volta.
    publicada = { versao: "v3", novidades: [] };
    await act(() => c.aviso.conferir());
    expect(faixa().textContent).toContain("Há uma versão nova");
  });

  it("mostra a novidade só quando marcada como visível", async () => {
    const c = montarCenario({
      publicada: { versao: "v2", novidades: [NOVIDADE] },
    });
    await montar(c.aviso);
    await act(() => c.aviso.conferir());
    expect(faixa().textContent).toContain(
      "Novo: motivo padronizado na reabertura",
    );

    const d = montarCenario({
      publicada: { versao: "v2", novidades: [{ ...NOVIDADE, visivel: false }] },
    });
    await act(() => d.aviso.conferir());
    expect(d.aviso.obter().novidade).toBeNull();
  });

  it("Atualizar agora sem pendência recarrega", async () => {
    const c = montarCenario();
    await montar(c.aviso);
    await act(() => c.aviso.conferir());
    await clicar(botao("atualizar-versao"));
    expect(c.recarregar).toHaveBeenCalledTimes(1);
  });

  it("Atualizar agora com alteração não salva pede para salvar e não recarrega", async () => {
    let pendente = true;
    const c = montarCenario({ temPendencia: () => pendente });
    await montar(c.aviso);
    await act(() => c.aviso.conferir());
    await clicar(botao("atualizar-versao"));
    expect(c.recarregar).not.toHaveBeenCalled();
    expect(faixa().textContent).toContain(AVISO_DE_PENDENCIA);

    pendente = false;
    await clicar(botao("atualizar-versao"));
    expect(c.recarregar).toHaveBeenCalledTimes(1);
  });

  it("a guarda de saída com pergunta pode cancelar a recarga", () => {
    const recarregar = vi.fn();
    const aviso = criarAvisoDeVersao({
      versaoAtual: "v1",
      temPendencia: () => false,
      confirmarSaida: () => false,
      recarregar,
    });
    expect(aviso.atualizarAgora()).toBe(false);
    expect(recarregar).not.toHaveBeenCalled();
  });
});

describe("aviso forte: a versão aberta quebrou", () => {
  let elemento;
  let montado;

  beforeEach(() => {
    elemento = document.createElement("div");
    document.body.append(elemento);
  });
  afterEach(() => {
    act(() => montado?.desmontar());
    elemento.remove();
  });

  it("PGRST202 com versão nova publicada vira 'Atualize para continuar', sem fechar", async () => {
    const c = montarCenario();
    await act(async () => {
      montado = montarAvisoDeVersao({ elemento, aviso: c.aviso });
    });
    c.aviso.iniciar();
    await act(async () => {
      c.janela.dispatchEvent(
        new CustomEvent(EVENTO_TELA_ANTIGA, {
          detail: { rpc: "reabrir_analise", codigo: "PGRST202" },
        }),
      );
      await vi.waitFor(() => expect(c.aviso.obter().telaAntiga).toBe(true));
    });
    const faixa = elemento.querySelector(".aviso-de-versao");
    expect(faixa.textContent).toContain("Atualize para continuar");
    expect(faixa.getAttribute("data-tone")).toBe("warning");
    expect(faixa.getAttribute("role")).toBe("alert");
    expect(
      elemento.querySelector('[data-acao="fechar-aviso-de-versao"]'),
    ).toBeNull();
    // Não recarrega sozinho.
    expect(c.recarregar).not.toHaveBeenCalled();
    c.aviso.parar();
  });

  it("aparece mesmo com o aviso fechado para aquela versão", async () => {
    const c = montarCenario();
    await c.aviso.conferir();
    c.aviso.fechar();
    expect(c.aviso.obter().fechado).toBe(true);
    await c.aviso.aoSinalDeTelaAntiga();
    await act(async () => {
      montado = montarAvisoDeVersao({ elemento, aviso: c.aviso });
    });
    expect(elemento.textContent).toContain("Atualize para continuar");
  });

  it("sem versão nova confirmada (front antes da migration), nada muda", async () => {
    const c = montarCenario({ publicada: { versao: "v1" } });
    await c.aviso.aoSinalDeTelaAntiga();
    expect(c.buscar).toHaveBeenCalledTimes(1);
    expect(c.aviso.obter().telaAntiga).toBe(false);
    expect(c.aviso.obter().versaoNova).toBeNull();
  });
});
