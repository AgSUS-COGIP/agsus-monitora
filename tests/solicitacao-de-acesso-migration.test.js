import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CARGOS_DA_SOLICITACAO,
  MOTIVOS_DE_RECUSA,
} from "../src/lib/solicitacao-de-acesso.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261021140000 (ainda não aplicada; ensaio begin…rollback em
  supabase/ensaios/): solicitação de acesso por área. Invariantes estáticas:
  as listas do banco são as do front, toda função nova é SECURITY DEFINER com
  search_path vazio e sem EXECUTE para anon, nada concede acesso automático,
  o contrato de RPC bate com as assinaturas, o ensaio leva o mesmo corpo e
  termina em rollback, e o rollback devolve as assinaturas antigas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261021140000_solicitacao_de_acesso_por_area.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

/** O corpo de `function <nome>(` até o `$function$;` de fechamento. */
const funcao = (sql, nome) => {
  const ini = sql.toLowerCase().indexOf(`function ${nome.toLowerCase()}(`);
  if (ini < 0) return "";
  const fim = sql.indexOf("$function$;", sql.indexOf("$function$", ini) + 10);
  return sql.slice(ini, fim);
};
const corpo = (sql) =>
  sql.slice(sql.indexOf("\nbegin;\n") + 8, sql.lastIndexOf("\ncommit;"));

