import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration das sugestões da ficha (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Invariantes estáticas: tabela MAD
  com RLS e sem grant, RPC do job só para o service_role e com a execução da
  pré-classificação, itens limpos no banco, a ficha devolve "sugestoes" e o
  resto igual a 20261008160000, rollback com o corpo de antes e ensaio com o
  mesmo corpo. O job Python chama a RPC com os mesmos argumentos.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009190000_sugestoes_da_ficha.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261008160000_anexos_do_questionario_na_empregare.sql",
);
const JOB = ler("scripts/pre_classificacao/pre_classificacao.py");

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const OBTER =
  "create or replace function public.obter_ficha_analise(p_ficha uuid)";
const GRAVAR = "public.gravar_sugestoes_da_ficha(text, uuid, text, jsonb)";

describe("sugestões da ficha (job Python → banco → tela)", () => {
  it("tabela no padrão MAD, com RLS, sem grant e comentada", () => {
    for (const trecho of [
      'create table public."TB_SUGESTAO_FICHA"',
      'constraint "PK_TB_SUGESTAO_FICHA" primary key ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO")',
      'constraint "FK_MONITORAMENTO_SUGFICHA"',
      'constraint "FK_EMPREGARECAND_SUGFICHA"',
      'constraint "FK_TLPRECLASSIF_SUGFICHA"',
      'constraint "CK_SUGFICHA_DSSUGESTAO" check (jsonb_typeof("DS_SUGESTAO") = \'object\')',
      'create index "IN_FKSUGFICHA_COEMPREGARECAND"',
      'create index "IN_FKSUGFICHA_COEXECUCAO"',
      'alter table public."TB_SUGESTAO_FICHA" enable row level security;',
      'revoke all on public."TB_SUGESTAO_FICHA" from public, anon, authenticated;',
      'comment on table public."TB_SUGESTAO_FICHA" is',
      'comment on column public."TB_SUGESTAO_FICHA"."DS_SUGESTAO" is',
    ])
      expect(MIGRATION).toContain(trecho);
    expect(MIGRATION).not.toMatch(/grant [^;]* on (table )?public\."TB_/i);
  });

  it("RPC do job só para o service_role, com a execução em andamento, só inscritos da vaga e itens limpos", () => {
    expect(MIGRATION).toContain(
      `revoke all on function ${GRAVAR} from public, anon, authenticated;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${GRAVAR} to service_role;`,
    );
    const gravar = corpoDaFuncao(
      MIGRATION,
      "create function public.gravar_sugestoes_da_ficha(",
    );
    expect(gravar).toContain(
      'perform private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);',
    );
    expect(gravar).toContain('c."CO_VAGA" = p_vaga');
    expect(gravar).toContain('private."FC_ITEM_SUGERIDO"(');
    expect(gravar).toContain(
      "x ->> 'tipo' in ('TITULOS', 'CURSOS', 'VINCULOS')",
    );
    // O job chama com os mesmos argumentos.
    expect(JOB).toContain('"gravar_sugestoes_da_ficha"');
    for (const arg of ["p_execucao", "p_edital", "p_vaga", "p_sugestoes"])
      expect(JOB).toContain(`"${arg}"`);
  });

  it("a ficha devolve as sugestões e mantém o resto de antes", () => {
    const agora = corpoDaFuncao(MIGRATION, OBTER);
    const antes = corpoDaFuncao(ANTERIOR, OBTER);
    expect(agora).toContain("'sugestoes', coalesce((");
    expect(agora).toContain('v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);');
    const semSugestoes = agora.replace(
      /\n\s*-- As linhas que as respostas[^\n]*\n\s*'sugestoes', coalesce\(\([\s\S]*?'\{\}'::jsonb\),/,
      "",
    );
    expect(semSugestoes).toBe(antes);
  });

  it("rollback volta a ficha ao corpo de 20261008160000 e apaga o que entrou", () => {
    expect(corpoDaFuncao(ROLLBACK, OBTER)).toBe(corpoDaFuncao(ANTERIOR, OBTER));
    for (const trecho of [
      `drop function if exists ${GRAVAR};`,
      'drop function if exists private."FC_ITEM_SUGERIDO"(text, jsonb);',
      'drop table if exists public."TB_SUGESTAO_FICHA";',
    ])
      expect(ROLLBACK).toContain(trecho);
  });

  it("o ensaio aplica o mesmo corpo da migration e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + "\nbegin;\n".length,
      MIGRATION.lastIndexOf("\ncommit;"),
    ).trim();
    const noEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (início) ═══") +
        "-- ═══ CORPO DA MIGRATION (início) ═══".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    ).trim();
    expect(noEnsaio).toBe(corpo);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });
});
