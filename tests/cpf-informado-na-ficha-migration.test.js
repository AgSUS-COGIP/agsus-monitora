import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cpfDaFicha } from "../src/lib/avaliacao-documental/cpf-da-ficha.ts";

/*
  Migration 20261015050000: obter_ficha_analise devolve cpf_informado (a
  resposta do candidato à pergunta do CPF no questionário da Empregare, de
  DS_COLUNA_ORIGINAL), e o cabeçalho da ficha mostra formatado
  (cpfDaFicha). Mesma permissão; o resto da função não muda.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261015050000_cpf_informado_na_ficha.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

describe("CPF informado na ficha", () => {
  it("a função ganha só a chave cpf_informado, lida da pergunta do CPF", () => {
    expect(MIGRATION).toContain(
      "'cpf_informado', (select nullif(btrim(e.value), '')",
    );
    expect(MIGRATION).toContain("e.key ~* '^\\s*pergunta' and e.key ~* 'cpf'");
    expect(MIGRATION).toContain(
      'v_papel := private."FC_EXIGIR_VER_FICHA"(v_f);',
    );
    expect(MIGRATION).toMatch(/^begin;$/m);
    expect(MIGRATION).toMatch(/^commit;$/m);
    // O rollback é a função de antes, sem a chave.
    expect(ROLLBACK).toContain(
      "CREATE OR REPLACE FUNCTION public.obter_ficha_analise",
    );
    expect(ROLLBACK.split("$function$")[1]).not.toContain("cpf_informado");
    expect(ENSAIO).toContain("cpf_informado");
  });

  it("o cabeçalho formata 000.000.000-00; outra coisa vai como veio; vazio, nada", () => {
    expect(cpfDaFicha("12345678909")).toBe("123.456.789-09");
    expect(cpfDaFicha(" 123.456.789-09 ")).toBe("123.456.789-09");
    expect(cpfDaFicha("123456")).toBe("123456");
    expect(cpfDaFicha("")).toBeNull();
    expect(cpfDaFicha(null)).toBeNull();
    expect(cpfDaFicha(12345678909)).toBeNull();
  });
});
