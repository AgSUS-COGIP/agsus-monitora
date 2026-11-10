import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A PASTA DE MIGRATIONS SÓ TEM O QUE SE APLICA

  `supabase/migrations/` é a fila de schema: tudo ali é aplicável, em ordem de
  timestamp. As migrations já aplicadas saíram do repositório em 10/11/2026 (seguem
  no banco e no registro `public.migracoes_aplicadas`); a pasta guarda só as que
  ainda importam. Processo em `docs/biblioteca/banco-e-migrations.md`.
*/
const MIGRATIONS = "supabase/migrations";
// Sem migration pendente, a pasta some do Git (pasta vazia não é versionada).
const nomes = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS) : [];
const sql = nomes.filter((n) => n.toLowerCase().endsWith(".sql"));

describe("supabase/migrations", () => {
  it("só tem .sql com timestamp de 14 dígitos", () => {
    const foraDoPadrao = nomes.filter(
      (n) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(n),
    );
    expect(foraDoPadrao).toEqual([]);
  });

  it("toda migration tem rollback e ensaio com o mesmo nome", () => {
    for (const n of sql) {
      expect(existsSync(`supabase/rollback/${n}`), `rollback de ${n}`).toBe(
        true,
      );
      expect(existsSync(`supabase/ensaios/${n}`), `ensaio de ${n}`).toBe(true);
    }
  });

  /*
    O acesso automático por domínio e o bridge da IA local foram decisões de
    nunca aplicar: nada os recria, nem com outro nome.
  */
  it("nada recria o acesso automático nem o bridge da Aya", () => {
    expect(
      sql.filter((n) => /acesso_basico|bridge_da_aya|bridge_aya/.test(n)),
    ).toEqual([]);
  });

  it("as pastas de legado não voltaram", () => {
    for (const pasta of [
      "supabase/migrations-historicas",
      "supabase/descartadas",
      "supabase/correcoes",
    ])
      expect(existsSync(pasta), pasta).toBe(false);
  });
});
