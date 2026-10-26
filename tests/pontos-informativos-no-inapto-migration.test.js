import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validarRegraAnalise } from "../src/lib/avaliacao-documental/regra.ts";

/*
  Migration 20261014170000: a pontuação dos títulos no inapto por requisito,
  só informativa (parecer.mostrar_pontos_quando_inapto). Ensaio
  (begin…rollback) em supabase/ensaios/ com a regra vigente do 114/2026, e a
  correção que liga a opção numa versão nova (sem aplicar).
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014170000_pontos_informativos_no_inapto.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CORRECAO = ler(
  "supabase/correcoes/20261014-edital-114-pontos-informativos.sql",
);
const CASOS = JSON.parse(
  ler("tests/fixtures/avaliacao-documental/casos-de-pontuacao.json"),
);

describe("pontuação informativa no inapto por requisito", () => {
  it("a regra aceita a opção (sim ou não) e o modelo da linha", () => {
    expect(MIGRATION).toMatch(
      /create or replace function private\."FC_VALIDAR_REGRA_ANALISE"\(p_regra jsonb\)/i,
    );
    expect(MIGRATION).toContain(
      `private."FC_JSON_SIM_NAO_OK"(v_obj, 'mostrar_pontos_quando_inapto')`,
    );
    expect(MIGRATION).toContain(
      `private."FC_JSON_TEXTO_OK"(v_obj -> 'pontos_informativos', false, 4000)`,
    );
    // As validações de antes continuam (diferenças por cargo no fim).
    expect(MIGRATION).toContain(
      'perform private."FC_VALIDAR_POR_CARGO_ANALISE"(p_regra);',
    );
  });

  it("o resultado: informativa só com a opção no inapto, obrigatória nele e igual à apurada", () => {
    expect(MIGRATION).toMatch(
      /create or replace function private\."FC_VALIDAR_RESULTADO_FICHA"\(p_regra jsonb, p_lanc jsonb, p_res jsonb, p_documental jsonb\)/i,
    );
    expect(MIGRATION).toContain(
      "v_mostra boolean := coalesce((p_regra #> '{parecer,mostrar_pontos_quando_inapto}') = 'true'::jsonb, false);",
    );
    expect(MIGRATION).toContain("falta a pontuação informativa");
    expect(MIGRATION).toContain(
      "abs((v_informativa ->> 'nota')::numeric - v_apurada) > 0.001",
    );
    expect(MIGRATION).toContain(
      "(v_informativa -> 'parciais') is distinct from coalesce(p_res -> 'parciais', '{}'::jsonb)",
    );
    // A nota final continua 0 no inapto por requisito.
    expect(MIGRATION).toContain(
      "case when v_resultado = 'INAPTO_REQUISITO' then 0 else v_apurada end",
    );
    for (const f of [
      'private."FC_VALIDAR_REGRA_ANALISE"(jsonb)',
      'private."FC_VALIDAR_RESULTADO_FICHA"(jsonb, jsonb, jsonb, jsonb)',
    ])
      expect(MIGRATION).toContain(
        `revoke all on function ${f} from public, anon, authenticated;`,
      );
    expect(MIGRATION.trim().endsWith("commit;")).toBe(true);
  });

  it("rollback volta as duas funções sem a opção; ensaio com os dez casos", () => {
    expect(ROLLBACK).toMatch(/FC_VALIDAR_REGRA_ANALISE/);
    expect(ROLLBACK).toMatch(/FC_VALIDAR_RESULTADO_FICHA/);
    expect(ROLLBACK).not.toContain("mostrar_pontos_quando_inapto");
    for (const caso of [
      "regra vigente",
      "regra com a opção",
      "opção em texto",
      "modelo longo demais",
      "sem a opção, sem a informativa",
      "com a opção, informativa 10",
      "com a opção, sem a informativa",
      "sem a opção, com a informativa",
      "informativa 12",
      "apto com a informativa",
    ])
      expect(ENSAIO).toContain(`'${caso}'`);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });

  it("a correção do 114 cria versão nova a partir da vigente, com a opção válida", () => {
    expect(CORRECAO).toContain('v_regra."NU_VERSAO_VIGENTE" + 1');
    expect(CORRECAO).toContain(`'mostrar_pontos_quando_inapto', true`);
    expect(CORRECAO).toContain(
      'perform private."FC_VALIDAR_REGRA_ANALISE"(v_nova);',
    );
    expect(CORRECAO).toContain(`"TP_SITUACAO" = 'CONFERIR'`);
    // A regra do 114 (cópia dos casos dourados) com a opção passa na validação da tela.
    const regra = structuredClone(CASOS.regras["E114-POR-CARGO"]);
    regra.parecer = {
      ...regra.parecer,
      ...CASOS.casos.find((c) => c.parecer_da_regra).parecer_da_regra,
    };
    expect(validarRegraAnalise(regra)).toEqual([]);
    expect(
      validarRegraAnalise({
        ...regra,
        parecer: { ...regra.parecer, mostrar_pontos_quando_inapto: "sim" },
      }),
    ).toContain(
      "Parecer: mostrar a pontuação dos títulos no inapto é sim ou não.",
    );
  });
});
