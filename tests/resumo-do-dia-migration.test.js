import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";

/*
  Resumo do dia do responsável (20261104130000). O ensaio (begin…rollback, em
  04/11/2026, com o corpo da 20261104120000 antes) conferiu: o Gestor
  responsável pelo edital vê em Hoje a etapa que termina hoje e a demanda do
  dia, em Próximos 7 dias a demanda em 5 dias e a etapa que começa em 3, em
  Atrasadas a demanda vencida (pode_concluir) — e não vê a de 20 dias nem a
  concluída; a pessoa comum vê só a demanda dela (pode_concluir false) e
  nenhuma etapa; quem não é responsável recebe responsavel false e listas
  vazias; a preferência liga e desliga (nula: 22023); tabela fechada com RLS,
  RPCs sem anon; sem sessão, 28000; a chamada levou ~19 ms.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261104130000_resumo_do_dia_do_responsavel.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261104120000_cronograma_demandas_internas.sql",
);
const corpo = (sql) =>
  sql
    .slice(sql.indexOf("\nbegin;\n") + 8, sql.indexOf("\nnotify pgrst"))
    .trim();

describe("resumo do dia do responsável (migration)", () => {
  it("TB_PREFERENCIA_USUARIO no padrão MAD, com RLS e fechada", () => {
    expect(MIGRATION).toContain(
      'create table public."TB_PREFERENCIA_USUARIO" (',
    );
    expect(MIGRATION).toContain(
      `constraint "CK_PREFUSUARIO_STMOSTRARRESUMO" check ("ST_MOSTRAR_RESUMO_DIA" in ('S', 'N'))`,
    );
    for (const coluna of [
      "CO_PERFIL_USUARIO",
      "ST_MOSTRAR_RESUMO_DIA",
      "DT_ATUALIZACAO",
    ])
      expect(MIGRATION).toContain(
        `comment on column public."TB_PREFERENCIA_USUARIO"."${coluna}" is`,
      );
    for (const constraint of [
      "PK_TB_PREFERENCIA_USUARIO",
      "FK_PERFILUSUARIO_PREFUSUARIO",
      "CK_PREFUSUARIO_STMOSTRARRESUMO",
    ])
      expect(MIGRATION).toContain(`comment on constraint "${constraint}" on`);
    expect(MIGRATION).toContain(
      'alter table public."TB_PREFERENCIA_USUARIO" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TB_PREFERENCIA_USUARIO" from public, anon, authenticated, service_role;',
    );
  });

  it("duas RPCs SECURITY DEFINER, search_path vazio, sem anon", () => {
    for (const assinatura of [
      "public.obter_meu_resumo_do_dia(date)",
      "public.salvar_minha_preferencia_do_resumo(boolean)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to authenticated;`,
      );
      expect(ROLLBACK).toContain(`drop function if exists ${assinatura};`);
    }
    const funcoes = MIGRATION.split(/^create function /m).slice(1);
    expect(funcoes).toHaveLength(2);
    for (const funcao of funcoes)
      expect(funcao).toContain("security definer\nset search_path to ''");
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_PREFERENCIA_USUARIO";',
    );
  });

  it("hoje, 7 dias e atrasadas só de quem é responsável e ainda vê", () => {
    expect(MIGRATION).toContain("v_data + 7");
    expect(MIGRATION).toContain(
      "(now() at time zone 'America/Sao_Paulo')::date",
    );
    expect(MIGRATION).toContain('private."FC_PODE_VER_EDITAL"(m.id)');
    expect(MIGRATION).toContain(
      'private."FC_PODE_VER_DEMANDA"(d."CO_AREA", d."CO_MONITORAMENTO")',
    );
    expect(MIGRATION).toContain("c.concluida is not true");
    expect(MIGRATION).toContain(`d."ST_CONCLUIDA" = 'N'`);
    // Só leitura: a única escrita é a preferência da própria pessoa.
    expect(MIGRATION.match(/insert into public\."[A-Z_]+"/g)).toEqual([
      'insert into public."TB_PREFERENCIA_USUARIO"',
    ]);
    expect(MIGRATION).not.toMatch(/\b(update|delete from) public\."TB_/);
  });

  it("o contrato tem as RPCs", () => {
    expect(CONTRATO_RPC.obter_meu_resumo_do_dia.argumentos).toEqual(["p_data"]);
    expect(CONTRATO_RPC.salvar_minha_preferencia_do_resumo.argumentos).toEqual([
      "p_mostrar",
    ]);
  });

  it("ensaio com a 20261104120000 antes, sempre desfeito", () => {
    expect(ENSAIO).toContain(corpo(ANTERIOR));
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.indexOf(corpo(ANTERIOR))).toBeLessThan(
      ENSAIO.indexOf(corpo(MIGRATION)),
    );
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    for (const tipo of ["admin_global", "gestor", "comum", "fora"])
      expect(ENSAIO).toContain(`from t_pessoas where tipo = '${tipo}';`);
    expect(ENSAIO).not.toMatch(/generate_series/);
  });
});
