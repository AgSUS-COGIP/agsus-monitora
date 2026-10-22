import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261013180000: o reinício das fichas usa a mesma régua do refazer
  do lote (FC_FICHA_INICIADA). Ensaio (begin…rollback) em supabase/ensaios/:
  ficha devolvida à fila e ficha iniciada fora do lote deixavam o refazer
  recusado depois do reinício.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261013180000_reinicio_volta_toda_ficha_iniciada.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("reinício volta toda ficha iniciada", () => {
  it("decide pelo FC_FICHA_INICIADA, não só pelos campos", () => {
    expect(MIGRATION).toMatch(
      /create or replace function private\."FC_REINICIAR_FICHAS_DO_EDITAL"/,
    );
    expect(MIGRATION).toContain('if not private."FC_FICHA_INICIADA"(v_f) then');
    expect(MIGRATION).not.toMatch(
      /v_f\."TP_SITUACAO" = 'PENDENTE' and v_f\."CO_USUARIO_RESPONSAVEL" is null/,
    );
  });

  it("a ficha fora do lote continua fora, mas perde o conteúdo e ganha REINICIAR", () => {
    expect(MIGRATION).toContain(
      "v_para := case when v_f.\"TP_SITUACAO\" = 'FORA_LOTE' then 'FORA_LOTE' else 'PENDENTE' end;",
    );
    expect(MIGRATION).toContain('"TP_SITUACAO" = v_para,');
    expect(MIGRATION).toMatch(/'REINICIAR', v_f\."TP_SITUACAO", v_para/);
    for (const coluna of [
      '"CO_USUARIO_RESPONSAVEL" = null',
      '"CO_USUARIO_RESERVA" = null',
      '"DS_LANCAMENTO" = null',
      '"DS_RESULTADO" = null',
      '"VL_NOTA_FINAL" = null',
      '"CO_USUARIO_CONCLUSAO" = null',
    ])
      expect(MIGRATION).toContain(coluna);
    expect(MIGRATION).not.toContain('"DS_MOTIVO_SAIDA" = null');
  });

  it("não apaga nem toca regra, pré-classificação ou análises; só o admin global", () => {
    expect(MIGRATION).not.toMatch(/\bdelete\s+from\b/i);
    expect(MIGRATION).not.toMatch(
      /update public\."(TB_REGRA_ANALISE|TB_DECISAO_LOTE|TB_PRE_CLASSIFICACAO|TB_ANALISE_CURRICULAR)"/,
    );
    expect(MIGRATION).toContain('a."ST_ADMIN_GLOBAL"');
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid) from public, anon, authenticated, service_role;',
    );
  });

  it("o ensaio monta os dois casos e o rollback volta à régua dos campos", () => {
    expect(ENSAIO).toContain("public.distribuir_fichas(");
    expect(ENSAIO).toContain("Devolvida à fila");
    expect(ENSAIO).toContain("public.reiniciar_fichas_do_edital(");
    expect(ENSAIO).toContain("refazer_permitido");
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ROLLBACK).toContain(
      'v_f."TP_SITUACAO" = \'PENDENTE\' and v_f."CO_USUARIO_RESPONSAVEL" is null',
    );
    expect(ROLLBACK).not.toContain("FC_FICHA_INICIADA");
  });
});
