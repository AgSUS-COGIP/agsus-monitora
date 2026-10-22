import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261014210000: o bloco de títulos, cursos ou experiência que não
  pontua no nível da vaga (e não tem como mudar o resultado) não vale para a
  ficha: as pendências não pedem a situação dele. O espelho é
  blocoNaoPontuaNoNivel (ficha.js); os casos estão em
  tests/lib/avaliacao-documental-perguntas-do-cargo.test.js.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014210000_bloco_que_nao_pontua_no_nivel.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("bloco que não pontua no nível", () => {
  it("o predicado olha o teto do nível e a tabela dos títulos, sem efeito possível", () => {
    expect(MIGRATION).toContain(
      'coalesce(private."FC_TETO_DO_BLOCO"(p_bloco, p_nivel) = 0, false)',
    );
    expect(MIGRATION).toContain("array['pontos_por_nivel', p_nivel]");
    expect(MIGRATION).toContain("not in ('', 'SO_REGISTRO')");
    expect(MIGRATION).toContain("p_bloco -> 'requisitos'");
    expect(MIGRATION).toContain("array['por_nivel', p_nivel, 'extras']");
    expect(MIGRATION).toContain("p_bloco -> 'minimo_meses'");
    expect(MIGRATION).toContain("coalesce(p_nivel, '') <> ''");
  });

  it("FC_BLOCO_SE_APLICA usa o predicado depois do nao_se_aplica do cargo", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf('FUNCTION private."FC_BLOCO_SE_APLICA"'),
    );
    expect(
      corpo.indexOf("nao_se_aplica' = 'true'::jsonb then false"),
    ).toBeLessThan(
      corpo.indexOf(
        "\"FC_BLOCO_NAO_PONTUA_NO_NIVEL\"(p_bloco, p_lancamento ->> 'nivel') then false",
      ),
    );
  });

  it("revoga, ensaia com rollback e o rollback volta ao anterior", () => {
    for (const f of [
      'private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(jsonb, text)',
      'private."FC_BLOCO_SE_APLICA"(jsonb, jsonb)',
    ])
      expect(MIGRATION).toContain(
        `revoke all on function ${f} from public, anon, authenticated, service_role;`,
      );
    expect(MIGRATION.trim().startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).toContain('private."FC_PENDENCIAS_FICHA"');
    expect(ROLLBACK).not.toContain('NAO_PONTUA_NO_NIVEL"(p_bloco');
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(jsonb, text);',
    );
    expect(ROLLBACK).toContain(
      "when p_bloco -> 'nao_se_aplica' = 'true'::jsonb then false",
    );
  });
});
