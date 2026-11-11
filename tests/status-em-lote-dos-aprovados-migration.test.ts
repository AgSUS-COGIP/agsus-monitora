import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Migration 20261111180000: alterar_status_candidatos_aprovados, o status em
  lote da aba Aprovados. O teste confere o trio sem banco: as mesmas regras da
  mudança de um candidato, os status do lote e as permissões.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261111180000_status_em_lote_dos_aprovados.sql";
const ler = (pasta: string) =>
  fs.readFileSync(path.join(RAIZ, "supabase", pasta, NOME), "utf8");
const migration = ler("migrations");
const rollback = ler("rollback");
const ensaio = ler("ensaios");

function funcao(sql: string): string {
  const de = sql.indexOf("-- [funcao]");
  const ate = sql.indexOf("-- [/funcao]");
  expect(de).toBeGreaterThanOrEqual(0);
  expect(ate).toBeGreaterThan(de);
  return sql.slice(de, ate);
}
const corpo = funcao(migration);

describe("migration 20261111180000 (status em lote dos aprovados)", () => {
  it("o ensaio cria a mesma função e termina em rollback; o rollback a tira", () => {
    expect(funcao(ensaio)).toBe(corpo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(rollback).toContain(
      "drop function public.alterar_status_candidatos_aprovados(uuid[], text, date);",
    );
  });

  it("só Convocado, Desistente, Documentação Rejeitada ou sem status (este, só o admin)", () => {
    expect(corpo).toContain(
      "v_status not in ('Convocado', 'Desistente', 'Documentação Rejeitada')",
    );
    expect(corpo).toContain("if v_status is null and not v_admin then");
    expect(corpo).not.toMatch(/'Contratado'|'Migração'/);
  });

  it("as regras de um candidato, um a um: lista ativa, status definido só o admin, fora do Convocado", () => {
    expect(corpo).toContain("if not v_c.vigente or not v_c.ativo then");
    expect(corpo).toContain(
      "elsif not v_admin and v_c.status is not null and v_c.status <> 'Convocado' then",
    );
    expect(corpo).toContain('private."FC_EXIGIR_AREA_EDITAL"(l.edital_id)');
    expect(corpo).toContain("if array_length(v_ids, 1) > 500 then");
    expect(corpo).toContain('insert into public."TH_CANDIDATO_APROVADO"(');
    expect(corpo).toContain('private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"');
  });

  it("responde como marcar_candidatos_convocados e só authenticated executa", () => {
    expect(corpo).toContain(
      "json_build_object('marcados', v_alterados, 'ignorados', v_ignorados,",
    );
    expect(corpo).toContain(
      "revoke all on function public.alterar_status_candidatos_aprovados(uuid[], text, date) from public, anon;",
    );
    expect(corpo).toContain(
      "grant execute on function public.alterar_status_candidatos_aprovados(uuid[], text, date) to authenticated;",
    );
  });
});
