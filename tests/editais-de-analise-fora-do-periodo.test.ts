import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Migration 20261111150000: o edital de análise com o período encerrado
  (data_fim_analise antes de hoje em Brasília) fica inativo, mesmo com SIM na
  planilha (11/11/2026: 112, 116 e 117/2026 contavam como ausentes no incremental).
  O teste confere o trio sem banco.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME =
  "20261111150000_editais_de_analise_fora_do_periodo_ficam_inativos.sql";
const ler = (pasta: string) =>
  fs.readFileSync(path.join(RAIZ, "supabase", pasta, NOME), "utf8");
const migration = ler("migrations");
const rollback = ler("rollback");
const ensaio = ler("ensaios");

function objetos(sql: string): string {
  const de = sql.indexOf("-- [objetos]");
  const ate = sql.indexOf("-- [/objetos]");
  expect(de, "início do bloco").toBeGreaterThanOrEqual(0);
  expect(ate, "fim do bloco").toBeGreaterThan(de);
  return sql.slice(de, ate);
}

const TAREFA = "agsus_analises_inativar_editais_encerrados";

describe("migration 20261111150000 (editais de análise fora do período)", () => {
  it("o ensaio cria os mesmos objetos da migration e termina em rollback", () => {
    expect(objetos(ensaio)).toBe(objetos(migration));
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("encerrado é o fim antes de hoje em Brasília, fora o edital avaliado no Yeendé", () => {
    const bloco = objetos(migration);
    expect(bloco).toContain(
      "p_fim < (now() at time zone 'America/Sao_Paulo')::date",
    );
    expect(bloco).toContain("p_fim is not null");
    expect(bloco).toContain(
      'not public."FC_EDITAL_ANALISE_NO_MONITORA"(p_planilha, p_edital)',
    );
  });

  it("o gatilho força NÃO e descarta a regravação sem mudança", () => {
    const bloco = objetos(migration);
    expect(bloco).toContain(
      'before insert or update on public."TB_EDITAL_ANALISE"',
    );
    expect(bloco).toContain("new.ativo := false;");
    const forca = bloco.indexOf("new.ativo := false;");
    const descarta = bloco.indexOf("return null;");
    expect(descarta).toBeGreaterThan(forca);
    // Compara sem updated_at: a carga sempre manda updated_at=now().
    const comparacao = bloco.slice(forca, descarta);
    expect(comparacao).not.toContain("updated_at");
    expect(comparacao).toContain("is not distinct from");
  });

  it("a tarefa diária é às 00:10 de Brasília, sem chave e no catálogo", () => {
    const bloco = objetos(migration);
    expect(bloco).toContain(`'${TAREFA}',\n  '10 3 * * *'`);
    expect(bloco).toMatch(
      new RegExp(`values \\('${TAREFA}', 'N',\\s+'[^']+', null, null\\)`),
    );
  });

  it("a migration roda a inativação uma vez, com teto; o rollback desfaz tudo", () => {
    expect(migration).toContain(
      'v_inativados integer := private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"();',
    );
    expect(migration).toContain("if v_inativados > 10 then");
    for (const trecho of [
      `cron.unschedule('${TAREFA}')`,
      `delete from public."TB_TAREFA_AGENDADA" where "NO_TAREFA" = '${TAREFA}'`,
      'drop trigger "TG_EDITALANALISE_PERIODO" on public."TB_EDITAL_ANALISE";',
      'drop function private."FC_TG_PERIODO_EDITAL_ANALISE"();',
      'drop function private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"();',
      'drop function private."FC_EDITAL_ANALISE_ENCERRADO"(text, text, date);',
    ])
      expect(rollback).toContain(trecho);
  });

  it("as funções novas não ficam abertas ao público", () => {
    for (const assinatura of [
      'private."FC_EDITAL_ANALISE_ENCERRADO"(text, text, date)',
      'private."FC_TG_PERIODO_EDITAL_ANALISE"()',
      'private."FC_INATIVAR_EDITAIS_ANALISE_ENCERRADOS"()',
    ])
      expect(migration).toContain(
        `revoke all on function ${assinatura} from public;`,
      );
  });
});
