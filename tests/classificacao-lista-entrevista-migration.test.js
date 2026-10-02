import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIPOS_DE_LISTA } from "../src/lib/classificacao/catalogo.js";

/*
  A migration da lista do resultado da entrevista: o banco aceita os mesmos
  tipos de lista do catálogo do front, e o rollback devolve os três antigos
  sem apagar histórico.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = ler(
  "supabase/migrations/20261002170000_classificacao_lista_da_entrevista.sql",
);
const ROLLBACK = ler(
  "supabase/rollback/20261002170000_classificacao_lista_da_entrevista.sql",
);
const tipos = (sql, onde) => {
  const m = sql.match(new RegExp(`${onde} in \\(([^)]*)\\)`));
  return m ? [...m[1].matchAll(/'([A-Z]+)'/g)].map((x) => x[1]) : [];
};

describe("migration 20261002170000 — lista ENTREVISTA", () => {
  it("o CHECK e o RPC aceitam os tipos do catálogo (TIPOS_DE_LISTA)", () => {
    const catalogo = TIPOS_DE_LISTA.map(([v]) => v).sort();
    expect(tipos(MIGRATION, '\\("TP_LISTA"').sort()).toEqual(catalogo);
    expect(tipos(MIGRATION, "p_tipo not").sort()).toEqual(catalogo);
  });

  it("transação, mesma assinatura do RPC e grant só para authenticated/service_role", () => {
    expect(MIGRATION.trim().startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n[\s\S]+\ncommit;\n?$/);
    expect(MIGRATION).toContain(
      "create or replace function public.registrar_lista_classificacao(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)",
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.registrar_lista_classificacao(uuid, text, integer, jsonb) from public, anon;",
    );
    expect(MIGRATION).toContain("set search_path to ''");
  });

  it("rollback: recusa se houver lista ENTREVISTA e volta aos três tipos", () => {
    expect(ROLLBACK).toContain(`where "TP_LISTA" = 'ENTREVISTA'`);
    expect(tipos(ROLLBACK, '\\("TP_LISTA"').sort()).toEqual([
      "CONVOCACAO",
      "FINAL",
      "PRELIMINAR",
    ]);
    expect(tipos(ROLLBACK, "p_tipo not").sort()).toEqual([
      "CONVOCACAO",
      "FINAL",
      "PRELIMINAR",
    ]);
  });
});
