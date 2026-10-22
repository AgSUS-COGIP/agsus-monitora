import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261008170000 (avaliador por competência; ensaio begin…rollback
  em supabase/ensaios/). Invariantes estáticas: tabela de vínculo no padrão
  MAD (sem linha = avalia todas), o cálculo e o lançamento passam por
  private."FC_AVALIADOR_AVALIA", configurar grava/valida o vínculo, o payload
  traz as competências, o treinamento tem o exemplo, rollback com os corpos
  de antes e ensaio com o mesmo corpo da migration.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008170000_avaliador_por_competencia.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const TABELA = "TB_ENTREVISTA_AVALIADOR_COMPETENCIA";

const corpoDaMigration = (texto) =>
  texto
    .slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"))
    .trim();
const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

describe("avaliador por competência (20261008170000)", () => {
  it("transação única, recarrega o esquema", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain("notify pgrst, 'reload schema';");
  });

  it("tabela MAD: chaves nomeadas, comentários, RLS, sem grant e cascata do membro", () => {
    expect(MIGRATION).toContain(`create table public."${TABELA}" (`);
    expect(MIGRATION).toContain(`constraint "PK_${TABELA}" primary key`);
    expect(MIGRATION).toContain(`comment on table public."${TABELA}"`);
    expect(MIGRATION).toContain(
      `alter table public."${TABELA}" enable row level security;`,
    );
    const bloco = MIGRATION.slice(
      MIGRATION.indexOf(`create table public."${TABELA}" (`),
      MIGRATION.indexOf("\n);", MIGRATION.indexOf(`"${TABELA}" (`)),
    );
    for (const [, coluna] of bloco.matchAll(/^\s+"([A-Z_]+)" /gm))
      expect(MIGRATION).toContain(
        `comment on column public."${TABELA}"."${coluna}"`,
      );
    for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g))
      expect(MIGRATION).toContain(`comment on constraint "${nome}"`);
    expect(MIGRATION).toContain(`revoke all on public."${TABELA}"`);
    expect(MIGRATION).not.toMatch(/grant [^;]*TB_ENTREVISTA_AVALIADOR_COMP/i);
    expect(bloco).toMatch(
      /references public\."TB_ENTREVISTA_AVALIADOR" \("CO_AVALIADOR"\) on delete cascade/,
    );
    expect(MIGRATION).toContain(
      'comment on index public."IN_FKAVALIADORCOMPETENCIA_CO"',
    );
  });

  it("sem vínculo com o roteiro = avalia todas", () => {
    const avalia = MIGRATION.slice(
      MIGRATION.indexOf('create function private."FC_AVALIADOR_AVALIA"'),
      MIGRATION.indexOf(
        "$function$;",
        MIGRATION.indexOf('create function private."FC_AVALIADOR_AVALIA"'),
      ),
    );
    expect(avalia).toMatch(/select not exists \(/);
    expect(avalia).toContain('k."CO_ROTEIRO" = alvo."CO_ROTEIRO"');
  });

  it("cálculo e lançamento passam pelo vínculo", () => {
    const calculo = corpoDaFuncao(
      MIGRATION,
      'CREATE OR REPLACE FUNCTION private."FC_CALCULAR_ENTREVISTA"',
    );
    expect(calculo.match(/private\."FC_AVALIADOR_AVALIA"/g)?.length).toBe(2);
    expect(calculo).toContain("having count(*) = v_qt_aspectos");
    const lancar = corpoDaFuncao(
      MIGRATION,
      "CREATE OR REPLACE FUNCTION public.lancar_notas_entrevista",
    );
    expect(lancar.match(/not private\."FC_AVALIADOR_AVALIA"/g)?.length).toBe(2);
    expect(lancar).toContain("using errcode = '23514'");
  });

  it("configurar: nulo = todas, valida, protege notas e a cobertura da banca", () => {
    const configurar = corpoDaFuncao(
      MIGRATION,
      "CREATE OR REPLACE FUNCTION public.configurar_entrevista_edital",
    );
    expect(configurar).toContain("not (b ? 'competencias')");
    expect(configurar).toContain(
      "if cardinality(v_comps) = v_qt_roteiro then v_comps := '{}'; end if;",
    );
    expect(configurar).toContain("já tem nota em");
    expect(configurar).toContain("ninguém avalia");
    expect(configurar).toContain('k."CO_ROTEIRO" <> v_roteiro');
  });

  it("payload e treinamento", () => {
    const obter = corpoDaFuncao(
      MIGRATION,
      "CREATE OR REPLACE FUNCTION public.obter_entrevistas_do_edital",
    );
    expect(obter).toContain(
      "'competencias', (select json_agg(l.\"CO_COMPETENCIA\"",
    );
    const treino = corpoDaFuncao(
      MIGRATION,
      'CREATE OR REPLACE FUNCTION private."FC_PREPARAR_TREINAMENTO_SI"',
    );
    expect(treino).toContain("'Trabalho em equipe'");
    expect(treino).toContain("'Avaliador Teste 2'");
  });

  it("rollback devolve as funções e tira a tabela", () => {
    expect(ROLLBACK).toContain(`drop table if exists public."${TABELA}";`);
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_AVALIADOR_AVALIA"(uuid, uuid);',
    );
    expect(
      ROLLBACK.indexOf('drop function if exists private."FC_AVALIADOR_AVALIA"'),
    ).toBeGreaterThan(
      ROLLBACK.indexOf(
        "CREATE OR REPLACE FUNCTION public.lancar_notas_entrevista",
      ),
    );
    expect(ROLLBACK.match(/FC_AVALIADOR_AVALIA"\(/g)?.length).toBe(1);
  });

  it("ensaio aplica o mesmo corpo da migration e termina em rollback", () => {
    expect(ENSAIO).toContain(corpoDaMigration(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
