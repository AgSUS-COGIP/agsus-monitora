import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration "Pacotes dos painéis em Python" (20261029160000), ainda não aplicada:
  o ensaio begin…rollback está em supabase/ensaios/ e o teste dourado (o Python
  monta igual ao SQL) em tests/python/test_pacotes_dos_paineis.py. Aqui, as
  invariantes estáticas: o ensaio roda o mesmo corpo da migration; as RPCs do job
  são só do service_role; a rodada do pg_cron só pede o workflow, com a reserva no
  banco; o workflow entra na lista fixa, no CK e na chave "Pacotes dos painéis"; e
  o rollback devolve as funções de antes.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261029160000_pacotes_dos_paineis_em_python.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const WORKFLOW = ler(".github/workflows/pacotes-dos-paineis.yml");

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

const RPCS_DO_JOB = [
  "public.paineis_ler_pendentes()",
  "public.paineis_ler_fontes(text, text)",
  "public.paineis_gravar_pacote(text, text, timestamptz, bigint[], json, text)",
];

describe("migration dos pacotes dos painéis em Python", () => {
  it("o ensaio roda o corpo da migration e desfaz", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });

  it.each(RPCS_DO_JOB)("%s é só do service_role", (assinatura) => {
    expect(MIGRATION).toContain(
      `revoke all on function ${assinatura} from public, anon, authenticated;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${assinatura} to service_role;`,
    );
  });

  it("a rodada do pg_cron pede o workflow e só monta no banco na reserva", () => {
    const rodada = MIGRATION.slice(
      MIGRATION.indexOf('function private."FC_PAINEIS_RODADA"'),
      MIGRATION.indexOf('procedure private."PR_REMONTAR_CACHE_AGENDADO"'),
    );
    expect(rodada).toContain(
      `private."FC_DISPARAR_ROBO"(c_workflow, '{"modo": "normal"}'::jsonb, p_origem => 'AGENDA')`,
    );
    expect(rodada).toContain("interval '4 minutes'");
    expect(rodada).toContain("interval '30 minutes'");
    expect(rodada).toContain("in ('FALHOU', 'SEM_TOKEN')");
    expect(rodada).toContain("public.atualizar_cache_painel_analises(v_area)");
    const procedimento = MIGRATION.slice(
      MIGRATION.indexOf('procedure private."PR_REMONTAR_CACHE_AGENDADO"'),
    );
    expect(procedimento).toContain('private."FC_PAINEIS_RODADA"(p_cache)');
    expect(procedimento).not.toContain("atualizar_cache_");
  });

  it("a gravação só valida, nunca troca o mais novo e apaga só as marcas lidas", () => {
    const gravar = MIGRATION.slice(
      MIGRATION.indexOf("function public.paineis_gravar_pacote("),
      MIGRATION.indexOf("-- 4. O workflow"),
    );
    expect(
      gravar.match(/where c\."DT_GERACAO" < excluded\."DT_GERACAO"/g),
    ).toHaveLength(3);
    expect(gravar).toContain('"CO_ALTERACAO_CACHE" = any (p_marcas)');
    expect(gravar).not.toMatch(/private."FC_MONTAR_/);
  });

  it("o workflow entra na lista fixa, no CK e na chave Pacotes dos painéis", () => {
    expect(MIGRATION).toContain(
      "'pacotes-dos-paineis.yml', jsonb_build_array('modo'));",
    );
    expect(MIGRATION).toContain(
      "'contratacao-dos-aprovados.yml', 'pacotes-dos-paineis.yml']));",
    );
    expect(MIGRATION).toContain(
      "when 'pacotes-dos-paineis.yml' then 'paineis'",
    );
    expect(WORKFLOW).toContain("python scripts/paineis/pacotes.py");
    expect(WORKFLOW).not.toMatch(/^\s+schedule:/m);
  });

  it("o rollback devolve a rodada de antes e tira o workflow", () => {
    expect(ROLLBACK).toContain(
      "v_resposta := case p_cache\n    when 'ANALISES' then public.atualizar_cache_painel_analises_vencidos()",
    );
    expect(ROLLBACK).not.toContain(
      "'pacotes-dos-paineis.yml', jsonb_build_array",
    );
    expect(ROLLBACK).toContain(
      `delete from public."TL_DISPARO_ROBO" where "NO_WORKFLOW" = 'pacotes-dos-paineis.yml';`,
    );
    for (const funcao of [
      'private."FC_PAINEIS_RODADA"(text)',
      ...RPCS_DO_JOB,
    ]) {
      expect(ROLLBACK).toContain(`drop function if exists ${funcao};`);
    }
  });
});
