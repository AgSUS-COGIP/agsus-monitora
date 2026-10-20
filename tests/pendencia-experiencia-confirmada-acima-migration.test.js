import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261020180000 (ainda não aplicada; ensaio begin…rollback em
  supabase/ensaios/): FC_PENDENCIAS_FICHA pede, como pendenciasDaFicha
  (ficha.js, tipo "acima"), que a experiência Conforme com a parcial acima
  da calculada pelos vínculos aceitos seja corrigida — só passa com Editar
  nota e justificativa. Aqui, as invariantes estáticas: só a regra nova é
  acrescentada à definição vigente (que o rollback devolve), o ensaio leva o
  mesmo corpo e termina em rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261020180000_pendencia_experiencia_confirmada_acima.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261020100000_pendencia_experiencia_nao_confere_com_vinculos.sql",
);
const FICHA = ler("src/lib/avaliacao-documental/ficha.js");

const funcao = (sql) => {
  const ini = sql.search(/function private."FC_PENDENCIAS_FICHA"/i);
  return sql.slice(
    ini,
    sql.indexOf("$function$", sql.indexOf("$function$", ini) + 1),
  );
};
const normal = (s) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
const REGRA_NOVA =
  /\n {4}-- Experiência Conforme com a pontuação acima[\s\S]*?\n {4}end if;\n/;

describe("experiência confirmada acima do que os vínculos aceitos comprovam", () => {
  it("só troca FC_PENDENCIAS_FICHA, sem \r, com a regra nova", () => {
    expect(MIGRATION).not.toContain("\r");
    expect(MIGRATION.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(1);
    expect(MIGRATION).not.toMatch(/alter table|create table|drop /i);
    const nova = funcao(MIGRATION).match(REGRA_NOVA)?.[0] ?? "";
    expect(nova).toContain(
      "v_bloco ->> 'tipo' = 'VINCULOS' and v_l ->> 'situacao' = 'CONFORME'",
    );
    expect(nova).toContain(
      "array['calculados', private.\"FC_PARCIAL_DO_TIPO\"('VINCULOS')]",
    );
    expect(nova).toContain("v_l -> 'edita_nota' = 'true'::jsonb");
    expect(nova).toContain("experiência confirmada com");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) from public, anon, authenticated;',
    );
    expect(MIGRATION).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
  });

  it("acrescenta só a regra nova à definição vigente (a do rollback, a de 20261020100000)", () => {
    const nova = funcao(MIGRATION);
    expect(nova).toMatch(REGRA_NOVA);
    expect(nova.replace(REGRA_NOVA, "\n")).toBe(funcao(ROLLBACK));
    expect(funcao(ROLLBACK)).toBe(funcao(ANTERIOR));
    expect(ROLLBACK).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(ROLLBACK).not.toContain("experiência confirmada com");
  });

  it("o ensaio leva o mesmo corpo, só lê e termina em rollback", () => {
    expect(normal(funcao(ENSAIO))).toBe(normal(funcao(MIGRATION)));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).not.toMatch(/\b(update|insert|delete)\b\s/i);
    expect(ENSAIO).toContain("bcecfb08-88ef-4e06-8401-bcad6bf88fd0");
  });

  it("a tela pede o mesmo (pendenciasDaFicha, tipo acima)", () => {
    expect(FICHA).toContain('falta(\n          "acima",');
    expect(FICHA).toContain("objeto(lancado).edita_nota === true &&");
    expect(FICHA).toContain("avaliacao?.calculados?.[parcial]");
  });
});
