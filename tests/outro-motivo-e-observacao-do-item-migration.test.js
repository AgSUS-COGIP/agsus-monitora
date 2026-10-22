import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261015010000: "Outro motivo (descrever)" (OUTRO em motivos ou
  justificativas, texto em motivo_livre) e a Observação do avaliador
  (observacao) em todo bloco. O espelho é pendenciasDaFicha (ficha.js) e a
  conta (pontuacao.js / pontuacao.py, casos dourados).
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261015010000_outro_motivo_e_observacao_do_item.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("outro motivo e observação do item", () => {
  it("o lançamento aceita OUTRO em motivos e justificativas e limita a observação", () => {
    expect(MIGRATION).toContain(
      "where m <> 'OUTRO' -- \"Outro motivo (descrever)\"",
    );
    expect(MIGRATION).toContain("where j <> 'OUTRO'");
    expect(MIGRATION).toContain(
      "length(coalesce(v_item.value ->> 'observacao', '')) > 2000",
    );
    expect(MIGRATION).toContain("not in ('string', 'null')");
  });

  it("as pendências aceitam o OUTRO descrito e pedem o texto quando falta", () => {
    expect(MIGRATION).toContain(
      "v_livre := length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10;",
    );
    expect(MIGRATION).toContain(
      "': descreva o outro motivo (10 caracteres ou mais)'",
    );
    expect(MIGRATION).toContain(
      "coalesce(v_l -> 'justificativas', '[]'::jsonb) ? 'OUTRO' and v_livre",
    );
    expect(MIGRATION).toContain("where m <> 'OUTRO')");
  });

  it("revoga, ensaia com rollback e o rollback volta ao anterior", () => {
    for (const f of [
      'private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb)',
      'private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb)',
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${f} from public, anon, authenticated;`,
      );
      expect(ROLLBACK).toContain(
        `revoke all on function ${f} from public, anon, authenticated;`,
      );
    }
    expect(MIGRATION.trim().startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).toContain('private."FC_PENDENCIAS_FICHA"');
    expect(ENSAIO).toContain('private."FC_VALIDAR_LANCAMENTO_FICHA"');
    const corpo = ROLLBACK.slice(ROLLBACK.indexOf("\nbegin;"));
    expect(corpo).not.toContain("'OUTRO'");
    expect(corpo).not.toContain("'observacao'");
    expect(ROLLBACK).toContain("': escolha o motivo'");
  });
});
