import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration do vínculo na conferência dos aprovados (20261024090000), ainda
  não aplicada: o ensaio begin…rollback está em supabase/ensaios/. Aqui, as
  invariantes estáticas: conferencia_ler_aprovados ganha só o hash da
  matrícula ('vinculo'), o resto da leitura é o de 20261007230000, a RPC segue
  SECURITY DEFINER, com search_path vazio e só para service_role, e o rollback
  volta ao corpo anterior.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261024090000_contratado_por_vinculo.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261007230000_edital_de_treinamento.sql",
);

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** O corpo da função (do create até o $function$; que fecha), em minúsculas. */
function funcao(sql) {
  const baixo = sql.toLowerCase();
  const inicio = baixo.indexOf(
    "create or replace function public.conferencia_ler_aprovados()",
  );
  expect(inicio).toBeGreaterThanOrEqual(0);
  const fim = baixo.indexOf(
    "$function$;",
    baixo.indexOf("$function$", inicio) + 1,
  );
  return sql.slice(inicio, fim);
}
const semCabecalho = (f) => f.slice(f.toLowerCase().indexOf("as $function$"));
const VINCULO =
  /,\n\s+-- O vínculo é a matrícula[^\n]*\n\s+encode\(sha256\(convert_to\('vinculo:'[^\n]*\n[^\n]*as vinculo/;

describe("conferência dos aprovados pelo vínculo (20261024090000)", () => {
  it("é uma transação, com pré-requisitos, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261007230000",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
  });

  it("a RPC segue SECURITY DEFINER, com search_path vazio, só para service_role", () => {
    const f = funcao(MIGRATION);
    expect(f).toContain("security definer");
    expect(f).toContain("set search_path to ''");
    for (const sql of [MIGRATION, ROLLBACK]) {
      expect(sql).toContain(
        "revoke all on function public.conferencia_ler_aprovados() from public, anon, authenticated;",
      );
      expect(sql).toContain(
        "grant execute on function public.conferencia_ler_aprovados() to service_role;",
      );
    }
  });

  it("acrescenta só o hash da matrícula; o resto da leitura é o de 20261007230000", () => {
    const nova = semCabecalho(funcao(MIGRATION));
    const antes = semCabecalho(funcao(ANTERIOR));
    expect(nova).toMatch(VINCULO);
    expect(nova).toContain("'pessoa', c.pessoa, 'vinculo', c.vinculo");
    const semVinculo = nova
      .replace(VINCULO, "")
      .replace(", 'vinculo', c.vinculo", "");
    expect(semVinculo.toLowerCase()).toBe(antes.toLowerCase());
    // A matrícula só entra no hash: nunca como chave da saída.
    expect(nova).not.toMatch(/'matricula'/);
    expect(nova.match(/c\.matricula/g)).toHaveLength(1);
  });

  it("o rollback volta ao corpo de 20261007230000, sem o vínculo", () => {
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    expect(semCabecalho(funcao(ROLLBACK))).toBe(semCabecalho(funcao(ANTERIOR)));
    expect(funcao(ROLLBACK)).not.toContain("vinculo");
  });

  it("o ensaio só devolve verdadeiro/falso e contagens", () => {
    expect(ENSAIO).toContain("'matricula_em_claro_na_saida'");
    expect(ENSAIO).toContain("'so_service_role'");
    expect(ENSAIO).not.toMatch(/select[^;]*c\.matricula\s+as/i);
  });
});
