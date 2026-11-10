import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Migration 20261110203000: em get_selecao_da_area, quem foi contratado pela
  outra linha do edital (ampla × cota) contava duas vezes em Aprovados e uma
  em Não contratados (auditoria dos cálculos de 10/11/2026). O teste confere o
  trio sem banco: o corpo da migration é o do ensaio; o do rollback é o
  retrato de produção (supabase/esquema-atual.sql); as guardas usam os md5
  certos; e só as duas contagens de "total" mudaram.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME =
  "20261110203000_selecao_conta_uma_vez_quem_esta_em_outra_lista.sql";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8");

const migration = ler(`supabase/migrations/${NOME}`);
const rollback = ler(`supabase/rollback/${NOME}`);
const ensaio = ler(`supabase/ensaios/${NOME}`);
const retrato = ler("supabase/esquema-atual.sql");

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

/** O corpo entre `as $_$` e `$_$;` (o prosrc que o Postgres guarda). */
function corpo(sql: string, marcaDeInicio = "as $_$"): string {
  const inicio = sql.indexOf(marcaDeInicio);
  expect(inicio, "corpo da função").toBeGreaterThanOrEqual(0);
  const de = inicio + marcaDeInicio.length;
  return sql.slice(de, sql.indexOf("$_$;", de));
}

const ANTES = "07ef20528cba24ed26c971f2e62500b4";
const corpoDoRetrato = corpo(
  retrato.slice(
    retrato.indexOf(
      "CREATE FUNCTION public.get_selecao_da_area(p_area text) RETURNS json",
    ),
  ),
  "AS $_$",
);
const corpoNovo = corpo(migration);
const DEPOIS = md5(corpoNovo);

describe("migration 20261110203000 (Seleção conta uma vez quem está em outra lista)", () => {
  it("o rollback volta ao corpo do retrato de produção", () => {
    expect(md5(corpoDoRetrato)).toBe(ANTES);
    expect(corpo(rollback)).toBe(corpoDoRetrato);
  });

  it("o ensaio aplica exatamente o corpo da migration", () => {
    expect(corpo(ensaio)).toBe(corpoNovo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("as guardas usam os md5 de antes e de depois", () => {
    expect(migration).toContain(`'${ANTES}'`);
    expect(migration).toContain(`'${DEPOIS}'`);
    expect(rollback).toContain(`'${DEPOIS}'`);
    expect(ensaio).toContain(`'${ANTES}'`);
    expect(ensaio).toContain(`'${DEPOIS}'`);
  });

  it("só o total de aprovados muda, nas duas contagens (código e cargo)", () => {
    const totalNovo =
      /\(count\(\*\) filter \(where c\.status is distinct from 'Contratado em outra lista'\s+and not private\."FC_EM_OUTRA_LISTA"\(c\.id\)\)\)::integer as total,/g;
    expect(corpoNovo.match(totalNovo)).toHaveLength(2);
    expect(corpoNovo).not.toContain("count(*)::integer as total,");
    // Tirando as linhas novas, sobra o corpo de antes sem as duas contagens antigas.
    const semAsNovas = corpoNovo
      .split("\n")
      .filter(
        (linha) =>
          !linha.includes("Quem foi contratado pela outra linha") &&
          !linha.includes("conta uma vez, como já não conta") &&
          !linha.includes("is distinct from 'Contratado em outra lista'") &&
          !linha.includes(
            'and not private."FC_EM_OUTRA_LISTA"(c.id)))::integer as total',
          ),
      )
      .join("\n");
    const semAsAntigas = corpoDoRetrato
      .split("\n")
      .filter((linha) => linha.trim() !== "count(*)::integer as total,")
      .join("\n");
    expect(semAsNovas).toBe(semAsAntigas);
  });

  it("contratados continua sem quem está em outra lista (a regra de antes)", () => {
    expect(
      corpoNovo.match(
        /\(count\(\*\) filter \(where c\.status in \('Contratado', 'Migração'\) and not private\."FC_EM_OUTRA_LISTA"\(c\.id\)\)\)::integer as contratados/g,
      ),
    ).toHaveLength(2);
  });

  it("aplica e registra como as outras: begin/commit e sem db push", () => {
    expect(migration).toMatch(/^begin;$/m);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain(
      'select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();',
    );
    expect(rollback.trimEnd().endsWith("commit;")).toBe(true);
  });
});
