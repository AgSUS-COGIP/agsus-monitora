// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  blocoDaFuncao,
  corpoDaFuncao,
  migrationDosProntos,
  NOME_DOS_PRONTOS,
  rollbackDosProntos,
  RPCS_ANTIGAS,
  rpcsAntigas,
  salvarDeAntes,
} from "./apoio/banco-dos-paineis.ts";

/*
  Migration 20261116160000 (relatórios prontos dos Painéis): que migration,
  ensaio e rollback contam a mesma história — as guardas usam o md5 dos corpos
  que estão no banco, o rollback os devolve letra por letra e aborta se a
  migration não estiver aplicada, e o ensaio aplica o mesmo corpo.
*/

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");
const ensaio = () =>
  readFileSync(`supabase/ensaios/${NOME_DOS_PRONTOS}`, "utf8").replace(
    /\r\n/g,
    "\n",
  );
const SALVAR = "public.salvar_fonte_da_coluna(";
const corpoDaMigration = (sql: string) =>
  sql.slice(sql.indexOf("\nbegin;\n"), sql.lastIndexOf("\ncommit;"));

describe("migration 20261116160000", () => {
  const migration = migrationDosProntos();
  const rollback = rollbackDosProntos();
  const antigas = rpcsAntigas();
  const salvarAntes = salvarDeAntes();
  const salvarDepois = blocoDaFuncao(
    migration,
    `create or replace function ${SALVAR}`,
  );

  it("as guardas usam o md5 dos corpos de antes", () => {
    for (const bloco of antigas)
      expect(migration).toContain(
        `is distinct from '${md5(corpoDaFuncao(bloco))}'`,
      );
    expect(migration).toContain(
      `is distinct from '${md5(corpoDaFuncao(salvarAntes))}'`,
    );
  });

  it("o rollback restaura os corpos de antes letra por letra", () => {
    for (const [i, nome] of RPCS_ANTIGAS.entries())
      expect(
        corpoDaFuncao(
          blocoDaFuncao(
            rollback,
            `create or replace function public.${nome}(p_area text)`,
          ),
        ),
      ).toBe(corpoDaFuncao(antigas[i]!));
    expect(
      corpoDaFuncao(
        blocoDaFuncao(rollback, `create or replace function ${SALVAR}`),
      ),
    ).toBe(corpoDaFuncao(salvarAntes));
  });

  it("o rollback aborta se a migration não estiver aplicada", () => {
    expect(rollback).toContain(
      `to_regclass('public."TB_LINHA_RELATORIO_PAINEL"') is null`,
    );
    expect(rollback).toMatch(/raise exception '[^']*não está aplicada/);
    expect(rollback).toContain(
      `is distinct from '${md5(corpoDaFuncao(salvarDepois))}'`,
    );
  });

  it("a troca de fonte recalcula o relatório", () => {
    expect(corpoDaFuncao(salvarDepois)).toBe(
      corpoDaFuncao(salvarAntes).replace(
        '  return private."FC_FONTES_DO_PAINEL_JSON"(p_area, p_relatorio);',
        '  perform private."FC_CALCULAR_RELATORIO_PAINEL"(p_area, p_relatorio, v_usuario, null);\n' +
          '  return private."FC_FONTES_DO_PAINEL_JSON"(p_area, p_relatorio);',
      ),
    );
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    const e = ensaio();
    expect(e).toContain(corpoDaMigration(migration));
    expect(e).toContain("Ensaio 20261116160000 ok");
    expect(e.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
