import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration "Lista de aprovados: substituir preserva o estado" (20261030090000),
  ainda não aplicada. O ensaio (supabase/ensaios/) roda o corpo em duas listas
  reais e desfaz; os casos das RPCs estão em
  supabase/tests/nova_versao_da_lista_de_aprovados.sql e a regra do casamento,
  em tests/python/test_casamento_da_lista.py. Aqui, as invariantes estáticas:
  os dois caminhos passam pelo mesmo pedido, o casamento é do job Python (o
  banco só valida e aplica), a gravação comum leva todo o estado, os
  contratados são recalculados, as permissões vêm da matriz de Acessos com o
  administrador global passando, e o rollback volta tudo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME =
  "20261030090000_lista_de_aprovados_substituir_preserva_o_estado.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const TESTE = ler("supabase/tests/nova_versao_da_lista_de_aprovados.sql");
const WORKFLOW = ler(".github/workflows/casamento-da-lista.yml");
const JOB = ler("scripts/aprovados/casamento_da_lista.py");

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** A definição de uma função (do create até o $function$; que fecha). */
function funcao(sql, nome) {
  const baixo = sql.toLowerCase();
  const alvo = nome.toLowerCase();
  let inicio = baixo.indexOf(`create or replace function ${alvo}(`);
  if (inicio < 0) inicio = baixo.indexOf(`create function ${alvo}(`);
  expect(inicio, nome).toBeGreaterThanOrEqual(0);
  const fim = baixo.indexOf(
    "$function$;",
    baixo.indexOf("$function$", inicio) + 1,
  );
  return sql.slice(inicio, fim);
}

const COMUM = 'private."FC_GRAVAR_NOVA_VERSAO_DA_LISTA"';
const CONTRATADOS = 'private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"';
const GLOBAL = 'private."FC_ADMIN_GLOBAL_ATIVO"((select auth.uid()))';

