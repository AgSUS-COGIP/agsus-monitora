import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  20261029210000: listar_pre_classificacao ganha p_motivo (nos eliminados) e
  devolve por_motivo, para a aba Eliminados da Triagem filtrar por motivo.
  Só leitura; o rollback volta à função de 20261029120000.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261029210000_eliminados_da_triagem_por_motivo.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261029120000_triagem_e_eliminados_em_paginas.sql",
);
const corpo = (sql) =>
  sql.slice(sql.indexOf("\nbegin;\n") + 8, sql.lastIndexOf("\ncommit;"));

describe("eliminados da Triagem por motivo (20261029210000)", () => {
  it("troca a assinatura com padrão e mantém permissão e comentário", () => {
    expect(MIGRATION).toContain(
      "drop function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer);",
    );
    expect(MIGRATION).toContain("  p_motivo text default null\n)");
    expect(MIGRATION).toContain(
      "grant execute on function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer, text) to authenticated;",
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer, text) from public, anon;",
    );
    expect(MIGRATION).toContain(
      'private."FC_EXIGIR_COORD_AVALIACAO"(p_edital)',
    );
  });

  it("o motivo recorta a lista, e as opções contam sem ele", () => {
    expect(MIGRATION).toContain(
      "where v_motivo is null or r.motivo_codigo = v_motivo",
    );
    expect(MIGRATION).toContain("select (select count(*) from filtrado),");
    expect(MIGRATION).toContain(
      "from recorte r where r.motivo_codigo is not null",
    );
    expect(MIGRATION).toContain("'por_motivo', v_por_motivo,");
  });

  it("só leitura: nada de gravar", () => {
    for (const proibido of ["insert into", "update public", "delete from"])
      expect(corpo(MIGRATION).toLowerCase()).not.toContain(proibido);
  });

  it("o ensaio roda o corpo da migration e termina em rollback", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION).trim().slice(0, 2000));
    for (const etapa of ["E1", "E2", "E3", "E4", "E5"])
      expect(ENSAIO).toContain(`FALHOU ${etapa}`);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("o rollback volta exatamente à função de 20261029120000", () => {
    const inicio = ANTERIOR.indexOf(
      "create or replace function public.listar_pre_classificacao(",
    );
    const antiga = ANTERIOR.slice(
      inicio,
      ANTERIOR.indexOf("-- ─── 3.", inicio),
    ).trim();
    expect(ROLLBACK).toContain(antiga);
    expect(ROLLBACK).toContain(
      "drop function public.listar_pre_classificacao(uuid, text, text, text, jsonb, integer, text);",
    );
  });

  it("o contrato declara p_motivo", () => {
    expect(CONTRATO_RPC.listar_pre_classificacao.argumentos).toContain(
      "p_motivo",
    );
  });
});
