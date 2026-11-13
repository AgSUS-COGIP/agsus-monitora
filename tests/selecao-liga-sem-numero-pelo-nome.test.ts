import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  A SELEÇÃO LIGA PELO NOME O EDITAL SEM NÚMERO (pedido de 13/11/2026)

  FGV (SEDE) e FCC (Projetos) estavam com 0 inscritos: as 18 linhas deles na
  planilha da Seleção ("FGV 2025" e "FCC") nunca se ligavam, porque a ligação
  só usava o número do edital. Fora da Saúde Indígena, sem número dos dois
  lados, a migration 20261113180000 liga pelo nome inteiro igual; o edital da
  FGV passa a "FGV 2025"; e edital novo nasce sem número de inscritos.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261113180000_ligar_selecao_sem_numero_pelo_nome";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");
const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

function corpo(sql: string): string {
  const inicio = sql.indexOf(
    'create or replace function private."FC_LIGAR_SELECAO_AOS_EDITAIS"()',
  );
  expect(inicio).toBeGreaterThan(-1);
  const abre = sql.indexOf("as $function$", inicio) + "as $function$".length;
  return sql.slice(abre, sql.indexOf("$function$;", abre));
}

describe("migration 20261113180000", () => {
  const migration = ler(`supabase/migrations/${NOME}.sql`);
  const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
  const rollback = ler(`supabase/rollback/${NOME}.sql`);
  const anterior = ler(
    "supabase/migrations/20261113120000_ligar_selecao_so_ao_edital_da_mesma_unidade.sql",
  );
  const novo = corpo(migration);
  const antes = corpo(rollback);

  it("o rollback volta exatamente ao corpo da migration anterior", () => {
    expect(antes).toBe(corpo(anterior));
  });

  it("sem número dos dois lados, liga pelo nome; DSEI/CASAI seguem exigindo número e unidade", () => {
    expect(novo).toContain(
      "or (c.numero is null and m.numero is null and c.nome <> '' and m.nome = c.nome)",
    );
    expect(novo).toContain("m.unidade_sem_hifen = c.unidade_sem_hifen");
    expect(novo).not.toContain(
      'where private."FC_NUMERO_EDITAL"(m.edital) is not null',
    );
  });

  it("as guardas usam o md5 do corpo de antes e do de depois, sem CR", () => {
    expect(migration).toContain(`is distinct from '${md5(antes)}'`);
    expect(migration).toContain(`if v_md5 = '${md5(novo)}'`);
    expect(rollback).toContain(`is distinct from '${md5(novo)}'`);
    for (const sql of [migration, ensaio, rollback])
      expect(sql).toContain("chr(13), ''))");
  });

  it("renomeia só o edital da FGV, tira o padrão 0 e confere os números", () => {
    expect(migration).toContain(
      "set edital = 'FGV 2025'\n where id = '65f6f52a-615d-4072-a784-fca9e0f34454' and edital = 'FGV';",
    );
    expect(migration).toContain("alter column inscritos set default null;");
    expect(migration).toContain("v_fgv is distinct from 13275");
    expect(migration).toContain("v_fcc is distinct from 5120");
    expect(rollback).toContain("alter column inscritos set default 0;");
  });

  it("o retrato mostra o corpo aplicado e inscritos sem padrão 0", () => {
    const retrato = ler("supabase/esquema-atual.sql");
    const cria = retrato.indexOf(
      'CREATE FUNCTION private."FC_LIGAR_SELECAO_AOS_EDITAIS"()',
    );
    const abre = retrato.indexOf("AS $_$", cria) + "AS $_$".length;
    expect(retrato.slice(abre, retrato.indexOf("$_$;", abre))).toBe(novo);
    const tabela = retrato.indexOf(
      'CREATE TABLE public."TB_MONITORAMENTO_INDIGENA" (',
    );
    const colunas = retrato.slice(tabela, retrato.indexOf(");", tabela));
    expect(colunas).toContain("    inscritos integer,");
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    expect(corpo(ensaio)).toBe(novo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
