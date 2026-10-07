import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration da inclusão no lote por decisão da coordenação (ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/ e simula a
  inclusão dos 6 do cargo 5 do 93/2026). Aqui, as invariantes estáticas:
  tabelas MAD com CK, comentário, RLS e sem apagar; a entrada DECISAO; as RPCs
  só da coordenação, SECURITY DEFINER com search_path vazio; a gravação do job
  que confere as decisões; a revogação que recusa ficha concluída; rollback
  com os corpos de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007200000_inclusao_no_lote_por_decisao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTES = ler("supabase/migrations/20261007180000_lote_pela_declarada.sql");
const ANTES_FILA = ler(
  "supabase/migrations/20261007130000_conteudo_da_ficha.sql",
);

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

describe("migration: inclusão no lote por decisão da coordenação", () => {
  it("o ensaio aplica exatamente o corpo da migration e termina em rollback", () => {
    const corpoDaMigration = MIGRATION.slice(
      MIGRATION.indexOf("begin;\n") + "begin;\n".length,
      MIGRATION.lastIndexOf("commit;"),
    ).trim();
    const corpoDoEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (início) ═══") +
        "-- ═══ CORPO DA MIGRATION (início) ═══".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    ).trim();
    expect(corpoDoEnsaio).toBe(corpoDaMigration);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    // O ensaio simula os 6 do cargo 5 do 93/2026 por "Critério CORES".
    for (const codigo of [
      "6975425",
      "6948286",
      "6980684",
      "5171946",
      "6948965",
      "5112426",
    ])
      expect(ENSAIO).toContain(`'${codigo}'`);
  });

  it("a entrada DECISAO e as tabelas no padrão MAD, com CK, comentário, RLS e sem apagar", () => {
    expect(MIGRATION).toContain(
      "\"TP_ENTRADA_LOTE\" in ('INICIAL', 'REPOSICAO', 'AMPLIACAO', 'DECISAO')",
    );
    for (const trecho of [
      'create table public."TB_DECISAO_LOTE" (',
      'create table public."TH_DECISAO_LOTE" (',
      'constraint "PK_TB_DECISAO_LOTE" primary key ("CO_DECISAO_LOTE")',
      'constraint "CK_DECISAOLOTE_MOTIVO"',
      'constraint "CK_DECISAOLOTE_REVOGACAO"',
      'create unique index "UK_DECISAOLOTE_ATIVA"',
      'create trigger "TG_DECISAOLOTE_SEMAPAGAR" before delete on public."TB_DECISAO_LOTE"',
      'create trigger "TG_THDECISAOLOTE_IMUTAVEL" before update or delete on public."TH_DECISAO_LOTE"',
      'alter table public."TB_DECISAO_LOTE" enable row level security;',
      'alter table public."TH_DECISAO_LOTE" enable row level security;',
    ])
      expect(MIGRATION).toContain(trecho);
    // Toda coluna das tabelas novas tem comentário.
    for (const tabela of ["TB_DECISAO_LOTE", "TH_DECISAO_LOTE"]) {
      const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
      const fim = MIGRATION.indexOf("\n);", inicio);
      const colunas = [
        ...MIGRATION.slice(inicio, fim).matchAll(/^ {2}"([A-Z_]+)" /gm),
      ].map((m) => m[1]);
      expect(colunas.length).toBeGreaterThan(4);
      for (const coluna of colunas)
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
    }
    expect(MIGRATION).not.toMatch(/grant [^;]* on (table )?public\."T[BHL]_/i);
  });

  it("incluir e revogar: só a coordenação, SECURITY DEFINER com search_path vazio, motivo e trava do job", () => {
    for (const [cabeca, assinatura] of [
      [
        "create function public.incluir_no_lote_por_decisao(p_edital uuid, p_codigos text[], p_motivo text, p_vaga text default null)",
        "public.incluir_no_lote_por_decisao(uuid, text[], text, text)",
      ],
      [
        "create function public.revogar_decisao_lote(p_edital uuid, p_codigos text[], p_motivo text, p_vaga text default null)",
        "public.revogar_decisao_lote(uuid, text[], text, text)",
      ],
    ]) {
      const corpo = corpoDaFuncao(MIGRATION, cabeca);
      expect(corpo).toContain("security definer\nset search_path to ''");
      expect(corpo).toContain(
        'perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);',
      );
      expect(corpo).toContain("errcode = '55P03'");
      expect(corpo).toContain('private."FC_ABRIR_FICHAS"(p_edital');
      expect(corpo).toContain('insert into public."TH_DECISAO_LOTE"');
      expect(corpo).toContain('insert into public."TH_PRE_CLASSIFICACAO"');
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to authenticated;`,
      );
    }
    const incluir = corpoDaFuncao(
      MIGRATION,
      "create function public.incluir_no_lote_por_decisao(",
    );
    expect(incluir).toContain("length(v_motivo) not between 5 and 250");
    expect(incluir).toContain("já está no lote");
    expect(incluir).toContain("\"TP_ENTRADA_LOTE\" = 'DECISAO'");
    const revogar = corpoDaFuncao(
      MIGRATION,
      "create function public.revogar_decisao_lote(",
    );
    expect(revogar).toContain("length(v_motivo) not between 10 and 250");
    expect(revogar).toContain(
      "já tem a ficha concluída: a decisão não se revoga",
    );
    expect(revogar).toContain("f.\"TP_SITUACAO\" = 'CONCLUIDA'");
    // Revogar é exclusão lógica: nada se apaga.
    expect(revogar).toContain("\"ST_ATIVO\" = 'N'");
    expect(revogar).not.toMatch(/delete from/i);
  });

  it("a gravação do job aplica as decisões e mantém as travas de antes", () => {
    const gravar = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.gravar_pre_classificacao_vaga(",
    );
    for (const trecho of [
      "'decisão da coordenação não aplicada'",
      "'entrada por decisão sem decisão vigente'",
      "('INICIAL', 'REPOSICAO', 'AMPLIACAO', 'DECISAO')",
      "quem está no lote só sai eliminado (AM-5.5)",
      "quem já tem ficha não muda",
      "a nota declarada congelada não muda",
      "t.entrada is distinct from 'DECISAO'",
    ])
      expect(gravar).toContain(trecho);
    const ler = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.pre_classificacao_ler_candidatos(",
    );
    expect(ler).toContain("'decisoes', coalesce((");
    expect(ler).toContain("d.\"ST_ATIVO\" = 'S'");
  });

  it("a tela e a fila leem a decisão; contrato de RPC igual", () => {
    const obter = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.obter_pre_classificacao(",
    );
    expect(obter).toContain("'no_lote_regra'");
    expect(obter).toContain("'no_lote_decisao'");
    expect(obter).toContain("'decisao', case when d.\"CO_DECISAO_LOTE\"");
    const fila = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.obter_fila_avaliacao(",
    );
    expect(fila).toContain(
      "'decisao', case when a.\"TP_ENTRADA_LOTE\" = 'DECISAO'",
    );
    expect(CONTRATO_RPC.incluir_no_lote_por_decisao.argumentos).toEqual([
      "p_edital",
      "p_codigos",
      "p_motivo",
      "p_vaga",
    ]);
    expect(CONTRATO_RPC.revogar_decisao_lote.argumentos).toEqual([
      "p_edital",
      "p_codigos",
      "p_motivo",
      "p_vaga",
    ]);
  });

  it("o rollback volta aos corpos de antes e recusa com inscrito no lote por decisão", () => {
    for (const cabeca of [
      "create or replace function public.gravar_pre_classificacao_vaga(",
      "create or replace function public.pre_classificacao_ler_candidatos(",
      "create or replace function public.obter_pre_classificacao(",
    ])
      expect(corpoDaFuncao(ROLLBACK, cabeca)).toBe(
        corpoDaFuncao(ANTES, cabeca),
      );
    expect(
      corpoDaFuncao(
        ROLLBACK,
        "create or replace function public.obter_fila_avaliacao(",
      ),
    ).toBe(
      corpoDaFuncao(
        ANTES_FILA,
        "create or replace function public.obter_fila_avaliacao(",
      ),
    );
    expect(ROLLBACK).toContain(
      "Há inscritos no lote por decisão da coordenação: revogue as decisões antes do rollback.",
    );
    expect(ROLLBACK).toContain(
      "drop function public.incluir_no_lote_por_decisao(uuid, text[], text, text);",
    );
    expect(ROLLBACK).toContain(
      "drop function public.revogar_decisao_lote(uuid, text[], text, text);",
    );
    expect(ROLLBACK).toContain(
      "\"TP_ENTRADA_LOTE\" in ('INICIAL', 'REPOSICAO', 'AMPLIACAO'));",
    );
  });
});
