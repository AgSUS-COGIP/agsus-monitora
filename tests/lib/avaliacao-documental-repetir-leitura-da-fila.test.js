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

  it("reconhece somente o timeout do banco", () => {
    expect(ehTimeoutDaFila(timeout)).toBe(true);
    const cancelado = { code: "57014", message: "user request" };
    const semPermissao = { code: "42501", message: timeout.message };
    expect(ehTimeoutDaFila(cancelado)).toBe(false);
    expect(ehTimeoutDaFila(semPermissao)).toBe(false);
    expect(ehTimeoutDaFila(null)).toBe(false);
  });

  it("faz uma segunda leitura após timeout", async () => {
    const leitura = vi.fn();
    leitura.mockRejectedValueOnce(timeout);
    leitura.mockResolvedValueOnce({ candidatos: [] });
    const pausa = vi.fn(async () => {});
    const resultado = lerFilaComRecuperacao(leitura, pausa);
    await expect(resultado).resolves.toEqual({ candidatos: [] });
    expect(leitura).toHaveBeenCalledTimes(2);
    expect(pausa).toHaveBeenCalledWith(1200);
  });

  it("interrompe após dois timeouts", async () => {
    const leitura = vi.fn(async () => Promise.reject(timeout));
    const resultado = lerFilaComRecuperacao(leitura, async () => {});
    await expect(resultado).rejects.toEqual(timeout);
    expect(leitura).toHaveBeenCalledTimes(2);
  });

  it("não repete erros de autorização", async () => {
    const proibido = { code: "42501", message: "permission denied" };
    const leitura = vi.fn(async () => Promise.reject(proibido));
    const resultado = lerFilaComRecuperacao(leitura, async () => {});
    await expect(resultado).rejects.toEqual(proibido);
    expect(leitura).toHaveBeenCalledTimes(1);
  });
});
