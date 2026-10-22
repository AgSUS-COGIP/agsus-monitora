import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeAllowedDomains } from "../src/lib/platform-context.js";

/*
  Migration 20261021170000 (ainda não aplicada; ensaio begin…rollback em
  supabase/ensaios/): cadastro só do domínio institucional, pelo hook Before
  User Created do Supabase Auth, e leitura de TB_PLANILHA_ANALISE só para quem
  vê configurações. Invariantes estáticas: o hook lê a mesma chave e usa o
  mesmo padrão do front, nunca libera tudo, devolve o formato do Supabase,
  roda como supabase_auth_admin (sem SECURITY DEFINER, sem EXECUTE para anon
  e authenticated, leitura de TB_CONFIGURACAO só da linha da lista), a policy
  das planilhas deixa de ser using (true), o ensaio leva o mesmo corpo e
  termina em rollback e o rollback desfaz tudo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261021170000_cadastro_so_do_dominio.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const HOOK = 'public."FC_HOOK_ANTES_CRIAR_USUARIO"';

/** O corpo de `function <nome>(` até o `$function$;` de fechamento. */
const funcao = (sql, nome) => {
  const ini = sql.toLowerCase().indexOf(`function ${nome.toLowerCase()}(`);
  if (ini < 0) return "";
  const fim = sql.indexOf("$function$;", sql.indexOf("$function$", ini) + 10);
  return sql.slice(ini, fim);
};
const corpo = (sql) =>
  sql.slice(sql.indexOf("\nbegin;\n") + 8, sql.lastIndexOf("\ncommit;"));

describe("cadastro só do domínio institucional (migration)", () => {
  it("transação única, sem \\r, sem apagar nada", () => {
    expect(MIGRATION).not.toContain("\r");
    expect(MIGRATION).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(MIGRATION).not.toMatch(
      /drop table|drop column|drop function|truncate|delete from|update public\./i,
    );
  });

  it("o nome do hook cabe no limite e segue o padrão MAD", () => {
    expect("FC_HOOK_ANTES_CRIAR_USUARIO".length).toBeLessThanOrEqual(30);
    expect(MIGRATION).toContain(
      `create or replace function ${HOOK}(event jsonb)\nreturns jsonb`,
    );
    expect(MIGRATION).toContain(`comment on function ${HOOK}(jsonb) is`);
  });

  it("lê o e-mail do evento e a chave do front, com o mesmo padrão", () => {
    const f = funcao(MIGRATION, HOOK);
    expect(f).toContain("event -> 'user' ->> 'email'");
    expect(f).toContain("lower(btrim(");
    expect(f).toContain('from public."TB_CONFIGURACAO" c');
    expect(f).toContain("c.chave = 'auth_google_allowed_domains'");
    expect(ler("src/app/sessao.js")).toContain(
      'normalizeAllowedDomains(lido("auth_google_allowed_domains"))',
    );
    const padrao = f.match(/v_dominios := array\[([^\]]+)\]/)[1];
    expect([...padrao.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(
      normalizeAllowedDomains(""),
    );
    // Vazio cai no padrão — nunca numa lista vazia que liberaria tudo.
    expect(f).toContain("if coalesce(cardinality(v_dominios), 0) = 0 then");
    expect(f).toContain("ltrim(lower(btrim(p.parte)), '@')");
  });

  it("domínio depois do último @; só permite se estiver na lista", () => {
    const f = funcao(MIGRATION, HOOK);
    expect(f).toContain("substring(v_email from '@([^@]+)$')");
    expect(f).toContain(
      "if v_dominio is not null and v_dominio = any (v_dominios) then\n    return '{}'::jsonb;",
    );
    expect(f.match(/return '\{\}'::jsonb;/g)).toHaveLength(1);
  });

  it("recusa no formato do Supabase: error com http_code 403 e mensagem da lista", () => {
    const f = funcao(MIGRATION, HOOK);
    expect(f).toMatch(
      /jsonb_build_object\(\s*'error', jsonb_build_object\(\s*'http_code', 403,\s*'message', 'Use uma conta institucional \(' \|\| v_lista \|\| '\)\.'/,
    );
  });

  it("roda como supabase_auth_admin, como a documentação de hooks recomenda", () => {
    const f = funcao(MIGRATION, HOOK);
    expect(f).not.toMatch(/security definer/i);
    expect(f).toContain("set search_path = ''");
    expect(MIGRATION).toContain(
      "grant usage on schema public to supabase_auth_admin;",
    );
    expect(MIGRATION).toContain(
      `revoke execute on function ${HOOK}(jsonb) from public, anon, authenticated;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${HOOK}(jsonb) to supabase_auth_admin;`,
    );
    expect(MIGRATION).toContain(
      'grant select on table public."TB_CONFIGURACAO" to supabase_auth_admin;',
    );
    expect(MIGRATION).toMatch(
      /create policy "PL_CONFIGURACAO_LEITURA_HOOK_AUTH" on public\."TB_CONFIGURACAO"\n\s+for select to supabase_auth_admin\n\s+using \(chave = 'auth_google_allowed_domains'\);/,
    );
    expect(MIGRATION).toContain(
      'comment on policy "PL_CONFIGURACAO_LEITURA_HOOK_AUTH"',
    );
  });

  it("TB_PLANILHA_ANALISE deixa de abrir para todo authenticated", () => {
    expect(MIGRATION).toContain(
      `alter policy "PL_PLANILHA_ANALISE_LEITURA" on public."TB_PLANILHA_ANALISE"\n  using ((select private.pode_recurso('configuracoes', 1)));`,
    );
    expect(MIGRATION).not.toMatch(
      /PL_PLANILHA_ANALISE_LEITURA[^;]*using \(true\)/,
    );
  });

  it("o ensaio leva o mesmo corpo, testa os casos pedidos e termina em rollback", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("select 'ensaio ok' as resultado;");
    for (const caso of [
      "@agenciasus.org.br",
      "@agsus.org.br",
      "alguem@gmail.com",
      "AgenciaSUS.Org.BR",
      '{"user":{"phone":"5561999999999"}}',
      "set valor = '  '",
      "delete from public.\"TB_CONFIGURACAO\" where chave = 'auth_google_allowed_domains'",
      'from public."TB_PLANILHA_ANALISE"',
    ])
      expect(ENSAIO, caso).toContain(caso);
  });

  it("o rollback desfaz tudo e avisa para desligar o hook antes", () => {
    expect(ROLLBACK).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(ROLLBACK).toContain("DESLIGUE o hook");
    expect(ROLLBACK).toContain(`drop function if exists ${HOOK}(jsonb);`);
    expect(ROLLBACK).toContain(
      'drop policy if exists "PL_CONFIGURACAO_LEITURA_HOOK_AUTH" on public."TB_CONFIGURACAO";',
    );
    expect(ROLLBACK).toContain(
      'revoke select on table public."TB_CONFIGURACAO" from supabase_auth_admin;',
    );
    expect(ROLLBACK).toMatch(
      /alter policy "PL_PLANILHA_ANALISE_LEITURA" on public\."TB_PLANILHA_ANALISE"\n\s+using \(true\);/,
    );
  });
});