describe("solicitação de acesso por área (migration)", () => {
  it("transação única, sem \\r; só as três assinaturas antigas saem", () => {
    expect(MIGRATION).not.toContain("\r");
    expect(MIGRATION).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(MIGRATION.match(/^drop function if exists .*$/gm)).toEqual([
      "drop function if exists public.listar_coordenacoes_ativas();",
      "drop function if exists public.registrar_solicitacao_acesso(text, text, text, text);",
      "drop function if exists public.recusar_solicitacao_acesso(uuid, text);",
    ]);
    expect(MIGRATION).not.toMatch(
      /drop table|drop column|truncate|delete from/i,
    );
  });

  it("colunas novas com prefixo MAD, FK, CHECK e COMMENT", () => {
    for (const coluna of [
      "CO_AREA",
      "CO_CARGO_SOLICITADO",
      "DS_CARGO_OUTRO",
      "CO_MOTIVO_RECUSA",
    ]) {
      expect(MIGRATION).toContain(`add column if not exists "${coluna}" text`);
      expect(MIGRATION).toContain(
        `comment on column public."TB_SOLICITACAO_ACESSO"."${coluna}" is`,
      );
    }
    expect(MIGRATION).toContain(
      '"FK_AREA_SOLICACESSO" foreign key ("CO_AREA")',
    );
    expect(MIGRATION).toContain('"IN_FKSOLICACESSO_COAREA"');
    for (const ck of [
      "CK_SOLICACESSO_CARGO",
      "CK_SOLICACESSO_CARGOOUTRO",
      "CK_SOLICACESSO_MOTIVORECUSA",
    ])
      expect(MIGRATION).toContain(`add constraint "${ck}" check`);
  });

  it("a lista de cargos do banco é a do front (código, rótulo e áreas), na mesma ordem", () => {
    const lista = funcao(MIGRATION, 'private."FC_CARGO_SOLICITACAO_ACESSO"');
    const doBanco = [
      ...lista.matchAll(/\('([A-Z_]+)', '([^']+)', '\{([^}]+)\}'::text\[\]\)/g),
    ].map(([, codigo, rotulo, areas]) => ({
      codigo,
      rotulo,
      areas: areas.split(",").sort(),
    }));
    expect(doBanco).toEqual(
      CARGOS_DA_SOLICITACAO.map(({ codigo, rotulo, areas }) => ({
        codigo,
        rotulo,
        areas: [...areas].sort(),
      })),
    );
    const check = MIGRATION.slice(
      MIGRATION.indexOf('"CK_SOLICACESSO_CARGO" check'),
      MIGRATION.indexOf("conname = 'CK_SOLICACESSO_CARGOOUTRO'"),
    );
    expect([...check.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])).toEqual(
      CARGOS_DA_SOLICITACAO.map((c) => c.codigo),
    );
  });

  it("a lista de motivos de recusa do banco é a do front", () => {
    const lista = funcao(MIGRATION, 'private."FC_MOTIVO_RECUSA_SOLICITACAO"');
    const doBanco = [...lista.matchAll(/\('([A-Z_]+)', '([^']+)'\)/g)].map(
      ([, codigo, rotulo]) => ({ codigo, rotulo }),
    );
    expect(doBanco).toEqual(
      MOTIVOS_DE_RECUSA.map(({ codigo, rotulo }) => ({ codigo, rotulo })),
    );
    const check = MIGRATION.slice(
      MIGRATION.indexOf('"CK_SOLICACESSO_MOTIVORECUSA" check'),
      MIGRATION.indexOf("$colunas$;"),
    );
    expect([...check.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])).toEqual(
      MOTIVOS_DE_RECUSA.map((m) => m.codigo),
    );
  });

  it("toda função pública é SECURITY DEFINER, search_path vazio, sem EXECUTE para anon", () => {
    const publicas = [
      ...MIGRATION.matchAll(/create or replace function public\.([a-z_]+)\(/g),
    ].map((m) => m[1]);
    expect(publicas.sort()).toEqual([
      "cancelar_minha_solicitacao_acesso",
      "listar_opcoes_da_solicitacao_acesso",
      "listar_solicitacoes_acesso",
      "obter_minha_solicitacao_acesso",
      "recusar_solicitacao_acesso",
      "registrar_solicitacao_acesso",
    ]);
    for (const nome of publicas) {
      const f = funcao(MIGRATION, `public.${nome}`);
      expect(f, nome).toContain("SECURITY DEFINER");
      expect(f, nome).toContain("SET search_path TO ''");
      expect(MIGRATION).toMatch(
        new RegExp(
          String.raw`revoke all on function public\.${nome}\([^)]*\) from public, anon;`,
        ),
      );
      expect(MIGRATION).toMatch(
        new RegExp(String.raw`comment on function public\.${nome}\(`),
      );
    }
    for (const nome of [
      'private."FC_CARGO_SOLICITACAO_ACESSO"',
      'private."FC_MOTIVO_RECUSA_SOLICITACAO"',
    ])
      expect(funcao(MIGRATION, nome)).toContain("SET search_path TO ''");
  });

  it("nada concede acesso: só aprovar_solicitacao_acesso cria perfil, e ela não muda", () => {
    expect(MIGRATION).not.toMatch(/TB_PERFIL_USUARIO"\s*\(/);
    expect(MIGRATION).not.toMatch(/update public\."TB_PERFIL_USUARIO"/);
    expect(MIGRATION).not.toMatch(/insert into public\."TB_PERFIL_USUARIO"/);
    expect(MIGRATION).not.toContain("garantir_acesso_basico");
    expect(MIGRATION).not.toContain(
      "function public.aprovar_solicitacao_acesso",
    );
    expect(MIGRATION).not.toMatch(/@agenciasus\.org\.br/);
  });

  it("recusar e listar continuam exigindo quem gerencia acessos", () => {
    for (const nome of [
      "recusar_solicitacao_acesso",
      "listar_solicitacoes_acesso",
    ])
      expect(funcao(MIGRATION, `public.${nome}`)).toContain(
        'private."FC_EXIGIR_GESTOR_DE_ACESSOS"()',
      );
    expect(funcao(MIGRATION, "public.recusar_solicitacao_acesso")).toContain(
      'v_gestor = \'coordenador\' and v_req."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"()',
    );
  });

  it("justificativa e 'Outro' da recusa usam a regra de texto do front", () => {
    expect(funcao(MIGRATION, "public.registrar_solicitacao_acesso")).toContain(
      'private."FC_MOTIVO_PARECE_TEXTO"(v_justificativa_limpa, 3)',
    );
    expect(funcao(MIGRATION, "public.recusar_solicitacao_acesso")).toContain(
      'private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 3)',
    );
  });

  it("o contrato de RPC bate com as assinaturas novas", () => {
    const argumentos = (nome) => {
      const f = funcao(MIGRATION, `public.${nome}`);
      const lista = f.slice(f.indexOf("(") + 1, f.indexOf(")\n"));
      return [...lista.matchAll(/(p_[a-z_]+) /g)].map((m) => m[1]);
    };
    for (const nome of [
      "registrar_solicitacao_acesso",
      "recusar_solicitacao_acesso",
      "cancelar_minha_solicitacao_acesso",
      "listar_opcoes_da_solicitacao_acesso",
      "obter_minha_solicitacao_acesso",
    ])
      expect(CONTRATO_RPC[nome]?.argumentos, nome).toEqual(argumentos(nome));
    expect(CONTRATO_RPC.listar_coordenacoes_ativas).toBeUndefined();
  });

  it("o ensaio leva o mesmo corpo e termina em rollback", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });

  it("o rollback devolve as assinaturas antigas e tira as colunas", () => {
    expect(ROLLBACK).toContain(
      "CREATE OR REPLACE FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_setor text DEFAULT NULL::text, p_justificativa text DEFAULT NULL::text, p_coordenacao text DEFAULT NULL::text)",
    );
    expect(ROLLBACK).toContain(
      "CREATE OR REPLACE FUNCTION public.recusar_solicitacao_acesso(p_solicitacao_id uuid, p_observacao_admin text DEFAULT NULL::text)",
    );
    expect(ROLLBACK).toContain(
      "CREATE OR REPLACE FUNCTION public.listar_coordenacoes_ativas()",
    );
    expect(ROLLBACK).toContain(
      "drop function if exists public.listar_opcoes_da_solicitacao_acesso();",
    );
    expect(ROLLBACK).toContain('drop column if exists "CO_AREA"');
    expect(ROLLBACK).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
  });
});
