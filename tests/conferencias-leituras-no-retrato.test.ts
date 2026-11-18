import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  AS LEITURAS DAS CONFERÊNCIAS NO BANCO (migration 20261117193000, aplicada em 18/11/2026)

  O job scripts/conferencias/ depende de três campos que essas leituras passaram a trazer; as regras
  que os usam estão em scripts/conferencias/regras.py (tests/python/test_conferencias.py). Aqui, o
  retrato do banco (supabase/esquema-atual.sql) confere que o corpo vigente de cada leitura os traz.
*/
const RETRATO = readFileSync("supabase/esquema-atual.sql", "utf8").replace(
  /\r/g,
  "",
);

function corpo(funcao: string) {
  const i = RETRATO.indexOf(`CREATE FUNCTION public.${funcao}`);
  expect(i, funcao).toBeGreaterThanOrEqual(0);
  const resto = RETRATO.slice(i);
  const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
  const tag = achado?.[1];
  if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
  const ini = achado.index + achado[0].length;
  return resto.slice(ini, resto.indexOf(tag, ini));
}

describe("leituras das conferências no retrato do banco", () => {
  it("inscrição só da candidatura no mesmo edital ou na vaga da análise", () => {
    const sql = corpo("conferencia_ler_analises(");
    expect(sql).toContain(`v."CO_MONITORAMENTO" = e.edital_id`);
    expect(sql).toContain(`c."CO_VAGA" = nullif(btrim(p.codigo_vaga), '')`);
  });

  it("aprovados com a admissão conciliada, só de lista ativa", () => {
    const sql = corpo("conferencia_ler_aprovados(");
    expect(sql).toContain(`public."TB_ADMISSAO_CONCILIADA"`);
    expect(sql).toContain(
      `'admitido', c.admissao is not null, 'admissao', c.admissao`,
    );
    expect(sql).toContain("coalesce(l.ativo, true)");
  });

  it("listas com a versão da regra", () => {
    expect(corpo("conferencia_ler_listas_e_quadros(")).toContain(
      `'versao_regra', u."NU_VERSAO_REGRA"`,
    );
  });
});
