import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Migration 20261111170000: o cartão "Próximos 7 dias" de Editais
  (get_nucleo_cronograma_resumo) contava de hoje a hoje + 7 (8 dias). Decisão de
  11/11/2026: 7 dias contando hoje; proxima_7d vai de 4 a 6 dias. O teste confere
  o trio sem banco.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261111170000_proximos_7_dias_contam_7_dias.sql";
const ler = (pasta: string) =>
  fs.readFileSync(path.join(RAIZ, "supabase", pasta, NOME), "utf8");
const migration = ler("migrations");
const rollback = ler("rollback");
const ensaio = ler("ensaios");

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");
const ANTES = "92b67beb8bc97e20271b46d1ec50cedf";
const DEPOIS = "436e0e97170a4d8ee43e01705ff574fb";

function corpo(sql: string): string {
  const marca = "AS $function$";
  const de = sql.indexOf(marca);
  expect(de, "corpo da função").toBeGreaterThanOrEqual(0);
  const inicio = de + marca.length;
  return sql.slice(inicio, sql.indexOf("$function$", inicio));
}

describe("migration 20261111170000 (próximos 7 dias contam 7 dias)", () => {
  it("os md5 das guardas batem com os corpos", () => {
    expect(md5(corpo(rollback))).toBe(ANTES);
    expect(md5(corpo(migration))).toBe(DEPOIS);
    for (const sql of [migration, ensaio]) {
      expect(sql).toContain(`'${ANTES}'`);
      expect(sql).toContain(`'${DEPOIS}'`);
    }
    expect(rollback).toContain(`'${DEPOIS}'`);
  });

  it("só a faixa de proxima_7d muda (4 a 7 → 4 a 6); proxima_3d segue de 0 a 3", () => {
    const novo = corpo(migration);
    expect(novo).toContain("between 0 and 3 then 'proxima_3d'");
    expect(novo).toContain("between 4 and 6 then 'proxima_7d'");
    expect(
      novo.replace(
        "between 4 and 6 then 'proxima_7d'",
        "between 4 and 7 then 'proxima_7d'",
      ),
    ).toBe(corpo(rollback));
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    expect(corpo(ensaio)).toBe(corpo(migration));
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
  });
});
