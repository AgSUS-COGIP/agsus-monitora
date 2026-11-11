import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Migration 20261111200000 (cartão #57): get_monitoramento_cronograma passa a
  devolver a validade do processo seletivo no objeto 'monitoramento'. O teste
  confere o trio sem banco: o corpo da migration é o do ensaio; o do rollback é
  o retrato de produção (supabase/esquema-atual.sql); as guardas usam os md5
  certos; e só entraram as três chaves.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261111200000_formulario_do_edital_le_a_validade.sql";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8");

const migration = ler(`supabase/migrations/${NOME}`);
const rollback = ler(`supabase/rollback/${NOME}`);
const ensaio = ler(`supabase/ensaios/${NOME}`);
const retrato = ler("supabase/esquema-atual.sql");

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

/** O corpo entre `as $$` e `$$;` (o prosrc que o Postgres guarda). */
function corpo(sql: string, marcaDeInicio = "as $$"): string {
  const inicio = sql.indexOf(marcaDeInicio);
  expect(inicio, "corpo da função").toBeGreaterThanOrEqual(0);
  const de = inicio + marcaDeInicio.length;
  return sql.slice(de, sql.indexOf("$$;", de));
}

const ANTES = "19cdcd4a6520bfcc7b606e2961b0fc9c";
const corpoDoRetrato = corpo(
  retrato.slice(
    retrato.indexOf(
      "CREATE FUNCTION public.get_monitoramento_cronograma(p_monitoramento_id uuid) RETURNS jsonb",
    ),
  ),
  "AS $$",
);
const corpoNovo = corpo(migration);
const DEPOIS = md5(corpoNovo);

const LINHAS_NOVAS = [
  "        'cronograma_ultima_errata', m.cronograma_ultima_errata,",
  "        -- Validade do processo seletivo (20261111200000): o formulário do edital lê e devolve.",
  "        'nu_anos_validade', m.\"NU_ANOS_VALIDADE\",",
  "        'nu_meses_validade', m.\"NU_MESES_VALIDADE\",",
  "        'st_prorrogado', m.\"ST_PRORROGADO\"",
];

describe("migration 20261111200000 (formulário do edital lê a validade)", () => {
  it("o rollback volta ao corpo do retrato de produção, sem COMMENT", () => {
    expect(md5(corpoDoRetrato)).toBe(ANTES);
    expect(corpo(rollback)).toBe(corpoDoRetrato);
    expect(rollback).toContain(
      "comment on function public.get_monitoramento_cronograma(uuid) is null;",
    );
    expect(retrato).not.toMatch(
      /COMMENT ON FUNCTION public\.get_monitoramento_cronograma\(p_monitoramento_id uuid\)/,
    );
  });

  it("o ensaio aplica exatamente o corpo da migration e termina em rollback", () => {
    expect(corpo(ensaio)).toBe(corpoNovo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("as guardas usam os md5 de antes e de depois", () => {
    for (const sql of [migration, rollback, ensaio]) {
      expect(sql).toContain(`'${ANTES}'`);
      expect(sql).toContain(`'${DEPOIS}'`);
    }
  });

  it("só entram as três chaves da validade; o resto é o corpo de antes", () => {
    const linhas = corpoNovo.split("\n");
    for (const linha of LINHAS_NOVAS) expect(linhas).toContain(linha);
    const semAsNovas = linhas
      .filter((linha) => !LINHAS_NOVAS.includes(linha))
      .join("\n");
    const semAAntiga = corpoDoRetrato
      .split("\n")
      .filter(
        (linha) =>
          linha !==
          "        'cronograma_ultima_errata', m.cronograma_ultima_errata",
      )
      .join("\n");
    expect(semAsNovas).toBe(semAAntiga);
  });

  it("mesma assinatura e search_path; COMMENT novo; sem grant nem revoke", () => {
    for (const sql of [migration, ensaio])
      expect(sql).toContain(
        "create or replace function public.get_monitoramento_cronograma(p_monitoramento_id uuid)\n returns jsonb\n language plpgsql\n stable security definer\n set search_path to ''",
      );
    expect(migration).toMatch(
      /comment on function public\.get_monitoramento_cronograma\(uuid\) is 'Leitura do formulário do edital/,
    );
    expect(migration).not.toMatch(/^\s*(grant|revoke)\b/im);
  });

  it("begin/commit na migration e no rollback", () => {
    expect(migration).toMatch(/^begin;$/m);
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(rollback).toMatch(/^begin;$/m);
    expect(rollback.trimEnd().endsWith("commit;")).toBe(true);
  });
});
