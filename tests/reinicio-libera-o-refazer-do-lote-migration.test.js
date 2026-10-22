import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Reiniciar as fichas devolve a ficha ao início também para o refazer do lote. */
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = ler(
  "supabase/migrations/20261013170000_reinicio_libera_o_refazer_do_lote.sql",
);
const ROLLBACK = ler(
  "supabase/rollback/20261013170000_reinicio_libera_o_refazer_do_lote.sql",
);

describe("reinício libera o refazer do lote", () => {
  it("só conta o histórico depois do último REINICIAR", () => {
    expect(MIGRATION).toMatch(
      /create or replace function private\."FC_FICHA_INICIADA"/,
    );
    expect(MIGRATION).toMatch(/'REFAZER_LOTE', 'REINICIAR'\)/);
    expect(MIGRATION).toMatch(
      /"NU_VERSAO" > coalesce\(\(\s*select max\(r\."NU_VERSAO"\)/,
    );
    expect(MIGRATION).toMatch(/r\."TP_ACAO" = 'REINICIAR'/);
  });

  it("os campos da ficha continuam valendo", () => {
    for (const campo of [
      "CO_USUARIO_RESPONSAVEL",
      "DS_LANCAMENTO",
      "CO_USUARIO_RESERVA",
      "VL_NOTA_FINAL",
    ])
      expect(MIGRATION).toContain(`p_f."${campo}" is not null`);
  });

  it("o rollback volta a olhar o histórico inteiro", () => {
    expect(ROLLBACK).toMatch(/FC_FICHA_INICIADA/);
    expect(ROLLBACK).not.toMatch(/REINICIAR/);
  });
});
