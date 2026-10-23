import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  O seletor de editais da Classificação só com os editais analisados
  (20261023120000). Invariantes estáticas: o filtro (análise ativa de qualquer
  origem ou lista gerada), a ordem, a assinatura e as permissões de antes; o
  ensaio com o mesmo corpo e terminando em rollback; o rollback com a função
  de 20261008180000 inteira.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261023120000_classificacao_so_editais_analisados.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261008180000_nome_das_versoes_das_regras.sql",
);
const CABECA =
  "create or replace function public.listar_editais_classificacao(p_area text)";
const funcao = (sql) => {
  const inicio = sql.indexOf(CABECA);
  expect(inicio).toBeGreaterThan(-1);
  return sql.slice(inicio, sql.indexOf("$function$;", inicio) + 11);
};
const corpo = (sql) =>
  sql.slice(sql.indexOf("\nbegin;\n") + 8, sql.lastIndexOf("\ncommit;")).trim();

describe("Classificação: só editais analisados no seletor", () => {
  it("entra o edital com análise ativa (qualquer origem) ou com lista gerada", () => {
    const f = funcao(MIGRATION);
    expect(f).toContain(`where a."CO_AREA" = p_area and a.ativo`);
    expect(f).not.toMatch(/TP_ORIGEM_REGISTRO/);
    expect(f).toContain("where coalesce(an.qt, 0) > 0 or ul.id is not null");
  });

  it("ordem: ativo, fora do treinamento, em andamento antes de encerrado, número", () => {
    const f = funcao(MIGRATION);
    expect(f).toContain(
      "order by m.ativo desc, m.treinamento, m.encerrado, m.edital",
    );
    expect(f).toContain(
      `coalesce(m.status, '') in ('Concluído', 'Cancelado') as encerrado`,
    );
  });

  it("mesma assinatura, permissões, recorte e campos de antes", () => {
    const f = funcao(MIGRATION);
    for (const trecho of [
      "security definer",
      "set search_path to ''",
      "private.pode_recurso('classificacao', 1)",
      `private."FC_PODE_AREA"(p_area)`,
      `private."FC_EDITAIS_VISIVEIS"()`,
      "'pode_editar', private.pode_recurso('classificacao', 2)",
      "'candidatos', coalesce(an.qt, 0)",
      `'nome_regra', h."NO_VERSAO"`,
      "'ultima_lista', ul.lista",
    ])
      expect(f).toContain(trecho);
    expect(MIGRATION).toContain(
      "comment on function public.listar_editais_classificacao(text) is",
    );
    expect(CONTRATO_RPC.listar_editais_classificacao.argumentos).toEqual([
      "p_area",
    ]);
  });

  it("ensaio com o mesmo corpo da migration, lido como usuário e terminando em rollback", () => {
    const abre = "═══ CORPO DA MIGRATION (início) ═══\n";
    const doEnsaio = ENSAIO.slice(
      ENSAIO.indexOf(abre) + abre.length,
      ENSAIO.indexOf("\n-- ═══ CORPO DA MIGRATION (fim)"),
    ).trim();
    expect(doEnsaio).toBe(corpo(MIGRATION));
    expect(ENSAIO).toContain("set local role authenticated;");
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\bcommit;/);
  });

  it("rollback volta a função de 20261008180000 inteira", () => {
    expect(funcao(ROLLBACK)).toBe(funcao(ANTERIOR));
    expect(ROLLBACK.trim().endsWith("commit;")).toBe(true);
  });
});
