import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SEM_SERVIDOR,
  TempoEsgotado,
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../src/lib/falha-de-rede.js";

afterEach(() => vi.useRealTimers());

describe("mensagem de falha de rede", () => {
  it("'Failed to fetch' e parecidos viram a mensagem clara", () => {
    for (const erro of [
      new TypeError("Failed to fetch"),
      { message: "TypeError: Failed to fetch" },
      { message: "NetworkError when attempting to fetch resource." },
      { message: "Load failed" },
      { name: "FalhaDeConexao", falhaTransitoria: true, message: "x" },
    ]) {
      expect(ehFalhaDeConexao(erro)).toBe(true);
      expect(mensagemDeFalha(erro)).toBe(SEM_SERVIDOR);
    }
    expect(SEM_SERVIDOR).toBe(
      "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    );
  });

  it("erro do banco continua com a mensagem do banco", () => {
    const erro = { message: "Sem permissão para este recurso", code: "42501" };
    expect(ehFalhaDeConexao(erro)).toBe(false);
    expect(mensagemDeFalha(erro)).toBe("Sem permissão para este recurso");
  });

  it("comTempoLimite rejeita com TempoEsgotado quando a promessa não volta", async () => {
    vi.useFakeTimers();
    const espera = comTempoLimite(new Promise(() => {}), 5000);
    const verificacao = expect(espera).rejects.toBeInstanceOf(TempoEsgotado);
    await vi.advanceTimersByTimeAsync(5000);
    await verificacao;
    vi.useRealTimers();
    const erro = await comTempoLimite(new Promise(() => {}), 10).catch(
      (e) => e,
    );
    expect(mensagemDeFalha(erro)).toContain(SEM_SERVIDOR);
  });

  it("comTempoLimite devolve o resultado quando chega a tempo", async () => {
    await expect(comTempoLimite(Promise.resolve(7), 1000)).resolves.toBe(7);
  });
});
