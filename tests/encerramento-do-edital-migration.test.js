import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Encerramento do edital (20261021180000): invariantes estáticas da
  migration. O ensaio (begin…rollback) simulou o fim do lote do 114/2026 e
  conferiu a leitura, o visto e as recusas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261021180000_encerramento_do_edital.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const funcao = (nome) => {
  const inicio = MIGRATION.indexOf(`create or replace function ${nome}(`);
  expect(inicio).toBeGreaterThan(-1);
  const fim = MIGRATION.indexOf("$function$;", inicio);
  return MIGRATION.slice(inicio, fim);
};

describe("migration 20261021180000 (encerramento do edital)", () => {
  it("transação, ensaio que termina em rollback e rollback que desfaz tudo", () => {
    expect(MIGRATION.trimStart().startsWith("/*")).toBe(true);
    expect(MIGRATION).toContain("\nbegin;\n");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).toContain(`\\ir ../migrations/${NOME}`);
    for (const objeto of [
      "public.marcar_encerramento_visto(uuid)",
      "public.obter_encerramentos_do_edital()",
      'private."FC_EDITAIS_ENCERRADOS"()',
      'public."RL_ENCERRAMENTO_EDITAL_USUARIO"',
    ])
      expect(ROLLBACK).toContain(objeto);
  });

  it("não mexe em função existente (front velho segue igual)", () => {
    const criadas = [
      ...MIGRATION.matchAll(/create or replace function ([^\s(]+)\(/g),
    ].map((m) => m[1]);
    expect(criadas).toEqual([
      'private."FC_EDITAIS_ENCERRADOS"',
      "public.obter_encerramentos_do_edital",
      "public.marcar_encerramento_visto",
    ]);
    expect(MIGRATION).not.toMatch(
      /FC_PUBLICAR_FICHA_ANALISE|alter function|drop function/i,
    );
  });

  it("encerrado = todo o lote concluído (fora do lote não conta), fora do treinamento", () => {
    const f = funcao('private."FC_EDITAIS_ENCERRADOS"');
    expect(f).toContain(`f."TP_SITUACAO" <> 'FORA_LOTE'`);
    expect(f).toContain("s.concluidas = s.no_lote");
    expect(f).toContain("s.no_lote > 0");
    expect(f).toContain(`o."TP_ORIGEM" = 'MONITORA'`);
    expect(f).toContain(`coalesce(m."ST_TREINAMENTO", 'N') <> 'S'`);
    // Quem fechou: a maior DT_CONCLUSAO das fichas concluídas.
    expect(f).toContain(`order by f."DT_CONCLUSAO" desc nulls last`);
    expect(MIGRATION).toContain(
      `revoke all on function private."FC_EDITAIS_ENCERRADOS"() from public, anon, authenticated, service_role;`,
    );
  });

  it("as RPCs: SECURITY DEFINER, search_path vazio, sessão e perfil ativo, só para authenticated", () => {
    for (const nome of [
      "public.obter_encerramentos_do_edital",
      "public.marcar_encerramento_visto",
    ]) {
      const f = funcao(nome);
      expect(f).toContain("security definer");
      expect(f).toContain("set search_path to ''");
      expect(f).toContain("v_usuario uuid := auth.uid();");
      expect(f).toContain("errcode = '42501', message = 'Sessão necessária.'");
      expect(f).toContain("p.user_id = v_usuario and p.ativo is true");
    }
    expect(MIGRATION).toContain(
      "revoke all on function public.obter_encerramentos_do_edital() from public, anon;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.marcar_encerramento_visto(uuid) to authenticated;",
    );
  });

  it("a leitura só traz a pessoa que chama: sem nome, sem ranking, sem outros usuários", () => {
    const f = funcao("public.obter_encerramentos_do_edital");
    expect(f).not.toMatch(
      /NOME_E_SOBRENOME|TB_PERFIL_USUARIO" p\s+on|rank\(|avaliadores|responsavel/i,
    );
    // Toda contagem por pessoa é de quem chama.
    for (const m of f.matchAll(/"CO_USUARIO_CONCLUSAO" = (\w+)/g))
      expect(m[1]).toBe("v_usuario");
    expect(f).toContain("where t.minhas > 0");
    expect(f).toContain(`'fechou', e."CO_USUARIO_FECHOU" = v_usuario`);
  });

  it("visto: uma vez por pessoa e edital, só edital encerrado com ficha da pessoa", () => {
    expect(MIGRATION).toContain(
      `constraint "PK_RL_ENCERRAMENTO_EDITAL_USUARIO" primary key ("CO_MONITORAMENTO", "CO_USUARIO")`,
    );
    expect(MIGRATION).toContain(
      'alter table public."RL_ENCERRAMENTO_EDITAL_USUARIO" enable row level security;',
    );
    const f = funcao("public.marcar_encerramento_visto");
    expect(f).toContain("on conflict do nothing");
    expect(f).toContain(`f."CO_USUARIO_CONCLUSAO" = v_usuario`);
    expect(f).toContain("errcode = '22023'");
  });

  it("o contrato de RPC conhece as duas", () => {
    expect(CONTRATO_RPC.obter_encerramentos_do_edital.argumentos).toEqual([]);
    expect(CONTRATO_RPC.marcar_encerramento_visto.argumentos).toEqual([
      "p_edital",
    ]);
  });
});
