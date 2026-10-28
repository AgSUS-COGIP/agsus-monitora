import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  "supabase/migrations/20261028100707_ativar_entrada_pre_classificacao.sql",
  "utf8",
);
const ROLLBACK = readFileSync(
  "supabase/rollback/20261028100707_ativar_entrada_pre_classificacao.sql",
  "utf8",
);

describe("ativação controlada da Pré-classificação", () => {
  it("possui bloco PL/pgSQL íntegro", () => {
    const delimitador = "$" + "$";
    expect(MIGRATION.split("do " + delimitador)).toHaveLength(2);
    expect(MIGRATION.split("\n" + delimitador + ";\n")).toHaveLength(2);
    expect(MIGRATION).not.toContain("\n$;\n");
  });

  it("recusa ativar uma entrada inexistente, já ativa ou com áreas incompletas", () => {
    expect(MIGRATION).toContain('"CO_VIEW" = \'pre-classificacao\'');
    expect(MIGRATION).toContain('"CO_RECURSO" = \'avaliacao_documental\'');
    expect(MIGRATION).toContain('"ST_ATIVO" = \'N\'');
    expect(MIGRATION).toContain('left join public."RL_ABA_AREA"');
    expect(MIGRATION).toContain('r."ST_ATIVO" <> \'S\'');
  });

  it("altera apenas o sinal de ativação da nova entrada", () => {
    const semComentarios = MIGRATION.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(semComentarios).toContain(
      'update public."TB_ABA"\n   set "ST_ATIVO" = \'S\'',
    );
    expect(semComentarios).not.toMatch(/\b(update|delete|insert)\s+public\."(TB_CANDIDATO|TB_ANALISE|TB_PRE_CLASSIFICACAO)"/i);
    expect(semComentarios).not.toMatch(/\b(grant|revoke|create\s+policy|alter\s+table)\b/i);
  });

  it("a reversão somente desativa a entrada e não muda dados", () => {
    expect(ROLLBACK).toContain('"ST_ATIVO" = \'N\'');
    expect(ROLLBACK).toContain('"CO_ABA" = \'pre-classificacao\'');
    expect(ROLLBACK).toContain('"CO_RECURSO" = \'avaliacao_documental\'');
    expect(ROLLBACK).not.toMatch(/\bdelete\s+from\b/i);
  });
});
