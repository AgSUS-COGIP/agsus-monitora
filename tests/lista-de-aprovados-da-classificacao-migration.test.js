import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration que faz do resultado FINAL da Classificação a fonte da Lista de
  aprovados (ainda não aplicada: o ensaio begin…rollback está em
  supabase/ensaios/). Aqui, as invariantes estáticas: nomenclatura MAD, RLS sem
  acesso direto, RPCs SECURITY DEFINER com search_path vazio e permissão,
  nada apagado (sem delete), o que a publicação preserva, contrato de RPC,
  rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005160000_lista_de_aprovados_da_classificacao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDaFuncao = (cabeca) => {
  const inicio = MIGRATION.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
};

const RPCS = {
  publicar_lista_aprovados_da_classificacao: "uuid, uuid, jsonb",
  obter_publicacao_lista_aprovados: "uuid, boolean",
  importar_lista_aprovados: "text, boolean, text, text, jsonb, boolean, text",
  listar_listas_aprovados: "",
};

describe("migration da lista de aprovados da Classificação: banco", () => {
  it("histórico no padrão MAD: colunas tipadas, constraints nomeadas, COMMENT ON e RLS sem grant", () => {
    const tabela = "TH_PUBLICACAO_APROVADO";
    expect(tabela.length).toBeLessThanOrEqual(30);
    const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
    expect(inicio).toBeGreaterThan(-1);
    const bloco = MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
    expect(bloco).toContain(`constraint "PK_${tabela}" primary key`);
    const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map((m) => m[1]);
    expect(colunas.length).toBeGreaterThan(10);
    for (const coluna of colunas) {
      expect(coluna).toMatch(/^(CO|TP|NO|DS|DT|NU|QT)_[A-Z_]+$/);
      expect(coluna.length).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(
        `comment on column public."${tabela}"."${coluna}" is`,
      );
    }
    for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g)) {
      expect(nome.length, nome).toBeLessThanOrEqual(30);
      if (!nome.startsWith("PK_"))
        expect(MIGRATION).toContain(
          `comment on constraint "${nome}" on public."${tabela}"`,
        );
    }
    expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
    expect(MIGRATION).toContain(
      `alter table public."${tabela}" enable row level security;`,
    );
    expect(MIGRATION).toContain(
      `revoke all on public."${tabela}" from public, anon, authenticated;`,
    );
    expect(MIGRATION).not.toMatch(/grant [^;]*on public\."T[BH]_/i);
  });

  it("colunas novas em maiúsculas, comentadas; as legadas (minúsculas) não são renomeadas", () => {
    for (const [tabela, coluna] of [
      ["TB_LISTA_APROVADO", "TP_ORIGEM"],
      ["TB_LISTA_APROVADO", "CO_LISTA_CLASSIFICACAO"],
      ["TB_CANDIDATO_APROVADO", "CO_ANALISE_CURRICULAR"],
      ["TB_CANDIDATO_APROVADO", "TP_SITUACAO_CLASSIFICACAO"],
      ["TB_CANDIDATO_APROVADO", "CO_CANDIDATO_ANTERIOR"],
    ])
      expect(MIGRATION).toContain(
        `comment on column public."${tabela}"."${coluna}" is`,
      );
    expect(MIGRATION).toContain(
      `add column "TP_ORIGEM" varchar(15) not null default 'XLSX'`,
    );
    expect(MIGRATION).not.toMatch(/rename column/i);
  });

  it("constraints e índices nomeados (até 30 caracteres) e comentados", () => {
    for (const [, nome] of MIGRATION.matchAll(
      /(?:add )?constraint "([A-Z_]+)"/g,
    ))
      expect(nome.length, nome).toBeLessThanOrEqual(30);
    const indices = [
      ...MIGRATION.matchAll(/create index "([A-Z_]+)" on public/g),
    ].map((m) => m[1]);
    expect(indices.length).toBeGreaterThanOrEqual(5);
    for (const nome of indices) {
      expect(nome).toMatch(/^IN_/);
      expect(nome.length, nome).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on index public."${nome}" is`);
    }
  });

  it("nada é apagado: sem delete nem truncate de tabela do sistema", () => {
    expect(MIGRATION).not.toMatch(/delete from public\./i);
    expect(MIGRATION).not.toMatch(/truncate public\./i);
    expect(MIGRATION).not.toMatch(/update public\."TB_ANALISE_CURRICULAR"/i);
  });
});

describe("migration da lista de aprovados da Classificação: RPCs", () => {
  it.each(Object.entries(RPCS))(
    "%s: SECURITY DEFINER, search_path vazio, só authenticated, comentada, contrato",
    (nome, assinatura) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toMatch(/set search_path (to|=) ''/);
      expect(MIGRATION).toContain(
        `revoke all on function public.${nome}(${assinatura}) from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${nome}(${assinatura}) to authenticated;`,
      );
      expect(MIGRATION).toContain(
        `comment on function public.${nome}(${assinatura}) is`,
      );
      const argumentos = corpo
        .slice(corpo.indexOf("(") + 1, corpo.indexOf(")\n"))
        .split(",")
        .map((a) => a.trim().split(" ")[0])
        .filter(Boolean);
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(argumentos);
    },
  );

  it("publicar: Classificação editor no edital, só o FINAL mais recente sem pendência, lista vigente conferida", () => {
    const corpo = corpoDaFuncao(
      "create function public.publicar_lista_aprovados_da_classificacao(",
    );
    expect(corpo).toContain(
      `private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_l."CO_MONITORAMENTO", 2)`,
    );
    expect(corpo).toContain(`if v_l."TP_LISTA" <> 'FINAL' then`);
    expect(corpo).toContain(`if v_l."QT_PENDENCIA" > 0 then`);
    expect(corpo).toContain(`o."DT_GERACAO" > v_l."DT_GERACAO"`);
    expect(corpo).toContain(
      "if v_anterior.id is distinct from p_lista_vigente then",
    );
    expect(corpo).toContain("using errcode = '40001'");
    // A anterior fica inativa no histórico, sem apagar.
    expect(corpo).toContain("set vigente = false, ativo = false");
  });

  it("publicar: confere os vínculos e preserva status, sub judice, decisão judicial e anexos", () => {
    const corpo = corpoDaFuncao(
      "create function public.publicar_lista_aprovados_da_classificacao(",
    );
    for (const trecho of [
      "'Cada pessoa só pode ser vinculada uma vez.'",
      "'Vínculo com candidato que não está na lista vigente.'",
      "'Vínculo com candidato que não está no resultado final.'",
      "o.status, o.processo_sei, o.matricula,",
      "case when o.alterado_judicialmente then o.nota else n.nota end",
      'insert into public."TB_ANEXO_CANDIDATO_APROVADO"',
      'private."FC_RECOLOCAR_NA_CLASSIFICACAO"',
      'insert into public."TH_PUBLICACAO_APROVADO"',
    ])
      expect(corpo).toContain(trecho);
  });

  it("importar por XLSX: motivo obrigatório sobre lista da Classificação e histórico", () => {
    const corpo = corpoDaFuncao(
      "create function public.importar_lista_aprovados(",
    );
    expect(corpo).toContain(
      "if v_origem_atual = 'CLASSIFICACAO' and v_motivo is null then",
    );
    expect(corpo).toContain('insert into public."TH_PUBLICACAO_APROVADO"');
    expect(MIGRATION).toContain(
      "drop function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean);",
    );
  });

  it("a situação do edital aceita Classificação, Aprovados ou Importação e confere área e recorte", () => {
    const corpo = corpoDaFuncao(
      "create function public.obter_publicacao_lista_aprovados(",
    );
    expect(corpo).toContain("private.pode_recurso('classificacao', 1)");
    expect(corpo).toContain("private.pode_recurso('aprovados', 1)");
    expect(corpo).toContain("private.pode_recurso('importacao', 2)");
    expect(corpo).toContain('private."FC_EXIGIR_AREA_EDITAL"(p_edital::text)');
  });
});

describe("rollback e ensaio da lista de aprovados da Classificação", () => {
  it("rollback derruba as RPCs novas, o histórico e as colunas; volta importar e listar", () => {
    for (const trecho of [
      "drop function if exists public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb);",
      "drop function if exists public.obter_publicacao_lista_aprovados(uuid, boolean);",
      "drop function if exists public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text);",
      "create or replace function public.importar_lista_aprovados(",
      "create function public.listar_listas_aprovados()",
      'drop table if exists public."TH_PUBLICACAO_APROVADO";',
      'drop column if exists "TP_ORIGEM"',
      'drop column if exists "CO_ANALISE_CURRICULAR"',
    ])
      expect(ROLLBACK).toContain(trecho);
    expect(ROLLBACK).not.toContain("p_motivo text");
  });

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
    for (const trecho of [
      "FALHOU E3: leitor publicou",
      "FALHOU E3: publicou com a lista vigente errada",
      "FALHOU E4: o contratado não levou status e matrícula",
      "FALHOU E4: a nota da decisão judicial não foi preservada",
      "FALHOU E4: o incluído por decisão judicial não foi mantido como sub judice",
      "exception when insufficient_privilege then null;",
      "reset role;",
      "ENSAIO OK",
    ])
      expect(ENSAIO).toContain(trecho);
    expect(ENSAIO.indexOf("reset role;")).toBeLessThan(
      ENSAIO.indexOf("-- E4. O que ficou gravado."),
    );
  });

  it("PL/pgSQL sem `if case when … then … end then`", () => {
    expect(MIGRATION).not.toMatch(/if\s+case\s+when/i);
    expect(ENSAIO).not.toMatch(/if\s+case\s+when/i);
  });
});
