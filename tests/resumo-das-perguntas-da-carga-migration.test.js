import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261009180000 (o resumo das perguntas da carga da Empregare vira
  instantâneo por edital, calculado em Python pelo robô). Invariantes
  estáticas: a conta saiu de obter_regra_analise e do banco, a gravação
  confere a privacidade, quem pode chamar o quê, o ensaio com o mesmo corpo e
  o rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009180000_resumo_das_perguntas_da_carga.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROBO = ler("scripts/robo-empregare/resumo_das_perguntas.py");
const corpo = (texto) =>
  texto.slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"));
const trecho = (inicio, fim) =>
  MIGRATION.slice(MIGRATION.indexOf(inicio), MIGRATION.indexOf(fim));
const LER_VAGA = trecho(
  "create function public.ler_respostas_pergunta_vaga",
  "create function public.gravar_resumo_pergunta_edital",
);
const GRAVAR = trecho(
  "create function public.gravar_resumo_pergunta_edital",
  "-- 4. A leitura da tela",
);
const LEITURA = trecho(
  "create function public.obter_perguntas_carga_analise",
  "create or replace function public.obter_regra_analise",
);
const REGRA = MIGRATION.slice(
  MIGRATION.indexOf("create or replace function public.obter_regra_analise"),
);
const RPCS_DO_ROBO = [
  "public.listar_resumos_pergunta_pendentes(text[], boolean)",
  "public.ler_respostas_pergunta_vaga(text)",
  "public.gravar_resumo_pergunta_edital(uuid, text, jsonb, integer)",
];

describe("migration do resumo das perguntas da carga", () => {
  it("a tabela segue o padrão MAD, com RLS e sem acesso do cliente", () => {
    expect(MIGRATION).toContain(
      'create table public."TB_RESUMO_PERGUNTA_EDITAL" (',
    );
    for (const nome of [
      '"PK_TB_RESUMO_PERGUNTA_EDITAL"',
      '"FK_MONITORAMENTO_RESPERGEDT"',
      '"CK_RESPERGEDT_DSPERGUNTA"',
      '"CK_RESPERGEDT_QTCANDIDATO"',
    ]) {
      expect(nome.length - 2).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on constraint ${nome}`);
    }
    for (const coluna of [
      "CO_MONITORAMENTO",
      "DS_PERGUNTA",
      "QT_CANDIDATO",
      "DS_HASH_VAGA",
      "DT_ATUALIZACAO",
    ])
      expect(MIGRATION).toContain(
        `comment on column public."TB_RESUMO_PERGUNTA_EDITAL"."${coluna}"`,
      );
    expect(MIGRATION).toContain(
      'alter table public."TB_RESUMO_PERGUNTA_EDITAL" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TB_RESUMO_PERGUNTA_EDITAL" from public, anon, authenticated;',
    );
  });

  it("obter_regra_analise não monta mais as perguntas e chama o papel uma vez", () => {
    expect(REGRA).not.toContain("'perguntas'");
    expect(REGRA).not.toContain("TB_EMPREGARE_CANDIDATO");
    expect(REGRA).not.toContain("DS_COLUNA_ORIGINAL");
    expect(REGRA.match(/FC_PAPEL_AVALIACAO/g)).toHaveLength(1);
    expect(REGRA).toContain(
      "v_coordena boolean := coalesce(v_papel = 'COORDENADOR', false);",
    );
  });

  it("o banco não conta: entrega as respostas cruas e o Python resume", () => {
    // Sem contagem nem corte de 30 no banco; só projeta, apara e corta em 200.
    expect(MIGRATION).not.toMatch(/count\(\*\)::integer as qt/);
    expect(MIGRATION).not.toContain("row_number()");
    expect(LER_VAGA).toContain("left(btrim(e.value), 200)");
    expect(LER_VAGA).toContain("c.\"ST_REGISTRO_ATIVO\" = 'S'");
    expect(LER_VAGA).toContain("e.key ilike 'Pergunta %'");
    expect(ROBO).toContain(
      "from monitora.avaliacao_documental.perguntas_da_carga import resumir_perguntas",
    );
    for (const rpc of [
      "listar_resumos_pergunta_pendentes",
      "ler_respostas_pergunta_vaga",
      "gravar_resumo_pergunta_edital",
    ])
      expect(ROBO).toContain(`"${rpc}"`);
  });

  it("a gravação confere a privacidade e a assinatura da carga", () => {
    expect(GRAVAR).toContain("(r ->> 'quantidade')::numeric < 2");
    expect(GRAVAR).toContain("length(r ->> 'valor') not between 1 and 200");
    expect(GRAVAR).toContain("jsonb_array_length(p -> 'respostas') > 30");
    expect(GRAVAR).toContain("not (p ->> 'coluna' ilike 'Pergunta %')");
    expect(GRAVAR).toContain(
      'if p_hash is distinct from private."FC_HASH_VAGA_EDITAL"(p_edital) then',
    );
    expect(GRAVAR).toContain("errcode = '40001'");
  });

  it("as RPCs do robô só para service_role; a da tela, da coordenação", () => {
    for (const rpc of RPCS_DO_ROBO) {
      expect(MIGRATION).toContain(
        `revoke all on function ${rpc} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${rpc} to service_role;`,
      );
    }
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_HASH_VAGA_EDITAL"(uuid) from public, anon, authenticated, service_role;',
    );
    expect(LEITURA).toContain(
      'private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
    );
    expect(LEITURA).toContain("if v_coordena then");
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_perguntas_carga_analise(uuid) to authenticated, service_role;",
    );
    expect(CONTRATO_RPC.obter_perguntas_carga_analise.argumentos).toEqual([
      "p_edital",
    ]);
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    const a = "-- ===== corpo da migration (sem begin/commit) =====\n";
    const b = "\n-- ===== fim do corpo =====";
    expect(ENSAIO.slice(ENSAIO.indexOf(a) + a.length, ENSAIO.indexOf(b))).toBe(
      corpo(MIGRATION),
    );
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });

  it("o rollback devolve obter_regra_analise de antes e apaga o resumo", () => {
    for (const rpc of RPCS_DO_ROBO)
      expect(ROLLBACK).toContain(
        `drop function if exists ${rpc.replace(/\(.*/, "")}(`,
      );
    expect(ROLLBACK).toContain(
      "drop function if exists public.obter_perguntas_carga_analise(uuid);",
    );
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_RESUMO_PERGUNTA_EDITAL";',
    );
    expect(ROLLBACK).toContain(
      "create or replace function public.obter_regra_analise(p_edital uuid)",
    );
    expect(ROLLBACK).toContain("'perguntas', case when coalesce(v_coordena");
  });
});
