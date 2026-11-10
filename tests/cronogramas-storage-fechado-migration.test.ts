import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration que fecha o bucket cronogramas-editais (auditoria SEG-01). As
  travas que não podem se perder numa edição: a política é restritiva, vale
  para toda operação, só o administrador global passa, e os outros buckets
  ficam de fora. O app não pode voltar a usar o bucket sem rever isto.
*/
const ler = (arquivo: string) =>
  readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261110120000_fechar_bucket_de_cronogramas.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

/** O `create policy` até o `;` que o fecha. */
const politica = (sql: string) => {
  const inicio = sql.indexOf('create policy "PL_STORAGE_CRONOGRAMAS_SO_ADMIN"');
  return sql.slice(inicio, sql.indexOf(";", inicio) + 1);
};

describe("bucket de cronogramas fechado (migration)", () => {
  it("restritiva, para toda operação, só administrador global", () => {
    const corpo = politica(MIGRATION);
    expect(corpo).toMatch(
      /on storage\.objects as restrictive for all to authenticated/,
    );
    const condicao =
      /bucket_id <> 'cronogramas-editais'\s+or \(select private\.is_master\(\)\)\s*\)/g;
    // Uma vez no using e outra no with check.
    expect(corpo.match(condicao)).toHaveLength(2);
    expect(corpo).not.toMatch(/pode_recurso/);
  });

  it("idempotente, em transação, sem apagar arquivo", () => {
    expect(MIGRATION).toMatch(
      /drop policy if exists "PL_STORAGE_CRONOGRAMAS_SO_ADMIN" on storage\.objects;\s*create policy/,
    );
    expect(MIGRATION).toMatch(/begin;[\s\S]*commit;\s*$/);
    expect(MIGRATION).not.toMatch(
      /delete from storage|drop bucket|storage\.buckets/i,
    );
  });

  it("rollback confere que foi aplicada e só tira a política", () => {
    expect(ROLLBACK).toMatch(
      /raise exception 'Migration 20261110120000 nao aplicada/,
    );
    expect(ROLLBACK).toMatch(
      /drop policy if exists "PL_STORAGE_CRONOGRAMAS_SO_ADMIN" on storage\.objects;/,
    );
    expect(ROLLBACK).toMatch(/begin;[\s\S]*commit;\s*$/);
  });

  it("ensaio usa a mesma política, confere os perfis e termina em rollback", () => {
    expect(politica(ENSAIO)).toBe(politica(MIGRATION));
    expect(ENSAIO).toMatch(/ainda ve % arquivo\(s\) do bucket/);
    expect(ENSAIO).toMatch(/A politica mudou outros buckets/);
    expect(ENSAIO).toMatch(/rollback;\s*$/);
  });

  it("o app não usa o bucket", () => {
    let usos = "";
    try {
      usos = execFileSync(
        "git",
        [
          "grep",
          "-l",
          "cronogramas-editais",
          "--",
          "src",
          "api",
          "scripts",
          "server",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
    } catch {
      // git grep sai com código 1 quando não acha nada.
    }
    expect(usos).toBe("");
  });
});
