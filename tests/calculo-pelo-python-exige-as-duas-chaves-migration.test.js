import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration que faz o cálculo da classificação pelo Python exigir as duas
  chaves (20261024110000), ainda não aplicada: o ensaio begin…rollback está em
  supabase/ensaios/. Aqui, as invariantes estáticas: FC_CALCULO_PELO_PYTHON
  passa a exigir "classificacao" e "classificacao_calculo" com 'S', sem mudar
  a assinatura, a segurança nem os privilégios; nenhuma chave muda de estado;
  o ensaio prova as quatro combinações e o caso que travava; o rollback volta
  ao corpo de 20261023200000.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261024110000_calculo_pelo_python_exige_as_duas_chaves.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ETAPA_2B = ler(
  "supabase/migrations/20261023200000_classificacao_em_python_etapa_2b.sql",
);

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** A função FC_CALCULO_PELO_PYTHON do arquivo (create ou create or replace) até o fim do corpo. */
function funcao(sql) {
  const m =
    /create (or replace )?function private\."FC_CALCULO_PELO_PYTHON"\(\)/.exec(
      sql,
    );
  expect(m).not.toBeNull();
  const fim = sql.indexOf(
    "$function$;",
    sql.indexOf("$function$", m.index) + 1,
  );
  return sql
    .slice(m.index, fim)
    .replace("create function", "create or replace function");
}

describe("cálculo pelo Python exige as duas chaves (20261024110000)", () => {
  it("é uma transação, com pré-requisito, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261023200000",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
  });

  it("exige as duas chaves ligadas, com a linha na tabela", () => {
    const f = funcao(MIGRATION);
    expect(f).toContain("returns boolean");
    expect(f).toContain("stable");
    expect(f).toContain("security definer");
    expect(f).toContain("set search_path to ''");
    expect(f).toContain(
      `select count(*) = 2 from public."TB_CHAVE_AUTOMACAO" c
   where c."CO_CHAVE" in ('classificacao', 'classificacao_calculo') and c."ST_LIGADA" = 'S';`,
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_CALCULO_PELO_PYTHON"() from public, anon, authenticated, service_role;',
    );
  });

  it("não liga nem desliga chave nenhuma e não mexe nas RPCs que usam a função", () => {
    const c = corpo(MIGRATION);
    expect(c).not.toMatch(
      /(insert into|update|delete from) public\."T[BH]_CHAVE_AUTOMACAO"/,
    );
    expect(c).not.toContain("pedir_calculo_classificacao(");
    expect(c).not.toContain("registrar_lista_classificacao(");
  });

  it("o ensaio prova as quatro combinações e o caso que travava", () => {
    expect(ENSAIO).toContain(
      "foreach v_classificacao in array array['S', 'N']",
    );
    expect(ENSAIO).toContain("foreach v_calculo in array array['S', 'N']");
    expect(ENSAIO).toContain("public.pedir_calculo_classificacao(v_edital");
    expect(ENSAIO).toContain("public.registrar_lista_classificacao(v_edital");
    expect(ENSAIO).toContain("'pedidos_http_novos'");
    // Segredo falso: nenhum pedido do ensaio usa o segredo real do disparo.
    expect(ENSAIO).toContain(
      "select vault.create_secret('token-falso-do-ensaio'",
    );
  });

  it("o rollback volta ao corpo de 20261023200000", () => {
    expect(funcao(ROLLBACK)).toBe(funcao(ETAPA_2B));
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });
});
