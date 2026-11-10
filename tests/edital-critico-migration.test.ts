import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration do edital crítico marcado à mão (20261110150000). As travas que
  não podem se perder numa edição: só RPC (RLS ligada, sem grant direto), quem
  marca é administrador global ou gestor/coordenador que vê o edital, motivo
  obrigatório (também para desmarcar) com histórico, e nenhuma função existente
  trocada. O ensaio roda o mesmo corpo e termina em rollback.
*/
const ler = (arquivo: string) =>
  readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261110150000_edital_critico_marcado.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpo = (sql: string) =>
  sql
    .slice(sql.indexOf("create table if not exists"))
    .split("\n")
    .filter((l) => !/^(commit|rollback);$|notify pgrst/.test(l))
    .join("\n");

describe("edital crítico marcado à mão (migration)", () => {
  it("tabelas só por RPC: RLS ligada e sem grant direto", () => {
    for (const tabela of ["TB_EDITAL_CRITICO", "TH_EDITAL_CRITICO"]) {
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on table public."${tabela}" from public, anon, authenticated;`,
      );
    }
    expect(MIGRATION).not.toMatch(/create policy/i);
  });

  it("quem marca: administrador global, ou gestor/coordenador que vê o edital", () => {
    const regra = MIGRATION.slice(
      MIGRATION.indexOf('function private."FC_PODE_MARCAR_CRITICO"'),
    );
    expect(regra).toContain("if private.is_master() then return true; end if;");
    expect(regra).toContain(
      "v_perfil.perfil in ('edital_gestor', 'coordenador')",
    );
    expect(regra).toContain('private."FC_PODE_VER_EDITAL"(p_edital)');
    expect(regra).toContain("v_perfil.ativo is true");
  });

  it("marcar exige a permissão e o motivo, também para desmarcar, e grava o histórico", () => {
    const marcar = MIGRATION.slice(
      MIGRATION.indexOf("function public.marcar_edital_critico"),
    );
    expect(
      marcar.indexOf('private."FC_PODE_MARCAR_CRITICO"(p_edital)'),
    ).toBeLessThan(marcar.indexOf("insert into"));
    expect(marcar).toContain("length(v_motivo) not between 10 and 500");
    expect(marcar).toContain('private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 2)');
    expect(marcar).toMatch(/'MARCAR' else 'ALTERAR'/);
    expect(marcar).toContain("'DESMARCAR'");
  });

  it("RPCs fora do anon, para authenticated; nenhuma função existente trocada", () => {
    for (const rpc of [
      "listar_editais_criticos_manuais(text)",
      "obter_critico_do_edital(uuid)",
      "marcar_edital_critico(uuid, boolean, text)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function public.${rpc} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${rpc} to authenticated;`,
      );
    }
    const trocadas = [
      ...MIGRATION.matchAll(/create or replace function ([\w."]+)\(/g),
    ].map((m) => m[1]);
    expect(trocadas).toEqual([
      'private."FC_PODE_MARCAR_CRITICO"',
      'private."FC_NOME_DO_USUARIO"',
      "public.listar_editais_criticos_manuais",
      "public.obter_critico_do_edital",
      "public.marcar_edital_critico",
    ]);
    expect(MIGRATION).toMatch(/begin;[\s\S]*commit;\s*$/);
  });

  it("ensaio com o mesmo corpo, terminando em rollback; rollback com guarda", () => {
    expect(corpo(ENSAIO).startsWith(corpo(MIGRATION))).toBe(true);
    expect(ENSAIO).toMatch(/rollback;\s*$/);
    expect(ENSAIO).toContain("MARCAR,ALTERAR,DESMARCAR");
    expect(ROLLBACK).toMatch(
      /raise exception 'Migration 20261110150000 nao aplicada/,
    );
    expect(ROLLBACK).toContain("dado não se desfaz");
    expect(ROLLBACK).toMatch(/begin;[\s\S]*commit;\s*$/);
  });
});
