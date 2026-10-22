import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261008100000 (aspectos da entrevista; ensaio begin…rollback em
  supabase/ensaios/). Invariantes estáticas: tabelas no padrão MAD com
  comentário e sem acesso direto, o cálculo ignora as notas eliminatórias com
  aspectos e arredonda o total no fim, o lançamento exige todos os aspectos, a
  versão anterior dos roteiros fica para os editais que a usam, rollback com os
  corpos de antes e ensaio com o mesmo corpo da migration.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008100000_aspectos_da_entrevista.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDaMigration = (texto) =>
  texto
    .slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"))
    .trim();
const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

describe("aspectos da entrevista (20261008100000)", () => {
  it("transação única, recarrega o esquema", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain("notify pgrst, 'reload schema';");
  });

  it("tabelas MAD: chaves e checks nomeados, comentários, RLS e sem grant", () => {
    for (const tabela of [
      "TB_ROTEIRO_ASPECTO",
      "TB_ENTREVISTA_AVALIACAO_ASPECTO",
    ]) {
      expect(MIGRATION).toContain(`create table public."${tabela}" (`);
      expect(MIGRATION).toContain(`constraint "PK_${tabela}" primary key`);
      expect(MIGRATION).toContain(`comment on table public."${tabela}"`);
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      const bloco = MIGRATION.slice(
        MIGRATION.indexOf(`create table public."${tabela}" (`),
        MIGRATION.indexOf("\n);", MIGRATION.indexOf(`"${tabela}" (`)),
      );
      const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      for (const coluna of colunas)
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}"`,
        );
      for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g))
        expect(MIGRATION).toContain(`comment on constraint "${nome}"`);
    }
    expect(MIGRATION).toMatch(/revoke all on public."TB_ROTEIRO_ASPECTO"/);
    expect(MIGRATION).not.toMatch(/grant [^;]*TB_(ROTEIRO|ENTREVISTA)_/i);
    expect(MIGRATION).toContain("on delete cascade");
  });

  it("cálculo: média dos aspectos completos, total no fim, sem eliminatória", () => {
    const calculo = corpoDaFuncao(
      MIGRATION,
      'create or replace function private."FC_CALCULAR_ENTREVISTA"',
    );
    expect(calculo).toContain("having count(*) = v_qt_aspectos");
    expect(calculo).toContain("round(v_bruto, 2)");
    expect(calculo).toMatch(
      /v_qt_aspectos = 0 and exists \(select 1 from jsonb_array_elements_text\(v_r\."DS_NOTAS_ELIMINATORIAS"\)/,
    );
  });

  it("lançamento: todos os aspectos, escala de cada um, histórico 'aspectos'", () => {
    const lancar = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.lancar_notas_entrevista",
    );
    expect(lancar).toContain("jsonb_array_length(v_aspectos) <> v_qt_aspectos");
    expect(lancar).toContain('private."FC_EXIGIR_NOTA_NA_ESCALA"');
    expect(lancar).toContain("'aspectos', v_ant_txt, v_novo_txt");
  });

  it("roteiros: versão nova, a anterior fica com os editais", () => {
    expect(MIGRATION).toContain(
      "'Saúde Indígena 2026 — Entrevista individual'",
    );
    expect(MIGRATION).not.toMatch(
      /update public\."TB_ENTREVISTA_EDITAL"[^;]*where[^;]*NO_ROTEIRO/,
    );
    expect(MIGRATION).toContain(
      "md5('agsus-treinamento-roteiro-aspectos-' || v_area)::uuid",
    );
  });

  it("rollback devolve as funções e tira as tabelas", () => {
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_ENTREVISTA_AVALIACAO_ASPECTO";',
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_EXIGIR_NOTA_NA_ESCALA"',
    );
    expect(ROLLBACK).not.toContain(
      'TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_r',
    );
  });

  it("ensaio aplica o mesmo corpo da migration e termina em rollback", () => {
    expect(ENSAIO).toContain(corpoDaMigration(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
