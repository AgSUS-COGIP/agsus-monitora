import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration do ajuste da pontuação no recurso (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Aqui, as invariantes que não
  podem se perder numa edição: a nota da planilha não é tocada, só o parecer
  jurídico propõe e aprova, aprovar exige o recurso deferido, reabrir cancela,
  tudo comentado e sem escrita direta nas tabelas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005130000_recurso_ajusta_pontuacao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDe = (fonte, cabeca) => {
  const inicio = fonte.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return fonte.slice(inicio, fonte.indexOf("$function$;", inicio));
};

const RPCS = {
  obter_ajustes_pontuacao_recurso: ["p_recurso"],
  obter_dados_previa_ajuste: ["p_recurso"],
  propor_ajuste_pontuacao: ["p_recurso", "p_dados"],
  aprovar_ajuste_pontuacao: ["p_ajuste", "p_previa"],
  cancelar_ajuste_pontuacao: ["p_ajuste", "p_motivo"],
};

describe("migration do ajuste da pontuação", () => {
  it("o ensaio aplica o corpo idêntico ao da migration e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + "\nbegin;\n".length,
      MIGRATION.lastIndexOf("\ncommit;"),
    );
    const noEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (início) ═══\n") +
        "-- ═══ CORPO DA MIGRATION (início) ═══\n".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    );
    expect(noEnsaio.trim()).toBe(corpo.trim());
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    // As conferências pedidas: proposto não vale, aprovado vale e muda a
    // posição, reabrir cancela, quem não pode recebe 42501; reset role antes
    // de ler tabelas sem grant; SELECT de resumo.
    for (const trecho of [
      "FALHOU E3: ajuste proposto entrou na classificação",
      "FALHOU E3: a posição não mudou",
      "FALHOU E3: reabrir não cancelou o ajuste",
      "exception when insufficient_privilege then null;",
      "reset role;",
      "ENSAIO OK",
    ])
      expect(ENSAIO).toContain(trecho);
    expect(ENSAIO.indexOf("reset role;")).toBeLessThan(
      ENSAIO.indexOf("-- E4. Histórico e imutabilidade"),
    );
  });

  it("a nota da análise e da entrevista nunca é escrita", () => {
    expect(MIGRATION).not.toMatch(/update public\."TB_ANALISE_CURRICULAR"/i);
    expect(MIGRATION).not.toMatch(/update public\."TB_ENTREVISTA/i);
  });

  it("tabelas com nomes MAD, RLS, sem grant e com COMMENT em toda coluna", () => {
    for (const tabela of [
      "TB_AJUSTE_PONTUACAO_RECURSO",
      "TB_ITEM_AJUSTE_PONTUACAO",
    ]) {
      expect(tabela.length).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
      const definicao = MIGRATION.slice(
        MIGRATION.indexOf(`create table public."${tabela}" (`),
        MIGRATION.indexOf(
          "\n);",
          MIGRATION.indexOf(`create table public."${tabela}" (`),
        ),
      );
      const colunas = [...definicao.matchAll(/^ {2}"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      expect(colunas.length).toBeGreaterThan(4);
      for (const coluna of colunas) {
        expect(coluna.length).toBeLessThanOrEqual(30);
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      const restricoes = [...definicao.matchAll(/constraint "([A-Z_]+)"/g)].map(
        (m) => m[1],
      );
      for (const r of restricoes) {
        expect(r).toMatch(/^(PK|UK|FK|CK)_/);
        expect(MIGRATION).toContain(
          `comment on constraint "${r}" on public."${tabela}"`,
        );
      }
    }
    expect(MIGRATION).toContain(
      'revoke all on public."TB_AJUSTE_PONTUACAO_RECURSO", public."TB_ITEM_AJUSTE_PONTUACAO" from public, anon, authenticated;',
    );
    for (const indice of [
      ...MIGRATION.matchAll(/create (?:unique )?index "([A-Z_]+)"/g),
    ])
      expect(MIGRATION).toContain(`comment on index public."${indice[1]}" is`);
  });

  it.each(Object.entries(RPCS))(
    "%s: definer, search_path vazio, grant só a authenticated e no contrato",
    (nome, argumentos) => {
      const corpo = corpoDe(MIGRATION, `create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(MIGRATION).toMatch(
        new RegExp(
          `revoke all on function public\\.${nome}\\([^)]*\\) from public, anon;`,
        ),
      );
      expect(MIGRATION).toMatch(
        new RegExp(`comment on function public\\.${nome}\\(`),
      );
      expect(CONTRATO_RPC[nome].argumentos).toEqual(argumentos);
    },
  );

  it("propor e aprovar são do parecer jurídico; aprovar exige o recurso deferido", () => {
    for (const nome of [
      "obter_dados_previa_ajuste",
      "propor_ajuste_pontuacao",
      "aprovar_ajuste_pontuacao",
      "cancelar_ajuste_pontuacao",
    ])
      expect(corpoDe(MIGRATION, `create function public.${nome}(`)).toContain(
        'perform private."FC_EXIGIR_PARECER_RECURSO"();',
      );
    const aprovar = corpoDe(
      MIGRATION,
      "create function public.aprovar_ajuste_pontuacao(",
    );
    expect(aprovar).toContain(
      `if v_r."TP_SITUACAO" not in ('DEFERIDO', 'PARCIALMENTE_INDEFERIDO') then`,
    );
    expect(aprovar).toContain(
      "perform set_config('monitora.ajuste_pontuacao', 'S', true);",
    );
    expect(aprovar).toContain(
      "perform set_config('monitora.ajuste_pontuacao', 'N', true);",
    );
    const propor = corpoDe(
      MIGRATION,
      "create function public.propor_ajuste_pontuacao(",
    );
    expect(propor).toContain(
      `not in ('EM_ANALISE_JURIDICA', 'DEFERIDO', 'PARCIALMENTE_INDEFERIDO')`,
    );
  });

  it("reabrir, indeferir, devolver ou excluir cancela; a marca só muda pelo ajuste", () => {
    const gatilho = corpoDe(
      MIGRATION,
      'create function private."FC_TG_AJUSTE_DO_RECURSO"(',
    );
    expect(gatilho).toContain("'Decisão do recurso reaberta.'");
    expect(gatilho).toContain("'Recurso indeferido.'");
    expect(gatilho).toContain("'Recurso devolvido para ajuste.'");
    expect(gatilho).toContain("'Recurso excluído.'");
    expect(gatilho).toContain(`new."ST_MUDOU_CLASSIFICACAO" := 'N';`);
    expect(gatilho).toContain("errcode = '22023'");
    expect(MIGRATION).toContain(
      `before insert or update on public."TB_RECURSO_CANDIDATO"`,
    );
  });

  it("a Classificação lê os ajustes aprovados pela mesma função da prévia", () => {
    const dados = corpoDe(
      MIGRATION,
      'create function private."FC_DADOS_CLASSIFICACAO_EDITAL"(',
    );
    expect(dados).toContain(`j."TP_SITUACAO" = 'APROVADO'`);
    expect(dados).toContain("'ajustes_mudaram_em'");
    expect(
      corpoDe(
        MIGRATION,
        "create or replace function public.obter_classificacao_do_edital(",
      ),
    ).toContain('private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital, v_area)');
  });

  it("o rollback desfaz tudo e para se houver ajuste gravado", () => {
    for (const nome of Object.keys(RPCS))
      expect(ROLLBACK).toContain(`drop function public.${nome}(`);
    expect(ROLLBACK).toContain('drop table public."TB_ITEM_AJUSTE_PONTUACAO";');
    expect(ROLLBACK).toContain(
      'drop table public."TB_AJUSTE_PONTUACAO_RECURSO";',
    );
    expect(ROLLBACK).toContain('drop trigger "TG_RECURSOCANDIDATO_AJUSTE"');
    expect(ROLLBACK).toContain("Há ajustes da pontuação gravados");
    // obter_classificacao_do_edital volta ao corpo de 20261002150000.
    const original = corpoDe(
      ler("supabase/migrations/20261002150000_classificacao.sql"),
      "create function public.obter_classificacao_do_edital(",
    );
    const voltou = corpoDe(
      ROLLBACK,
      "create or replace function public.obter_classificacao_do_edital(",
    );
    expect(
      voltou.replace("create or replace function", "create function"),
    ).toBe(original);
  });
});
