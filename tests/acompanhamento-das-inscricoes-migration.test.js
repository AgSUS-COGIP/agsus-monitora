import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261009140000 (acompanhamento das inscrições: retrato diário,
  RPCs, vagas ligadas no robô da Empregare e a agenda do 114/2026; o ensaio
  begin…rollback está em supabase/ensaios/). Invariantes estáticas: tabela MAD
  sem acesso direto, quem chama cada função, o corpo do ensaio igual ao da
  migration, a tarefa do pg_cron que desliga sozinha e o rollback que desfaz
  tudo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009140000_acompanhamento_das_inscricoes.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const corpo = (texto) =>
  texto.slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"));

describe("migration do acompanhamento das inscrições", () => {
  it("a tabela é MAD, com RLS e sem acesso direto", () => {
    expect(MIGRATION).toContain(
      'create table public."TH_INSCRICAO_VAGA_EDITAL"',
    );
    expect(MIGRATION).toContain(
      'constraint "PK_TH_INSCRICAO_VAGA_EDITAL" primary key ("CO_MONITORAMENTO", "CO_VAGA", "DT_RETRATO")',
    );
    expect(MIGRATION).toContain(
      'alter table public."TH_INSCRICAO_VAGA_EDITAL" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TH_INSCRICAO_VAGA_EDITAL" from public, anon, authenticated, service_role;',
    );
    // Só contagens: nenhuma coluna de pessoa.
    expect(MIGRATION).not.toMatch(
      /"(NO_CANDIDATO|NU_CPF|DS_EMAIL|CO_EMPREGARE_CANDIDATO)"[^\n]*(integer|varying|uuid)/,
    );
  });

  it("quem chama cada função", () => {
    expect(MIGRATION).toContain(
      "revoke all on function public.gravar_retrato_inscricoes(text, uuid, jsonb) from public, anon, authenticated;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.gravar_retrato_inscricoes(text, uuid, jsonb) to service_role;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_acompanhamento_inscricoes(uuid) to authenticated;",
    );
    expect(MIGRATION).toContain(
      'private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
    );
    expect(MIGRATION).toContain(
      'private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao)',
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_AGENDA_DAS_INSCRICOES"(text, text, date) from public, anon, authenticated, service_role;',
    );
  });

  it("o robô acha as vagas ligadas ao edital (origem ligada) sem duplicar", () => {
    expect(MIGRATION).toContain("'ligada'::text as origem");
    expect(MIGRATION).toMatch(
      /where not exists \(select 1 from quadro q where q\.vaga = l\.vaga\)\s+and not exists \(select 1 from selecao s where s\.vaga = l\.vaga\)/,
    );
    const robo = ler("scripts/robo-empregare/robo_empregare.py");
    expect(robo).toContain('("ligada", "ligadas ao edital")');
  });

  it("a agenda do 114/2026: 7h e 13h de Brasília até 15/10 e desliga sozinha", () => {
    expect(MIGRATION).toContain(
      "c_tarefa constant text := 'agsus_robo_inscricoes_114_2026';",
    );
    expect(MIGRATION).toContain("c_agenda constant text := '0 10,16 * * *';");
    expect(MIGRATION).toContain(
      `'select private."FC_AGENDA_DAS_INSCRICOES"(''agsus_robo_inscricoes_114_2026'', ''114/2026'', date ''2026-10-15'');'`,
    );
    expect(MIGRATION).toContain("perform cron.unschedule(p_tarefa);");
    expect(MIGRATION).toContain(
      "private.\"FC_DISPARAR_ROBO\"('robo-empregare.yml',",
    );
    expect(MIGRATION).toContain("'America/Sao_Paulo'");
    const doc = ler("docs/agenda-dos-robos.md");
    expect(doc).toContain("agsus_robo_inscricoes_114_2026");
    expect(ler("src/lib/saude-das-cargas.ts")).toContain(
      "agsus_robo_inscricoes_114_2026",
    );
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("github_disparo_robos_ausente_no_ensaio");
  });

  it("o rollback desfaz tudo e devolve as duas fontes do robô", () => {
    for (const trecho of [
      "perform cron.unschedule('agsus_robo_inscricoes_114_2026');",
      'drop function if exists private."FC_AGENDA_DAS_INSCRICOES"(text, text, date);',
      "drop function if exists public.obter_acompanhamento_inscricoes(uuid);",
      "drop function if exists public.gravar_retrato_inscricoes(text, uuid, jsonb);",
      'drop table if exists public."TH_INSCRICAO_VAGA_EDITAL";',
      "CREATE OR REPLACE FUNCTION public.listar_vagas_empregare",
    ])
      expect(ROLLBACK).toContain(trecho);
    expect(ROLLBACK).not.toContain("'ligada'");
  });
});
