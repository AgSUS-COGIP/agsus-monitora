import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseLegacyFacade,
  installSupabaseLegacyBridge
} from "../../src/lib/supabase-legacy-bridge.js";

describe("supabase legacy bridge", () => {
  it("devolve a mesma instancia compartilhada para chamadas legadas", () => {
    const sharedClient = { auth: {}, rpc: vi.fn() };
    const resolveClient = vi.fn(() => sharedClient);
    const facade = createSupabaseLegacyFacade(resolveClient);

    expect(facade.createClient("url-a", "key-a")).toBe(sharedClient);
    expect(facade.createClient("url-b", "key-b", { auth: {} })).toBe(sharedClient);
    expect(resolveClient).toHaveBeenCalledTimes(2);
  });

  it("substitui a fabrica global por uma fachada unica e idempotente", () => {
    const previousFactory = vi.fn(() => ({ id: "duplicado" }));
    const target = { supabase: { createClient: previousFactory } };
    const sharedClient = { id: "compartilhado" };

    const first = installSupabaseLegacyBridge(target, () => sharedClient);
    const second = installSupabaseLegacyBridge(target, () => ({ id: "outro" }));

    expect(first).toBe(second);
    expect(target.supabase.createClient()).toBe(sharedClient);
    expect(previousFactory).not.toHaveBeenCalled();
  });

  it("permite decoracao legada sem trocar a instancia compartilhada", () => {
    const sharedClient = { id: "compartilhado" };
    const facade = createSupabaseLegacyFacade(() => sharedClient);
    const originalCreateClient = facade.createClient.bind(facade);

    facade.createClient = (...args) => {
      const client = originalCreateClient(...args);
      client.decorado = true;
      return client;
    };

    expect(facade.createClient("url", "key")).toBe(sharedClient);
    expect(sharedClient.decorado).toBe(true);
  });

  it("falha de forma explicita quando o ambiente nao fornece cliente", () => {
    const facade = createSupabaseLegacyFacade(() => null);

    expect(() => facade.createClient()).toThrow(/Supabase indisponível/);
  });
});
