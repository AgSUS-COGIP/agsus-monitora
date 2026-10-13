import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Invariantes da migration 20261013130000 (diferenças por cargo na regra da
  avaliação documental), do rollback, do ensaio e da correção do 114/2026: a
  regra da vaga no banco igual à de regra-por-cargo.ts, a validação nova, a
  ficha validada pela regra da vaga com a vaga e o cargo carimbados, e a
  correção que cria uma versão nova a partir da VIGENTE, em CONFERIR.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261013130000_regra_por_cargo.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CORRECAO = ler(
  "supabase/correcoes/20261013-edital-114-regra-por-cargo.sql",
);

function corpoDa(nome, texto = MIGRATION) {
  const inicio = texto.search(
    new RegExp(
      `create or replace function (public|private)\\.("?)${nome}\\2\\(`,
      "i",
    ),
  );
  if (inicio < 0) throw new Error(`função ${nome} não está no arquivo`);
  const resto = texto.slice(inicio);
  return resto.slice(0, resto.search(/\n\$(function|\$)?\$?;\n/) + 1);
}

const NOVAS = [
  ["FC_TEXTO_DO_CARGO", "(text)"],
  ["FC_DIFERENCA_DA_VAGA", "(jsonb, text, text)"],
  ["FC_BLOCO_DO_CARGO", "(jsonb, jsonb, text)"],
  ["FC_REGRA_DA_VAGA", "(jsonb, text, text, text)"],
  ["FC_VALIDAR_POR_CARGO_ANALISE", "(jsonb)"],
];

