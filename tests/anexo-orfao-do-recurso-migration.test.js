import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration que deixa apagar o anexo de recurso órfão (enviado ao bucket e
  não registrado). As travas que não podem se perder numa edição: só o dono,
  só nos primeiros 10 minutos, só o caminho ainda não registrado, e nenhuma
  outra política de delete/update no bucket.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261022190500_apagar_anexo_orfao_do_recurso.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("anexo órfão do recurso (migration)", () => {
  it("delete só do dono, em 10 minutos e do caminho não registrado", () => {
    const politica = MIGRATION.slice(
      MIGRATION.indexOf(
        'create policy "PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO"',
      ),
    );
    expect(politica).toMatch(/for delete to authenticated/);
    expect(politica).toMatch(/bucket_id = 'recursos-anexos'/);
    expect(politica).toMatch(/owner_id = \(select auth\.uid\(\)\)::text/);
    expect(politica).toMatch(/created_at > now\(\) - interval '10 minutes'/);
    expect(politica).toMatch(/private\."FC_ANEXO_RECURSO_ORFAO"\(name\)/);
  });

  it("a função é SECURITY DEFINER com search_path vazio e fora do anon", () => {
    expect(MIGRATION).toMatch(/security definer\s+set search_path to ''/);
    expect(MIGRATION).toMatch(
      /revoke all on function private\."FC_ANEXO_RECURSO_ORFAO"\(text\) from public, anon;/,
    );
    expect(MIGRATION).toMatch(/begin;[\s\S]*commit;\s*$/);
  });

  it("rollback tira política e função; ensaio termina em rollback", () => {
    expect(ROLLBACK).toMatch(
      /drop policy if exists "PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO" on storage\.objects;/,
    );
    expect(ROLLBACK).toMatch(
      /drop function if exists private\."FC_ANEXO_RECURSO_ORFAO"\(text\);/,
    );
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });
});
