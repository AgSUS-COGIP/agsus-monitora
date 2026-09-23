import { describe, expect, it, vi } from "vitest";
import {
  decorateOperationalClient,
  installOperationalTransport,
} from "../src/modules/monitoramento-operational-transport.js";

function createBuilder(table) {
  return {
    table,
    select: vi.fn(() => ({ table, operation: "select" })),
    update: vi.fn(() => ({ table, operation: "update" })),
    insert: vi.fn(() => ({ table, operation: "insert" })),
  };
}

describe("monitoramento operational transport", () => {
  it("redireciona select para a view operacional e preserva gravações", () => {
    const builders = new Map();
    const from = vi.fn((table) => {
      if (!builders.has(table)) builders.set(table, createBuilder(table));
      return builders.get(table);
    });

    const client = decorateOperationalClient({ from });
    const source = client.from("TB_MONITORAMENTO_INDIGENA");

    source.select("id,etapa,status");
    source.update({ etapa: "Etapa manual" });

    expect(from).toHaveBeenCalledWith("VW_MONITORAMENTO_INDIGENA_OPERACIONAL");
    expect(
      builders.get("VW_MONITORAMENTO_INDIGENA_OPERACIONAL").select,
    ).toHaveBeenCalledWith("id,etapa,status");
    expect(
      builders.get("TB_MONITORAMENTO_INDIGENA").update,
    ).toHaveBeenCalledWith({
      etapa: "Etapa manual",
    });
  });

  it("instala a decoração sem criar cliente antecipadamente", () => {
    const client = { from: vi.fn(() => createBuilder("configuracoes")) };
    const createClient = vi.fn(() => client);
    const target = { supabase: { createClient } };

    expect(installOperationalTransport(target)).toBe(true);
    expect(createClient).not.toHaveBeenCalled();

    const decorated = target.supabase.createClient();
    expect(decorated).toBe(client);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("não altera tabelas não operacionais e é idempotente", () => {
    const other = createBuilder("configuracoes");
    const client = { from: vi.fn(() => other) };

    expect(decorateOperationalClient(decorateOperationalClient(client))).toBe(
      client,
    );

    client.from("TB_CONFIGURACAO").select("*");
    expect(other.select).toHaveBeenCalledWith("*");
  });
});
