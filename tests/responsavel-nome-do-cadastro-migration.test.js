import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Invariantes da migration 20261016120000 (responsável pela análise com nome e
  sobrenome do cadastro): a regra está numa função só, o sincronismo grava por ela
  sem mexer no hash do payload, a publicação da ficha usa o nome e sobrenome do
  perfil, e os SET das funções reescritas continuam os mesmos.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261016120000_responsavel_nome_do_cadastro.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const CORRECAO = ler(
  "supabase/correcoes/20261016-responsavel-nome-do-cadastro.sql",
);

function corpoDa(texto, cabecalho) {
  const inicio = texto.indexOf(cabecalho);
  if (inicio < 0) throw new Error(`${cabecalho} não está no arquivo`);
  const resto = texto.slice(inicio);
  return resto.slice(0, resto.indexOf("\n$function$;"));
}

describe("a migration", () => {
  it("transação com lock_timeout", () => {
    expect(MIGRATION).toMatch(/\nbegin;\nset local lock_timeout/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("nome e sobrenome: IMMUTABLE, primeiro nome + último sobrenome sem partículas", () => {
    const f = corpoDa(
      MIGRATION,
      'create or replace function private."FC_NOME_E_SOBRENOME"',
    );
    expect(f).toMatch(/\nimmutable\n/);
    expect(f).toContain("set search_path = ''");
    expect(f).toContain("t.a[1]");
    expect(f).toContain("('de', 'da', 'do', 'dos', 'das', 'e')");
    expect(f).toContain("order by u.i desc");
  });

  it("normalização sem acento, caixa e espaços extras", () => {
    const f = corpoDa(
      MIGRATION,
      'create or replace function private."FC_NOME_NORMALIZADO"',
    );
    expect(f).toMatch(/\nimmutable\n/);
    expect(f).toContain("translate(lower(p_texto)");
    expect(f).toContain("'\\s+', ' ', 'g'");
  });

  it("tabela MAD de apelidos: FK do perfil e da área, ST_ATIVO e auditoria, sem acesso direto", () => {
    expect(MIGRATION).toContain('create table public."TB_APELIDO_RESPONSAVEL"');
    expect(MIGRATION).toContain('"FK_PERFILUSUARIO_APELIDORESPONSAVEL"');
    expect(MIGRATION).toContain('"FK_AREA_APELIDORESPONSAVEL"');
    expect(MIGRATION).toContain('"CK_APELIDORESPONSAVEL_STATIVO"');
    expect(MIGRATION).toContain('"UK_APELIDORESPONSAVEL_APELIDOAREA"');
    for (const coluna of [
      "DT_CRIACAO",
      "CO_USUARIO_CRIACAO",
      "DT_ATUALIZACAO",
      "CO_USUARIO_ATUALIZACAO",
    ]) {
      expect(MIGRATION).toContain(`"${coluna}"`);
    }
    expect(MIGRATION).toContain(
      'alter table public."TB_APELIDO_RESPONSAVEL" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on table public."TB_APELIDO_RESPONSAVEL" from public, anon, authenticated;',
    );
  });

  it("responsável: apelido, depois nome completo de um só perfil ativo, senão o texto original", () => {
    const f = corpoDa(
      MIGRATION,
      'create or replace function private."FC_NOME_DO_RESPONSAVEL"',
    );
    expect(f).toMatch(/security definer/);
    expect(f).toContain("set search_path = ''");
    expect(f).toContain(`ap."ST_ATIVO" = 'S'`);
    expect(f).toContain("case when count(*) = 1 then min(p.nome) end");
    expect(f).toContain("where p.ativo");
    expect(f).toContain(
      'return coalesce(private."FC_NOME_E_SOBRENOME"(v_nome), p_texto);',
    );
  });

  it("carga sem os nomes sem cadastro", () => {
    expect(MIGRATION).toContain("('Pietra', 'Pietra Mello Pires', 'projetos')");
    expect(MIGRATION).toContain(
      "('Ana Cirino', 'Ana Beatriz Jales Cirino', 'projetos')",
    );
    for (const sem of ["Suzana", "Marcia Silva", "João Victor"]) {
      expect(MIGRATION).not.toMatch(new RegExp(`\\('${sem}`));
    }
  });

  it("o sincronismo grava pela função, preserva os SET e compara pelo hash do payload", () => {
    const f = corpoDa(
      MIGRATION,
      "CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote",
    );
    expect(f).toContain(
      `private."FC_NOME_DO_RESPONSAVEL"(public.jsonb_text_or_null(s.payload,'responsavel_analise'),`,
    );
    expect(f).not.toContain(
      "public.jsonb_text_or_null(s.payload,'responsavel_analise') as responsavel_analise",
    );
    expect(f).toContain("s.hash_registro");
    expect(f).toContain("hash_registro=excluded.hash_registro");
    for (const set of [
      "SET search_path TO 'public', 'auth', 'pg_temp'",
      "SET statement_timeout TO '20s'",
      "SET lock_timeout TO '2s'",
      "SET work_mem TO '8MB'",
      "SET jit TO 'off'",
    ]) {
      expect(f).toContain(set);
    }
    expect(MIGRATION).toContain(
      "grant execute on function public.processar_sync_analises_lote(uuid, integer) to service_role;",
    );
  });

  it("a publicação da ficha grava o nome e sobrenome do perfil", () => {
    const f = corpoDa(
      MIGRATION,
      'CREATE OR REPLACE FUNCTION private."FC_PUBLICAR_FICHA_ANALISE"',
    );
    expect(f).toContain(
      'select coalesce(private."FC_NOME_E_SOBRENOME"(u.nome), u.email) into v_responsavel',
    );
    expect(f).toContain("SET search_path TO ''");
    expect(f).toContain('private."FC_NOME_VAGA_PUBLICADA"');
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_PUBLICAR_FICHA_ANALISE"(uuid) from public, anon, authenticated, service_role;',
    );
  });
});

describe("ensaio, rollback e correção", () => {
  it("o ensaio testa os exemplos do pedido", () => {
    expect(ENSAIO).toContain(
      `private."FC_NOME_E_SOBRENOME"('Ana Lilian de Matos Pereira') = 'Ana Pereira'`,
    );
    expect(ENSAIO).toContain(
      `private."FC_NOME_DO_RESPONSAVEL"('Suzana Carvalho', 'Projetos') = 'Suzana Carvalho'`,
    );
  });

  it("o rollback volta as duas funções e apaga o que é novo", () => {
    expect(ROLLBACK).not.toContain('"FC_NOME_DO_RESPONSAVEL"(public.jsonb');
    expect(ROLLBACK).toContain(
      "public.jsonb_text_or_null(s.payload,'responsavel_analise') as responsavel_analise",
    );
    expect(ROLLBACK).toContain(
      "select coalesce(nullif(btrim(u.nome), ''), u.email) into v_responsavel",
    );
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_APELIDO_RESPONSAVEL";',
    );
  });

  it("a correção vai edital por edital, só onde muda, sem tocar no hash", () => {
    const blocos = CORRECAO.match(/\nbegin;\n/g) ?? [];
    expect(blocos.length).toBe((CORRECAO.match(/\ncommit;\n/g) ?? []).length);
    expect(blocos.length).toBeGreaterThan(1);
    expect(CORRECAO).toContain(
      'is distinct from a.responsavel_analise',
    );
    expect(CORRECAO).not.toMatch(/set[^;]*hash_registro/);
    expect(CORRECAO).not.toMatch(/ultima_atualizacao\s*=/);
    expect(CORRECAO).toContain("a01afddb-f64b-47d9-80e8-476a1ed14e43");
  });
});
