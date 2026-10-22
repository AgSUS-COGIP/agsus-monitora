import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A PASTA DE MIGRATIONS SÓ TEM O QUE SE APLICA (20/10/2026)

  `supabase/migrations/` é a fila de schema: tudo ali é aplicável, em ordem de
  timestamp. O que nunca deve correr foi para `supabase/descartadas/` (decisão)
  e o que já correu e seria perigoso reaplicar foi para
  `supabase/migrations-historicas/`. Processo em `supabase/migrations/README.md`.
*/
const MIGRATIONS = "supabase/migrations";
const nomes = readdirSync(MIGRATIONS);
const sql = nomes.filter((n) => n.toLowerCase().endsWith(".sql"));

describe("supabase/migrations", () => {
  it("só tem .sql com timestamp de 14 dígitos (e o README)", () => {
    const foraDoPadrao = nomes.filter(
      (n) => n !== "README.md" && !/^\d{14}_[a-z0-9_]+\.sql$/.test(n),
    );
    expect(foraDoPadrao).toEqual([]);
    expect(sql.length).toBeGreaterThan(100);
  });

  it("nenhuma descartada voltou para a pasta", () => {
    const descartadas = readdirSync("supabase/descartadas").filter((n) =>
      n.endsWith(".sql"),
    );
    expect(descartadas).toEqual(
      expect.arrayContaining([
        "20260929190000_acesso_basico_institucional.sql",
        "20260918120000_registro_do_bridge_da_aya.sql",
      ]),
    );
    expect(sql.filter((n) => descartadas.includes(n))).toEqual([]);
  });

  /*
    Mesmo com outro nome: o acesso automático por domínio e o bridge da IA local
    foram decisões de nunca aplicar.
  */
  it("nada recria o acesso automático nem o bridge da Aya", () => {
    expect(
      sql.filter((n) => /acesso_basico|bridge_da_aya|bridge_aya/.test(n)),
    ).toEqual([]);
  });

  it("nenhuma histórica foi duplicada na pasta", () => {
    const historicas = readdirSync("supabase/migrations-historicas").filter(
      (n) => n.endsWith(".sql"),
    );
    expect(historicas).toEqual(
      expect.arrayContaining([
        "add_update_user_access_rpc.sql",
        "restrict_access_management_to_master.sql",
        "20260624_access_requests_and_panel_permissions.sql",
      ]),
    );
    expect(sql.filter((n) => historicas.includes(n))).toEqual([]);
  });

  it("descartadas e históricas explicam cada arquivo no README", () => {
    for (const pasta of [
      "supabase/descartadas",
      "supabase/migrations-historicas",
    ]) {
      const leia = readFileSync(`${pasta}/README.md`, "utf8");
      for (const n of readdirSync(pasta).filter((x) => x.endsWith(".sql"))) {
        expect(leia, `${pasta}/README.md não cita ${n}`).toContain(n);
      }
    }
  });
});
