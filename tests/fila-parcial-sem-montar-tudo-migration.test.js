import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Invariantes da migration 20261019150000 (a fila parcial sem montar a fila
  inteira): obter_fila_avaliacao_desde montava obter_fila_avaliacao inteira
  (1.512 linhas, ≈630 KB no 114/2026) e só depois filtrava. Agora a regra da
  linha continua numa fonte só (FC_LINHAS_DA_FILA, com p_candidatos), o corpo
  da fila também (FC_FILA_AVALIACAO_JSON) e o contrato das RPCs não muda.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261019150000_fila_parcial_sem_montar_tudo.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const funcao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio).toBeGreaterThanOrEqual(0);
  const corpo = texto.slice(inicio);
  return corpo.slice(0, corpo.indexOf("$function$;") + 11);
};
const LINHAS = funcao(
  MIGRATION,
  'create function private."FC_LINHAS_DA_FILA"(',
);
const CORPO = funcao(
  MIGRATION,
  'create or replace function private."FC_FILA_AVALIACAO_JSON"(',
);
const FILA = funcao(
  MIGRATION,
  "create or replace function public.obter_fila_avaliacao(",
);
const DESDE = funcao(
  MIGRATION,
  "create or replace function public.obter_fila_avaliacao_desde(",
);

describe("a fila parcial sem montar a fila inteira", () => {
  it("transação com lock_timeout, sem CR, com ensaio e rollback", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout = '10s';");
    expect(MIGRATION).toContain("notify pgrst, 'reload schema';");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    for (const sql of [MIGRATION, ROLLBACK, ENSAIO])
      expect(sql).not.toMatch(/\r/);
    expect(MIGRATION).toContain(`Ensaio: supabase/ensaios/${NOME}`);
    expect(MIGRATION).toContain(`Rollback: supabase/rollback/${NOME}`);
    expect(ENSAIO).toContain("begin … rollback");
    expect(ENSAIO).toContain("-- == aplicar a migration aqui ==");
  });

  it("a desde não monta mais a fila inteira antes de saber se é parcial", () => {
    expect(DESDE).not.toContain("public.obter_fila_avaliacao(p_edital)");
    expect(DESDE).toContain(
      'v := private."FC_FILA_AVALIACAO_JSON"(p_edital, v_ids);',
    );
    // o mesmo critério de antes para as fichas que mudaram
    expect(DESDE).toContain(
      `f."DT_ATUALIZACAO" >= p_desde - interval '2 minutes'`,
    );
    expect(DESDE).toContain(
      `f."DT_RESERVA_EXPIRA" >= p_desde - interval '2 minutes'`,
    );
    // a mesma marca
    expect(DESDE).toContain(
      `md5(concat_ws('|', count(*), max(a."DT_ATUALIZACAO"), max(a."CO_EXECUCAO"),`,
    );
    expect(DESDE).toContain(
      `v ->> 'eu', v ->> 'papel', (v -> 'vagas')::text))`,
    );
    // outra marca: a inteira
    expect(DESDE).toContain(
      'v := private."FC_FILA_AVALIACAO_JSON"(p_edital, null);',
    );
    for (const chave of [
      "marca",
      "parcial",
      "total_nucleo",
      "candidatos",
      "saiu",
    ])
      expect(DESDE).toContain(`'${chave}'`);
  });

  it("uma fonte só: a linha em FC_LINHAS_DA_FILA, o corpo em FC_FILA_AVALIACAO_JSON", () => {
    expect(MIGRATION).toContain(
      'drop function private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer);',
    );
    expect(LINHAS).toContain("p_candidatos uuid[] default null");
    expect(LINHAS).toContain("return query execute");
    expect(LINHAS).toContain(
      'and ($6 is null or a."CO_EMPREGARE_CANDIDATO" = any ($6))',
    );
    expect(LINHAS).toContain(
      'private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO") = $3',
    );
    expect(FILA).toContain(
      'return private."FC_FILA_AVALIACAO_JSON"(p_edital, null);',
    );
    expect(CORPO).toContain(
      'private."FC_LINHAS_DA_FILA"(p_edital, v_vagas, true, null, null, p_candidatos)',
    );
  });

  it("a permissão e o recorte do analista continuam antes de qualquer leitura", () => {
    const declare = CORPO.slice(0, CORPO.indexOf("\nbegin\n"));
    expect(declare).toContain(
      'v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);',
    );
    expect(declare).toContain(
      'v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);',
    );
    expect(CORPO).toContain(
      'v_vagas := private."FC_VAGAS_DO_ANALISTA"(p_edital, v_uid);',
    );
    expect(CORPO).toContain("'schema_version', 2");
    for (const f of [
      'private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer, uuid[])',
      'private."FC_FILA_AVALIACAO_JSON"(uuid, uuid[])',
    ])
      expect(MIGRATION).toContain(
        `revoke all on function ${f} from public, anon, authenticated;`,
      );
  });

  it("as contagens agrupadas antes da regra do núcleo, pelo índice coberto", () => {
    expect(CORPO).toContain("with g as materialized (");
    expect(CORPO).toContain(
      'private."FC_NO_NUCLEO_DA_FILA"(g.s, g.sf) as nucleo from g',
    );
    expect(CORPO).toContain("'fora_do_lote', v_fora,");
    expect(CORPO).toContain("'versao', md5(concat_ws('|',");
    expect(MIGRATION).toContain(
      'create index if not exists "IN_PRECLASSIF_FILA"',
    );
    expect(MIGRATION).toContain(
      'include ("CO_VAGA", "TP_SITUACAO", "NO_MODALIDADE", "DT_ATUALIZACAO", "CO_EXECUCAO")',
    );
  });

  it("o rollback volta as definições de antes e apaga o que é novo", () => {
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_FILA_AVALIACAO_JSON"(uuid, uuid[]);',
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_LINHAS_DA_FILA"(uuid, text[], boolean, uuid, integer, uuid[]);',
    );
    expect(ROLLBACK).toContain(
      'CREATE OR REPLACE FUNCTION private."FC_LINHAS_DA_FILA"(p_edital uuid, p_vagas text[], p_nucleo boolean, p_apos uuid, p_limite integer)',
    );
    expect(ROLLBACK).toContain(
      "v json := public.obter_fila_avaliacao(p_edital);",
    );
    expect(ROLLBACK).toContain(
      'drop index if exists public."IN_PRECLASSIF_FILA";',
    );
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("o contrato das RPCs segue o mesmo", () => {
    expect(CONTRATO_RPC.obter_fila_avaliacao.argumentos).toEqual(["p_edital"]);
    expect(CONTRATO_RPC.obter_fila_avaliacao_desde.argumentos).toEqual([
      "p_edital",
      "p_desde",
      "p_marca",
    ]);
    expect(CONTRATO_RPC.obter_fila_avaliacao_desde.resumo).toContain(
      "20261019150000",
    );
  });
});
