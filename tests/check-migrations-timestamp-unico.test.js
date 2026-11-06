import { describe, expect, it } from "vitest";
import {
  compararMigrations,
  timestampDe,
} from "../scripts/check-migrations-timestamp-unico.mjs";

/*
  O passo do CI que barra, antes do merge, a migration nova com timestamp que
  a main já usa (o caso de 05/11/2026, 20261105190000).
*/

const MAIN = [
  "20261105170000_leitura_da_api_de_editais.sql",
  "20261105190000_area_na_api.sql",
  "README.md",
];

describe("timestamp das migrations do PR contra a main", () => {
  it("lê o timestamp só de migration .sql com prefixo", () => {
    expect(timestampDe("supabase/migrations/20261105190000_a.sql")).toBe(
      "20261105190000",
    );
    expect(timestampDe("README.md")).toBeNull();
    expect(timestampDe("20261105190000_a.txt")).toBeNull();
  });

  it("timestamp livre e depois da última da main passa sem aviso", () => {
    const resultado = compararMigrations(MAIN, [
      ...MAIN,
      "20261106100000_nova.sql",
    ]);
    expect(resultado).toEqual({
      novas: ["20261106100000_nova.sql"],
      erros: [],
      avisos: [],
    });
  });

  it("timestamp que a main já tem falha e manda renomear a nova", () => {
    const { erros } = compararMigrations(MAIN, [
      ...MAIN,
      "20261105190000_fontes_apos_leitura_da_api_de_editais.sql",
    ]);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain("20261105190000_fontes_apos_leitura");
    expect(erros[0]).toContain("20261105190000_area_na_api.sql");
    expect(erros[0]).toMatch(/Renomeie a migration NOVA/);
  });

  it("duas novas do mesmo PR com o mesmo timestamp falham", () => {
    const { erros } = compararMigrations(MAIN, [
      ...MAIN,
      "20261106100000_a.sql",
      "20261106100000_b.sql",
    ]);
    expect(erros).toEqual([
      expect.stringContaining("20261106100000_a.sql, 20261106100000_b.sql"),
    ]);
  });

  it("timestamp livre mas anterior à última da main só avisa", () => {
    const { erros, avisos } = compararMigrations(MAIN, [
      ...MAIN,
      "20261105180000_no_meio.sql",
    ]);
    expect(erros).toEqual([]);
    expect(avisos).toEqual([
      expect.stringContaining("anterior à última migration da main"),
    ]);
  });

  it("migration da main renomeada ou apagada no PR falha", () => {
    const { erros } = compararMigrations(MAIN, [
      "20261105170000_leitura_da_api_de_editais.sql",
      "20261106100000_area_na_api.sql",
    ]);
    expect(erros).toEqual([
      expect.stringContaining("20261105190000_area_na_api.sql: está na main"),
    ]);
  });

  it("ramo atrasado: o que só a main tem não é novo nem apagado", () => {
    const inicio = ["20261105170000_leitura_da_api_de_editais.sql"];
    const resultado = compararMigrations(
      MAIN,
      [...inicio, "20261106100000_nova.sql"],
      inicio,
    );
    expect(resultado.erros).toEqual([]);
    expect(resultado.novas).toEqual(["20261106100000_nova.sql"]);
  });

  it("os repetidos antigos da main não contam contra o PR", () => {
    const main = [...MAIN, "20261105190000_fontes.sql"];
    expect(compararMigrations(main, main)).toEqual({
      novas: [],
      erros: [],
      avisos: [],
    });
  });
});
