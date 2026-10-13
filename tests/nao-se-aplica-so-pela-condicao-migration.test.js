import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261013180100: NAO_SE_APLICA só no bloco cuja condição não vale
  para o candidato. Ensaio (begin…rollback) em supabase/ensaios/ com a regra
  vigente do 114/2026 (Motorista D).
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261013180100_nao_se_aplica_so_pela_condicao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("não se aplica só pela condição do bloco", () => {
  it("recusa NAO_SE_APLICA em bloco que vale para o candidato", () => {
    expect(MIGRATION).toMatch(
      /create or replace function private\."FC_VALIDAR_LANCAMENTO_FICHA"\(p_regra jsonb, p_lanc jsonb\)/,
    );
    expect(MIGRATION).toMatch(
      /v_item\.value ->> 'situacao' = 'NAO_SE_APLICA' and coalesce\(v_bloco ->> 'tipo', ''\) <> 'REGISTRO'\s+and private\."FC_BLOCO_SE_APLICA"\(v_bloco, p_lanc\) then/,
    );
    expect(MIGRATION).toContain("using errcode = '22023'");
  });

  it("mantém as validações da regra por cargo e das leituras", () => {
    expect(MIGRATION).toContain(
      "foreach v_campo in array array['extras', 'requisitos'] loop",
    );
    expect(MIGRATION).toContain(
      'perform private."FC_VALIDAR_LEITURAS_LANCAMENTO"(p_lanc);',
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb) from public, anon, authenticated;',
    );
  });

  it("ensaio com os cinco casos e rollback sem a recusa", () => {
    for (const caso of [
      "IDENTIDADE não se aplica",
      "REQUISITO_DO_CARGO não se aplica",
      "COTA_PP não se aplica (AC)",
      "COTA_PP não se aplica (PP)",
      "tudo Conforme",
    ])
      expect(ENSAIO).toContain(caso);
    expect(ROLLBACK).toMatch(/FC_VALIDAR_LANCAMENTO_FICHA/);
    expect(ROLLBACK).not.toContain("vale para este candidato");
  });
});
