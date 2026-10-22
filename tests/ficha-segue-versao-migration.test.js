import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A ficha da avaliação documental guardava a versão da regra com que o
  inscrito entrou no lote: no 93/2026 a ficha aberta mostrava "Regra v2" com a
  v4 conferida e a pré-classificação recalculada. A migration
  20261007110000 faz FC_ABRIR_FICHAS (o job, no fim de cada edital, e
  abrir_fichas_do_edital) levar a ficha não concluída à versão da
  pré-classificação atual e corrige as fichas que já estão no banco; a
  concluída mantém a versão com que foi analisada (AM-2.3, fase F4). Ensaio
  begin…rollback em supabase/ensaios/ e rollback em supabase/rollback/.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007110000_ficha_segue_versao_da_pre_classificacao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const F3 = ler("supabase/migrations/20261006120000_fichas_fila_e_reserva.sql");

const CABECA = 'function private."FC_ABRIR_FICHAS"(p_edital uuid';
const corpo = (texto) => {
  const inicio = texto.indexOf(CABECA);
  expect(inicio).toBeGreaterThan(-1);
  return texto.slice(
    inicio,
    texto.indexOf("$function$;", texto.indexOf("as $function$", inicio)) + 11,
  );
};
const semEspacos = (texto) => texto.replace(/\s+/g, " ");
const SINCRONIA =
  /update public\."TB_FICHA_ANALISE" f\s+set "NU_VERSAO_REGRA" = p\."NU_VERSAO_REGRA", "DT_ATUALIZACAO" = now\(\)\s+from public\."TB_PRE_CLASSIFICACAO" p\s+where p\."CO_MONITORAMENTO" = f\."CO_MONITORAMENTO" and p\."CO_EMPREGARE_CANDIDATO" = f\."CO_EMPREGARE_CANDIDATO"[\s\S]*?f\."TP_SITUACAO" <> 'CONCLUIDA'\s+and f\."NU_VERSAO_REGRA" is distinct from p\."NU_VERSAO_REGRA";/;

describe("a ficha segue a versão da regra do último recálculo", () => {
  it("FC_ABRIR_FICHAS leva a ficha não concluída à versão da pré-classificação, antes de abrir e fechar fichas", () => {
    const f = corpo(MIGRATION);
    expect(MIGRATION).toContain(`create or replace ${CABECA}`);
    expect(f).toMatch(SINCRONIA);
    expect(f).toContain('and f."CO_MONITORAMENTO" = p_edital');
    expect(f.indexOf('set "NU_VERSAO_REGRA"')).toBeLessThan(
      f.indexOf("-- Saem do lote"),
    );
    // A versão da regra não é situação, responsável nem reserva: a versão
    // otimista da ficha não sobe só por isso.
    const sincronia = f.slice(
      f.indexOf('set "NU_VERSAO_REGRA"'),
      f.indexOf("-- Saem do lote"),
    );
    expect(sincronia).not.toContain('"NU_VERSAO" =');
    expect(f).toContain("'regra_atualizada', v_regra_nova");
    expect(f).toContain("security definer");
    expect(f).toContain("set search_path to ''");
    expect(f).toContain("pg_advisory_xact_lock");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_ABRIR_FICHAS"(uuid, jsonb, uuid) from public, anon, authenticated;',
    );
  });

  it("o resto de FC_ABRIR_FICHAS é o de 20261006120000", () => {
    const tirar = (texto) =>
      semEspacos(
        texto
          .replace(SINCRONIA, "")
          .replace(/\n\s*-- Seguem o último recálculo:[^\n]*\n[^\n]*\n/, "\n")
          .replace(/\s*get diagnostics v_regra_nova = row_count;/, "")
          .replace(/\s*v_regra_nova integer := 0;/, "")
          .replace(", 'regra_atualizada', v_regra_nova", ""),
      );
    expect(tirar(corpo(MIGRATION))).toBe(semEspacos(corpo(F3)));
  });

  it("corrige as fichas já abertas pela mesma regra, sem tocar nas concluídas", () => {
    const correcao = MIGRATION.slice(
      MIGRATION.indexOf("-- 2. As fichas abertas antes do último recálculo"),
    );
    expect(correcao).toMatch(SINCRONIA);
    expect(correcao).not.toContain("p_edital");
    expect(MIGRATION.trim().startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trim().endsWith("commit;")).toBe(true);
  });

  it("o ensaio desfaz tudo e o rollback devolve a função de 20261006120000", () => {
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\bcommit;/);
    expect(ENSAIO).toContain(`supabase/migrations/${NOME}`);
    expect(ENSAIO).toContain("'regra_atualizada'");
    expect(semEspacos(corpo(ROLLBACK))).toBe(semEspacos(corpo(F3)));
    expect(ROLLBACK).toContain(`create or replace ${CABECA}`);
  });
});
