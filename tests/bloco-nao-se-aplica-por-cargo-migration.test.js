import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261014150000: por_cargo aceita { nao_se_aplica: true } num
  bloco de documento; a regra da vaga marca o bloco e ele não vale para a
  ficha (o mesmo de regra-por-cargo.ts, ficha.js, pontuacao.js e .py).
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014150000_bloco_nao_se_aplica_por_cargo.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

describe("bloco que não se aplica ao cargo", () => {
  it("o bloco marcado não vale e a regra da vaga o marca", () => {
    expect(MIGRATION).toContain(
      "when p_bloco -> 'nao_se_aplica' = 'true'::jsonb then false",
    );
    expect(MIGRATION).toContain(
      "v_bloco := v_bloco || jsonb_build_object('nao_se_aplica', true);",
    );
  });

  it("a validação aceita só em DOCUMENTO, marcado e sozinho", () => {
    expect(MIGRATION).toContain(
      "when 'DOCUMENTO' then array['requisitos', 'nao_se_aplica'] end;",
    );
    expect(MIGRATION).toContain('"não se aplica" só aceita marcado (true).');
    expect(MIGRATION).toContain('"não se aplica" não vai com outras mudanças.');
  });

  it("revoga as funções e o rollback volta ao anterior", () => {
    for (const f of [
      'private."FC_BLOCO_SE_APLICA"(jsonb, jsonb)',
      'private."FC_BLOCO_DO_CARGO"(jsonb, jsonb, text)',
      'private."FC_VALIDAR_POR_CARGO_ANALISE"(jsonb)',
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${f} from public, anon, authenticated, service_role;`,
      );
      expect(ROLLBACK).toContain(`revoke all on function ${f}`);
    }
    expect(ROLLBACK).not.toContain("nao_se_aplica', true");
    expect(ROLLBACK).toContain("when 'DOCUMENTO' then array['requisitos'] end;");
  });
});
