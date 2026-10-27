import { describe, expect, it, vi } from "vitest";
import {
  ehTimeoutDaFila,
  lerFilaComRecuperacao,
} from "../../src/lib/avaliacao-documental/repetir-leitura-da-fila.ts";

describe("recuperação da leitura da fila", () => {
  const timeout = {
    code: "57014",
    message: "canceling statement due to statement timeout",
  };

  it("identifica apenas statement_timeout (57014)", () => {
    expect(ehTimeoutDaFila(timeout)).toBe(true);
    expect(ehTimeoutDaFila({ code: "57014", message: "user request" })).toBe(false);
    expect(ehTimeoutDaFila({ code: "42501", message: timeout.message })).toBe(false);
    expect(ehTimeoutDaFila(null)).toBe(false);
  });

  it("repete uma vez quando a primeira leitura excede o tempo", async () => {
    const leitura = vi
      .fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce({ candidatos: [] });
    const pausa = vi.fn(async () => {});
    await expect(lerFilaComRecuperacao(leitura, pausa)).resolves.toEqual({
      candidatos: [],
    });
    expect(leitura).toHaveBeenCalledTimes(2);
    expect(pausa).toHaveBeenCalledWith(1200);
  });

  it("não repete timeout duas vezes nem erros de permissão", async () => {
    const leitura = vi.fn(async () => Promise.reject(timeout));
    await expect(lerFilaComRecuperacao(leitura, async () => {})).rejects.toEqual(
      timeout,
    );
    expect(leitura).toHaveBeenCalledTimes(2);
    const proibido = { code: "42501", message: "permission denied" };
    const outra = vi.fn(async () => Promise.reject(proibido));
    await expect(lerFilaComRecuperacao(outra, async () => {})).rejects.toEqual(
      proibido,
    );
    expect(outra).toHaveBeenCalledTimes(1);
  });
});
