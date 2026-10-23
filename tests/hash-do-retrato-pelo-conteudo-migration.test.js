import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration do hash do retrato pelo conteúdo (20261024130000), ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/. Aqui, as
  invariantes estáticas: o hash passa a ser private."FC_HASH_RETRATO_CLASSIFICACAO"
  (sha256 do jsonb com os números sem zeros à direita) nas três funções que
  gravam o hash, cada uma com o corpo vigente e SÓ a linha do hash trocada;
  nenhum DS_HASH gravado muda; assinaturas e privilégios iguais; o ensaio
  confere 35 × 35.0, os exemplos da fixture e as listas do 114; o rollback
  volta aos corpos anteriores.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261024130000_hash_do_retrato_pelo_conteudo.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ETAPA_2B = ler(
  "supabase/migrations/20261023200000_classificacao_em_python_etapa_2b.sql",
);
const LOTE = ler(
  "supabase/migrations/20261007200000_inclusao_no_lote_por_decisao.sql",
);
const FIXTURE = JSON.parse(
  ler("tests/fixtures/classificacao/hash-dos-retratos.json"),
);

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** O corpo ($function$…$function$) da última definição da função no arquivo. */
function funcao(sql, nome) {
  const re = new RegExp(
    `create (or replace )?function ${nome.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&")}`,
    "g",
  );
  const inicios = [...sql.matchAll(re)];
  expect(inicios.length).toBeGreaterThan(0);
  const i = inicios.at(-1).index;
  const a = sql.indexOf("$function$", i) + "$function$".length;
  return sql.slice(a, sql.indexOf("$function$", a));
}

const FUNCOES = [
  {
    nome: 'private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(',
    antes: ETAPA_2B,
    linha: "encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex')",
    nova: 'private."FC_HASH_RETRATO_CLASSIFICACAO"(p_resultado)',
  },
  {
    nome: "public.classificacao_gravar_calculo(",
    antes: ETAPA_2B,
    linha: "encode(sha256(convert_to(p_retrato::text, 'UTF8')), 'hex')",
    nova: 'private."FC_HASH_RETRATO_CLASSIFICACAO"(p_retrato)',
  },
  {
    nome: "public.registrar_lista_pre_classificacao(",
    antes: LOTE,
    linha: "encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex')",
    nova: 'private."FC_HASH_RETRATO_CLASSIFICACAO"(v_resultado)',
  },
];

describe("hash do retrato pelo conteúdo (20261024130000)", () => {
  it("é uma transação, com pré-requisito, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261023200000",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("o hash é o sha256 do jsonb com os números sem zeros à direita, só do dono", () => {
    const canonico = funcao(MIGRATION, 'private."FC_JSONB_CANONICO"(');
    expect(canonico).toContain("to_jsonb(trim_scale(p_valor::numeric))");
    expect(canonico).toContain("order by e.ordem");
    const hash = funcao(MIGRATION, 'private."FC_HASH_RETRATO_CLASSIFICACAO"(');
    expect(hash).toContain(
      "if v_texto ~ '\\.[0-9]*0([],}]|$)' then\n    v_texto := private.\"FC_JSONB_CANONICO\"(p_retrato)::text;",
    );
    expect(hash).toContain(
      "return encode(sha256(convert_to(v_texto, 'UTF8')), 'hex');",
    );
    for (const f of ["FC_JSONB_CANONICO", "FC_HASH_RETRATO_CLASSIFICACAO"]) {
      expect(MIGRATION).toContain(
        `revoke all on function private."${f}"(jsonb) from public, anon, authenticated, service_role;`,
      );
      expect(MIGRATION).toMatch(
        new RegExp(
          `function private\\."${f}"\\([^)]*\\)\\nreturns \\w+\\nlanguage plpgsql\\nimmutable\\nparallel safe\\nset search_path to ''`,
        ),
      );
    }
  });

  it("as três funções que gravam o hash: o corpo vigente com SÓ a linha do hash trocada; o rollback volta ao anterior", () => {
    for (const f of FUNCOES) {
      const antes = funcao(f.antes, f.nome);
      expect(antes.split(f.linha)).toHaveLength(2);
      expect(funcao(MIGRATION, f.nome)).toBe(antes.replace(f.linha, f.nova));
      expect(funcao(ROLLBACK, f.nome)).toBe(antes);
    }
    expect(corpo(MIGRATION)).not.toMatch(
      /sha256\(convert_to\((p_resultado|p_retrato|v_resultado)::text/,
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_HASH_RETRATO_CLASSIFICACAO"(jsonb);',
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_JSONB_CANONICO"(jsonb);',
    );
  });

  it("assinaturas e privilégios das RPCs iguais; nenhum hash gravado muda", () => {
    for (const linha of [
      "revoke all on function public.classificacao_gravar_calculo(text, uuid, jsonb) from public, anon, authenticated;",
      "grant execute on function public.classificacao_gravar_calculo(text, uuid, jsonb) to service_role;",
      "revoke all on function public.registrar_lista_pre_classificacao(uuid, text, integer) from public, anon;",
      "grant execute on function public.registrar_lista_pre_classificacao(uuid, text, integer) to authenticated;",
      'revoke all on function private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb) from public, anon, authenticated, service_role;',
    ]) {
      expect(MIGRATION).toContain(linha);
      expect(ROLLBACK).toContain(linha);
    }
    expect(corpo(MIGRATION)).not.toMatch(
      /update public\."(TB_LISTA_CLASSIFICACAO|TB_RELATORIO_DESEMPATE|TH_PUBLICACAO_APROVADO)"/i,
    );
    expect(corpo(MIGRATION)).not.toMatch(/\bdrop function/i);
  });

  it("o ensaio confere 35 × 35.0, os exemplos da fixture, as listas do 114 e que nada gravado muda", () => {
    expect(ENSAIO).toContain("'mesmo_hash_35_e_35_0'");
    expect(ENSAIO).toContain("'lista_114_python'");
    expect(ENSAIO).toContain("'hashes_gravados_mudaram'");
    expect(ENSAIO).toContain("'funcoes_usam_o_hash_do_conteudo'");
    for (const e of FIXTURE.exemplos) expect(ENSAIO).toContain(`'${e.hash}'`);
  });
});
