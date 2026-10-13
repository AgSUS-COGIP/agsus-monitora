import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONFERENCIAS,
  motivoDoCaso,
} from "../src/lib/avisos-de-conferencia.ts";

/*
  Migration 20261013180200: a leitura das fichas concluídas para o job das
  conferências refazer a conta (scripts/conferencias/regras.py,
  conferir_fichas). Ensaio (begin…rollback) em supabase/ensaios/.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261013180200_conferencia_da_conta_das_fichas.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const JOB = ler("scripts/conferencias/conferencias.py");
const REGRAS = ler("scripts/conferencias/regras.py");

describe("conferência da conta das fichas", () => {
  it("RPC só de leitura, só service_role, em páginas", () => {
    expect(MIGRATION).toMatch(
      /create function public\.conferencia_ler_fichas\(p_apos uuid default null, p_limite integer default 500\)/,
    );
    expect(MIGRATION).toMatch(/\bstable\b/);
    expect(MIGRATION).toContain(
      "revoke all on function public.conferencia_ler_fichas(uuid, integer) from public, anon, authenticated;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.conferencia_ler_fichas(uuid, integer) to service_role;",
    );
    expect(MIGRATION).toContain(
      "least(greatest(coalesce(p_limite, 500), 1), 1000)",
    );
    expect(MIGRATION).toContain(
      "'proximo', case when v_qt = v_limite then v_ultimo end",
    );
  });

  it("só fichas concluídas fora do treinamento, com a regra da versão usada", () => {
    expect(MIGRATION).toContain(`f."TP_SITUACAO" = 'CONCLUIDA'`);
    expect(MIGRATION).toContain(
      'not private."FC_EDITAL_EH_TREINAMENTO"(f."CO_MONITORAMENTO")',
    );
    expect(MIGRATION).toContain('f."NU_VERSAO_REGRA" as versao');
    expect(MIGRATION).toMatch(
      /from public\."TH_REGRA_ANALISE" h\s+where \(h\."CO_REGRA_ANALISE", h\."NU_VERSAO"\) in/,
    );
    expect(MIGRATION).not.toMatch(/NO_CANDIDATO|NU_CPF|DS_EMAIL/);
  });

  it("o job lê as fichas no módulo Análises e avisa com o código do catálogo", () => {
    expect(JOB).toContain('chamar("conferencia_ler_fichas"');
    expect(JOB).toContain(
      "regras.conferir_fichas(paginas_de_fichas(chamar), acumulador)",
    );
    expect(REGRAS).toContain(
      "from monitora.avaliacao_documental.pontuacao import conferir_ficha",
    );
    expect(REGRAS).toContain('"ANALISE_FICHA_CONTA_DIVERGENTE"');
    expect(CONFERENCIAS.ANALISE_FICHA_CONTA_DIVERGENTE).toEqual({
      modulo: "analises",
      gravidade: "CRITICA",
      titulo: "Ficha concluída com a conta diferente da regra",
    });
    expect(
      motivoDoCaso("ANALISE_FICHA_CONTA_DIVERGENTE", { campos: "nota_final" }),
    ).toBe("Diferente na conta: nota_final");
  });

  it("ensaio altera uma conta e rollback tira a RPC", () => {
    expect(ENSAIO).toContain("public.conferencia_ler_fichas(null, 500)");
    expect(ENSAIO).toContain("treinamento_fora");
    expect(ROLLBACK).toContain(
      "drop function if exists public.conferencia_ler_fichas(uuid, integer);",
    );
  });
});
