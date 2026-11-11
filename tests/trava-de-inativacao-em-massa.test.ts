import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Migration 20261111120000: o envio completo das análises
  (finalizar_sync_analises_lotes) passa a recusar a desativação em massa, como o
  incremental já fazia. Incidente de 11/11/2026: 11.089 análises da Saúde
  Indígena desativadas por um envio completo com a planilha só dos editais novos.
  O teste confere o trio sem banco.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261111120000_trava_de_inativacao_em_massa_das_analises.sql";
const ler = (pasta: string) =>
  fs.readFileSync(path.join(RAIZ, "supabase", pasta, NOME), "utf8");
const migration = ler("migrations");
const rollback = ler("rollback");
const ensaio = ler("ensaios");

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");
const ANTES = "087cfc07ca94fecee3e822ccf8cbcdfb";
const DEPOIS = "18df29fd6b152d7981ab91579849ded6";

/** O corpo entre `AS $function$` e `$function$` (o prosrc que o Postgres guarda). */
function corpo(sql: string): string {
  const marca = "AS $function$";
  const de = sql.indexOf(marca);
  expect(de, "corpo da função").toBeGreaterThanOrEqual(0);
  const inicio = de + marca.length;
  return sql.slice(inicio, sql.indexOf("$function$", inicio));
}

const corpoNovo = corpo(migration);
const corpoVelho = corpo(rollback);

describe("migration 20261111120000 (trava de desativação em massa)", () => {
  it("os md5 das guardas batem com os corpos", () => {
    expect(md5(corpoVelho)).toBe(ANTES);
    expect(md5(corpoNovo)).toBe(DEPOIS);
    for (const sql of [migration, ensaio]) {
      expect(sql).toContain(`'${ANTES}'`);
      expect(sql).toContain(`'${DEPOIS}'`);
    }
    expect(rollback).toContain(`'${DEPOIS}'`);
  });

  it("o ensaio aplica o mesmo corpo e a mesma função da trava, e termina em rollback", () => {
    expect(corpo(ensaio)).toBe(corpoNovo);
    const funcao = (sql: string) =>
      sql.slice(
        sql.indexOf(
          'create function private."FC_CONFERIR_INATIVACAO_EM_MASSA"',
        ),
        sql.indexOf("$guarda_fn$;") + "$guarda_fn$;".length,
      );
    expect(funcao(ensaio)).toBe(funcao(migration));
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("fora a trava, o corpo novo é o de produção letra por letra", () => {
    const semATrava = corpoNovo
      .replace("  v_a_inativar integer:=0;\n  v_bloqueio text;\n", "")
      .replace(/ {2}-- \[trava-em-massa\][\s\S]*? {2}end if;\n\n/, "");
    expect(semATrava).toBe(corpoVelho);
  });

  it("a trava conta antes do update e, acima do limite, não desativa nada", () => {
    const conta = corpoNovo.indexOf(
      "select count(*)::integer into v_a_inativar",
    );
    const trava = corpoNovo.indexOf(
      'private."FC_CONFERIR_INATIVACAO_EM_MASSA"(v_planilha, v_a_inativar)',
    );
    const update = corpoNovo.indexOf("set ativo=false,updated_at=now()");
    expect(conta).toBeGreaterThan(0);
    expect(trava).toBeGreaterThan(conta);
    expect(update).toBeGreaterThan(trava);
    // Recusa: encerra o sync como erro e devolve ok=false (o Apps Script descarta o estado).
    expect(corpoNovo).toContain("set status='erro', erro=v_bloqueio");
    expect(corpoNovo).toContain("'ok',false");
  });

  it("o limite é o do incremental e a liberação é só da sessão", () => {
    expect(migration).toContain("greatest(25, ceil(v_ativas * 0.02)::integer)");
    expect(migration).toContain(
      "current_setting('monitora.permitir_inativacao_em_massa', true)",
    );
    expect(migration).toContain(
      'revoke all on function private."FC_CONFERIR_INATIVACAO_EM_MASSA"(text, integer) from public;',
    );
    expect(rollback).toContain(
      'drop function private."FC_CONFERIR_INATIVACAO_EM_MASSA"(text, integer);',
    );
  });
});
