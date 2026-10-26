import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizarNome } from "../src/lib/publicacao-de-aprovados.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration "Lista de aprovados: substituir preserva o estado" (20261026150000),
  ainda não aplicada. O ensaio (supabase/ensaios/) roda o corpo em duas listas
  reais e desfaz; os casos das RPCs (lista sem status, status casando, status
  sem par, vínculo à mão, sem motivo, remover zera) estão em
  supabase/tests/nova_versao_da_lista_de_aprovados.sql. Aqui, as invariantes
  estáticas: os dois caminhos gravam pela mesma função, com a mesma permissão;
  a função comum leva todo o estado da pessoa; os contratados são
  recalculados em importar, remover e ativar/inativar; e o rollback volta as
  assinaturas de antes.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME =
  "20261026150000_lista_de_aprovados_substituir_preserva_o_estado.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const TESTE = ler("supabase/tests/nova_versao_da_lista_de_aprovados.sql");

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
const PERMISSAO = 'private."FC_EXIGIR_PODE_SUBSTITUIR_LISTA"';
const CONTRATADOS = 'private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"';

describe("Lista de aprovados: substituir preserva o estado (20261026150000)", () => {
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
    expect(TESTE.trimEnd().endsWith("rollback;")).toBe(true);
    expect(TESTE).not.toMatch(/\ncommit;/);
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("os dois caminhos gravam pela mesma função e exigem a mesma permissão", () => {
    for (const rpc of [
      "public.importar_lista_aprovados",
      "public.publicar_lista_aprovados_da_classificacao",
    ]) {
      const sql = funcao(MIGRATION, rpc);
      expect(sql, rpc).toContain(`${COMUM}(`);
      expect(sql, rpc).toContain(`${PERMISSAO}(`);
      expect(sql, rpc).toContain('private."FC_CASAR_NOVA_VERSAO_DA_LISTA"(');
      expect(sql, rpc).toContain(
        'private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"()',
      );
      // Nada de gravar candidatos por fora da função comum.
      expect(sql, rpc).not.toMatch(
        /insert into public\."TB_CANDIDATO_APROVADO"/,
      );
      expect(sql, rpc).not.toMatch(
        /insert into public\."TH_PUBLICACAO_APROVADO"/,
      );
    }
  });

  it("a função comum leva status, matrícula, datas, sub judice, anexos e o vínculo anterior", () => {
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
    // Os sub judice sem par continuam na lista nova.
    expect(sql).toMatch(/o\.removido_em is null and o\.sub_judice\n/);
  });

  it("importar, remover e ativar/inativar recalculam os contratados; sem lista vigente, zera", () => {
    for (const rpc of [
      "public.remover_lista_aprovados",
      "public.definir_lista_aprovados_ativa",
    ])
      expect(funcao(MIGRATION, rpc), rpc).toContain(`perform ${CONTRATADOS}(`);
    const conta = funcao(MIGRATION, CONTRATADOS);
    // Sai só quando o edital nunca teve lista; com lista removida, a conta dá 0.
    expect(conta).toContain(
      'not exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text)',
    );
    expect(conta).toMatch(/coalesce\(\(count\(c\.id\)[\s\S]*?, 0\) qt/);
    expect(funcao(MIGRATION, 'private."FC_EM_OUTRA_LISTA"')).toContain(
      '"CO_CANDIDATO_ANTERIOR"',
    );
  });

  it("permissão: lista já cadastrada só o admin; com estado, motivo", () => {
    const sql = funcao(MIGRATION, PERMISSAO);
    expect(sql).toContain("private.papel_recurso('importacao') <> 'admin'");
    expect(sql).toContain("informe o motivo");
    expect(sql).toContain("length(v_motivo) not between 3 and 500");
    const obter = funcao(MIGRATION, "public.obter_publicacao_lista_aprovados");
    expect(obter).toContain("'pode_substituir', v_pode_substituir");
  });

  it("o casamento do banco é o da tela: o mesmo nome normalizado", () => {
    const sql = funcao(MIGRATION, 'private."FC_NOME_DO_CASAMENTO"');
    const [, de, para] = sql.match(
      /translate\(lower\(coalesce\(p_nome, ''\)\),\s*'([^']+)',\s*'([^']+)'\)/,
    );
    expect([...de].length).toBe([...para].length);
    // Imita a função SQL em JS e compara com normalizarNome nos nomes do dia a dia.
    const comoNoBanco = (nome) => {
      const mapa = new Map([...de].map((c, i) => [c, [...para][i]]));
      const t = [...String(nome ?? "").toLowerCase()]
        .map((c) => mapa.get(c) ?? c)
        .join("")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      return t || null;
    };
    for (const nome of [
      "José  da Silva",
      "MARIA DAS GRAÇAS",
      "Ângela Conceição-Pereira",
      "joão d'ávila",
      "Ítalo Müller Ñuñez",
      "  Zé  ",
    ])
      expect(comoNoBanco(nome), nome).toBe(normalizarNome(nome) || null);
    expect(MIGRATION).toMatch(/'NOME_VAGA'/);
  });

  it("o contrato das RPCs acompanha as assinaturas novas", () => {
    expect(CONTRATO_RPC.importar_lista_aprovados.argumentos).toEqual([
      "p_edital_id",
      "p_ativo",
      "p_arquivo_nome",
      "p_arquivo_path",
      "p_candidatos",
      "p_substituir",
      "p_motivo",
      "p_vinculos",
    ]);
    expect(
      CONTRATO_RPC.publicar_lista_aprovados_da_classificacao.argumentos,
    ).toEqual([
      "p_lista_classificacao",
      "p_lista_vigente",
      "p_vinculos",
      "p_motivo",
    ]);
  });

  it("o rollback volta as assinaturas e tira as funções novas", () => {
    expect(ROLLBACK).toContain(
      "drop function if exists public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text, jsonb);",
    );
    expect(ROLLBACK).toContain(
      "drop function if exists public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb, text);",
    );
    expect(ROLLBACK).toContain(
      "grant execute on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text) to authenticated;",
    );
    expect(ROLLBACK).toContain(
      "grant execute on function public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb) to authenticated;",
    );
    for (const nova of [
      COMUM,
      PERMISSAO,
      'private."FC_CASAR_NOVA_VERSAO_DA_LISTA"',
      'private."FC_PREPARAR_NOVA_VERSAO_DA_LISTA"',
      'private."FC_NOME_DO_CASAMENTO"',
    ])
      expect(ROLLBACK).toContain(`drop function if exists ${nova}(`);
    expect(funcao(ROLLBACK, "public.remover_lista_aprovados")).not.toContain(
      CONTRATADOS,
    );
  });
});