describe("a migration", () => {
  it("transação com lock_timeout", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout = '10s';");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  it.each(NOVAS)(
    "%s é privada, sem execução para ninguém, com comentário",
    (nome, args) => {
      expect(MIGRATION).toContain(
        `create or replace function private."${nome}"`,
      );
      expect(MIGRATION).toContain(
        `revoke all on function private."${nome}"${args} from public, anon, authenticated, service_role;`,
      );
      expect(MIGRATION).toContain(
        `comment on function private."${nome}"${args} is`,
      );
    },
  );

  it("a regra da vaga: vaga primeiro, cargo por palavras inteiras, cargo > nível", () => {
    const diferenca = corpoDa("FC_DIFERENCA_DA_VAGA");
    expect(diferenca).toMatch(
      /btrim\(v\) = btrim\(p_vaga\)[\s\S]*order by n limit 1\),\n\s*\(select d from diferencas/,
    );
    expect(diferenca).toContain(
      "strpos(' ' || private.\"FC_TEXTO_DO_CARGO\"(p_cargo) || ' ',",
    );
    const bloco = corpoDa("FC_BLOCO_DO_CARGO");
    expect(bloco).toContain(
      "p_bloco || v_parte else p_bloco end) - 'por_nivel'",
    );
    expect(bloco).toContain("'efeito', 'ELIMINA'");
    const regra = corpoDa("FC_REGRA_DA_VAGA");
    expect(regra).toContain("'por_cargo', '[]'::jsonb");
  });

  it("FC_VALIDAR_REGRA_ANALISE chama a validação das diferenças", () => {
    expect(corpoDa("FC_VALIDAR_REGRA_ANALISE")).toContain(
      'perform private."FC_VALIDAR_POR_CARGO_ANALISE"(p_regra);',
    );
    const validacao = corpoDa("FC_VALIDAR_POR_CARGO_ANALISE");
    for (const trecho of [
      "when 'CURSOS' then array['teto', 'faixas', 'extras']",
      "when 'TITULOS' then array['teto', 'extras']",
      "when 'VINCULOS' then array['teto', 'area']",
      "when 'DOCUMENTO' then array['requisitos']",
      "já está na diferença",
      "já é um motivo do bloco",
      '"não pontua em" só com blocos de títulos ou cursos da regra',
    ])
      expect(validacao).toContain(trecho);
  });

  it("o lançamento aceita extras e requisitos só da regra da vaga; as pendências pedem os dois", () => {
    expect(corpoDa("FC_VALIDAR_LANCAMENTO_FICHA")).toContain(
      "foreach v_campo in array array['extras', 'requisitos'] loop",
    );
    const pend = corpoDa("FC_PENDENCIAS_FICHA");
    expect(pend).toContain(": confira cada requisito do cargo");
    expect(pend).toContain(
      "jsonb_typeof(v_l -> 'nota_ajustada') is distinct from 'number'",
    );
  });

  it.each(["salvar_rascunho_ficha", "concluir_ficha"])(
    "%s carimba vaga e cargo e valida pela regra da vaga",
    (nome) => {
      const corpo = corpoDa(nome);
      expect(corpo).toContain(
        "p_lancamento := p_lancamento || jsonb_build_object('vaga', v_f.\"CO_VAGA\", 'cargo', v_cargo);",
      );
      expect(corpo).toContain(
        'v_conf := private."FC_REGRA_DA_VAGA"(v_regra.p_configuracao, v_f."CO_VAGA", v_cargo, p_lancamento ->> \'nivel\');',
      );
      expect(corpo).toContain(
        'private."FC_VALIDAR_LANCAMENTO_FICHA"(v_conf, p_lancamento)',
      );
      expect(corpo).toContain('private."FC_VALIDAR_RESULTADO_FICHA"(v_conf,');
      expect(corpo).not.toMatch(/FC_VALIDAR_\w+"\(v_regra\.p_configuracao/);
      expect(corpo).toContain("SECURITY DEFINER");
      expect(corpo).toContain("SET search_path TO ''");
    },
  );

  it("o apoio do assistente devolve o cargo de cada vaga e os cargos do quadro", () => {
    const apoio = corpoDa("obter_apoio_regra_analise");
    expect(apoio).toContain("'cargos_do_quadro'");
    expect(apoio).toContain("'^Candidatos da vaga [0-9]+ - (.+) em Excel'");
    expect(apoio).toContain(
      'private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
    );
  });

  it("as RPCs mantêm as assinaturas do contrato", () => {
    expect(CONTRATO_RPC.salvar_rascunho_ficha.argumentos).toEqual([
      "p_ficha",
      "p_versao",
      "p_lancamento",
      "p_resultado",
      "p_parecer",
    ]);
    expect(CONTRATO_RPC.concluir_ficha.argumentos).toEqual([
      "p_ficha",
      "p_versao",
      "p_versao_regra",
      "p_lancamento",
      "p_resultado",
      "p_parecer",
    ]);
    expect(CONTRATO_RPC.obter_apoio_regra_analise.argumentos).toEqual([
      "p_edital",
    ]);
    expect(CONTRATO_RPC.obter_apoio_regra_analise.resumo).toContain(
      "cargos do quadro",
    );
    expect(MIGRATION).toContain(
      "public.salvar_rascunho_ficha(p_ficha uuid, p_versao integer, p_lancamento jsonb, p_resultado jsonb, p_parecer text)",
    );
  });
});

describe("rollback, ensaio e correção", () => {
  it("o rollback volta as seis funções e apaga as novas", () => {
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    for (const [nome, args] of NOVAS)
      expect(ROLLBACK).toContain(
        `drop function if exists private."${nome}"${args.replace(/, /g, ", ")};`,
      );
    expect(corpoDa("FC_VALIDAR_REGRA_ANALISE", ROLLBACK)).not.toContain(
      "FC_VALIDAR_POR_CARGO_ANALISE",
    );
    expect(corpoDa("concluir_ficha", ROLLBACK)).not.toContain(
      "FC_REGRA_DA_VAGA",
    );
  });

  it("o ensaio não grava nada e simula a ficha do Motorista D", () => {
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).toContain("'182528'");
    expect(ENSAIO).toContain('"UMCQA": true');
    expect(ENSAIO).toContain(
      "ENSAIO 3: a regra sem diferença deveria recusar Cursos 15",
    );
  });

  it("a correção cria uma versão nova a partir da vigente, em CONFERIR, e confere no fim", () => {
    expect(CORRECAO).toContain(
      "c_motivo constant text := 'Diferenças por cargo do edital 114/2026 (8.2.6 e Anexo I)';",
    );
    expect(CORRECAO).toContain('v_versao := v_regra."NU_VERSAO_VIGENTE" + 1;');
    expect(CORRECAO).toContain('h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE"');
    expect(CORRECAO).toContain(`"TP_SITUACAO" = 'CONFERIR'`);
    expect(CORRECAO).toContain(
      'perform private."FC_VALIDAR_REGRA_ANALISE"(v_nova);',
    );
    expect(CORRECAO).toContain(
      "Aplique antes a migration 20261013130000_regra_por_cargo.sql",
    );
    expect(CORRECAO).toContain(
      "já tem % diferença(s) por cargo: nada foi feito.",
    );
    expect(CORRECAO.trimEnd()).toMatch(
      /\nselect r\."NU_VERSAO_VIGENTE" as versao,[\s\S]*;$/,
    );
    expect(CORRECAO).not.toMatch(/"NU_VERSAO" = 2\b/);
  });
});
