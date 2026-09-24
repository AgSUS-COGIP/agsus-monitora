import { describe, expect, it, vi } from "vitest";
import { createNucleoSummaryStore } from "../../src/componentes/nucleo/resumo.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("Núcleo summary store", () => {
  it("cache vazio é válido e consulta ativa prevalece sobre cache anterior", async () => {
    const pending = deferred();
    const loader = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(pending.promise);
    const store = createNucleoSummaryStore({ loader });
    await store.get();
    await store.get();
    expect(loader).toHaveBeenCalledTimes(1);
    const refreshing = store.get({ force: true });
    expect(store.get()).toBe(refreshing);
    pending.resolve([{ id: "new" }]);
    expect(await refreshing).toEqual([{ id: "new" }]);
  });
  it("compartilha uma única carga entre chamadas concorrentes", async () => {
    const pending = deferred();
    const loader = vi.fn(() => pending.promise);
    const store = createNucleoSummaryStore({ loader, ttlMs: 30_000 });

    const first = store.get();
    const second = store.get();
    const third = store.get({ force: true });
    expect(first).toBe(second);
    expect(first).toBe(third);

    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(store.snapshot().inFlight).toBe(true);

    pending.resolve([{ id: "1" }]);
    await expect(Promise.all([first, second, third])).resolves.toEqual([
      [{ id: "1" }],
      [{ id: "1" }],
      [{ id: "1" }],
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("usa cache válido e permite zero chamadas numa nova abertura", async () => {
    let now = 1_000;
    const loader = vi.fn(async () => [{ id: "cache" }]);
    const store = createNucleoSummaryStore({
      loader,
      ttlMs: 30_000,
      now: () => now,
    });

    await expect(store.get()).resolves.toEqual([{ id: "cache" }]);
    now += 10_000;
    await expect(store.get()).resolves.toEqual([{ id: "cache" }]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(store.snapshot().hasFreshCache).toBe(true);
  });

  it("expira o cache após o TTL", async () => {
    let now = 0;
    const loader = vi
      .fn()
      .mockResolvedValueOnce([{ id: "old" }])
      .mockResolvedValueOnce([{ id: "new" }]);
    const store = createNucleoSummaryStore({
      loader,
      ttlMs: 30_000,
      now: () => now,
    });

    await expect(store.get()).resolves.toEqual([{ id: "old" }]);
    now = 30_001;
    await expect(store.get()).resolves.toEqual([{ id: "new" }]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("invalida o cache após salvar e busca dados novos", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([{ id: "before" }])
      .mockResolvedValueOnce([{ id: "after" }]);
    const store = createNucleoSummaryStore({ loader });

    await expect(store.get()).resolves.toEqual([{ id: "before" }]);
    store.invalidate();
    await expect(store.get({ force: true })).resolves.toEqual([
      { id: "after" },
    ]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("não deixa uma resposta antiga repovoar o cache após invalidação", async () => {
    const first = deferred();
    const second = deferred();
    const loader = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const store = createNucleoSummaryStore({ loader });

    const oldRequest = store.get();
    store.invalidate();
    const freshRequest = store.get({ force: true });

    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    first.resolve([{ id: "stale" }]);
    await expect(oldRequest).resolves.toEqual([{ id: "stale" }]);

    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    second.resolve([{ id: "fresh" }]);
    await expect(freshRequest).resolves.toEqual([{ id: "fresh" }]);
    expect(store.peek()).toEqual([{ id: "fresh" }]);
  });

  it("libera a fila depois de erro para permitir nova tentativa", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("rede indisponível"))
      .mockResolvedValueOnce([{ id: "ok" }]);
    const store = createNucleoSummaryStore({ loader });

    await expect(store.get()).rejects.toThrow("rede indisponível");
    expect(store.snapshot().inFlight).toBe(false);
    await expect(store.get()).resolves.toEqual([{ id: "ok" }]);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
