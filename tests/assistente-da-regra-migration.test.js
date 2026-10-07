import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration do assistente da regra e da dupla conferência (20261008120000;
  o ensaio begin…rollback está em supabase/ensaios/). Invariantes estáticas:
  a RPC nova só lê, é SECURITY DEFINER com search_path vazio, pede o leitor
  da Avaliação documental, não devolve respostas de candidato e está no
  contrato; conferir recusa o autor (salvo o administrador global); ensaio
  com o mesmo corpo e rollback que desfaz tudo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008120000_assistente_da_regra.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDaFuncao = (cabeca) => {
  const inicio = MIGRATION.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

describe("assistente da regra: a RPC de leitura", () => {
  const apoio = corpoDaFuncao(
    "create function public.obter_apoio_regra_analise(p_edital uuid)",
  );

  it("só lê, SECURITY DEFINER, search_path vazio e o porteiro do leitor", () => {
    expect(apoio).toContain("stable\nsecurity definer\nset search_path to ''");
    expect(apoio).toContain(
      `private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)`,
    );
    expect(apoio).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(MIGRATION).toContain(
      "revoke all on function public.obter_apoio_regra_analise(uuid) from public, anon;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_apoio_regra_analise(uuid) to authenticated, service_role;",
    );
    expect(MIGRATION).toContain(
      "comment on function public.obter_apoio_regra_analise(uuid) is",
    );
  });

  it("perguntas por vaga: só os nomes das colunas de pergunta, nenhuma resposta", () => {
    expect(apoio).toContain(`c.coluna ilike 'Pergunta %'`);
    expect(apoio).not.toContain("TB_EMPREGARE_CANDIDATO");
    expect(apoio).not.toContain("DS_COLUNA_ORIGINAL");
  });

  it("regras da área só para a coordenação e só as conferidas que a pessoa vê", () => {
    expect(apoio).toContain("'regras_da_area', case when v_coordena then");
    expect(apoio).toContain(`r."TP_SITUACAO" = 'CONFERIDA'`);
    expect(apoio).toContain(`private."FC_PODE_VER_EDITAL"(m.id)`);
  });

  it("a classificação segue a permissão dela (leitor lê, Editor grava)", () => {
    expect(apoio).toContain("private.pode_recurso('classificacao', 1)");
    expect(apoio).toContain("private.pode_recurso('classificacao', 2)");
  });

  it("está no contrato de RPC", () => {
    expect(CONTRATO_RPC.obter_apoio_regra_analise.argumentos).toEqual([
      "p_edital",
    ]);
    expect(CONTRATO_RPC.conferir_regra_analise.resumo).toContain(
      "Dupla conferência",
    );
  });
});

describe("dupla conferência", () => {
  const conferir = corpoDaFuncao(
    "create or replace function public.conferir_regra_analise(p_edital uuid, p_versao integer)",
  );

  it("o autor da versão vigente não confere, salvo o administrador global (42501 com a mensagem)", () => {
    expect(conferir).toContain(`private."FC_EXIGIR_COORD_AVALIACAO"(p_edital)`);
    expect(conferir).toContain(
      `if v_autor = (select auth.uid()) and not private.is_master() then`,
    );
    expect(conferir).toContain(
      "Dupla conferência: quem salvou a versão % não pode conferi-la.",
    );
    expect(conferir).toMatch(/using errcode = '42501'/);
  });

  it("a regra vigente diz à tela que precisa de outra pessoa", () => {
    const json = corpoDaFuncao(
      `create or replace function private."FC_REGRA_ANALISE_JSON"(p_edital uuid)`,
    );
    expect(json).toContain("'conferir_pede_outra_pessoa'");
    expect(MIGRATION).toContain(
      `revoke all on function private."FC_REGRA_ANALISE_JSON"(uuid) from public, anon, authenticated;`,
    );
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio tem o corpo idêntico ao da migration e termina em rollback", () => {
    const daMigration = corpoDaMigration(MIGRATION, "\nbegin;\n", "\ncommit;");
    const doEnsaio = corpoDaMigration(
      ENSAIO,
      "-- ═══ CORPO DA MIGRATION (início) ═══\n",
      "-- ═══ CORPO DA MIGRATION (fim) ═══",
    );
    expect(doEnsaio).toBe(daMigration);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/m);
  });

  it("o rollback apaga a RPC nova e volta conferir e a regra vigente sem a dupla conferência", () => {
    expect(ROLLBACK).toContain(
      "drop function if exists public.obter_apoio_regra_analise(uuid);",
    );
    expect(ROLLBACK).toContain(
      "create or replace function public.conferir_regra_analise(p_edital uuid, p_versao integer)",
    );
    expect(ROLLBACK).toContain(
      `create or replace function private."FC_REGRA_ANALISE_JSON"(p_edital uuid)`,
    );
    expect(ROLLBACK).not.toContain("Dupla conferência:");
    expect(ROLLBACK).not.toContain("'conferir_pede_outra_pessoa'");
  });
});
