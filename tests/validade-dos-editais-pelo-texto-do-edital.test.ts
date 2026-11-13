import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  A VALIDADE DOS EDITAIS PELO TEXTO DO EDITAL (migration 20261113230000)

  Nenhum edital tinha a validade gravada, então nenhum vencia. O prazo de 121
  editais foi lido na cláusula do PDF publicado e as prorrogações, nos avisos
  do site. O comportamento é conferido no banco pelo ensaio (121 gravados, 45
  vencidos, nenhuma lista vencida ativa); aqui, que migration, ensaio e
  rollback contam a mesma história.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261113230000_validade_dos_editais_pelo_texto_do_edital";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

/* As linhas de `values` da tabela temporária (uma por edital). */
const linhasDeValores = (sql: string) =>
  sql.split("\n").filter((l) => /^ {4}\('[0-9a-f-]{36}'::uuid/.test(l));

describe("migration 20261113230000", () => {
  const migration = ler(`supabase/migrations/${NOME}.sql`);
  const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
  const rollback = ler(`supabase/rollback/${NOME}.sql`);
  const linhas = linhasDeValores(migration);

  it("grava 121 editais, os mesmos no ensaio e no rollback", () => {
    expect(linhas).toHaveLength(121);
    expect(linhasDeValores(ensaio)).toEqual(linhas);
    expect(linhasDeValores(rollback)).toEqual(linhas);
    expect(migration).toContain("if v_gravados <> 121 then");
  });

  it("anos e meses dentro da regra do banco (0 a 10 anos, 0 a 11 meses)", () => {
    for (const l of linhas) {
      const [, anos, meses] = l.match(/(\d+)::smallint, (\d+)::smallint/) || [];
      expect(Number(anos)).toBeLessThanOrEqual(10);
      expect(Number(meses)).toBeLessThanOrEqual(11);
    }
  });

  it("só 79/2025 e 05/2025 são prorrogados, pelos avisos do site", () => {
    const prorrogados = linhas.filter((l) => /smallint, true\)/.test(l));
    expect(
      prorrogados.map((l) => l.match(/::uuid, '([^']+)'/)?.[1]).sort(),
    ).toEqual(["05/2025", "79/2025"]);
    expect(prorrogados.find((l) => l.includes("'05/2025'"))).toContain(
      "1::smallint, 0::smallint, true",
    );
    expect(prorrogados.find((l) => l.includes("'79/2025'"))).toContain(
      "0::smallint, 6::smallint, true",
    );
  });

  it("as erratas e retificações valem: 1 ano nos de fevereiro/2025, 12 meses na SEDE", () => {
    for (const edital of ["03/2025", "04/2025", "06/2025", "09/2025"]) {
      const linha = linhas.find((l) => l.includes(`'${edital}'`));
      expect(linha).toContain("1::smallint, 0::smallint, false");
      expect(linha).toContain("errata de 27/02/2025");
    }
    for (const edital of [
      "31/2025",
      "33/2025",
      "45/2025",
      "46/2025",
      "48/2025",
    ]) {
      const linha = linhas.find((l) => l.includes(`'${edital}'`));
      expect(linha).toContain("1::smallint, 0::smallint, false");
      expect(linha).toContain("retificação");
    }
  });

  it("não sobrescreve validade gravada e inativa as listas vencidas", () => {
    expect(migration).toContain("já têm validade gravada");
    expect(migration).toContain('private."FC_INATIVAR_LISTAS_VENCIDAS"()');
    expect(migration).toContain("if v_ativas_vencidas <> 0 then");
  });

  it("o rollback reativa só as listas que esta migration inativou", () => {
    expect(rollback).toMatch(/and l\.id not in \('[0-9a-f-]{36}'/);
    expect(rollback).toContain('set "NU_ANOS_VALIDADE" = 0');
  });

  it("o ensaio termina em rollback", () => {
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
