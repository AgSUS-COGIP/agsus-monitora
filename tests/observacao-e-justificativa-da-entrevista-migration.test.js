import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261008220000 (observação do avaliador e justificativa da banca;
  ensaio begin…rollback em supabase/ensaios/). Invariantes estáticas: tabela
  MAD com comentários e RLS, coluna da justificativa sem obrigatoriedade na
  tabela, o lançamento com a mesma assinatura aceitando as chaves novas,
  histórico em TH_ENTREVISTA_AVALIACAO, a recusa de INAPTO/Faltou sem
  justificativa depois do recálculo, o payload com os campos novos, rollback
  com os corpos de antes e ensaio com o mesmo corpo da migration.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008220000_observacao_e_justificativa_da_entrevista.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTES = ler(
  "supabase/migrations/20261008170000_avaliador_por_competencia.sql",
);
const TABELA = "TB_ENTREVISTA_OBSERVACAO_AVALIADOR";

const corpoDaMigration = (texto) =>
  texto
    .slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"))
    .trim();
const funcao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const LANCAR = "CREATE OR REPLACE FUNCTION public.lancar_notas_entrevista(";
const OBTER = "CREATE OR REPLACE FUNCTION public.obter_entrevistas_do_edital(";

describe("observação do avaliador e justificativa da banca (20261008220000)", () => {
  it("transação única, recarrega o esquema", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain("notify pgrst, 'reload schema';");
  });

  it("tabela MAD: chaves nomeadas, comentários, RLS, sem grant, cascata e limite de 1.000", () => {
    const bloco = MIGRATION.slice(
      MIGRATION.indexOf(`create table public."${TABELA}" (`),
      MIGRATION.indexOf("\n);", MIGRATION.indexOf(`"${TABELA}" (`)),
    );
    expect(bloco).toContain(`constraint "PK_${TABELA}" primary key`);
    for (const [, coluna] of bloco.matchAll(/^\s+"([A-Z_]+)" /gm))
      expect(MIGRATION).toContain(
        `comment on column public."${TABELA}"."${coluna}"`,
      );
    for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g))
      expect(MIGRATION).toContain(`comment on constraint "${nome}"`);
    expect(bloco.match(/on delete cascade/g)).toHaveLength(2);
    expect(bloco).toContain('length("DS_OBSERVACAO") <= 1000');
    expect(MIGRATION).toContain(`comment on table public."${TABELA}"`);
    expect(MIGRATION).toContain(
      `alter table public."${TABELA}" enable row level security;`,
    );
    expect(MIGRATION).toContain(`revoke all on public."${TABELA}"`);
    expect(MIGRATION).not.toMatch(/grant [^;]*OBSERVACAO_AVALIADOR/i);
    expect(MIGRATION).toContain(
      'comment on index public."IN_FKOBSERVACAOAVALIADOR_AV"',
    );
  });

  it("a justificativa é coluna opcional (a obrigatoriedade é do lançamento, não da tabela)", () => {
    expect(MIGRATION).toContain(
      'alter table public."TB_ENTREVISTA" add column "DS_JUSTIFICATIVA_BANCA" text;',
    );
    expect(MIGRATION).toContain(
      'comment on column public."TB_ENTREVISTA"."DS_JUSTIFICATIVA_BANCA"',
    );
    expect(MIGRATION).toContain(
      'comment on constraint "CK_ENTREVISTA_DSJUSTIFICATIVABANCA"',
    );
    expect(MIGRATION).not.toMatch(/"DS_JUSTIFICATIVA_BANCA" text not null/);
    expect(MIGRATION).not.toMatch(
      /update public\."TB_ENTREVISTA" set "DS_JUSTIFICATIVA_BANCA" = '/,
    );
  });

  it("o lançamento mantém a assinatura, aceita as chaves novas e grava o histórico", () => {
    const lancar = funcao(MIGRATION, LANCAR);
    expect(lancar).toContain(
      "public.lancar_notas_entrevista(p_entrevista uuid, p_dados jsonb)",
    );
    expect(lancar).toContain("p_dados -> 'observacoes'");
    expect(lancar).toContain("if p_dados ? 'justificativa' then");
    expect(lancar).toMatch(/'observacao', v_obs_ant, v_obs_nova/);
    expect(lancar).toMatch(/'justificativa', e\."DS_JUSTIFICATIVA_BANCA"/);
    // Tudo o que já existia no lançamento continua (só se acrescenta).
    const antes = funcao(ANTES, LANCAR);
    const trecho = antes.slice(
      antes.indexOf("begin\n  select * into v_e"),
      antes.indexOf('  perform private."FC_CALCULAR_ENTREVISTA"'),
    );
    expect(lancar).toContain(trecho);
  });

  it("INAPTO ou Faltou sem justificativa é recusado depois do recálculo (23514)", () => {
    const lancar = funcao(MIGRATION, LANCAR);
    const calculo = lancar.indexOf('perform private."FC_CALCULAR_ENTREVISTA"');
    const regra = lancar.indexOf(
      `(v_final."TP_PARECER" = 'INAPTO' or v_final."ST_COMPARECEU" = 'N') and v_final."DS_JUSTIFICATIVA_BANCA" is null`,
    );
    expect(regra).toBeGreaterThan(calculo);
    expect(lancar).toContain("errcode = '23514'");
    expect(lancar).toContain("obrigatória quando o parecer é Inapto");
    expect(lancar).toContain("obrigatória quando o candidato falta");
  });

  it("o payload traz a justificativa e as observações", () => {
    const obter = funcao(MIGRATION, OBTER);
    expect(obter).toContain(`'justificativa', e."DS_JUSTIFICATIVA_BANCA"`);
    expect(obter).toContain(`'observacoes', coalesce((select json_agg(`);
  });

  it("rollback com os corpos de antes; ensaio com o mesmo corpo da migration", () => {
    expect(funcao(ROLLBACK, LANCAR)).toBe(funcao(ANTES, LANCAR));
    expect(funcao(ROLLBACK, OBTER)).toBe(funcao(ANTES, OBTER));
    expect(ROLLBACK).toContain(`drop table public."${TABELA}";`);
    expect(ROLLBACK).toContain('drop column "DS_JUSTIFICATIVA_BANCA";');
    expect(ENSAIO).toContain(corpoDaMigration(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    for (const passo of ["E1", "E2", "E3", "E4", "E5", "E6"])
      expect(ENSAIO).toContain(`FALHOU ${passo}`);
  });
});
