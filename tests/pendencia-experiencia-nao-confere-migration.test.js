import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261020100000 (ainda não aplicada; ensaio begin…rollback em
  supabase/ensaios/): FC_PENDENCIAS_FICHA pede, como pendenciasDaFicha
  (ficha.js, tipo "minimo"), que a experiência Não conforme com os vínculos
  aceitos cumprindo o mínimo que elimina seja desfeita. Aqui, as invariantes
  estáticas: só a regra nova é acrescentada à definição vigente (que o
  rollback devolve), o ensaio leva o mesmo corpo e termina em rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME =
  "20261020100000_pendencia_experiencia_nao_confere_com_vinculos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
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
  /\n {4}-- Experiência Não conforme com os vínculos aceitos[\s\S]*?\n {4}end if;\n/;

describe("experiência Não confere com os vínculos aceitos cumprindo o mínimo", () => {
  it("só troca FC_PENDENCIAS_FICHA, sem \\r, com a regra nova", () => {
    expect(MIGRATION).not.toContain("\r");
    expect(MIGRATION.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(1);
    expect(MIGRATION).not.toMatch(/alter table|create table|drop /i);
    const nova = funcao(MIGRATION);
    expect(nova).toContain(
      "v_bloco ->> 'tipo' = 'VINCULOS' and v_l ->> 'situacao' = 'NAO_CONFORME'",
    );
    expect(nova).toContain(
      "coalesce(v_bloco ->> 'efeito_minimo', 'ELIMINA') = 'ELIMINA'",
    );
    expect(nova).toContain(">= (v_bloco ->> 'minimo_meses')::numeric then");
    expect(nova).toContain("'meses_considerados' else 'meses'");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) from public, anon, authenticated;',
    );
    expect(MIGRATION).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
  });

  it("acrescenta só a regra nova à definição vigente (a do rollback)", () => {
    const nova = funcao(MIGRATION);
    expect(nova).toMatch(REGRA_NOVA);
    expect(nova.replace(REGRA_NOVA, "\n")).toBe(funcao(ROLLBACK));
    expect(ROLLBACK).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n?$/);
    expect(ROLLBACK).not.toContain("NAO_CONFORME' and");
  });

  it("o ensaio leva o mesmo corpo, só lê e termina em rollback", () => {
    expect(normal(funcao(ENSAIO))).toBe(normal(funcao(MIGRATION)));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).not.toMatch(/\b(update|insert|delete)\b\s/i);
    expect(ENSAIO).toContain("bcecfb08-88ef-4e06-8401-bcad6bf88fd0");
  });

  it("a tela pede o mesmo (pendenciasDaFicha, tipo minimo)", () => {
    expect(FICHA).toContain('l.situacao === "NAO_CONFORME" && meses >= minimo');
    expect(FICHA).toContain('(bloco.efeito_minimo ?? "ELIMINA") === "ELIMINA"');
  });
});
