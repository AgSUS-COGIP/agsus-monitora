import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration do cálculo conferido no banco (20261023090000) e a da conversão de
  dias no painel (20261023091000), ainda não aplicadas: os ensaios
  begin…rollback estão em supabase/ensaios/. Aqui, as invariantes estáticas.
  O cálculo em lote (a revisão das fichas concluídas com pendência e a correção
  do 114) é do Python: o banco só valida a ficha que está sendo gravada e
  guarda, pelas RPCs enxutas só de service_role.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261023090000_calculo_conferido_no_banco.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const PAINEL = "20261023091000_anos_meses_dias_no_painel.sql";

const NOVAS_PRIVADAS = [
  "FC_DATA_DO_TEXTO",
  "FC_DIAS_DOS_INTERVALOS",
  "FC_ANOS_MESES_DIAS",
  "FC_EFEITO_DO_BLOCO",
  "FC_NUMERO_OU_ZERO",
  "FC_BLOCO_NO_NIVEL",
  "FC_EXPERIENCIA_DA_FICHA",
  "FC_CALCULADO_DO_BLOCO",
  "FC_BLOCO_PELA_NOTA",
  "FC_AJUSTE_JUSTIFICADO",
  "FC_FIM_DAS_INSCRICOES",
  "FC_REGRA_COM_DATA_LIMITE",
];
const RPCS_DO_SERVICO = [
  "public.revisar_ficha_concluida_com_pendencia(uuid, integer)",
  "public.corrigir_experiencia_da_ficha(uuid, integer, jsonb, text, uuid)",
];
const TROCADAS = [
  'private."FC_VALIDAR_RESULTADO_FICHA"',
  'private."FC_PENDENCIAS_FICHA"',
  'private."FC_LINHAS_DA_FILA"',
  'private."FC_REGRA_VIGENTE_FICHA"',
  "public.conferencia_ler_fichas",
  "public.listar_anexos_para_leitura",
  "public.pre_classificacao_ler_editais",
  'private."FC_VALIDAR_LANCAMENTO_FICHA"',
];

