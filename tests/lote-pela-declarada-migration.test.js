import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration do lote pela nota declarada e da declarada congelada (ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/). Aqui, as
  invariantes estáticas: colunas MAD com CK e comentário, a validação da base
  da nota com as mesmas mensagens do JS e do Python, a gravação que guarda a
  congelada e não a deixa mudar (sem tirar a trava do lote), o descongelar só
  da coordenação, rollback com os corpos de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007180000_lote_pela_declarada.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTES_VALIDAR = ler(
  "supabase/migrations/20261007140000_declarada_por_nivel.sql",
);
const ANTES_PRE = ler(
  "supabase/migrations/20261006110000_pre_classificacao_e_lote.sql",
);
const REGRA_JS = ler("src/lib/avaliacao-documental/regra.js");
const REGRA_PY = ler(
  "python/monitora/avaliacao_documental/pre_classificacao.py",
);

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

describe("migration: lote pela nota declarada e declarada congelada", () => {
  it("o ensaio aplica exatamente o corpo da migration", () => {
    const corpoDaMigration = MIGRATION.slice(
      MIGRATION.indexOf("begin;\n") + "begin;\n".length,
      MIGRATION.lastIndexOf("commit;"),
    ).trim();
    const corpoDoEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (início) ═══") +
        "-- ═══ CORPO DA MIGRATION (início) ═══".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    ).trim();
    expect(corpoDoEnsaio).toBe(corpoDaMigration);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });

  it("colunas novas no padrão MAD, com CK e comentário; nenhum grant em tabela", () => {
    for (const trecho of [
      'add column "VL_DECLARADA_CONGELADA" numeric(8,4)',
      'add column "DS_DECLARADA_CONGELADA" jsonb',
      'add column "DT_CONGELAMENTO_DECLARADA" timestamptz',
      'add constraint "CK_PRECLASSIF_DECLCONGELADA"',
      'comment on column public."TB_PRE_CLASSIFICACAO"."VL_DECLARADA_CONGELADA" is',
      'comment on column public."TB_PRE_CLASSIFICACAO"."DS_DECLARADA_CONGELADA" is',
      'comment on column public."TB_PRE_CLASSIFICACAO"."DT_CONGELAMENTO_DECLARADA" is',
      'alter table public."TH_PRE_CLASSIFICACAO" add column "CO_USUARIO" uuid',
      'add constraint "CK_THPRECLASSIF_ORIGEM"',
      'comment on column public."TH_PRE_CLASSIFICACAO"."CO_USUARIO" is',
    ])
      expect(MIGRATION).toContain(trecho);
    expect(MIGRATION).not.toMatch(/grant [^;]* on (table )?public\."T[BHL]_/i);
  });

  it("a validação da base da nota tem as mesmas mensagens no banco, no JS e no Python", () => {
    const validar = corpoDaFuncao(
      MIGRATION,
      'create or replace function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)',
    );
    for (const mensagem of [
      "Base da nota do lote: DECLARADA ou ART.",
      "Base da nota do lote pela declarada: configure a nota declarada.",
    ]) {
      expect(validar).toContain(mensagem);
      expect(REGRA_JS).toContain(mensagem);
      expect(REGRA_PY).toContain(mensagem);
    }
    // O resto da validação é o de 20261007140000.
    const antes = corpoDaFuncao(
      ANTES_VALIDAR,
      'create or replace function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)',
    );
    const semBase = validar.replace(
      /\n {2}-- A nota do corte e da ordem do lote[\s\S]*?\n {4}end if;\n {2}end if;/,
      "",
    );
    expect(semBase).toBe(antes);
  });

  it("a gravação guarda a congelada, não a deixa mudar e mantém as travas do lote", () => {
    const gravar = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.gravar_pre_classificacao_vaga(",
    );
    expect(gravar).toContain("a nota declarada congelada não muda");
    expect(gravar).toContain("'declarada congelada inválida'");
    expect(gravar).toContain(
      '"VL_DECLARADA_CONGELADA" = coalesce(a."VL_DECLARADA_CONGELADA", excluded."VL_DECLARADA_CONGELADA")',
    );
    expect(gravar).toContain("quem está no lote só sai eliminado (AM-5.5)");
    expect(gravar).toContain("quem já tem ficha não muda");
    expect(gravar).toContain("'completa', t.declarada_completa");
  });

  it("descongelar: só a coordenação, com motivo, no histórico; contrato de RPC igual", () => {
    const descongelar = corpoDaFuncao(
      MIGRATION,
      "create function public.descongelar_declarada_pre_classificacao(p_edital uuid, p_motivo text, p_vaga text default null)",
    );
    expect(descongelar).toContain(
      'perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);',
    );
    expect(descongelar).toContain('insert into public."TH_PRE_CLASSIFICACAO"');
    expect(descongelar).toContain("errcode = '55P03'");
    expect(MIGRATION).toContain(
      "grant execute on function public.descongelar_declarada_pre_classificacao(uuid, text, text) to authenticated;",
    );
    expect(
      CONTRATO_RPC.descongelar_declarada_pre_classificacao.argumentos,
    ).toEqual(["p_edital", "p_motivo", "p_vaga"]);
  });

  it("o rollback volta aos corpos de antes e apaga o que entrou", () => {
    for (const cabeca of [
      "returns table (\n  id uuid, situacao text",
      "'Pré-classificação (job Python): os inscritos de uma vaga do edital",
    ]) {
      expect(ROLLBACK).toContain(cabeca);
    }
    expect(
      corpoDaFuncao(
        ROLLBACK,
        'create or replace function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)',
      ),
    ).toBe(
      corpoDaFuncao(
        ANTES_VALIDAR,
        'create or replace function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)',
      ),
    );
    expect(
      corpoDaFuncao(
        ROLLBACK,
        "create or replace function public.gravar_pre_classificacao_vaga(",
      ).replace("create or replace function", "create function"),
    ).toBe(
      corpoDaFuncao(
        ANTES_PRE,
        "create function public.gravar_pre_classificacao_vaga(",
      ),
    );
    expect(ROLLBACK).toContain(
      "drop function public.descongelar_declarada_pre_classificacao(uuid, text, text);",
    );
    expect(ROLLBACK).toContain('drop column "VL_DECLARADA_CONGELADA"');
  });
});
