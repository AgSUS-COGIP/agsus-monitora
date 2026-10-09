import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration da experiência mínima ao concluir a ficha (20261009150000),
  ainda não aplicada: o ensaio begin…rollback está em supabase/ensaios/.
  Aqui, as invariantes estáticas: só FC_PENDENCIAS_FICHA muda, com a mesma
  regra da tela (pendenciasDaFicha, tipo "minimo"), o ensaio leva o mesmo
  corpo e o rollback devolve a função de 20261007130000.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009150000_experiencia_minima_ao_concluir_a_ficha.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ORIGEM = ler("supabase/migrations/20261007130000_conteudo_da_ficha.sql");

const funcao = (sql) => {
  const ini = sql.search(/function private."FC_PENDENCIAS_FICHA"/i);
  return sql.slice(
    ini,
    sql.indexOf("$function$", sql.indexOf("$function$", ini) + 1),
  );
};
const normal = (s) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

describe("experiência mínima ao concluir a ficha", () => {
  it("só troca FC_PENDENCIAS_FICHA, com a pendência do mínimo", () => {
    expect(MIGRATION.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(1);
    expect(MIGRATION).not.toMatch(/alter table|create table|drop /i);
    const nova = funcao(MIGRATION);
    expect(nova).toContain("v_bloco ->> 'tipo' = 'VINCULOS'");
    expect(nova).toContain("v_l ->> 'situacao' = 'CONFORME'");
    expect(nova).toContain(
      "coalesce(v_bloco ->> 'efeito_minimo', 'ELIMINA') = 'ELIMINA'",
    );
    expect(nova).toContain("'meses_considerados' else 'meses'");
    expect(MIGRATION).toMatch(/^begin;$/m);
    expect(MIGRATION).toMatch(/^commit;$/m);
  });

  it("o ensaio leva o mesmo corpo e termina em rollback", () => {
    expect(normal(funcao(ENSAIO))).toBe(normal(funcao(MIGRATION)));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).toContain("992/2099");
    expect(ENSAIO).not.toMatch(/a4ffcb6a/);
    expect(ENSAIO).toContain("public.concluir_ficha(");
  });

  it("o rollback devolve a função de 20261007130000", () => {
    expect(normal(funcao(ROLLBACK))).toBe(normal(funcao(ORIGEM)));
  });
});
