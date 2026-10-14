import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Invariantes das migrations de menos egress da Avaliação documental:
  20261014230000 (leitura por versão: pré-classificação, classificação, regra
  e a situação leve do Recalcular) e 20261014231000 (a fila e a ficha só com o
  que mudou). Só funções novas que chamam as de sempre: o front de hoje segue
  igual com elas aplicadas, e o novo cai nas de sempre sem elas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOMES = [
  "20261014230000_avaliacao_leitura_por_versao.sql",
  "20261014231000_fila_e_ficha_so_o_que_mudou.sql",
];
const MIGRATIONS = NOMES.map((n) => ler(`supabase/migrations/${n}`));
const [VERSAO, FILA] = MIGRATIONS;

const funcao = (texto, nome) => {
  const inicio = texto.indexOf(`create or replace function ${nome}(`);
  expect(inicio).toBeGreaterThanOrEqual(0);
  const corpo = texto.slice(inicio);
  return corpo.slice(0, corpo.indexOf("$function$;") + 11);
};

describe("as migrations de menos egress", () => {
  it.each(NOMES)(
    "%s: transação com lock_timeout, ensaio e rollback, sem CR",
    (nome) => {
      const sql = ler(`supabase/migrations/${nome}`);
      expect(sql).toMatch(/\nbegin;\n/);
      expect(sql).toContain("set local lock_timeout = '10s';");
      expect(sql).toContain("notify pgrst, 'reload schema';");
      expect(sql.trimEnd().endsWith("commit;")).toBe(true);
      expect(sql).not.toMatch(/drop function/i);
      expect(sql).not.toMatch(/\r/);
      expect(sql).toContain(`Ensaio: supabase/ensaios/${nome}`);
      expect(sql).toContain(`Rollback: supabase/rollback/${nome}`);
      expect(ler(`supabase/ensaios/${nome}`)).toContain("begin … rollback");
      expect(ler(`supabase/rollback/${nome}`)).toMatch(
        /drop function if exists/,
      );
    },
  );

  it("nenhuma função de antes é recriada (o front atual segue igual)", () => {
    for (const sql of MIGRATIONS)
      for (const antiga of [
        "obter_pre_classificacao",
        "obter_classificacao_do_edital",
        "obter_regra_analise",
        "obter_fila_avaliacao",
        "obter_ficha_analise",
      ])
        expect(sql).not.toContain(`function public.${antiga}(`);
  });

  it('as de "se mudou" chamam a de sempre e respondem inalterado com a versão', () => {
    expect(funcao(VERSAO, "public.obter_pre_classificacao_se_mudou")).toContain(
      "public.obter_pre_classificacao(p_edital)::jsonb",
    );
    expect(
      funcao(VERSAO, "public.obter_classificacao_do_edital_se_mudou"),
    ).toContain("public.obter_classificacao_do_edital(p_edital)::jsonb");
    expect(funcao(VERSAO, "public.obter_regra_analise_se_mudou")).toContain(
      'private."FC_SE_MUDOU"(public.obter_regra_analise(p_edital)::jsonb, p_versao)',
    );
    const colunas = funcao(VERSAO, 'private."FC_SE_MUDOU_EM_COLUNAS"');
    expect(colunas).toContain("'inalterado', true");
    // A versão é calculada antes da conversão em colunas (que só roda quando mudou).
    expect(colunas.indexOf("md5(")).toBeLessThan(
      colunas.indexOf('private."FC_COLUNAS_JSON"'),
    );
  });

  it("a situação leve confere a permissão e não lê os inscritos", () => {
    const situacao = funcao(VERSAO, "public.obter_situacao_pre_classificacao");
    expect(situacao).toContain(
      'private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
    );
    expect(situacao).toContain("'em_andamento'");
    expect(situacao).toContain("'ultima_execucao'");
    expect(situacao).not.toContain('TB_PRE_CLASSIFICACAO"');
  });

  it("a fila parcial parte de obter_fila_avaliacao, com margem e as reservas", () => {
    const desde = funcao(FILA, "public.obter_fila_avaliacao_desde");
    expect(desde).toContain("public.obter_fila_avaliacao(p_edital)");
    expect(desde).toContain("p_desde - interval '2 minutes'");
    expect(desde).toContain('f."DT_RESERVA_EXPIRA" >= p_desde');
    expect(desde).toContain("'total_nucleo'");
    expect(desde).toContain("'saiu'");
    expect(desde).toContain("returns json");
    const leve = funcao(FILA, "public.obter_ficha_analise_leve");
    expect(leve).toContain("public.obter_ficha_analise(p_ficha)");
    expect(leve).toContain("'regra_omitida'");
  });

  it("todas as RPCs novas estão no contrato com os argumentos", () => {
    expect(CONTRATO_RPC.obter_pre_classificacao_se_mudou.argumentos).toEqual([
      "p_edital",
      "p_versao",
    ]);
    expect(
      CONTRATO_RPC.obter_classificacao_do_edital_se_mudou.argumentos,
    ).toEqual(["p_edital", "p_versao"]);
    expect(CONTRATO_RPC.obter_regra_analise_se_mudou.argumentos).toEqual([
      "p_edital",
      "p_versao",
    ]);
    expect(CONTRATO_RPC.obter_situacao_pre_classificacao.argumentos).toEqual([
      "p_edital",
    ]);
    expect(CONTRATO_RPC.obter_fila_avaliacao_desde.argumentos).toEqual([
      "p_edital",
      "p_desde",
      "p_marca",
    ]);
    expect(CONTRATO_RPC.obter_ficha_analise_leve.argumentos).toEqual([
      "p_ficha",
      "p_regra_chave",
    ]);
  });
});
