import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Anexos do questionário: o robô lê primeiro o lote, pula quem não finalizou e não relê a resposta já lida. */
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014200000_anexos_priorizam_o_lote.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANEXOS = ler("scripts/robo-empregare/anexos_empregare.py");

describe("anexos priorizam o lote", () => {
  it("RPC só leitura, só service_role, numa transação", () => {
    expect(MIGRATION.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
    expect(MIGRATION).toContain(
      "create or replace function public.listar_prioridade_anexos_empregare(p_vaga text)",
    );
    expect(MIGRATION).toMatch(
      /stable\s+security definer\s+set search_path = ''/,
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.listar_prioridade_anexos_empregare(text) from public, anon, authenticated;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.listar_prioridade_anexos_empregare(text) to service_role;",
    );
    expect(MIGRATION).not.toMatch(
      /\b(insert|update|delete)\b\s+(into|public|from)/i,
    );
  });

  it("lote/ficha primeiro, pula quem não finalizou ou cancelou, devolve as respostas lidas", () => {
    expect(MIGRATION).toContain("p.\"TP_SITUACAO\" = 'NO_LOTE'");
    expect(MIGRATION).toContain(
      "f.\"TP_SITUACAO\" in ('PENDENTE', 'EM_ANALISE')",
    );
    expect(MIGRATION).toContain("not ('FINALIZADO' = any (k.questionarios))");
    expect(MIGRATION).toContain("k.situacao = 'CANCELADO'");
    expect(MIGRATION).toContain("in ('QUESTIONARIO', 'CANCELADO')");
    expect(MIGRATION).toContain('r."QT_PERGUNTA" > 0');
  });

  it("ensaio termina em rollback e o rollback derruba a função", () => {
    expect(ENSAIO.trim()).toMatch(/rollback;$/);
    expect(ROLLBACK).toContain(
      "drop function if exists public.listar_prioridade_anexos_empregare(text);",
    );
  });

  it("o robô usa a RPC e cai para ler todos sem a migration", () => {
    expect(ANEXOS).toContain('"listar_prioridade_anexos_empregare"');
    expect(ANEXOS).toContain("falta a migration 20261014200000");
  });
});