/** Os corpos das funções criadas no arquivo, por nome. */
function funcoes(sql) {
  const mapa = {};
  const re = /CREATE OR REPLACE FUNCTION ([^(]+)\(/g;
  let m;
  while ((m = re.exec(sql))) {
    const fim = sql.indexOf(
      "$function$",
      sql.indexOf("$function$", m.index) + 1,
    );
    mapa[m[1].trim()] = sql.slice(m.index, fim);
  }
  return mapa;
}
const normal = (s) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

describe("cálculo conferido no banco (20261023090000)", () => {
  const criadas = funcoes(MIGRATION);

  it("cria as funções novas, troca as existentes e só mexe na tabela para a ação CORRIGIR", () => {
    for (const nome of NOVAS_PRIVADAS)
      expect(Object.keys(criadas)).toContain(`private."${nome}"`);
    for (const nome of TROCADAS) expect(Object.keys(criadas)).toContain(nome);
    expect(MIGRATION).not.toMatch(/create table|drop table|drop function/i);
    expect(MIGRATION.match(/alter table/gi)).toHaveLength(2);
    expect(MIGRATION).toContain("'CORRIGIR']));");
    for (const nome of NOVAS_PRIVADAS)
      expect(MIGRATION).toMatch(
        new RegExp(`revoke all on function private\\."${nome}"\\(`),
      );
    expect(MIGRATION).toMatch(/^begin;$/m);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("nada de varredura em lote nem agenda no banco: aplicar não muda a situação de ficha nenhuma", () => {
    expect(MIGRATION).not.toMatch(/FC_REVISAR_FICHAS_COM_PENDENCIA|cron\./);
    expect(MIGRATION).not.toMatch(/^select [^\n]*revisar/im);
  });

  it("as RPCs de gravação são só do service_role e uma ficha por vez", () => {
    for (const rpc of RPCS_DO_SERVICO) {
      expect(MIGRATION).toContain(
        `revoke all on function ${rpc} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${rpc} to service_role;`,
      );
    }
    const revisar = criadas["public.revisar_ficha_concluida_com_pendencia"];
    expect(revisar).toContain("SECURITY DEFINER");
    expect(revisar).toContain("SET search_path TO ''");
    expect(revisar).toContain('private."FC_PENDENCIAS_FICHA"(');
    expect(revisar).toContain("'sem pendência no banco'");
    expect(revisar).toContain("'REVISAR', 'CONCLUIDA'");
    expect(revisar).toMatch(/v_motivo, null\);/);
    expect(revisar).not.toMatch(/"VL_NOTA_FINAL" =|"TP_RESULTADO" =/);
    const corrigir = criadas["public.corrigir_experiencia_da_ficha"];
    expect(corrigir).toContain(
      'private."FC_EXPERIENCIA_DA_FICHA"(x.b, v_lanc)',
    );
    expect(corrigir).toContain("a pontuação mudaria");
    expect(corrigir).toContain("'CORRIGIR', 'CONCLUIDA'");
    expect(corrigir).toContain('private."FC_PUBLICAR_FICHA_ANALISE"(p_ficha)');
    expect(corrigir).not.toMatch(
      /"VL_NOTA_FINAL" =|"TP_RESULTADO" =|"TP_SITUACAO" =/,
    );
  });

  it("o resultado recalcula os itens e só recusa a pontuação ACIMA deles sem Editar nota e justificativa", () => {
    const validar = criadas['private."FC_VALIDAR_RESULTADO_FICHA"'];
    expect(validar).toContain(
      'private."FC_CALCULADO_DO_BLOCO"(v_bloco, p_lanc)',
    );
    expect(validar).toContain(
      'private."FC_AJUSTE_JUSTIFICADO"(p_regra, v_bloco, v_lancado)',
    );
    expect(validar).toContain("v_ajuste - v_calc > 0.0001");
    expect(validar).not.toContain("abs(v_ajuste - v_calc)");
    expect(validar).toContain("v_resultado <> 'INAPTO_REQUISITO'");
    expect(validar).toContain('private."FC_EXPERIENCIA_DA_FICHA"(b, p_lanc)');
  });

  it("as pendências usam a conta do banco, só o sentido acima, o Não enviou, o eliminado por outro bloco e as datas", () => {
    const pend = criadas['private."FC_PENDENCIAS_FICHA"'];
    expect(pend).toContain("STABLE");
    expect(pend).toContain(
      "in ('NAO_CONFORME', 'NAO_ENVIADO') and not v_elimina_outro",
    );
    expect(pend).toContain("vínculo com data antes de 1960");
    expect(pend).toContain("vínculo com fim depois de hoje");
    expect(pend).toContain("if v_valor - v_calc > 0.0001 then");
    expect(pend).not.toMatch(/pontos, abaixo/);
    expect(pend).not.toContain("p_res #>> array['experiencia'");
  });

  it("a regra com a data limite padrão chega à tela e ao Python, com a versão da ficha para o job", () => {
    expect(criadas['private."FC_REGRA_VIGENTE_FICHA"']).toContain(
      'private."FC_REGRA_COM_DATA_LIMITE"(h."DS_CONFIGURACAO", f."CO_MONITORAMENTO")',
    );
    for (const rpc of [
      "public.conferencia_ler_fichas",
      "public.listar_anexos_para_leitura",
      "public.pre_classificacao_ler_editais",
    ])
      expect(criadas[rpc]).toContain('private."FC_REGRA_COM_DATA_LIMITE"');
    expect(criadas["public.conferencia_ler_fichas"]).toContain(
      "'versao', p.versao_ficha",
    );
    expect(criadas['private."FC_LINHAS_DA_FILA"']).toContain(
      "'motivo_revisao'",
    );
  });

  it("o ensaio leva os mesmos corpos, os casos dourados do arquivo, a foto da situação e termina em rollback", () => {
    const doEnsaio = funcoes(ENSAIO);
    for (const [nome, corpo] of Object.entries(criadas))
      expect(normal(doEnsaio[nome] ?? ""), nome).toBe(normal(corpo));
    const json = ENSAIO.match(/\$dourados\$(.*)\$dourados\$/s)?.[1];
    expect(JSON.parse(json)).toEqual(
      JSON.parse(
        ler(
          "tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json",
        ),
      ),
    );
    expect(ENSAIO).toContain("'dourados_com_falha'");
    expect(ENSAIO).toContain("'situacao_mudou_ao_aplicar'");
    expect(ENSAIO).toContain("'tempo_da_validacao_ms'");
    expect(
      ENSAIO.indexOf("create temp table ensaio_situacao_antes"),
    ).toBeLessThan(ENSAIO.indexOf("CREATE OR REPLACE FUNCTION"));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;$/m);
  });

  it("o rollback devolve as trocadas, apaga as novas e tira a ação CORRIGIR", () => {
    const voltam = funcoes(ROLLBACK);
    for (const nome of TROCADAS) expect(Object.keys(voltam)).toContain(nome);
    for (const nome of NOVAS_PRIVADAS)
      expect(ROLLBACK).toContain(`drop function if exists private."${nome}"(`);
    for (const rpc of RPCS_DO_SERVICO)
      expect(ROLLBACK).toContain(`drop function if exists ${rpc};`);
    expect(ROLLBACK).not.toContain("'CORRIGIR'");
    expect(voltam['private."FC_PENDENCIAS_FICHA"']).not.toContain(
      "v_elimina_outro",
    );
  });
});

describe("anos, meses e dias no painel (20261023091000)", () => {
  const MIG = ler(`supabase/migrations/${PAINEL}`);
  const RB = ler(`supabase/rollback/${PAINEL}`);

  it("só a conversão muda em FC_PUBLICAR_FICHA_ANALISE, com a ficha fora do lote fora do painel", () => {
    const nova = funcoes(MIG)['private."FC_PUBLICAR_FICHA_ANALISE"'];
    const antiga = funcoes(RB)['private."FC_PUBLICAR_FICHA_ANALISE"'];
    expect(nova).toContain('private."FC_ANOS_MESES_DIAS"(v_dias)');
    expect(nova).not.toContain("(v_dias % 365) / 30");
    expect(nova).toContain("FORA_LOTE");
    const semConversao = (s) =>
      normal(s)
        .split("\n")
        .filter((l) => !/v_amd|v_dias \/ 365|v_dias % 365|^-- |^--$/.test(l))
        .join("\n");
    expect(semConversao(nova)).toBe(semConversao(antiga));
    expect(
      ler(`supabase/ensaios/${PAINEL}`).trimEnd().endsWith("rollback;"),
    ).toBe(true);
  });
});
