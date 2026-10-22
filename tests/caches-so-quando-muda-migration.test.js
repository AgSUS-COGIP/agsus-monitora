import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261007220000 (caches dos painéis só quando os dados mudam; o
  ensaio begin…rollback está em supabase/ensaios/). Invariantes estáticas: a
  tabela de marcas no padrão MAD e sem acesso direto, gatilhos POR COMANDO com
  as tabelas de transição (nunca por linha), quem remonta apaga as marcas antes
  de montar, as tarefas do pg_cron saem sem fazer nada quando não há marca, as
  funções de versão saem, caches e tabelas de passagem sem WAL, rollback com os
  corpos de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007220000_caches_so_quando_muda.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const TABELA = "TL_ALTERACAO_CACHE";

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  const fim = texto.indexOf("$function$;", inicio);
  return texto.slice(inicio, fim > -1 ? fim : texto.indexOf("$$;", inicio));
};
const corpoDaMigration = (texto) =>
  texto
    .slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"))
    .trim();

const ORIGENS = {
  TB_ANALISE_CURRICULAR: ["TG_ANALISE_CACHE", "FC_TG_CACHE_ANALISE"],
  TB_EDITAL_ANALISE: ["TG_EDITALANALISE_CACHE", "FC_TG_CACHE_EDITAL_ANALISE"],
  TB_LISTA_APROVADO: ["TG_LISTAAPROV_CACHE", "FC_TG_CACHE_LISTA_APROVADO"],
  TB_CANDIDATO_APROVADO: [
    "TG_CANDAPROV_CACHE",
    "FC_TG_CACHE_CANDIDATO_APROVADO",
  ],
  TB_MONITORAMENTO_INDIGENA: [
    "TG_MONITINDIG_CACHE",
    "FC_TG_CACHE_MONITORAMENTO",
  ],
  TB_ENTREVISTA: ["TG_ENTREVISTA_CACHE", "FC_TG_CACHE_ENTREVISTA"],
  TB_ENTREVISTA_NOTA: ["TG_ENTREVNOTA_CACHE", "FC_TG_CACHE_ENTREVISTA_NOTA"],
};

