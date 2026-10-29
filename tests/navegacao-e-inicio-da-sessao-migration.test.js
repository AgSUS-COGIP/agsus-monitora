import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Navegação e início da sessão, cada um numa chamada (diagnóstico de
  desempenho, 29/10/2026). A migration só acrescenta duas funções que chamam
  ou leem o que já existe: o que se grava e o que cada pessoa vê não mudam.
*/
const NOME = "20261029121700_navegacao_e_inicio_da_sessao_numa_chamada.sql";
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const sql = ler(`supabase/migrations/${NOME}`);

describe(NOME, () => {
  it("numa transação, só acrescenta (sem drop nem alteração de dados)", () => {
    expect(sql.trim()).toMatch(/^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/);
    // O cabeçalho cita o rollback (drop); o código, não.
    const codigo = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
    expect(codigo).not.toMatch(/\bdrop\b/i);
    expect(codigo).not.toMatch(
      /\b(insert|update|delete)\b\s+(into|public|from)/i,
    );
  });

  it("a navegação grava pelas duas RPCs de antes e não desfaz o evento se a presença falhar", () => {
    expect(sql).toContain("public.registrar_evento_acesso(");
    expect(sql).toContain("public.registrar_presenca_monitora(p_current_view)");
    expect(sql).toMatch(
      /exception when others then\s+v_presenca := jsonb_build_object\(\s+'presenca_erro'/,
    );
  });

  it("o início passa pela RLS de sempre (SECURITY INVOKER) e só para quem entrou", () => {
    const inicio = sql.slice(
      sql.indexOf("function public.obter_inicio_da_sessao"),
    );
    expect(inicio).toMatch(/security invoker/);
    expect(inicio).not.toMatch(/security definer/);
    for (const parte of [
      'public."TB_CONFIGURACAO"',
      'public."TB_PAINEL_EXTERNO"',
      "public.listar_abas_do_menu()",
      "public.obter_situacao_do_sistema()",
      'public."TD_UNIDADE"',
    ])
      expect(inicio).toContain(parte);
    expect(sql).toMatch(
      /revoke all on function public\.obter_inicio_da_sessao\(\) from public, anon;/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.obter_inicio_da_sessao\(\) to authenticated;/,
    );
  });

  it("as colunas de cada parte são as das consultas do front", () => {
    // src/app/paineis-externos.ts e src/app/carga.ts (TD_UNIDADE).
    for (const coluna of [
      "id",
      "codigo",
      "titulo",
      "icone",
      "url",
      "ordem",
      "ativo",
      "em_manutencao",
      "tipo_abertura",
    ])
      expect(sql).toContain(`'${coluna}', p.${coluna}`);
    for (const coluna of [
      "id_unidade",
      "sigla",
      "nome_oficial",
      "tipo",
      "uf_sede",
      "ativo",
    ])
      expect(sql).toContain(`'${coluna}', u.${coluna}`);
    expect(sql).toMatch(/order by u\.tipo, u\.nome_oficial/);
    expect(ler("src/app/paineis-externos.ts")).toContain(
      '"id,codigo,titulo,icone,url,ordem,ativo,em_manutencao,tipo_abertura"',
    );
  });

  it("ensaio termina em rollback; o rollback derruba as duas funções", () => {
    expect(ler(`supabase/ensaios/${NOME}`).trim()).toMatch(/rollback;$/);
    const rollback = ler(`supabase/rollback/${NOME}`);
    expect(rollback).toContain(
      "drop function if exists public.obter_inicio_da_sessao()",
    );
    expect(rollback).toContain(
      "drop function if exists public.registrar_navegacao_monitora(",
    );
  });

  it("os argumentos do contrato são os da função", () => {
    const argumentos = [...sql.matchAll(/^\s+(p_\w+) \w+ default/gm)].map(
      (m) => m[1],
    );
    expect(argumentos.sort()).toEqual(
      [...CONTRATO_RPC.registrar_navegacao_monitora.argumentos].sort(),
    );
    expect(CONTRATO_RPC.obter_inicio_da_sessao.argumentos).toEqual([]);
  });
});
