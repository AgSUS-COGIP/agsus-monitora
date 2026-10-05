import { describe, expect, it, vi } from "vitest";
import {
  CHAVE_DA_RECARGA,
  importarComRecarga,
  JANELA_DA_RECARGA_MS,
  recarregarUmaVez,
} from "../src/lib/importar-com-recarga.js";

/*
  Versão nova publicada com a página aberta: o pedaço baixado sob demanda (o
  painel do chat) some e o import falha. Recarrega uma vez; sem laço.
*/

function memoria() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
  };
}

const falhaDeVersao = () =>
  Promise.reject(
    new TypeError(
      "Failed to fetch dynamically imported module: /assets/painel-abc123.js",
    ),
  );

describe("recarregarUmaVez", () => {
  it("recarrega e marca a hora; dentro da janela, não recarrega de novo", () => {
    const armazenamento = memoria();
    const recarregar = vi.fn();
    expect(recarregarUmaVez({ armazenamento, recarregar, agora: 1000 })).toBe(
      true,
    );
    expect(armazenamento.getItem(CHAVE_DA_RECARGA)).toBe("1000");
    expect(
      recarregarUmaVez({
        armazenamento,
        recarregar,
        agora: 1000 + JANELA_DA_RECARGA_MS - 1,
      }),
    ).toBe(false);
    expect(recarregar).toHaveBeenCalledTimes(1);
    expect(
      recarregarUmaVez({
        armazenamento,
        recarregar,
        agora: 1000 + JANELA_DA_RECARGA_MS,
      }),
    ).toBe(true);
    expect(recarregar).toHaveBeenCalledTimes(2);
  });

  it("sem sessionStorage (acesso negado), recarrega mesmo assim", () => {
    const armazenamento = {
      getItem: () => {
        throw new Error("negado");
      },
      setItem: () => {
        throw new Error("negado");
      },
    };
    const recarregar = vi.fn();
    expect(recarregarUmaVez({ armazenamento, recarregar, agora: 5 })).toBe(
      true,
    );
    expect(recarregar).toHaveBeenCalledOnce();
  });
});

describe("importarComRecarga", () => {
  it("devolve o módulo quando o import funciona", async () => {
    const modulo = { default: () => null };
    const recarregar = vi.fn();
    await expect(
      importarComRecarga(() => Promise.resolve(modulo), {
        armazenamento: memoria(),
        recarregar,
      })(),
    ).resolves.toBe(modulo);
    expect(recarregar).not.toHaveBeenCalled();
  });

  it("falha de carregamento: recarrega e a promessa fica pendente (sem erro na ilha)", async () => {
    const recarregar = vi.fn();
    const promessa = importarComRecarga(falhaDeVersao, {
      armazenamento: memoria(),
      recarregar,
      agora: 10_000,
    })();
    const resultado = await Promise.race([
      promessa.then(
        () => "resolveu",
        () => "rejeitou",
      ),
      new Promise((r) => setTimeout(() => r("pendente"), 20)),
    ]);
    expect(resultado).toBe("pendente");
    expect(recarregar).toHaveBeenCalledOnce();
  });

  it("falhou de novo logo depois de recarregar: repassa o erro (sem laço)", async () => {
    const armazenamento = memoria();
    armazenamento.setItem(CHAVE_DA_RECARGA, "10000");
    const recarregar = vi.fn();
    await expect(
      importarComRecarga(falhaDeVersao, {
        armazenamento,
        recarregar,
        agora: 10_500,
      })(),
    ).rejects.toThrow(/dynamically imported module/);
    expect(recarregar).not.toHaveBeenCalled();
  });

  it("erro que não é de carregamento é repassado sem recarregar", async () => {
    const recarregar = vi.fn();
    await expect(
      importarComRecarga(() => Promise.reject(new Error("bug no painel")), {
        armazenamento: memoria(),
        recarregar,
      })(),
    ).rejects.toThrow("bug no painel");
    expect(recarregar).not.toHaveBeenCalled();
  });
});
