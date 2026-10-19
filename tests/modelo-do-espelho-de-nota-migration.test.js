import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAMPOS_DO_MODELO } from "../src/lib/avaliacao-documental/modelo-do-espelho.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Invariantes da migration 20261019120000 (modelo do espelho de nota): as
  tabelas no padrão AgSUS (comentadas, RLS, sem acesso direto), a validação
  com as MESMAS chaves e limites do front, a leitura para todos da avaliação
  do edital, o salvar só da coordenação com PT409; ensaio e rollback ao lado.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261019120000_modelo_do_espelho_de_nota.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

function corpoDa(nome) {
  const inicio = MIGRATION.search(
    new RegExp(
      `create or replace function (public|private)\\.("?)${nome}\\2\\(`,
      "i",
    ),
  );
  if (inicio < 0) throw new Error(`função ${nome} não está no arquivo`);
  const resto = MIGRATION.slice(inicio);
  return resto.slice(0, resto.search(/\n\$function\$;\n/));
}

function colunasDa(tabela) {
  const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
  const corpo = MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
  return [...corpo.matchAll(/^\s+"([A-Z_]+)" /gm)].map((m) => m[1]);
}

describe("a migration", () => {
  it("transação com lock_timeout", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  for (const tabela of ["TB_MODELO_ESPELHO_NOTA", "TH_MODELO_ESPELHO_NOTA"])
    it(`${tabela}: colunas com prefixo, tudo comentado, RLS e sem acesso direto`, () => {
      const colunas = colunasDa(tabela);
      expect(colunas.length).toBeGreaterThan(4);
      for (const coluna of colunas) {
        expect(coluna).toMatch(/^(CO|NU|DS|DT|TP|ST)_/);
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      const constraints = [
        ...MIGRATION.slice(
          MIGRATION.indexOf(`create table public."${tabela}" (`),
        )
          .split("\n);")[0]
          .matchAll(/constraint "([A-Z_]+)"/g),
      ].map((m) => m[1]);
      for (const c of constraints) {
        expect(c).toMatch(/^(PK|FK|CK|UK)_/);
        expect(MIGRATION).toContain(`comment on constraint "${c}" on`);
      }
    });

  it("um modelo por edital; o histórico é por versão", () => {
    expect(MIGRATION).toContain(
      `constraint "UK_MODELOESPELHO_EDITAL" unique ("CO_MONITORAMENTO")`,
    );
    expect(MIGRATION).toContain(
      `primary key ("CO_MODELO_ESPELHO_NOTA", "NU_VERSAO")`,
    );
    expect(MIGRATION).toContain(
      `revoke all on public."TB_MODELO_ESPELHO_NOTA", public."TH_MODELO_ESPELHO_NOTA" from public, anon, authenticated;`,
    );
  });

  it("a validação tem as mesmas chaves, limites e vazios do front", () => {
    const validar = corpoDa("FC_VALIDAR_MODELO_ESPELHO_NOTA");
    const bloco = validar.match(/v_campos constant jsonb := '(\{[\s\S]*?\})'/);
    const campos = JSON.parse(bloco[1]);
    expect(Object.keys(campos).sort()).toEqual(
      CAMPOS_DO_MODELO.map((c) => c.chave).sort(),
    );
    for (const c of CAMPOS_DO_MODELO)
      expect(campos[c.chave], c.chave).toEqual([c.podeFicarVazio, c.maximo]);
    expect(validar).toContain("mostrar_autodeclarada");
    expect(validar).toContain("v_chave not in ('saudacao', 'abertura')");
    expect(validar).toContain("v_chave = 'saudacao' and strpos");
    expect(validar).toContain("errcode = '22023'");
    expect(validar).toMatch(/set search_path = ''/);
  });

  it("ler: SECURITY DEFINER, só leitura, todos da avaliação do edital", () => {
    const obter = corpoDa("obter_modelo_espelho_nota");
    expect(obter).toMatch(/security definer/);
    expect(obter).toMatch(/set search_path = ''/);
    expect(obter).toMatch(/\nstable\n/);
    expect(obter).toContain(
      `private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)`,
    );
    expect(obter).not.toMatch(/\b(insert|update|delete)\b/i);
  });

  it("salvar: só a coordenação, valida, trava por edital e recusa versão velha com PT409", () => {
    const salvar = corpoDa("salvar_modelo_espelho_nota");
    expect(salvar).toMatch(/security definer/);
    expect(salvar).toMatch(/set search_path = ''/);
    expect(salvar).toContain(`private."FC_EXIGIR_COORD_AVALIACAO"(p_edital)`);
    expect(salvar).toContain(
      `private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(v_textos)`,
    );
    expect(salvar).toContain("pg_advisory_xact_lock");
    expect(salvar).toContain("errcode = 'PT409'");
    expect(salvar).not.toContain("40001");
    expect(salvar).toContain(`insert into public."TH_MODELO_ESPELHO_NOTA"`);
    expect(salvar).toContain("then 'RESTAURAR' else 'SALVAR'");
  });

  it("grants: as RPCs só para authenticated; a validação fechada", () => {
    for (const assinatura of [
      "public.obter_modelo_espelho_nota(uuid)",
      "public.salvar_modelo_espelho_nota(uuid, jsonb, integer)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to authenticated;`,
      );
      expect(MIGRATION).toContain(`comment on function ${assinatura} is`);
    }
    expect(MIGRATION).toContain(
      `revoke all on function private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(jsonb) from public, anon, authenticated;`,
    );
  });
});

describe("contrato, ensaio e rollback", () => {
  it("as RPCs estão no contrato com os argumentos da migration", () => {
    expect(CONTRATO_RPC.obter_modelo_espelho_nota.argumentos).toEqual([
      "p_edital",
    ]);
    expect(CONTRATO_RPC.salvar_modelo_espelho_nota.argumentos).toEqual([
      "p_edital",
      "p_textos",
      "p_versao_atual",
    ]);
  });

  it("o ensaio é desfeito e cobre PT409, 22023, 42501 e restaurar", () => {
    expect(ENSAIO).toContain("rollback;");
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/m);
    for (const trecho of ["PT409", "22023", "42501", "RESTAURAR"])
      expect(ENSAIO).toContain(trecho);
  });

  it("o rollback tira tudo o que a migration cria", () => {
    for (const trecho of [
      "drop function if exists public.salvar_modelo_espelho_nota(uuid, jsonb, integer);",
      "drop function if exists public.obter_modelo_espelho_nota(uuid);",
      `drop function if exists private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(jsonb);`,
      `drop table if exists public."TH_MODELO_ESPELHO_NOTA";`,
      `drop table if exists public."TB_MODELO_ESPELHO_NOTA";`,
    ])
      expect(ROLLBACK).toContain(trecho);
    expect(ROLLBACK.indexOf('TH_MODELO_ESPELHO_NOTA";')).toBeLessThan(
      ROLLBACK.indexOf('TB_MODELO_ESPELHO_NOTA";'),
    );
  });
});
