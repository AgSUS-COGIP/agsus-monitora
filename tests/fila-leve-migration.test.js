import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Invariantes da migration 20261014180000 (a fila carrega só o lote):
  obter_fila_avaliacao manda o núcleo e as contagens de fora do lote; os de fora
  vêm em páginas por obter_fila_fora_do_lote; a permissão do analista é avaliada
  por vaga (por inscrito passava dos 8 s do authenticated no 114/2026).
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014180000_fila_leve.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const funcao = (texto, nome) => {
  const inicio = texto.indexOf(`create or replace function ${nome}(`);
  expect(inicio).toBeGreaterThanOrEqual(0);
  const corpo = texto.slice(inicio);
  return corpo.slice(0, corpo.indexOf("$function$;") + 11);
};

describe("a migration da fila leve", () => {
  it("transação com lock_timeout, sem drop nem CR", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout = '10s';");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).not.toMatch(/drop function/i);
    expect(MIGRATION).not.toMatch(/\r/);
  });

  it("uma regra só para a partição, usada nas linhas e nas contagens", () => {
    expect(funcao(MIGRATION, 'private."FC_NO_NUCLEO_DA_FILA"')).toContain(
      "immutable",
    );
    expect(funcao(MIGRATION, 'private."FC_LINHAS_DA_FILA"')).toContain(
      'private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO") = p_nucleo',
    );
    expect(funcao(MIGRATION, "public.obter_fila_avaliacao")).toContain(
      'and not private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO")',
    );
  });

  it("a fila manda o núcleo e fora_do_lote; o analista por vaga, não por inscrito", () => {
    const fila = funcao(MIGRATION, "public.obter_fila_avaliacao");
    expect(fila).toContain("'schema_version', 2");
    expect(fila).toContain("'fora_do_lote'");
    expect(fila).toContain(
      'private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, true, null, null)',
    );
    expect(fila).toContain('private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)');
    expect(fila).toContain('private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid)');
    // a permissão por inscrito saiu (fica só a de "pode_pegar", sem vaga)
    expect(fila.match(/FC_PODE_ANALISAR_VAGA/g)).toHaveLength(1);
    expect(funcao(MIGRATION, 'private."FC_VAGAS_DO_ANALISTA"')).toContain(
      "as materialized",
    );
  });

  it("os de fora do lote em páginas limitadas, com a mesma permissão", () => {
    const fora = funcao(MIGRATION, "public.obter_fila_fora_do_lote");
    expect(fora).toContain('private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)');
    expect(fora).toContain(
      "least(greatest(coalesce(p_limite, 1000), 1), 2000)",
    );
    expect(fora).toContain(
      'private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, false, p_apos, v_limite)',
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_fila_fora_do_lote(uuid, uuid, integer) to authenticated;",
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer) from public, anon, authenticated;',
    );
  });

  it("contrato da RPC nova, ensaio e rollback", () => {
    expect(CONTRATO_RPC.obter_fila_fora_do_lote.argumentos).toEqual([
      "p_edital",
      "p_apos",
      "p_limite",
    ]);
    expect(ENSAIO).toContain("-- FIM DO ANTES");
    expect(ENSAIO).toMatch(/ENSAIO 1: .* linha\(s\) diferem/);
    expect(ROLLBACK).toContain(
      "drop function if exists public.obter_fila_fora_do_lote(uuid, uuid, integer);",
    );
    expect(ROLLBACK).toContain(
      'not v_so_minhas_vagas or private."FC_PODE_ANALISAR_VAGA"(p_edital, v_uid, a."CO_VAGA")',
    );
  });
});
