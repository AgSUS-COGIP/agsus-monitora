import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acompanharPreparoDoDesempate,
  ESPERA_DO_RELATORIO_MS,
} from "../../src/lib/classificacao/relatorio-de-desempate.ts";

/*
  A releitura do relatório de desempate enquanto o Python o prepara
  (Classificação › Listas): espera crescente, só com a aba à frente e até o
  prazo; passado o prazo, a tela mostra o erro com "Tentar de novo".
*/

const PREPARANDO = {
  preparo: { situacao: "PREPARANDO", pedidoEm: "" },
  desempate: null,
};
const PRONTO = { preparo: null, desempate: { grupos: [] } };

function montar({ respostas = () => PREPARANDO } = {}) {
  vi.useFakeTimers();
  const documento = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  const ler = vi.fn(async () => respostas(ler.mock.calls.length));
  const aoLer = vi.fn();
  const aoEsgotar = vi.fn();
  const parar = acompanharPreparoDoDesempate({
    ler,
    aoLer,
    aoEsgotar,
    documento,
    espera: () => 60_000,
  });
  return { documento, ler, aoLer, aoEsgotar, parar };
}

afterEach(() => vi.useRealTimers());

describe("acompanharPreparoDoDesempate", () => {
  it("relê enquanto prepara e para quando fica pronto", async () => {
    const { ler, aoLer, aoEsgotar } = montar({
      respostas: (n) => (n < 3 ? PREPARANDO : PRONTO),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(ler).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000 * 5);
    expect(ler).toHaveBeenCalledTimes(3);
    expect(aoLer).toHaveBeenLastCalledWith(PRONTO);
    expect(aoEsgotar).not.toHaveBeenCalled();
  });

  it("passado o prazo, para de reler e avisa", async () => {
    const { ler, aoEsgotar } = montar();
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELATORIO_MS);
    expect(aoEsgotar).toHaveBeenCalledTimes(1);
    const lidas = ler.mock.calls.length;
    expect(lidas).toBe(ESPERA_DO_RELATORIO_MS / 60_000 + 1);
    await vi.advanceTimersByTimeAsync(ESPERA_DO_RELATORIO_MS * 4);
    expect(ler).toHaveBeenCalledTimes(lidas);
  });

  it("com a aba no fundo, espera a volta para reler", async () => {
    const { documento, ler } = montar();
    await vi.advanceTimersByTimeAsync(0);
    documento.visibilityState = "hidden";
    await vi.advanceTimersByTimeAsync(60_000 * 10);
    // A releitura marcada para o fundo não sai.
    expect(ler).toHaveBeenCalledTimes(1);
    documento.visibilityState = "visible";
    documento.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(ler).toHaveBeenCalledTimes(2);
  });

  it("parar (desmontar) solta o temporizador e a escuta da aba", async () => {
    const { documento, ler, parar } = montar();
    await vi.advanceTimersByTimeAsync(0);
    parar();
    documento.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60_000 * 10);
    expect(ler).toHaveBeenCalledTimes(1);
  });

  it("leitura que estoura não vira rejeição solta e conta como sem resposta", async () => {
    vi.useFakeTimers();
    const aoLer = vi.fn();
    acompanharPreparoDoDesempate({
      ler: () => Promise.reject(new Error("sem rede")),
      aoLer,
      aoEsgotar: vi.fn(),
      documento: null,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(aoLer).toHaveBeenCalledWith(null);
  });
});
