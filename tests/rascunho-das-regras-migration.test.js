import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Invariantes da migration 20261013120000 (rascunho das regras guardado no
  banco, depois do incidente de 13/10 no 114/2026): tabela MAD com RLS e sem
  grant, uma linha por tipo + edital + pessoa, as mesmas travas de quem salva
  cada regra, só o próprio rascunho, contrato, ensaio e rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261013120000_rascunho_das_regras.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

function corpoDa(nome, texto = MIGRATION) {
  const inicio = texto.search(
    new RegExp(
      `create or replace function (public|private)\\.("?)${nome}\\2\\(`,
      "i",
    ),
  );
  if (inicio < 0) throw new Error(`função ${nome} não está na migration`);
  const resto = texto.slice(inicio);
  return resto.slice(0, resto.search(/\n\$function\$;\n/));
}

/* O texto entre os marcadores do corpo da migration no ensaio. */
const corpoNoEnsaio = () =>
  ENSAIO.slice(
    ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (início) ═══"),
    ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
  );

describe("a migration", () => {
  it("transação com lock_timeout e pré-requisitos", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout = '10s';");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(`'private."FC_EXIGIR_COORD_AVALIACAO"(uuid)'`);
    expect(MIGRATION).toContain(
      `'private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer)'`,
    );
  });

  it("tabela no padrão MAD: chave tipo + edital + pessoa, RLS e sem grant", () => {
    expect(MIGRATION).toContain('create table public."TB_RASCUNHO_REGRA"');
    expect(MIGRATION).toContain(
      'constraint "PK_TB_RASCUNHO_REGRA" primary key ("TP_REGRA", "CO_MONITORAMENTO", "CO_USUARIO")',
    );
    expect(MIGRATION).toContain(
      `check ("TP_REGRA" in ('ANALISE', 'CLASSIFICACAO'))`,
    );
    expect(MIGRATION).toContain(
      'alter table public."TB_RASCUNHO_REGRA" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TB_RASCUNHO_REGRA" from public, anon, authenticated;',
    );
    // Cada coluna, restrição e índice com comentário.
    for (const coluna of [
      "TP_REGRA",
      "CO_MONITORAMENTO",
      "CO_USUARIO",
      "DS_CONTEUDO",
      "NU_VERSAO_BASE",
      "DT_CRIACAO",
      "DT_ATUALIZACAO",
    ])
      expect(MIGRATION).toContain(
        `comment on column public."TB_RASCUNHO_REGRA"."${coluna}"`,
      );
    for (const nome of MIGRATION.matchAll(/constraint "([A-Z_]+)"/g))
      expect(MIGRATION).toContain(`comment on constraint "${nome[1]}"`);
  });

  it("as travas são as de quem salva cada regra", () => {
    const exigir = corpoDa("FC_EXIGIR_RASCUNHO_REGRA");
    expect(exigir).toContain(
      `if p_tipo = 'ANALISE' then
    perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);`,
    );
    expect(exigir).toContain(
      `elsif p_tipo = 'CLASSIFICACAO' then
    perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);`,
    );
    expect(exigir).toContain("errcode = '22023'");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_EXIGIR_RASCUNHO_REGRA"(text, uuid) from public, anon, authenticated;',
    );
    for (const rpc of ["salvar_rascunho_regra", "obter_rascunho_regra"])
      expect(corpoDa(rpc)).toContain(
        'private."FC_EXIGIR_RASCUNHO_REGRA"(p_tipo, p_edital)',
      );
  });

  it("cada pessoa só lê, grava e apaga o próprio rascunho", () => {
    expect(corpoDa("obter_rascunho_regra")).toContain('r."CO_USUARIO" = v_uid');
    expect(corpoDa("salvar_rascunho_regra")).toContain(
      'on conflict ("TP_REGRA", "CO_MONITORAMENTO", "CO_USUARIO")',
    );
    const descartar = corpoDa("descartar_rascunho_regra");
    expect(descartar).toContain('"CO_USUARIO" = v_uid');
    expect(descartar).toContain("if v_uid is null then");
  });

  it("RPCs só para authenticated, com SECURITY DEFINER e search_path vazio", () => {
    for (const assinatura of [
      "salvar_rascunho_regra(text, uuid, jsonb, integer)",
      "obter_rascunho_regra(text, uuid)",
      "descartar_rascunho_regra(text, uuid)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function public.${assinatura} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${assinatura} to authenticated;`,
      );
      expect(MIGRATION).toContain(`comment on function public.${assinatura}`);
    }
    for (const rpc of [
      "salvar_rascunho_regra",
      "obter_rascunho_regra",
      "descartar_rascunho_regra",
    ]) {
      expect(corpoDa(rpc)).toContain("security definer");
      expect(corpoDa(rpc)).toContain("set search_path to ''");
    }
  });

  it("o contrato de RPC tem as três, com os parâmetros da migration", () => {
    expect(CONTRATO_RPC.salvar_rascunho_regra.argumentos).toEqual([
      "p_tipo",
      "p_edital",
      "p_conteudo",
      "p_versao_base",
    ]);
    expect(CONTRATO_RPC.obter_rascunho_regra.argumentos).toEqual([
      "p_tipo",
      "p_edital",
    ]);
    expect(CONTRATO_RPC.descartar_rascunho_regra.argumentos).toEqual([
      "p_tipo",
      "p_edital",
    ]);
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio aplica o corpo da migration sem mudança e termina em rollback", () => {
    const semComentarios = (texto) =>
      texto
        .split("\n")
        .filter((l) => !/^\s*comment on /.test(l) && !/^\s+'/.test(l))
        .join("\n")
        .replace(/\n{2,}/g, "\n");
    const daMigration = MIGRATION.slice(
      MIGRATION.indexOf("set local lock_timeout"),
      MIGRATION.lastIndexOf("commit;"),
    );
    // Cada comando da migration (fora os comentários) está no ensaio.
    for (const comando of semComentarios(daMigration)
      .split(/;\n/)
      .map((c) => c.trim())
      .filter((c) => c && !c.startsWith("--")))
      expect(corpoNoEnsaio()).toContain(comando.split("\n")[0]);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).toContain("set local role authenticated;");
    expect(ENSAIO).toContain("FALHOU E5");
  });

  it("o rollback apaga as funções e a tabela", () => {
    for (const trecho of [
      "drop function if exists public.descartar_rascunho_regra(text, uuid);",
      "drop function if exists public.obter_rascunho_regra(text, uuid);",
      "drop function if exists public.salvar_rascunho_regra(text, uuid, jsonb, integer);",
      'drop function if exists private."FC_EXIGIR_RASCUNHO_REGRA"(text, uuid);',
      'drop table if exists public."TB_RASCUNHO_REGRA";',
    ])
      expect(ROLLBACK).toContain(trecho);
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });
});
