import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";

/*
  Migration 20261111210000 (exportação do Resumo por cargo e status):
  invariantes estáticas, sem banco. O comportamento é conferido pelo ensaio
  (SQL Editor, termina em rollback).

  - A função nova é a de 20261110190000 com só as trocas declaradas.
  - O ensaio contém o corpo da migration e termina em rollback.
  - O rollback devolve a função de 20261110190000 letra por letra.
  - O contrato declara p_conteudo.
*/

const NOME = "20261111210000_exportacao_do_resumo_por_cargo.sql";
const ler = (pasta: string, nome = NOME) =>
  readFileSync(`supabase/${pasta}/${nome}`, "utf8");
const MIGRATION = ler("migrations");
const ENSAIO = ler("ensaios");
const ROLLBACK = ler("rollback");
const ANTERIOR = ler(
  "migrations",
  "20261110190000_exportacao_da_lista_de_aprovados.sql",
);

const funcao = (sql: string) => {
  const inicio = sql.indexOf(
    "create function public.registrar_exportacao_aprovados(",
  );
  expect(inicio).toBeGreaterThan(-1);
  return sql.slice(inicio, sql.indexOf("$$;", inicio) + 3);
};
const corpo = (sql: string) =>
  sql.slice(sql.indexOf("-- 0. Guardas"), sql.lastIndexOf("commit;"));

describe("migration 20261111210000", () => {
  it("a função é a de antes com p_conteudo, a validação, a gravação e o retorno", () => {
    const antes = funcao(ANTERIOR);
    const depois = funcao(MIGRATION);
    const desfeita = depois
      .replace(",\n  p_conteudo text default 'LISTA'\n", "\n")
      .replace(
        "\n  v_conteudo text := upper(btrim(coalesce(p_conteudo, 'LISTA')));",
        "",
      )
      .replace(
        "\n  if v_conteudo not in ('LISTA', 'RESUMO') then\n    raise exception 'Conteúdo inválido: LISTA ou RESUMO.' using errcode = '22023';\n  end if;",
        "",
      )
      .replace(
        '"TP_FORMATO", "TP_CONTEUDO", "DS_FILTRO"',
        '"TP_FORMATO", "DS_FILTRO"',
      )
      .replace("v_area, v_formato, v_conteudo,", "v_area, v_formato,")
      .replace(", 'conteudo', v_conteudo);", ");");
    expect(desfeita).toBe(antes);
  });

  it("tira a assinatura antiga (sem sobrecarga ambígua) e mantém o padrão LISTA", () => {
    expect(MIGRATION).toContain(
      "drop function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer);",
    );
    expect(MIGRATION).toMatch(
      /"TP_CONTEUDO" character varying\(6\) default 'LISTA' not null/,
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer, text) from public, anon;",
    );
    expect(MIGRATION.trim().endsWith("commit;")).toBe(true);
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION).trim());
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\bcommit;/);
  });

  it("o rollback devolve a função de 20261110190000 e tira a coluna", () => {
    expect(ROLLBACK).toContain(funcao(ANTERIOR));
    expect(ROLLBACK).toContain('drop column "TP_CONTEUDO"');
    expect(ROLLBACK).toContain("agsus.rollback_descartar_conteudo");
  });

  it("o contrato declara p_conteudo", () => {
    expect(CONTRATO_RPC.registrar_exportacao_aprovados?.argumentos).toContain(
      "p_conteudo",
    );
  });
});