describe("caches só quando muda (20261007220000)", () => {
  it("transação única, sem comentário aninhado que engula o corpo", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    const cabecalho = MIGRATION.slice(0, MIGRATION.indexOf("*/"));
    expect(cabecalho.slice(2)).not.toContain("/*");
    expect(MIGRATION).toContain("notify pgrst, 'reload schema';");
  });

  it("marcas: tabela MAD, RLS ligada e sem grant", () => {
    const inicio = MIGRATION.indexOf(`create table private."${TABELA}" (`);
    expect(inicio).toBeGreaterThan(-1);
    const bloco = MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
    const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map((m) => m[1]);
    expect(colunas).toHaveLength(5);
    for (const coluna of colunas) {
      expect(coluna).toMatch(/^(CO|TP|NO|DT)_[A-Z_]+$/);
      expect(MIGRATION).toContain(
        `comment on column private."${TABELA}"."${coluna}" is`,
      );
    }
    for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g)) {
      expect(nome.length, nome).toBeLessThanOrEqual(30);
      expect(nome).toMatch(/^(PK|CK)_/);
    }
    expect(MIGRATION).toContain(
      `alter table private."${TABELA}" enable row level security;`,
    );
    expect(MIGRATION).toContain(
      `revoke all on table private."${TABELA}" from public, anon, authenticated;`,
    );
    expect(MIGRATION).not.toMatch(/grant [a-z, ]+ on (table )?private\./i);
  });

  it("gatilhos por comando, com tabela de transição, em todas as origens", () => {
    for (const [tabela, [gatilho, funcao]] of Object.entries(ORIGENS)) {
      for (const [sufixo, evento, transicao] of [
        ["INS", "insert", "referencing new table as novas"],
        [
          "UPD",
          "update",
          "referencing old table as antigas new table as novas",
        ],
        ["DEL", "delete", "referencing old table as antigas"],
      ]) {
        const nome = `${gatilho}_${sufixo}`;
        expect(nome.length, nome).toBeLessThanOrEqual(30);
        expect(MIGRATION).toContain(
          `create trigger "${nome}" after ${evento} on public."${tabela}"\n  ${transicao} for each statement execute function private."${funcao}"();`,
        );
      }
      const corpo = corpoDaFuncao(
        MIGRATION,
        `create function private."${funcao}"()`,
      );
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path = ''");
      expect(MIGRATION).toContain(
        `revoke all on function private."${funcao}"() from public, anon, authenticated;`,
      );
    }
    expect(MIGRATION).not.toMatch(/for each row/i);
  });

  it("mudança sem efeito não marca: edital e monitoramento comparam antes × depois", () => {
    const edital = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_TG_CACHE_EDITAL_ANALISE"()',
    );
    expect(edital).toContain("is distinct from");
    const monit = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_TG_CACHE_MONITORAMENTO"()',
    );
    expect(monit).toContain(
      '(n.edital, n.unidade, n."CO_AREA") is distinct from (o.edital, o.unidade, o."CO_AREA")',
    );
    // O sync regravava todos os editais iguais a cada execução.
    expect(MIGRATION).toContain(
      "CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental(p_sync_id uuid)",
    );
    expect(MIGRATION).toMatch(
      /"TB_EDITAL_ANALISE"\."CO_PLANILHA"=excluded\."CO_PLANILHA"\n {4}-- Só o edital que mudou/,
    );
  });

  it("quem remonta apaga as marcas ANTES de montar; as tarefas só remontam a área com marca", () => {
    for (const [cabeca, tipo, montar] of [
      [
        "create or replace function public.atualizar_cache_aprovados(p_area text default null)",
        "APROVADOS",
        'private."FC_MONTAR_APROVADOS_AREA"',
      ],
      [
        "create or replace function public.atualizar_cache_painel_analises(p_area text default null, p_escopos text[] default null)",
        "ANALISES",
        'private."FC_MONTAR_PAINEL_ANALISE"',
      ],
      [
        "create or replace function public.atualizar_cache_painel_entrevistas(p_area text default null)",
        "ENTREVISTAS",
        'private."FC_MONTAR_ENTREVISTAS_AREA"',
      ],
    ]) {
      const corpo = corpoDaFuncao(MIGRATION, cabeca);
      const apaga = corpo.indexOf(
        `where t."TP_CACHE" = '${tipo}' and t."CO_AREA" = v_area;`,
      );
      expect(apaga, cabeca).toBeGreaterThan(-1);
      expect(apaga).toBeLessThan(corpo.indexOf(montar));
      expect(corpo).toContain("exception when others then");
    }
    for (const [cabeca, tipo] of [
      [
        "create or replace function public.atualizar_cache_aprovados_vencidos()",
        "APROVADOS",
      ],
      [
        "create or replace function public.atualizar_cache_painel_analises_vencidos()",
        "ANALISES",
      ],
      [
        "create or replace function public.atualizar_cache_painel_entrevistas(p_area text default null)",
        "ENTREVISTAS",
      ],
    ]) {
      const corpo = corpoDaFuncao(MIGRATION, cabeca);
      expect(corpo).toContain(`private."FC_CACHE_DESATUALIZADO"('${tipo}'`);
      expect(corpo).toContain("interval '24 hours'");
      expect(corpo).not.toContain("interval '6 hours'");
    }
  });

  it("as funções de versão saem e ninguém mais as usa", () => {
    for (const nome of [
      "FC_VERSAO_ENTREVISTAS",
      "FC_VERSAO_APROVADOS_AREA",
      "FC_VERSAO_DADOS_ANALISE",
    ]) {
      expect(MIGRATION).toContain(`drop function private."${nome}"(text);`);
      const corpo = corpoDaMigration(MIGRATION);
      const usos = corpo.split(`"${nome}"`).length - 1;
      expect(usos, nome).toBe(1);
      expect(ROLLBACK).toContain(`FUNCTION private."${nome}"(p_area text)`);
    }
  });

  it("marcos da Visão geral pelo pacote do painel de análises, com a conta na hora como reserva", () => {
    const corpo = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.obter_marcos_da_area(p_area text)",
    );
    expect(corpo).toContain('"DS_CONCLUIDAS_POR_ANO"');
    expect(corpo).toContain("c.\"TP_ESCOPO\" in ('ativo', 'inativo')");
    expect(corpo).toContain('private."FC_PODE_AREA"(p_area)');
    expect(corpo).toContain("if v_escopos < 2 then");
    expect(MIGRATION).toContain(
      'alter table private."TA_PAINEL_ANALISE" add column "DS_CONCLUIDAS_POR_ANO" json;',
    );
  });

  it("caches e tabelas de passagem sem WAL; o rollback devolve", () => {
    for (const tabela of [
      'private."TA_CANDIDATO_APROVADO_AREA"',
      'private."TA_PAINEL_ANALISE"',
      'private."TA_PAINEL_ENTREVISTA"',
      'public."TM_ANALISE_CURRICULAR"',
      'public."TM_MANIFESTO_ANALISE"',
    ]) {
      expect(MIGRATION).toContain(`alter table ${tabela} set unlogged;`);
      expect(ROLLBACK).toContain(`alter table ${tabela} set logged;`);
    }
  });

  it("rollback desfaz tudo e o ensaio roda o mesmo corpo e termina em rollback", () => {
    expect(ROLLBACK).toContain(`drop table if exists private."${TABELA}";`);
    for (const [gatilho] of Object.values(ORIGENS))
      for (const sufixo of ["INS", "UPD", "DEL"])
        expect(ROLLBACK).toContain(
          `drop trigger if exists "${gatilho}_${sufixo}"`,
        );
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    expect(ENSAIO).toContain(corpoDaMigration(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });
});
