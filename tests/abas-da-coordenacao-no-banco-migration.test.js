import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  As abas da coordenação travadas no banco e o andamento das fichas na lista
  (20261016130000; o ensaio begin…rollback está em supabase/ensaios/ e foi
  rodado no banco novo como administrador, avaliador e analista). Invariantes
  estáticas: as quatro RPCs das abas exigem FC_EXIGIR_COORD_AVALIACAO; a regra
  fica enxuta para quem não coordena; a lista manda `fichas` no formato que a
  entrada (entrada-da-avaliacao.tsx) lê; nada da Fila/ficha é recriado; o
  rollback volta as seis funções.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261016130000_abas_da_coordenacao_no_banco.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpo = (texto, nome) => {
  const cabeca = `CREATE OR REPLACE FUNCTION public.${nome}(`;
  const inicio = texto.indexOf(cabeca);
  expect(inicio, nome).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

const TRAVADAS = [
  "obter_pre_classificacao",
  "obter_situacao_pre_classificacao",
  "obter_equipe_edital",
  "obter_apoio_regra_analise",
];

describe("abas da coordenação no banco", () => {
  it("as RPCs das abas da coordenação exigem a coordenação do edital", () => {
    for (const nome of TRAVADAS) {
      const c = corpo(MIGRATION, nome);
      expect(c).toContain('private."FC_EXIGIR_COORD_AVALIACAO"(p_edital)');
      expect(c).not.toContain('"FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)');
      expect(c).toContain("SET search_path TO ''");
      expect(c).toContain("SECURITY DEFINER");
    }
  });

  it("a regra segue para o Leitor, enxuta para quem não coordena", () => {
    const c = corpo(MIGRATION, "obter_regra_analise");
    expect(c).toContain('"FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)');
    expect(c).toContain(
      `'regra', case when v_coordena then private."FC_REGRA_ANALISE_JSON"(p_edital) else (`,
    );
    expect(c).toContain(
      `json_build_object('versao', h."NU_VERSAO", 'nome', h."NO_VERSAO")`,
    );
    expect(c).toContain(`'modelos', case when not v_coordena then '[]'::json`);
    expect(c).toContain(`'aldeias', case when v_coordena then (`);
    expect(c).toContain("'pode_coordenar', v_coordena");
  });

  it("a lista manda fichas no formato da entrada, pelo índice da fila", () => {
    const c = corpo(MIGRATION, "listar_editais_avaliacao");
    for (const campo of [
      "concluidas",
      "pendentes",
      "em_analise",
      "minhas_em_analise",
    ])
      expect(c).toContain(`'${campo}', fx.${campo}`);
    expect(c).toContain(
      `f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR', 'CONCLUIDA')`,
    );
    expect(c).toContain(`g."CO_USUARIO_RESPONSAVEL" = (select auth.uid())`);
    const entrada = ler(
      "src/modulos/avaliacao-documental/entrada-da-avaliacao.tsx",
    );
    expect(entrada).toContain("edital.fichas");
    expect(entrada).toContain("f.minhas_em_analise");
  });

  it("não recria a Fila nem a ficha", () => {
    for (const nome of [
      "obter_ficha_analise",
      "obter_fila_avaliacao",
      "reservar_ficha",
      "pegar_proxima_ficha",
      '"FC_PUBLICAR_FICHA_ANALISE"',
    ])
      expect(MIGRATION).not.toContain(`FUNCTION public.${nome}(`);
  });

  it("rollback volta as seis funções; ensaio testa quem não coordena", () => {
    for (const nome of [...TRAVADAS, "obter_regra_analise"])
      expect(corpo(ROLLBACK, nome)).toContain(
        '"FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
      );
    expect(corpo(ROLLBACK, "listar_editais_avaliacao")).not.toContain(
      "'fichas'",
    );
    expect(ENSAIO).toContain("703ecea8-7401-46ce-82ae-b54ec5b62534");
    expect(ENSAIO).toContain("set local role authenticated;");
  });

  it("contrato de RPC conta a trava e a resposta enxuta", () => {
    for (const nome of TRAVADAS)
      expect(CONTRATO_RPC[nome].resumo).toContain("FC_EXIGIR_COORD_AVALIACAO");
    expect(CONTRATO_RPC.obter_regra_analise.resumo).toContain("enxuta");
    expect(CONTRATO_RPC.listar_editais_avaliacao.resumo).toContain(
      "minhas_em_analise",
    );
  });
});
