import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration do nome das versões das regras (20261008180000; o ensaio
  begin…rollback está em supabase/ensaios/ e foi rodado no banco real só com
  rollback). Invariantes estáticas: coluna NO_VERSAO (MAD, varchar(80),
  COMMENT) nas três versões; salvar aceita o nome sem quebrar a chamada de
  hoje; renomear muda só o nome, com motivo e histórico, e a permissão de quem
  edita a regra; leitura devolve o nome; contrato de RPC; ensaio com o mesmo
  corpo; rollback que desfaz tudo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008180000_nome_das_versoes_das_regras.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDaFuncao = (cabeca) => {
  const inicio = MIGRATION.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
};

describe("nome das versões: o banco", () => {
  it("NO_VERSAO varchar(80), nulo, com check e COMMENT nas três tabelas", () => {
    for (const [tabela, ck] of [
      ["TH_REGRA_ANALISE", "CK_THREGRAANALISE_NOVERSAO"],
      ["TH_REGRA_CLASSIFICACAO", "CK_HISTREGRACLASSIF_NOVERSAO"],
      ["TB_ROTEIRO_ENTREVISTA", "CK_ROTEIROENTREVISTA_NOVERSAO"],
    ]) {
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" add column "NO_VERSAO" varchar(80);`,
      );
      expect(MIGRATION).toContain(`add constraint "${ck}"`);
      expect(MIGRATION).toContain(
        `comment on column public."${tabela}"."NO_VERSAO" is`,
      );
      expect(ROLLBACK).toContain(
        `alter table public."${tabela}" drop column if exists "NO_VERSAO";`,
      );
    }
    expect(MIGRATION).toMatch(/between 3 and 80/);
  });

  it("histórico de nomes imutável, com RLS e sem acesso direto", () => {
    expect(MIGRATION).toContain('create table public."TH_NOME_VERSAO_REGRA"');
    expect(MIGRATION).toContain(
      `check ("TP_REGRA" in ('ANALISE', 'CLASSIFICACAO', 'ROTEIRO'))`,
    );
    expect(MIGRATION).toContain(
      'before update or delete on public."TH_NOME_VERSAO_REGRA"',
    );
    expect(MIGRATION).toContain(
      'alter table public."TH_NOME_VERSAO_REGRA" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TH_NOME_VERSAO_REGRA" from public, anon, authenticated;',
    );
  });

  it("o gatilho da avaliação deixa mudar só o NO_VERSAO", () => {
    const gatilho = corpoDaFuncao(
      'create or replace function private."FC_TG_REGRA_ANALISE_IMUTAVEL"()',
    );
    expect(gatilho).toContain(
      `(to_jsonb(new) - 'NO_VERSAO') = (to_jsonb(old) - 'NO_VERSAO')`,
    );
    expect(gatilho).toContain("FC_REINICIO_TREINAMENTO_PERMITE");
  });

  it("salvar aceita p_nome com default (a chamada de 4 argumentos continua)", () => {
    for (const rpc of ["salvar_regra_analise", "salvar_regra_classificacao"]) {
      expect(MIGRATION).toContain(
        `drop function public.${rpc}(uuid, jsonb, integer, text);`,
      );
      expect(MIGRATION).toMatch(
        new RegExp(
          `create function public\\.${rpc}\\([^)]*p_nome text default null\\)`,
        ),
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${rpc}(uuid, jsonb, integer, text, text) to authenticated, service_role;`,
      );
      expect(CONTRATO_RPC[rpc].argumentos).toEqual([
        "p_edital",
        "p_configuracao",
        "p_versao_atual",
        "p_motivo",
        "p_nome",
      ]);
    }
    expect(
      corpoDaFuncao(
        "create or replace function public.salvar_roteiro_entrevista(p_dados jsonb)",
      ),
    ).toContain(`private."FC_NOME_DA_VERSAO"(p_dados ->> 'nome_versao')`);
  });

  it("renomear: só o nome, motivo de 10 a 500, histórico e a permissão de quem edita", () => {
    const casos = [
      [
        "renomear_versao_regra_analise(p_edital uuid, p_versao integer, p_nome text, p_motivo text)",
        `private."FC_EXIGIR_COORD_AVALIACAO"(p_edital)`,
        `update public."TH_REGRA_ANALISE" set "NO_VERSAO" = v_nome`,
      ],
      [
        "renomear_versao_regra_classificacao(p_edital uuid, p_versao integer, p_nome text, p_motivo text)",
        `private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2)`,
        `update public."TH_REGRA_CLASSIFICACAO" set "NO_VERSAO" = v_nome`,
      ],
      [
        "renomear_versao_roteiro_entrevista(p_roteiro uuid, p_nome text, p_motivo text)",
        "private.pode_recurso('entrevistas', 2)",
        `update public."TB_ROTEIRO_ENTREVISTA" set "NO_VERSAO" = v_nome`,
      ],
    ];
    for (const [cabeca, porteiro, update] of casos) {
      const corpo = corpoDaFuncao(`create function public.${cabeca}`);
      expect(corpo).toContain("security definer\nset search_path to ''");
      expect(corpo).toContain(porteiro);
      expect(corpo).toContain(update);
      expect(corpo).toContain("not between 10 and 500");
      expect(corpo).toContain('insert into public."TH_NOME_VERSAO_REGRA"');
      expect(corpo).toContain("O nome não mudou.");
      // Só o nome: nem a configuração nem o hash entram no update.
      expect(corpo).not.toMatch(/set[^;]*"DS_(CONFIGURACAO|HASH)"/);
      const nome = cabeca.slice(0, cabeca.indexOf("("));
      expect(MIGRATION).toMatch(
        new RegExp(
          `revoke all on function public\\.${nome}\\([^)]*\\) from public, anon;`,
        ),
      );
      expect(CONTRATO_RPC[nome]).toBeTruthy();
      expect(ROLLBACK).toContain(`drop function if exists public.${nome}(`);
    }
  });

  it("leitura devolve o nome (vigente, versões, editais, apoio e roteiro)", () => {
    expect(
      corpoDaFuncao(
        'create or replace function private."FC_REGRA_ANALISE_JSON"(p_edital uuid)',
      ),
    ).toContain(`'nome', v."NO_VERSAO"`);
    expect(
      corpoDaFuncao(
        'create or replace function private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital uuid)',
      ),
    ).toContain(`'renomeacoes', private."FC_RENOMEACOES_JSON"('CLASSIFICACAO'`);
    expect(
      corpoDaFuncao(
        "create or replace function public.listar_editais_avaliacao(p_area text)",
      ),
    ).toContain(`'nome_regra', h."NO_VERSAO"`);
    expect(
      corpoDaFuncao(
        "create or replace function public.listar_editais_classificacao(p_area text)",
      ),
    ).toContain(`'nome_regra', h."NO_VERSAO"`);
    expect(
      corpoDaFuncao(
        'create or replace function private."FC_ROTEIRO_JSON"(p_roteiro uuid)',
      ),
    ).toContain(`'nome_versao', r."NO_VERSAO"`);
  });

  it("ensaio com o mesmo corpo da migration e terminando em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + 8,
      MIGRATION.lastIndexOf("\ncommit;"),
    ).trim();
    const abre = "═══ CORPO DA MIGRATION (início) ═══\n";
    const doEnsaio = ENSAIO.slice(
      ENSAIO.indexOf(abre) + abre.length,
      ENSAIO.indexOf("\n-- ═══ CORPO DA MIGRATION (fim)"),
    ).trim();
    expect(doEnsaio).toBe(corpo);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });

  it("rollback volta as assinaturas de 4 argumentos com os grants", () => {
    for (const rpc of ["salvar_regra_analise", "salvar_regra_classificacao"]) {
      expect(ROLLBACK).toContain(
        `drop function if exists public.${rpc}(uuid, jsonb, integer, text, text);`,
      );
      expect(ROLLBACK).toContain(
        `grant execute on function public.${rpc}(uuid, jsonb, integer, text) to authenticated, service_role;`,
      );
    }
    expect(ROLLBACK).toContain(
      'drop table if exists public."TH_NOME_VERSAO_REGRA";',
    );
  });
});
