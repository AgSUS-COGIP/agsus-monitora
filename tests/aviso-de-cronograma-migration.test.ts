import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULOS_DOS_AVISOS } from "../src/lib/conferencias/avisos-de-conferencia.ts";

/*
  A MIGRATION DO AVISO "CRONOGRAMA ENCERRADO" (20261118150000), enquanto pendente

  O contexto das conferências traz o estado do cronograma pelas datas e o módulo editais (recurso
  nucleo) passa a ser aceito. Depende da central de avisos (20261118120000): gravar, listar e
  listar_casos partem dos corpos dela; o contexto, FC_CONFERENCIA_RECURSO e FC_MARCA_DA_RPC, do
  retrato. A regra está em scripts/conferencias/regras.py (tests/python/test_conferencias.py).
  Aplicada a migration (e regerado o retrato), este teste sai junto com ela.
*/
const NOME = "20261118150000_aviso_de_cronograma_encerrado.sql";
const CENTRAL = "20261118120000_central_de_avisos_das_conferencias.sql";
const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r/g, "");
const RETRATO = ler("supabase/esquema-atual.sql");
const DA_CENTRAL = ler(`supabase/migrations/${CENTRAL}`);
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

function corpo(texto: string, funcao: string, inicio: string) {
  const i = texto.indexOf(`${inicio} ${funcao}`);
  expect(i, `${inicio} ${funcao}`).toBeGreaterThanOrEqual(0);
  const resto = texto.slice(i);
  const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
  const tag = achado?.[1];
  if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
  const ini = achado.index + achado[0].length;
  const fim = resto.indexOf(tag, ini);
  return {
    inteira: resto.slice(0, fim + tag.length),
    corpo: resto.slice(ini, fim),
  };
}

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");
const DO_RETRATO = [
  "public.conferencia_ler_contexto(",
  'private."FC_CONFERENCIA_RECURSO"(',
  'private."FC_MARCA_DA_RPC"(',
];
const DA_CENTRAL_FUNCOES = [
  "public.gravar_avisos_conferencia(",
  "public.listar_avisos_conferencia(",
  "public.listar_casos_aviso_conferencia(",
];
const NOVA = "CREATE OR REPLACE FUNCTION";

describe("migration do aviso de cronograma encerrado", () => {
  it("a guarda parte do retrato e da central; exige a central aplicada", () => {
    for (const f of DO_RETRATO)
      expect(MIGRATION, f).toContain(
        `is distinct from '${md5(corpo(RETRATO, f, "CREATE FUNCTION").corpo)}'`,
      );
    for (const f of DA_CENTRAL_FUNCOES)
      expect(MIGRATION, f).toContain(
        `is distinct from '${md5(corpo(DA_CENTRAL, f, NOVA).corpo)}'`,
      );
    expect(MIGRATION).toContain(
      `to_regclass('public."TH_AVISO_CONFERENCIA"') is null`,
    );
  });

  it("o módulo editais em todas as listas e no recurso nucleo; a tela também o conhece", () => {
    const lista =
      "('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais')";
    for (const f of ['private."FC_MARCA_DA_RPC"(', ...DA_CENTRAL_FUNCOES])
      expect(corpo(MIGRATION, f, NOVA).corpo, f).toContain(lista);
    expect(MIGRATION).toContain(`check ("CO_MODULO" in ${lista})`);
    expect(
      corpo(MIGRATION, 'private."FC_CONFERENCIA_RECURSO"(', NOVA).corpo,
    ).toContain("when 'editais' then 'nucleo'");
    expect(MODULOS_DOS_AVISOS.map((m) => m.valor)).toContain("editais");
  });

  it("o contexto traz o cronograma pelas datas, o status manual e o treinamento; não muda o status", () => {
    const { corpo: sql } = corpo(
      MIGRATION,
      "public.conferencia_ler_contexto(",
      NOVA,
    );
    expect(sql).toContain('private."FC_ESTADO_DO_CRONOGRAMA"(m.id');
    expect(sql).toContain("'status_manual'");
    expect(sql).toContain("'treinamento'");
    expect(MIGRATION).not.toMatch(
      /update public\."TB_MONITORAMENTO_INDIGENA"/i,
    );
  });

  it("o rollback devolve os corpos de antes, letra por letra", () => {
    for (const f of DO_RETRATO)
      expect(ROLLBACK, f).toContain(
        corpo(RETRATO, f, "CREATE FUNCTION").inteira.replace(
          "CREATE FUNCTION",
          NOVA,
        ),
      );
    for (const f of DA_CENTRAL_FUNCOES)
      expect(ROLLBACK, f).toContain(corpo(DA_CENTRAL, f, NOVA).inteira);
    const ck = /CONSTRAINT "CK_AVISOCONF_COMODULO" (CHECK \(.*\)),?\n/.exec(
      RETRATO,
    )?.[1];
    expect(ROLLBACK).toContain(`add constraint "CK_AVISOCONF_COMODULO" ${ck}`);
  });

  it("o ensaio aplica a central se faltar e termina em rollback", () => {
    expect(ENSAIO).toContain("\\if :aplicar_a_central");
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });
});
