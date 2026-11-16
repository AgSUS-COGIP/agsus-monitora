// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import { moldeDeBanco } from "./apoio/molde-de-banco.ts";

async function contagem(db: PGlite): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int as n from t",
  );
  return rows[0]?.n ?? -1;
}

function bancoComTabela() {
  return vi.fn(async () => {
    const db = await PGlite.create();
    await db.exec("create table t (x int)");
    return db;
  });
}

describe("moldeDeBanco", () => {
  it("monta o banco uma vez só", async () => {
    const montar = bancoComTabela();
    const banco = moldeDeBanco(montar);
    await banco();
    await banco();
    expect(montar).toHaveBeenCalledTimes(1);
  });

  it("cada chamada é um banco independente", async () => {
    const banco = moldeDeBanco(bancoComTabela());
    const a = await banco();
    const b = await banco();
    await a.exec("insert into t values (1)");
    expect(await contagem(a)).toBe(1);
    expect(await contagem(b)).toBe(0);
  });

  it("o molde não é alterado pelos clones", async () => {
    const banco = moldeDeBanco(bancoComTabela());
    const a = await banco();
    await a.exec("insert into t values (1)");
    expect(await contagem(await banco())).toBe(0);
  });
});