describe("Lista de aprovados: substituir preserva o estado (20261030090000)", () => {
  it("é uma transação, com pré-requisitos; o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261024120000_contratado_em_outra_lista.sql.'",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    expect(ENSAIO).toContain(
      "set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';",
    );
    expect(TESTE).toContain(
      "set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';",
    );
    expect(TESTE.trimEnd().endsWith("rollback;")).toBe(true);
    expect(TESTE).not.toMatch(/\ncommit;/);
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("os dois caminhos passam pelo mesmo pedido e pela mesma gravação; os antigos saem", () => {
    const pedir = funcao(MIGRATION, "public.pedir_casamento_da_lista");
    expect(pedir).toContain("if p_origem = 'XLSX' then");
    expect(pedir).toContain('private."FC_NOVOS_DA_CLASSIFICACAO"(');
    expect(pedir).toContain('private."FC_EXIGIR_PEDIR_NOVA_VERSAO"(');
    expect(pedir).toContain('private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"(');
    // Com lista vigente, o casamento é do job; sem ela, o plano sai vazio, na hora.
    expect(pedir).toContain(
      "private.\"FC_DISPARAR_ROBO\"('casamento-da-lista.yml'",
    );
    expect(pedir).toContain("'vinculos', '[]'::jsonb");
    const aplicar = funcao(MIGRATION, "public.aplicar_casamento_da_lista");
    expect(aplicar).toContain(`${COMUM}(`);
    expect(aplicar).toContain("errcode = 'PT409'");
    expect(aplicar).toContain('private."FC_BASE_DA_LISTA"(v_vigente)');
    expect(aplicar).toMatch(
      /FC_EXIGIR_PODE_SUBSTITUIR_LISTA"\([^;]*p_motivo, true\)/,
    );
    // O banco não casa ninguém: nada de nome normalizado nem de casamento em SQL.
    expect(MIGRATION).not.toMatch(/FC_NOME_DO_CASAMENTO|FC_CASAR_NOVA_VERSAO/);
    expect(MIGRATION).toContain(
      "drop function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text);",
    );
    expect(MIGRATION).toContain(
      "drop function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb);",
    );
  });

  it("o plano do job é só validado e guardado (service_role)", () => {
    const gravar = funcao(MIGRATION, "public.gravar_casamento_da_lista");
    for (const conferencia of [
      "Vínculo inválido.",
      "Cada pessoa só pode ser vinculada uma vez.",
      "Vínculo com candidato que não está na lista vigente.",
      "Vínculo com candidato que não está na lista nova.",
      "Vínculo pela análise com análise diferente.",
      "O plano não respeita a revisão à mão.",
      "A lista vigente mudou desde o pedido; peça a prévia de novo.",
    ])
      expect(gravar, conferencia).toContain(conferencia);
    expect(gravar).not.toMatch(/insert into public\."TB_CANDIDATO_APROVADO"/);
    for (const rpc of [
      "casamento_ler_pedidos(uuid)",
      "gravar_casamento_da_lista(text, uuid, jsonb, text)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function public.${rpc} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${rpc} to service_role;`,
      );
    }
    expect(MIGRATION).toContain(
      'alter table public."TB_PEDIDO_CASAMENTO_LISTA" enable row level security;',
    );
    expect(MIGRATION).toContain(
      "'casamento-da-lista.yml', jsonb_build_array('modo', 'pedido'))",
    );
    expect(MIGRATION).toContain(
      "'pacotes-dos-paineis.yml', 'casamento-da-lista.yml']));",
    );
  });

  it("o job e o workflow: chamam as RPCs do banco e só imprimem contagens", () => {
    expect(JOB).toContain('"casamento_ler_pedidos"');
    expect(JOB).toContain('"gravar_casamento_da_lista"');
    expect(JOB).toContain("from monitora.aprovados import casamento");
    expect(WORKFLOW).toContain(
      "python scripts/aprovados/casamento_da_lista.py",
    );
    expect(WORKFLOW).toContain("PEDIDO: ${{ inputs.pedido }}");
    expect(WORKFLOW).not.toMatch(/^\s+(push|schedule):/m);
  });

  it("a gravação comum leva status, matrícula, datas, sub judice, anexos e o vínculo anterior", () => {
    const sql = funcao(MIGRATION, COMUM);
    for (const campo of [
      "o.status",
      "o.processo_sei",
      "o.matricula",
      'o."DT_CONVOCACAO"',
      "coalesce(o.sub_judice, false)",
      "coalesce(o.alterado_judicialmente, false)",
      'coalesce(n.analise_id, o."CO_ANALISE_CURRICULAR")',
    ])
      expect(sql, campo).toContain(campo);
    expect(sql).toMatch(/"CO_CANDIDATO_ANTERIOR"/);
    expect(sql).toContain('insert into public."TB_ANEXO_CANDIDATO_APROVADO"');
    expect(sql).toContain('insert into public."TH_PUBLICACAO_APROVADO"');
    expect(sql).toContain('private."FC_RECOLOCAR_NA_CLASSIFICACAO"');
    expect(sql).toContain(`perform ${CONTRATADOS}(p_edital)`);
    expect(sql).toMatch(/o\.removido_em is null and o\.sub_judice\n/);
  });

  it("aplicar, remover e ativar/inativar recalculam os contratados; sem lista vigente, zera", () => {
    for (const rpc of [
      "public.remover_lista_aprovados",
      "public.definir_lista_aprovados_ativa",
    ])
      expect(funcao(MIGRATION, rpc), rpc).toContain(`perform ${CONTRATADOS}(`);
    const conta = funcao(MIGRATION, CONTRATADOS);
    expect(conta).toContain(
      'not exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text)',
    );
    expect(conta).toMatch(/coalesce\(\(count\(c\.id\)[\s\S]*?, 0\) qt/);
    expect(funcao(MIGRATION, 'private."FC_EM_OUTRA_LISTA"')).toContain(
      '"CO_CANDIDATO_ANTERIOR"',
    );
  });

  it("permissões pela matriz de Acessos, sem perfil fixo, com o admin global passando", () => {
    expect(funcao(MIGRATION, 'private."FC_PODE_SUBSTITUIR_LISTA"')).toContain(
      `${GLOBAL} or private.pode_recurso('importacao', 3)`,
    );
    const pedirNova = funcao(
      MIGRATION,
      'private."FC_EXIGIR_PEDIR_NOVA_VERSAO"',
    );
    expect(pedirNova).toContain(`if ${GLOBAL} then`);
    expect(pedirNova).toContain("private.pode_recurso('importacao', 2)");
    expect(pedirNova).toContain(
      'private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2)',
    );
    expect(funcao(MIGRATION, "public.remover_lista_aprovados")).toContain(
      'if not private."FC_PODE_SUBSTITUIR_LISTA"() then',
    );
    expect(funcao(MIGRATION, "public.definir_lista_aprovados_ativa")).toContain(
      `if not ${GLOBAL} then`,
    );
    // Nada de perfil fixo nas funções novas ou trocadas.
    expect(corpo(MIGRATION)).not.toMatch(/monitora_role\(\)|papel_recurso\(/);
    const exigir = funcao(
      MIGRATION,
      'private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"',
    );
    expect(exigir).toContain("length(v_motivo) not between 3 and 500");
    expect(exigir).toContain("informe o motivo");
    expect(
      funcao(MIGRATION, "public.obter_publicacao_lista_aprovados"),
    ).toContain("'pode_substituir', v_pode_substituir");
  });

  it("o contrato das RPCs acompanha o fluxo novo", () => {
    expect(CONTRATO_RPC.importar_lista_aprovados).toBeUndefined();
    expect(
      CONTRATO_RPC.publicar_lista_aprovados_da_classificacao,
    ).toBeUndefined();
    expect(CONTRATO_RPC.pedir_casamento_da_lista.argumentos).toEqual([
      "p_edital",
      "p_origem",
      "p_candidatos",
      "p_lista_classificacao",
      "p_lista_vigente",
      "p_arquivo_nome",
      "p_manuais",
    ]);
    expect(CONTRATO_RPC.obter_casamento_da_lista.argumentos).toEqual([
      "p_pedido",
    ]);
    expect(CONTRATO_RPC.aplicar_casamento_da_lista.argumentos).toEqual([
      "p_pedido",
      "p_motivo",
      "p_ativo",
      "p_arquivo_path",
    ]);
  });

  it("FC_EM_OUTRA_LISTA está no fecho das leituras por versão: recalcula as fontes", () => {
    expect(MIGRATION).toContain(
      'select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();',
    );
    expect(ROLLBACK).toContain(
      'select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();',
    );
  });

  it("o rollback tira o fluxo novo e volta os caminhos antigos", () => {
    for (const nova of [
      "public.aplicar_casamento_da_lista(",
      "public.obter_casamento_da_lista(",
      "public.gravar_casamento_da_lista(",
      "public.casamento_ler_pedidos(",
      "public.pedir_casamento_da_lista(",
      `${COMUM}(`,
      'private."FC_PODE_SUBSTITUIR_LISTA"(',
      'private."FC_EXIGIR_PEDIR_NOVA_VERSAO"(',
      'private."FC_NOVOS_DA_CLASSIFICACAO"(',
    ])
      expect(ROLLBACK).toContain(`drop function if exists ${nova}`);
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_PEDIDO_CASAMENTO_LISTA";',
    );
    expect(ROLLBACK).toContain(
      "grant execute on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text) to authenticated;",
    );
    expect(ROLLBACK).toContain(
      "grant execute on function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb) to authenticated;",
    );
    expect(ROLLBACK).not.toContain(
      "'casamento-da-lista.yml', jsonb_build_array",
    );
    expect(funcao(ROLLBACK, "public.remover_lista_aprovados")).not.toContain(
      CONTRATADOS,
    );
  });
});
