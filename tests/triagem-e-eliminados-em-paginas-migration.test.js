import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261029120000 (Pré-classificação e Eliminados em páginas: resumo
  sem os inscritos, listas de 50 por cursor, cargo do acompanhamento gravado
  pelo job e índice da análise curricular). Invariantes estáticas: só leitura
  (nada grava em tabela, nada pede o job), as RPCs novas só para
  authenticated, com SECURITY DEFINER e search_path vazio e a permissão de
  sempre; o ensaio roda o mesmo corpo e termina em rollback; o rollback desfaz
  tudo e devolve as definições anteriores.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261029120000_triagem_e_eliminados_em_paginas.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const corpo = (texto) =>
  texto.slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"));
const semComentarios = (texto) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

/* O corpo de uma função (entre os $$) pelo nome. */
function funcao(nome) {
  const i = MIGRATION.indexOf(`create or replace function ${nome}(`);
  expect(i, nome).toBeGreaterThan(-1);
  const ini = MIGRATION.indexOf("$$", i);
  return MIGRATION.slice(i, MIGRATION.indexOf("$$;", ini + 2) + 3);
}

const NOVAS = [
  [
    "public.obter_resumo_pre_classificacao",
    "uuid",
    'private."FC_PRE_CABECALHO"',
  ],
  [
    "public.obter_vagas_pre_classificacao",
    "uuid",
    'private."FC_EXIGIR_COORD_AVALIACAO"',
  ],
  [
    "public.obter_listas_pre_classificacao",
    "uuid",
    'private."FC_EXIGIR_COORD_AVALIACAO"',
  ],
  [
    "public.conferir_eliminados_pre_classificacao",
    "uuid, text[]",
    'private."FC_EXIGIR_COORD_AVALIACAO"',
  ],
  [
    "public.listar_pre_classificacao",
    "uuid, text, text, text, jsonb, integer",
    'private."FC_EXIGIR_COORD_AVALIACAO"',
  ],
  [
    "public.listar_eliminados_fila",
    "uuid, text, text, text, text, text, jsonb, integer",
    'private."FC_EXIGIR_AVALIACAO_EDITAL"',
  ],
];

describe("migration das listas em páginas (Pré-classificação e Eliminados)", () => {
  it("só lê: nenhuma escrita em tabela, nenhum pedido de job, nada na trava", () => {
    const sql = semComentarios(MIGRATION);
    expect(sql).not.toMatch(
      /\b(insert\s+into|update\s+public|delete\s+from|truncate)\b/i,
    );
    expect(sql).not.toMatch(/disparar_robo|FC_PEDIR_|net\.http_post/i);
    expect(sql).not.toMatch(/ST_INSCRICOES_CONGELADAS"\s*=/);
    expect(sql).not.toMatch(/create\s+temporary/i);
  });

  it.each(NOVAS)(
    "%s: SECURITY DEFINER, search_path vazio, só authenticated e a permissão de sempre",
    (nome, argumentos, exigir) => {
      const corpoDaFuncao = funcao(nome);
      expect(corpoDaFuncao).toMatch(/security definer/);
      expect(corpoDaFuncao).toMatch(/set search_path = ''/);
      expect(corpoDaFuncao).toMatch(/\bstable\b/);
      expect(corpoDaFuncao).toContain(exigir);
      expect(MIGRATION).toContain(
        `revoke all on function ${nome}(${argumentos}) from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${nome}(${argumentos}) to authenticated;`,
      );
      expect(ROLLBACK).toContain(
        `drop function if exists ${nome}(${argumentos});`,
      );
      expect(CONTRATO_RPC[nome.replace("public.", "")]).toBeTruthy();
    },
  );

  it("as páginas: limite com teto, cursor estável e o total do recorte", () => {
    const pre = funcao("public.listar_pre_classificacao");
    expect(pre).toMatch(
      /least\(greatest\(coalesce\(p_limite, 50\), 1\), 500\)/,
    );
    expect(pre).toMatch(
      /\(r\.vaga collate "C", r\.grupo, r\.posicao, r\.codigo\)\s*> /,
    );
    expect(pre).toMatch(/'total', v_total/);
    const eliminados = funcao("public.listar_eliminados_fila");
    expect(eliminados).toMatch(
      /least\(greatest\(coalesce\(p_limite, 50\), 1\), 2000\)/,
    );
    expect(eliminados).toMatch(/FC_VAGAS_DO_ANALISTA/);
    expect(eliminados).toMatch(/FC_LINHAS_DA_FILA/);
    expect(eliminados).toMatch(/\(r\.chave, r\.codigo, r\.id\) %2\$s/);
  });

  it("cada parte na sua RPC; obter_pre_classificacao junta as mesmas partes e os inscritos", () => {
    expect(funcao('private."FC_PRE_CABECALHO"')).toContain(
      'private."FC_EXIGIR_COORD_AVALIACAO"(p_edital)',
    );
    const resumo = funcao("public.obter_resumo_pre_classificacao");
    expect(resumo).not.toMatch(/'candidatos'|FC_PRE_VAGAS|FC_PRE_LISTAS/);
    expect(resumo).toContain("obter_congelamento_inscricoes");
    const inteira = funcao("public.obter_pre_classificacao");
    for (const parte of ["FC_PRE_CABECALHO", "FC_PRE_LISTAS", "FC_PRE_VAGAS"])
      expect(inteira).toContain(`private."${parte}"(p_edital)`);
    expect(inteira).toContain("'candidatos'");
    const conferir = funcao("public.conferir_eliminados_pre_classificacao");
    expect(conferir).toContain("cardinality(p_chaves) > 10000");
    expect(conferir).toContain("unnest(coalesce(p_chaves");
  });

  it("o acompanhamento só procura o quadro da vaga sem pré-classificação", () => {
    const acompanhamento = funcao("public.obter_acompanhamento_inscricoes");
    expect(acompanhamento).toMatch(
      /case when pv\."CO_VAGA" is not null[\s\S]*else \(select[\s\S]*FC_QUADRO_DA_VAGA_EMPREGARE/,
    );
    expect(acompanhamento).not.toMatch(
      /left join lateral \(select \* from private\."FC_QUADRO_DA_VAGA_EMPREGARE"/,
    );
  });

  it("o ensaio roda o mesmo corpo e desfaz; o rollback devolve as definições de antes", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("inscritos_e_trava_intactos");
    expect(ROLLBACK).toMatch(
      /CREATE OR REPLACE FUNCTION public\.obter_pre_classificacao\(p_edital uuid\)/,
    );
    expect(ROLLBACK).toMatch(
      /CREATE OR REPLACE FUNCTION public\.obter_acompanhamento_inscricoes\(p_edital uuid\)/,
    );
    expect(ROLLBACK).toContain(
      'drop index if exists public."IN_ANALISECURR_AREANUMEDITAL";',
    );
    for (const parte of ["FC_PRE_CABECALHO", "FC_PRE_VAGAS", "FC_PRE_LISTAS"])
      expect(ROLLBACK).toContain(
        `drop function if exists private."${parte}"(uuid);`,
      );
    // As partes somem depois de obter_pre_classificacao voltar a não depender delas.
    expect(
      ROLLBACK.indexOf('drop function if exists private."FC_PRE_CABECALHO"'),
    ).toBeGreaterThan(
      ROLLBACK.indexOf(
        "CREATE OR REPLACE FUNCTION public.obter_pre_classificacao",
      ),
    );
  });
});
