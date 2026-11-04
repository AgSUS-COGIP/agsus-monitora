import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Demandas internas e responsáveis pelo edital (20261104120000). O ensaio
  (begin…rollback, em 04/11/2026, como administrador global, Gestor só da Saúde
  Indígena e pessoa comum da Saúde Indígena) conferiu: o administrador cria em
  qualquer área (pode_criar_em com as três), conclui, reabre e edita; o Gestor
  cria e conclui na Saúde Indígena e recebe 42501 na SEDE; período invertido,
  título curto, responsável sem acesso e edital de outra área dão 22023; a
  pessoa comum vê a demanda (pode_editar false) e recebe 42501 em toda escrita;
  excluir tira da lista e excluir de novo dá P0002; o histórico ficou
  CRIACAO, CONCLUSAO, REABERTURA, EDICAO, CONCLUSAO, com autor; responsáveis
  pelo edital gravam TH só quando mudam; RLS em todas as tabelas, nenhuma
  legível por authenticated, RPCs sem anon e com search_path vazio; sem sessão,
  28000. Invariantes estáticas abaixo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261104120000_cronograma_demandas_internas.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const TABELAS = [
  "TB_DEMANDA_INTERNA",
  "RL_DEMANDA_INTERNA_RESPONSAVEL",
  "TH_DEMANDA_INTERNA",
  "RL_RESPONSAVEL_EDITAL",
  "TH_RESPONSAVEL_EDITAL",
];
const RPCS = {
  "public.listar_demandas_internas()": [],
  "public.salvar_demanda_interna(jsonb)": ["p_demanda"],
  "public.concluir_demanda_interna(uuid, boolean)": ["p_id", "p_concluida"],
  "public.excluir_demanda_interna(uuid)": ["p_id"],
  "public.listar_pessoas_da_area(text, uuid)": ["p_area", "p_edital"],
  "public.obter_responsaveis_do_edital(uuid)": ["p_edital"],
  "public.salvar_responsaveis_do_edital(uuid, uuid[])": [
    "p_edital",
    "p_responsaveis",
  ],
};

describe("demandas internas e responsáveis pelo edital (migration)", () => {
  it("tabelas MAD com RLS e sem privilégio para ninguém", () => {
    for (const tabela of TABELAS) {
      expect(MIGRATION).toContain(`create table public."${tabela}" (`);
      expect(MIGRATION).toContain(`constraint "PK_${tabela}" primary key`);
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${tabela}" from public, anon, authenticated, service_role;`,
      );
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
    }
    // Identificadores entre aspas em maiúsculas; flags S/N com CHECK.
    for (const coluna of MIGRATION.matchAll(/^ {2}"([A-Z_]+)" /gm)) {
      expect(coluna[1]).toMatch(/^(CO|NO|DS|DT|ST|TP)_/);
    }
    expect(MIGRATION).toContain(
      `constraint "CK_DEMANDAINTERNA_STCONCLUIDA" check ("ST_CONCLUIDA" in ('S', 'N'))`,
    );
    expect(MIGRATION).toContain(
      `constraint "CK_DEMANDAINTERNA_STATIVO" check ("ST_ATIVO" in ('S', 'N'))`,
    );
    expect(MIGRATION).toContain(
      `check (("ST_CONCLUIDA" = 'S') = ("DT_CONCLUSAO" is not null))`,
    );
  });

  it("toda coluna e constraint criada tem COMMENT ON", () => {
    const corpoDasTabelas = MIGRATION.slice(
      MIGRATION.indexOf("-- 1. Demandas internas"),
      MIGRATION.indexOf("-- 3. Permissões"),
    );
    for (const tabela of TABELAS) {
      const inicio = corpoDasTabelas.indexOf(`create table public."${tabela}"`);
      const fim = corpoDasTabelas.indexOf("\n);", inicio);
      const ddl = corpoDasTabelas.slice(inicio, fim);
      for (const m of ddl.matchAll(/^ {2}"([A-Z_]+)" /gm)) {
        expect(corpoDasTabelas).toContain(
          `comment on column public."${tabela}"."${m[1]}" is`,
        );
      }
      for (const m of ddl.matchAll(/constraint "([A-Z_]+)"/g)) {
        expect(corpoDasTabelas).toContain(`comment on constraint "${m[1]}" on`);
      }
    }
  });

  it("RPCs SECURITY DEFINER, search_path vazio, sem anon, só authenticated", () => {
    for (const assinatura of Object.keys(RPCS)) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to authenticated;`,
      );
      expect(ROLLBACK).toContain(`drop function if exists ${assinatura};`);
    }
    const funcoes = MIGRATION.split(/^create function /m).slice(1);
    expect(funcoes.length).toBe(13);
    for (const funcao of funcoes) {
      expect(funcao).toContain("security definer\nset search_path to ''");
    }
    expect(MIGRATION.match(/^grant .*$/gm)).toHaveLength(
      Object.keys(RPCS).length,
    );
  });

  it("administrador global sempre passa; editar exige editor de calendario/nucleo e a área", () => {
    expect(MIGRATION).toContain(
      `select private.is_master()
      or ((private.pode_recurso('calendario', 2) or private.pode_recurso('nucleo', 2))
          and private."FC_PODE_AREA"(p_area));`,
    );
    expect(MIGRATION).toContain(
      `select private.is_master()
      or (private.pode_recurso('calendario', 1)`,
    );
    expect(MIGRATION).toContain("using errcode = '42501'");
  });

  it("histórico TH_ em cada escrita e exclusão só lógica", () => {
    for (const acao of ["CRIACAO", "EDICAO", "CONCLUSAO", "REABERTURA", "EXCLUSAO"])
      expect(MIGRATION).toContain(`'${acao}'`);
    expect(MIGRATION).toContain(`set "ST_ATIVO" = 'N'`);
    expect(MIGRATION).not.toMatch(/delete from public\."TB_DEMANDA_INTERNA"/);
    expect(MIGRATION).toContain(`insert into public."TH_RESPONSAVEL_EDITAL"`);
  });

  it("sem e-mail: nada de aviso, antecedência ou resumo", () => {
    expect(MIGRATION).not.toMatch(/AVISO|RESUMO|ANTECEDENCIA/);
    expect(MIGRATION).not.toMatch(/dias_aviso|resumo_diario/);
  });

  it("não mexe na coluna legada nem no conjunto de leituras em cache", () => {
    expect(MIGRATION).not.toMatch(/alter table public\."TB_MONITORAMENTO_INDIGENA"/);
    expect(MIGRATION).not.toMatch(/create or replace function/);
    expect(MIGRATION).not.toContain("select private.\"FC_ATUALIZAR_FONTES_DAS_LEITURAS\"()");
  });

  it("o contrato tem as RPCs com os argumentos na ordem", () => {
    for (const [assinatura, argumentos] of Object.entries(RPCS)) {
      const nome = assinatura.slice("public.".length, assinatura.indexOf("("));
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(argumentos);
    }
  });

  it("ensaio com o corpo da migration, sempre desfeito e sem carga em lote", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + 8,
      MIGRATION.indexOf("\nnotify pgrst"),
    ).trim();
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    for (const tipo of ["admin_global", "gestor", "comum"])
      expect(ENSAIO).toContain(`from t_pessoas where tipo = '${tipo}';`);
    expect(ENSAIO).not.toMatch(/generate_series/);
  });
});
