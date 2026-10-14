import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Anexos do questionário: a resposta capturada pela metade volta a ser pendente e é relida. */
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261015040000_anexos_recapturam_resposta_incompleta.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("anexos recapturam a resposta incompleta", () => {
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
      "grant execute on function public.listar_prioridade_anexos_empregare(text) to service_role;",
    );
    expect(MIGRATION).not.toMatch(
      /\b(insert|update|delete)\b\s+(into|public|from)/i,
    );
  });

  it("só conta como lida a resposta que cobre as colunas Pergunta N; o lote segue primeiro", () => {
    expect(MIGRATION).toContain("where pk.key ilike 'Pergunta%') as perguntas");
    expect(MIGRATION).toContain('having sum(r."QT_PERGUNTA") >= k.perguntas');
    expect(MIGRATION).toContain("p.\"TP_SITUACAO\" = 'NO_LOTE'");
  });

  it("ensaio termina em rollback; rollback volta à versão de 20261014200000", () => {
    expect(ENSAIO.trim()).toMatch(/rollback;$/);
    expect(ENSAIO).toContain("8044295");
    expect(ROLLBACK).toContain('r."QT_PERGUNTA" > 0');
    expect(ROLLBACK).not.toContain("having sum");
  });
});
