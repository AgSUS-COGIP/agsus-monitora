import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  20261103181500 e 20261103182000: a vaga sem quadro e a última atualização das análises saem
  do banco para o robô das conferências (Python), as pendências são lidas em páginas e o fim do
  sync das análises não depende mais da estatística do manifesto. O ensaio no banco (03/11/2026)
  conferiu as respostas iguais; aqui, as invariantes dos arquivos.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const A = "20261103181500_conferencias_e_pendencias_leves.sql";
const B = "20261103182000_sem_conferencia_ler_classificacao.sql";
const migracao = ler(`supabase/migrations/${A}`);
const remocao = ler(`supabase/migrations/${B}`);

const corpo = (sql, inicio) => {
  const i = sql.indexOf(inicio);
  expect(i, inicio).toBeGreaterThan(0);
  return sql.slice(i, sql.indexOf("$function$;", i));
};

describe(A, () => {
  it("numa transação, com a guarda das funções que troca", () => {
    expect(migracao.trim()).toMatch(/^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/);
    expect(migracao).toContain("md5(replace(p.prosrc, E'\\r', ''))");
    for (const nome of [
      "conferencia_ler_analises",
      "pendencias_ler_aprovados",
      "FC_DESATIVAR_AUSENTES_DA_PLANILHA",
    ]) {
      expect(migracao).toMatch(new RegExp(`'${nome}', '[0-9a-f]{32}'`));
    }
  });

  it("a leitura nova das listas e dos quadros é crua e só do service_role", () => {
    const f = corpo(
      migracao,
      "create or replace function public.conferencia_ler_listas_e_quadros()",
    );
    expect(f).toContain("security definer");
    expect(f).toContain("set search_path to ''");
    expect(f).toContain('public."TB_QUADRO_VAGA_EDITAL"');
    expect(f).not.toContain("FC_QUADRO_DA_VAGA");
    expect(f).not.toContain('"TB_ANALISE_CURRICULAR"');
    expect(migracao).toContain(
      "revoke all on function public.conferencia_ler_listas_e_quadros() from public, anon, authenticated;",
    );
    expect(migracao).toContain(
      "grant execute on function public.conferencia_ler_listas_e_quadros() to service_role;",
    );
  });

  it("as análises ganham a vaga e o nome sem mudar o resto", () => {
    const f = corpo(
      migracao,
      "create or replace function public.conferencia_ler_analises(",
    );
    expect(f).toContain("'vaga', nullif(btrim(p.codigo_vaga), '')");
    expect(f).toContain(
      "'nome_vaga', case when nullif(btrim(p.nome_vaga), '') is not null then p.nome_vaga end",
    );
    expect(f).toContain("least(greatest(coalesce(p_limite, 5000), 1), 10000)");
  });

  it("pendências: sem argumentos a leitura inteira; com p_limite, páginas de até 10 mil", () => {
    const f = corpo(
      migracao,
      "create or replace function public.pendencias_ler_aprovados(",
    );
    expect(f).toMatch(
      /p_apos uuid default null, p_limite integer default null/,
    );
    expect(f).toContain(
      "limit case when p_limite is not null then least(greatest(p_limite, 1), 10000) end",
    );
    expect(f).toContain("case when p_apos is null then jsonb_build_object(");
    expect(f).toContain("set work_mem to '16MB'");
    expect(migracao).toContain(
      "drop function if exists public.pendencias_ler_aprovados();",
    );
    expect(migracao).toContain(
      "grant execute on function public.pendencias_ler_aprovados(uuid, integer) to service_role;",
    );
    expect(migracao).toContain(
      "revoke all on function public.pendencias_ler_aprovados(uuid, integer) from public, anon, authenticated;",
    );
  });

  it("os ausentes do manifesto por NOT IN (sem NOT EXISTS no manifesto), linha sem chave conta", () => {
    const f = corpo(
      migracao,
      'create or replace function public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(',
    );
    expect(f).not.toMatch(
      /not exists \(select 1 from public\."TM_MANIFESTO_ANALISE"/,
    );
    expect(
      f.match(
        /a\.chave_natural is null\s+or a\.chave_natural not in \(select m\."DS_CHAVE_NATURAL"/g,
      ),
    ).toHaveLength(2);
    expect(f).toContain("greatest(25, ceil(v_ativas * 0.02)::integer)");
  });

  it("ensaio e rollback com o mesmo nome; o rollback volta as três funções e apaga a nova", () => {
    const ensaio = ler(`supabase/ensaios/${A}`);
    expect(ensaio).toContain("-- == aplicar a migration aqui ==");
    expect(ensaio).toContain("-- == PARIDADE: antes ==");
    expect(ensaio.trim().endsWith("rollback;")).toBe(true);
    const volta = ler(`supabase/rollback/${A}`);
    expect(volta).toContain(
      "drop function if exists public.conferencia_ler_listas_e_quadros();",
    );
    expect(volta).toContain(
      "drop function if exists public.pendencias_ler_aprovados(uuid, integer);",
    );
    expect(volta).toContain(
      "CREATE OR REPLACE FUNCTION public.pendencias_ler_aprovados()",
    );
    expect(volta).toContain(
      'CREATE OR REPLACE FUNCTION public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"',
    );
    expect(volta).toContain(
      "CREATE OR REPLACE FUNCTION public.conferencia_ler_analises(",
    );
  });
});

describe(B, () => {
  it("só apaga a RPC antiga, com a nova já no banco", () => {
    expect(remocao.trim()).toMatch(/^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/);
    expect(remocao).toContain(
      "to_regprocedure('public.conferencia_ler_listas_e_quadros()') is null",
    );
    expect(remocao).toContain(
      "drop function if exists public.conferencia_ler_classificacao();",
    );
    expect(remocao).not.toMatch(/drop function[^;]*FC_QUADRO_DA_VAGA/);
    expect(ler(`supabase/rollback/${B}`)).toContain(
      "CREATE OR REPLACE FUNCTION public.conferencia_ler_classificacao()",
    );
    expect(ler(`supabase/ensaios/${B}`)).toContain("-- == CONFERE A VOLTA ==");
  });

  it("o robô das conferências já não chama a RPC apagada", () => {
    const robo = ler("scripts/conferencias/conferencias.py");
    expect(robo).toContain('"conferencia_ler_listas_e_quadros"');
    expect(robo).not.toContain('"conferencia_ler_classificacao"');
  });
});
