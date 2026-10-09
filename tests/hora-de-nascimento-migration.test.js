import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da hora de nascimento na Classificação (não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/ e passou no banco real em
  09/10/2026). Invariantes estáticas: MAD, RLS sem acesso direto, a RPC com
  permissão e contrato, a carga igual à anterior mais a hora, ensaio com o
  mesmo corpo e rollback que volta a função anterior.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009130000_hora_de_nascimento_na_classificacao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

const corpo = (sql, inicio, fim) =>
  sql.slice(sql.indexOf(inicio), sql.indexOf(fim, sql.indexOf(inicio)));
const funcaoDados = (sql) =>
  corpo(
    sql,
    'create or replace function private."FC_DADOS_CLASSIFICACAO_EDITAL"',
    "$function$;",
  );

describe("migration 20261009130000 — hora de nascimento", () => {
  it("tabelas no padrão MAD, comentadas, com RLS e sem acesso direto", () => {
    for (const tabela of [
      "TB_HORA_NASCIMENTO_CANDIDATO",
      "TH_HORA_NASCIMENTO_CANDIDATO",
    ]) {
      const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
      expect(inicio, tabela).toBeGreaterThan(-1);
      const bloco = MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
      const colunas = [...bloco.matchAll(/^ {2}"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      for (const c of colunas) {
        expect(c).toMatch(/^(CO|HR|DT)_[A-Z_]+$/);
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${c}" is`,
        );
      }
      for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g)) {
        expect(nome).toMatch(/^(PK|FK|CK|UK)_[A-Z_]+$/);
        if (!nome.startsWith("PK_"))
          expect(MIGRATION).toContain(`comment on constraint "${nome}"`);
      }
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on table public."${tabela}" from public, anon, authenticated;`,
      );
    }
    expect(MIGRATION).toContain('"HR_NASCIMENTO" time(0) without time zone');
  });

  it("a RPC confere a permissão, a análise do edital e a hora, e está no contrato", () => {
    const rpc = corpo(
      MIGRATION,
      "create function public.salvar_hora_nascimento_candidato(",
      "$function$;",
    );
    expect(rpc).toContain("security definer");
    expect(rpc).toContain("set search_path to ''");
    expect(rpc).toContain(
      'private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2)',
    );
    expect(rpc).toContain(
      'private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)',
    );
    expect(rpc).toContain("'^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'");
    expect(rpc).toContain('insert into public."TH_HORA_NASCIMENTO_CANDIDATO"');
    expect(MIGRATION).toContain(
      "revoke all on function public.salvar_hora_nascimento_candidato(uuid, uuid, text) from public, anon;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.salvar_hora_nascimento_candidato(uuid, uuid, text) to authenticated, service_role;",
    );
    expect(CONTRATO_RPC.salvar_hora_nascimento_candidato).toMatchObject({
      argumentos: ["p_edital", "p_analise", "p_hora"],
    });
  });

  it("a carga da Classificação é a anterior mais a hora de cada candidato", () => {
    const nova = funcaoDados(MIGRATION);
    const anterior = funcaoDados(ROLLBACK);
    expect(nova).toContain(
      `'hora_nascimento', to_char(h."HR_NASCIMENTO", 'HH24:MI:SS')`,
    );
    const semHora = nova
      .replace(
        `, 'hora_nascimento', to_char(h."HR_NASCIMENTO", 'HH24:MI:SS')`,
        "",
      )
      .replace(
        `\n               left join public."TB_HORA_NASCIMENTO_CANDIDATO" h on h."CO_ANALISE_CURRICULAR" = a.id`,
        "",
      );
    expect(semHora).toBe(anterior);
    expect(anterior).not.toContain("hora_nascimento");
  });

  it("ensaio: o mesmo corpo, os quatro passos e termina em rollback", () => {
    const corpoDaMigration = corpo(
      MIGRATION,
      "-- 0. Pré-requisitos",
      "\ncommit;",
    );
    expect(ENSAIO).toContain(
      `-- ═══ CORPO DA MIGRATION (início) ═══\n${corpoDaMigration}\n\n-- ═══ CORPO DA MIGRATION (fim) ═══`,
    );
    for (const passo of ["'E1'", "'E2'", "'E3'", "'E4'"])
      expect(ENSAIO).toContain(`insert into ensaio_resultado values (${passo}`);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
  });

  it("rollback: tira a RPC e as tabelas e devolve a função anterior", () => {
    expect(ROLLBACK).toContain(
      "drop function if exists public.salvar_hora_nascimento_candidato(uuid, uuid, text);",
    );
    expect(ROLLBACK).toContain(
      'drop table if exists public."TH_HORA_NASCIMENTO_CANDIDATO";',
    );
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_HORA_NASCIMENTO_CANDIDATO";',
    );
    expect(ROLLBACK).toContain(
      'revoke all on function private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text) from public, anon, authenticated;',
    );
  });
});
