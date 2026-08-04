import { describe, expect, it, vi } from "vitest";
import { bootstrapAnalisesSharedClient } from "../src/analises/analises-shared-client-bootstrap.js";

describe("bootstrapAnalisesSharedClient", () => {
  it("inicializa o cliente uma única vez e reutiliza a instância decorada", () => {
    const client = { from: vi.fn(), rpc: vi.fn() };
    const createClient = vi.fn(() => client);
    const target = { supabase: { createClient } };

    const first = bootstrapAnalisesSharedClient(target);
    const second = bootstrapAnalisesSharedClient(target);

    expect(first).toBe(client);
    expect(second).toBe(client);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("não inicializa quando a fachada Supabase ainda não está disponível", () => {
    expect(bootstrapAnalisesSharedClient({})).toBeNull();
    expect(bootstrapAnalisesSharedClient({ supabase: {} })).toBeNull();
  });
});
