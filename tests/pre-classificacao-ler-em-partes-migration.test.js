import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Invariantes da migration 20261014110000 (o job da pré-classificação lê em
  partes): pre_classificacao_ler_editais só com os metadados das vagas e
  pre_classificacao_ler_candidatos em partes, com a vaga (cargo e quadro) na
  primeira — o 114/2026 estourava o statement_timeout de 8 s numa chamada só.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014110000_pre_classificacao_ler_em_partes.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const JOB = ler("scripts/pre_classificacao/pre_classificacao.py");

const funcao = (texto, nome) => {
  const re = new RegExp(
    `create (or replace )?function ${nome.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&")}\\(`,
    "i",
  );
  const inicio = texto.search(re);
  expect(inicio).toBeGreaterThanOrEqual(0);
  const corpo = texto.slice(inicio);
  const delim = corpo.match(/as (\$[a-z]*\$)/i)[1];
  const abre = corpo.indexOf(delim);
  return corpo.slice(
    0,
    corpo.indexOf(delim, abre + delim.length) + delim.length,
  );
};

describe("a migration", () => {
  it("transação com lock_timeout", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout = '10s';");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("ler_editais fica leve: sem a linha do quadro de cada vaga", () => {
    const nova = funcao(MIGRATION, "public.pre_classificacao_ler_editais");
    expect(nova).not.toContain("FC_QUADRO_DA_VAGA_EMPREGARE");
    expect(nova).not.toContain("'quadro'");
    expect(nova).not.toContain("'cargo'");
    for (const chave of [
      "'situacao_carga', v.\"TP_SITUACAO\"",
      "'candidatos_ativos', v.\"QT_CANDIDATO_ATIVO\"",
      "'ultimo_lote', coalesce(pv.\"NU_ULTIMO_LOTE\", 0)",
      "'refazer_permitido', fi.n = 0",
      "'documental', private.\"FC_DOCUMENTAL_DO_EDITAL\"(m.id)",
    ])
      expect(nova).toContain(chave);
  });

  it("ler_candidatos em partes, na ordem do id, com a vaga na primeira", () => {
    const nova = funcao(MIGRATION, "public.pre_classificacao_ler_candidatos");
    expect(MIGRATION).toContain(
      "drop function if exists public.pre_classificacao_ler_candidatos(uuid, text);",
    );
    expect(nova).toContain(
      "p_edital uuid, p_vaga text, p_apos uuid default null, p_limite integer default null)",
    );
    expect(nova).toContain(
      '(p_apos is null or c."CO_EMPREGARE_CANDIDATO" > p_apos)',
    );
    expect(nova).toContain("limit p_limite + 1");
    expect(nova).toContain("p_limite is not null and count(*) > p_limite");
    expect(nova).toContain("(p_limite < 1 or p_limite > 5000)");
    expect(nova).toContain(
      'private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga)',
    );
    // anterior, decisões e vaga só na primeira parte
    expect(nova.indexOf("if p_apos is not null then")).toBeLessThan(
      nova.indexOf("'vaga', (select jsonb_build_object("),
    );
    // as colunas do cadastro continuam fora
    expect(nova).toContain(
      "(nome|e-?mail|cpf|telefone|celular|whatsapp|endere|logradouro|bairro|cep|nascimento|linkedin|^rg$|documento)",
    );
  });

  it("só o service_role executa a nova assinatura", () => {
    const assinatura =
      "public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer)";
    expect(MIGRATION).toContain(
      `revoke all on function ${assinatura} from public, anon, authenticated;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${assinatura} to service_role;`,
    );
    expect(MIGRATION).toContain(`comment on function ${assinatura} is`);
  });
});

describe("o rollback", () => {
  it("volta o quadro a ler_editais e a leitura de uma vez", () => {
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    expect(funcao(ROLLBACK, "public.pre_classificacao_ler_editais")).toContain(
      'private."FC_QUADRO_DA_VAGA_EMPREGARE"(m.id, v."CO_VAGA")',
    );
    expect(ROLLBACK).toContain(
      "drop function if exists public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer);",
    );
    expect(ROLLBACK).toContain(
      "CREATE FUNCTION public.pre_classificacao_ler_candidatos(p_edital uuid, p_vaga text)",
    );
    expect(ROLLBACK).toContain(
      "grant execute on function public.pre_classificacao_ler_candidatos(uuid, text) to service_role;",
    );
  });
});

describe("o ensaio e o job", () => {
  it("o ensaio confere em partes = de uma vez e não grava", () => {
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).toContain("ENSAIO 3: vaga % em partes (%) ≠ de uma vez (%)");
    expect(ENSAIO).toContain("ENSAIO 2: vaga % com cargo/quadro diferente");
    expect(ENSAIO).toContain("jsonb_array_length(v_lido -> 'vagas') <> 30");
  });

  it("o job lê cada vaga em partes e junta a vaga lida", () => {
    expect(JOB).toContain("TAMANHO_DA_PARTE = 500");
    expect(JOB).toContain('"p_apos": apos');
    expect(JOB).toContain('vaga = {**vaga, **(lidos.get("vaga") or {})}');
  });
});
