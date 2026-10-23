import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration da versão 2 do relatório de desempate (20261023230000), ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/. Aqui, as
  invariantes estáticas: a leitura da lista para o job ganha quem a gerou (o
  nome do cadastro, sem nada com "@"), a gravação aceita as versões 1 e 2 e
  grava a recebida, com as mesmas conferências de antes, as duas RPCs só para
  service_role e o rollback que volta aos corpos de 20261023170000.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261023230000_relatorio_de_desempate_versao_2.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ETAPA_2 = ler(
  "supabase/migrations/20261023170000_classificacao_em_python_etapa_2.sql",
);

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** O corpo de uma função criada no arquivo (create ou create or replace). */
function funcao(sql, nome) {
  let inicio = sql.indexOf(`create or replace function ${nome}(`);
  if (inicio < 0) inicio = sql.indexOf(`create function ${nome}(`);
  expect(inicio, nome).toBeGreaterThanOrEqual(0);
  const fim = sql.indexOf("$function$;", sql.indexOf("$function$", inicio) + 1);
  return sql.slice(inicio, fim);
}
const semCabecalho = (f) => f.slice(f.indexOf("as $function$"));

describe("relatório de desempate, versão 2 (20261023230000)", () => {
  it("é uma transação, com pré-requisitos, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261023170000",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
  });

  it("as duas RPCs são SECURITY DEFINER, com search_path vazio, só para service_role", () => {
    for (const [nome, assinatura] of [
      ["public.classificacao_ler_lista", "uuid"],
      [
        "public.classificacao_gravar_desempate",
        "text, uuid, text, jsonb, text",
      ],
    ]) {
      const f = funcao(MIGRATION, nome);
      expect(f, nome).toContain("security definer");
      expect(f, nome).toContain("set search_path to ''");
      expect(MIGRATION).toContain(
        `revoke all on function ${nome}(${assinatura}) from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${nome}(${assinatura}) to service_role;`,
      );
    }
  });

  it("a leitura da lista traz quem a gerou pelo nome e sobrenome do cadastro, sem e-mail", () => {
    const f = funcao(MIGRATION, "public.classificacao_ler_lista");
    expect(f).toContain(
      'select private."FC_NOME_E_SOBRENOME"(p.nome) into v_nome',
    );
    expect(f).toContain(
      'from public."TB_PERFIL_USUARIO" p where p.user_id = v."CO_USUARIO"',
    );
    expect(f).toContain(
      "'gerada_por', case when v_nome ~ '@' then null else left(v_nome, 120) end",
    );
    expect(f).not.toContain("email");
    // O resto da leitura é o de antes.
    for (const chave of [
      "'id', v.\"CO_LISTA_CLASSIFICACAO\"",
      "'hash', v.\"DS_HASH\"",
      "'gerada_em', v.\"DT_GERACAO\"",
      "'resultado', v.\"DS_RESULTADO\"",
    ]) {
      expect(funcao(ETAPA_2, "public.classificacao_ler_lista")).toContain(
        chave,
      );
      expect(f).toContain(chave);
    }
  });

  it("a gravação aceita as versões 1 e 2, grava a recebida e mantém as conferências", () => {
    const gravar = funcao(MIGRATION, "public.classificacao_gravar_desempate");
    const antes = funcao(ETAPA_2, "public.classificacao_gravar_desempate");
    expect(antes).toContain("(p_relatorio->>'versao')::numeric <> 1");
    expect(gravar).toContain("(p_relatorio->>'versao') not in ('1', '2')");
    expect(gravar).toContain(
      "values (p_lista, v_versao, p_relatorio, p_texto, p_hash",
    );
    for (const trecho of [
      'p_hash is distinct from v_lista."DS_HASH"',
      "p_relatorio->>'tipo' is distinct from v_lista.\"TP_LISTA\"",
      "'$.vagas[*].grupos[*].candidatos[*].analiseId'",
      "'@|[0-9]{11}'",
      `set "TP_SITUACAO" = 'PRONTO'`,
    ]) {
      expect(antes).toContain(trecho);
      expect(gravar).toContain(trecho);
    }
  });

  it("o rollback volta aos corpos de 20261023170000", () => {
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    for (const nome of [
      "public.classificacao_ler_lista",
      "public.classificacao_gravar_desempate",
    ])
      expect(semCabecalho(funcao(ROLLBACK, nome))).toBe(
        semCabecalho(funcao(ETAPA_2, nome)),
      );
  });
});
