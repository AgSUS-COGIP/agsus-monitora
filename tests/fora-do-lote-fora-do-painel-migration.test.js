import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Fora do lote fora do Painel das análises (20261022120000): a ficha
  FORA_LOTE publica como "Fora do lote" (inativa, sem apagar a linha) e a
  base do painel não a lista. O ensaio (begin…rollback) conferiu as 448 do
  114/2026.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261022120000_fora_do_lote_fora_do_painel.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("migration 20261022120000 (fora do lote fora do painel)", () => {
  it("transação, ensaio em rollback e rollback", () => {
    expect(MIGRATION).toContain("\nbegin;\n");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    expect(ROLLBACK).not.toContain("Fora do lote'");
  });

  it("FORA_LOTE publica como Fora do lote, sem apagar a linha", () => {
    expect(MIGRATION).toContain(
      `when v_f."TP_SITUACAO" = 'FORA_LOTE' then 'Fora do lote'`,
    );
    expect(MIGRATION).not.toMatch(
      /delete from public\."TB_ANALISE_CURRICULAR"/i,
    );
  });

  it("a base do painel não lista Fora do lote", () => {
    expect(MIGRATION).toContain(
      `AND a.status_consolidado IS DISTINCT FROM 'Fora do lote'::text`,
    );
  });

  it("republica as fichas FORA_LOTE já publicadas", () => {
    expect(MIGRATION).toMatch(
      /select private\."FC_PUBLICAR_FICHA_ANALISE"\(f\."CO_FICHA_ANALISE"\)\s+from public\."TB_FICHA_ANALISE" f\s+where f\."TP_SITUACAO" = 'FORA_LOTE';/,
    );
  });
});
