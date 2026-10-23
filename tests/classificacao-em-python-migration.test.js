import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration da classificação em Python, etapa 1 (20261023140000), ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/. Aqui, as
  invariantes estáticas: a leitura e a gravação do job só para service_role, a
  leitura da tela com o porteiro da Classificação, a tabela nova com RLS e sem
  acesso direto, o apelido dos nomes e o rollback que desfaz tudo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME =
  "20261023140000_classificacao_em_python_e_relatorio_de_desempate.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** O corpo de uma função criada no arquivo. */
function funcao(sql, nome) {
  const inicio = sql.indexOf(`create or replace function ${nome}(`);
  expect(inicio, nome).toBeGreaterThanOrEqual(0);
  const fim = sql.indexOf("$function$;", sql.indexOf("$function$", inicio) + 1);
  return sql.slice(inicio, fim);
}

describe("classificação em Python e relatório de desempate (20261023140000)", () => {
  it("é uma transação, com pré-requisitos, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain("raise exception 'Aplique antes");
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
  });

  it("as funções são SECURITY DEFINER com search_path vazio", () => {
    for (const nome of [
      "public.classificacao_ler_edital",
      "public.classificacao_gravar_desempate",
      "public.obter_desempate_da_lista",
    ]) {
      const f = funcao(MIGRATION, nome);
      expect(f, nome).toContain("security definer");
      expect(f, nome).toContain("set search_path to ''");
    }
  });

  it("leitura e gravação do job só para service_role; a da tela, autenticado com o porteiro", () => {
    for (const assinatura of [
      "public.classificacao_ler_edital(uuid)",
      "public.classificacao_gravar_desempate(text, uuid, text, jsonb, text)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to service_role;`,
      );
    }
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_desempate_da_lista(uuid) to authenticated, service_role;",
    );
    expect(funcao(MIGRATION, "public.obter_desempate_da_lista")).toContain(
      'private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_edital, 1)',
    );
  });

  it("a tabela do relatório segue a MAD, liga a RLS e não abre acesso direto", () => {
    expect(MIGRATION).toContain(
      'create table if not exists public."TB_RELATORIO_DESEMPATE"',
    );
    expect(MIGRATION).toContain(
      'constraint "FK_LISTACLASSIF_RELATDESEMP" foreign key ("CO_LISTA_CLASSIFICACAO")',
    );
    expect(MIGRATION).toContain(
      'alter table public."TB_RELATORIO_DESEMPATE" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on table public."TB_RELATORIO_DESEMPATE" from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(/create policy/i);
    const colunas = [
      ...MIGRATION.matchAll(/^\s+"([A-Z]{2}_[A-Z_]+)" [a-z]/gm),
    ].map((m) => m[1]);
    expect(colunas.length).toBeGreaterThanOrEqual(10);
    for (const coluna of new Set(colunas))
      expect(MIGRATION, coluna).toContain(
        `comment on column public."TB_RELATORIO_DESEMPATE"."${coluna}"`,
      );
  });

  it("o job não recebe nomes: apelido na ordem do motor, sem retrato, sem autores", () => {
    const f = funcao(MIGRATION, "public.classificacao_ler_edital");
    expect(MIGRATION).toContain(
      "create collation private.\"CL_NOME_PT_BR_BASE\" (provider = icu, locale = 'pt-BR-u-ks-level1', deterministic = false);",
    );
    expect(f).toContain('collate private."CL_NOME_PT_BR_BASE"');
    expect(f).toContain("lpad(row_number() over (");
    expect(f).toContain("jsonb_build_object('nome', v_apelidos->>");
    expect(f).toContain("d.value - 'por'");
    expect(f).toContain("i.value - 'justificativa'");
    expect(f).not.toContain("DS_RESULTADO");
    expect(f).not.toMatch(/'versoes'|cpf/i);
  });

  it("a gravação confere hash, forma, candidatos da lista, totais e dado pessoal", () => {
    const f = funcao(MIGRATION, "public.classificacao_gravar_desempate");
    expect(f).toContain('p_hash is distinct from v_lista."DS_HASH"');
    expect(f).toContain(
      "p_relatorio->>'tipo' is distinct from v_lista.\"TP_LISTA\"",
    );
    expect(f).toContain("'$.vagas[*].grupos[*].candidatos[*].analiseId'");
    expect(f).toContain("'@|[0-9]{11}'");
    expect(f).toContain('on conflict ("CO_LISTA_CLASSIFICACAO") do update');
  });

  it("o rollback desfaz as RPCs, a tabela e a collation", () => {
    for (const trecho of [
      "drop function if exists public.obter_desempate_da_lista(uuid);",
      "drop function if exists public.classificacao_gravar_desempate(text, uuid, text, jsonb, text);",
      "drop function if exists public.classificacao_ler_edital(uuid);",
      'drop table if exists public."TB_RELATORIO_DESEMPATE";',
      'drop collation if exists private."CL_NOME_PT_BR_BASE";',
    ])
      expect(ROLLBACK).toContain(trecho);
  });
});
