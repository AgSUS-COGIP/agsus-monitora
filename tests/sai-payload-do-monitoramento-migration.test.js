import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261007220100: sai get_monitoramento_dashboard_payload, que a tela
  não chama desde #305. Nada no front a cita; o rollback a devolve.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007220100_sai_payload_do_monitoramento.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const RPC = "get_monitoramento_dashboard_payload";

describe("sai o payload do monitoramento (20261007220100)", () => {
  it("só tira a função, numa transação", () => {
    expect(MIGRATION).toContain(`drop function public.${RPC}();`);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(ENSAIO).toContain(`drop function public.${RPC}();`);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("o front não a chama e o contrato não a lista", () => {
    expect(Object.keys(CONTRATO_RPC)).not.toContain(RPC);
    for (const arquivo of ["src/app/carga.js", "src/lib/rpc-contrato.js"])
      expect(ler(arquivo)).not.toContain(RPC);
  });

  it("o rollback devolve a função com a permissão de antes", () => {
    expect(ROLLBACK).toContain(`CREATE OR REPLACE FUNCTION public.${RPC}()`);
    expect(ROLLBACK).toContain(
      `grant execute on function public.${RPC}() to authenticated;`,
    );
  });
});
