import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULOS_DOS_AVISOS } from "../src/lib/conferencias/avisos-de-conferencia.ts";

/*
  O AVISO "CRONOGRAMA ENCERRADO" NO BANCO (migration 20261118150000, aplicada em 18/11/2026)

  Pelo retrato do banco: o contexto das conferências traz o estado do cronograma pelas datas, o
  status manual e o treinamento de cada edital, e o módulo editais (recurso nucleo) é aceito em
  todas as listas. A regra está em scripts/conferencias/regras.py (tests/python/test_conferencias.py).
*/
const RETRATO = readFileSync("supabase/esquema-atual.sql", "utf8").replace(
  /\r/g,
  "",
);

function corpo(funcao: string) {
  const i = RETRATO.indexOf(`CREATE FUNCTION ${funcao}`);
  expect(i, funcao).toBeGreaterThanOrEqual(0);
  const resto = RETRATO.slice(i);
  const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
  const tag = achado?.[1];
  if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
  const ini = achado.index + achado[0].length;
  return resto.slice(ini, resto.indexOf(tag, ini));
}

const LISTA =
  "('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais')";

describe("aviso de cronograma encerrado no retrato do banco", () => {
  it("o contexto traz o cronograma pelas datas, o status manual e o treinamento", () => {
    const sql = corpo("public.conferencia_ler_contexto(");
    expect(sql).toContain('private."FC_ESTADO_DO_CRONOGRAMA"(m.id');
    expect(sql).toContain("'status_manual'");
    expect(sql).toContain("'treinamento'");
  });

  it("o módulo editais é aceito em todas as listas e lê o recurso nucleo; a tela também o conhece", () => {
    for (const f of [
      'private."FC_MARCA_DA_RPC"(',
      "public.gravar_avisos_conferencia(",
      "public.listar_avisos_conferencia(",
      "public.listar_casos_aviso_conferencia(",
    ])
      expect(corpo(f), f).toContain(LISTA);
    expect(corpo('private."FC_CONFERENCIA_RECURSO"(')).toContain(
      "when 'editais' then 'nucleo'",
    );
    expect(RETRATO).toMatch(
      /CONSTRAINT "CK_AVISOCONF_COMODULO" CHECK .*'editais'/,
    );
    expect(MODULOS_DOS_AVISOS.map((m) => m.valor)).toContain("editais");
  });
});
