import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration da classificação em Python, etapa 2a (20261023170000), ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/. Aqui, as
  invariantes estáticas: o job lê os nomes reais só como service_role, gerar a
  lista pede o relatório sem nunca derrubar o registro, a chave da automação
  nova manda no pedido, as RPCs do job só para service_role, a tabela do
  preparo com RLS e sem acesso direto, a tela lendo o preparo com o porteiro
  da Classificação e o rollback que volta à etapa 1.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261023170000_classificacao_em_python_etapa_2.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ETAPA_1 = ler(
  "supabase/migrations/20261023140000_classificacao_em_python_e_relatorio_de_desempate.sql",
);
const CHAVES = ler(
  "supabase/migrations/20261022190000_chaves_da_automacao.sql",
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

describe("classificação em Python, etapa 2a (20261023170000)", () => {
  it("é uma transação, com pré-requisitos, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261023140000",
    );
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261022190000",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    // O ensaio nunca usa o segredo real do disparo.
    expect(ENSAIO).toContain(
      "set_config('agsus.segredo_disparo_robos', 'ensaio_disparo_classificacao', true)",
    );
  });

  it("as funções são SECURITY DEFINER com search_path vazio", () => {
    for (const nome of [
      "public.classificacao_ler_edital",
      'private."FC_DISPARAR_ROBO"',
      'private."FC_PEDIR_DESEMPATE"',
      "public.registrar_lista_classificacao",
      "public.classificacao_ler_pedidos_desempate",
      "public.classificacao_ler_lista",
      "public.classificacao_marcar_preparo",
      "public.classificacao_gravar_desempate",
      "public.obter_desempate_da_lista",
    ]) {
      const f = funcao(MIGRATION, nome);
      expect(f, nome).toContain("security definer");
      expect(f, nome).toContain("set search_path to ''");
    }
  });

  it("o job lê os nomes reais, só como service_role, e sem autores nem retrato", () => {
    const f = funcao(MIGRATION, "public.classificacao_ler_edital");
    expect(f).toContain(
      "'candidatos', coalesce(v_dados->'candidatos', '[]'::jsonb)",
    );
    expect(f).not.toContain("apelido");
    expect(f).toContain("d.value - 'por'");
    expect(f).toContain("i.value - 'justificativa'");
    expect(f).not.toContain("DS_RESULTADO");
    expect(MIGRATION).toContain(
      'drop collation if exists private."CL_NOME_PT_BR_BASE";',
    );
    for (const assinatura of [
      "public.classificacao_ler_edital(uuid)",
      "public.classificacao_ler_pedidos_desempate(uuid[])",
      "public.classificacao_ler_lista(uuid)",
      "public.classificacao_marcar_preparo(text, uuid, text, text)",
      "public.classificacao_gravar_desempate(text, uuid, text, jsonb, text)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to service_role;`,
      );
    }
  });

  it("gerar a lista pede o relatório depois de gravar e nunca derruba o registro", () => {
    const registrar = funcao(MIGRATION, "public.registrar_lista_classificacao");
    expect(
      registrar.indexOf(
        'perform private."FC_PEDIR_DESEMPATE"(v_id, (select auth.uid()));',
      ),
    ).toBeGreaterThan(
      registrar.indexOf('returning "CO_LISTA_CLASSIFICACAO" into v_id;'),
    );
    // O resto do corpo é o de antes (conflito de versão PT409, candidatos do edital).
    expect(registrar).toContain("using errcode = 'PT409'");
    expect(registrar).toContain(
      'perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital, p_resultado);',
    );
    const pedir = funcao(MIGRATION, 'private."FC_PEDIR_DESEMPATE"');
    expect(pedir).toContain("private.\"FC_AUTOMACAO_LIGADA\"('classificacao')");
    expect(pedir).toContain("v_situacao := 'DESLIGADA';");
    expect(pedir).toContain("exception when others then");
    expect(pedir).toContain("v_situacao := 'SEM_DISPARO';");
    expect(pedir).toContain(
      "'classificacao.yml', jsonb_build_object('modo', 'desempate', 'listas', p_lista::text), p_usuario",
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_PEDIR_DESEMPATE"(uuid, uuid) from public, anon, authenticated, service_role;',
    );
  });

  it("a chave nova e o workflow na lista fixa, sem mexer no resto de FC_DISPARAR_ROBO", () => {
    expect(MIGRATION).toContain(
      "'pre_classificacao', 'conferencias', 'paineis', 'manutencao', 'classificacao'));",
    );
    expect(MIGRATION).toContain(
      "values ('classificacao', 'Classificação em Python', 9, 'S', c_motivo, v_autor)",
    );
    expect(funcao(MIGRATION, 'private."FC_CHAVE_DO_WORKFLOW"')).toContain(
      "when 'classificacao.yml' then 'classificacao'",
    );
    expect(MIGRATION).toContain(
      "'leitura-de-arquivos.yml', 'classificacao.yml']));",
    );
    const nova = funcao(MIGRATION, 'private."FC_DISPARAR_ROBO"');
    const antiga = funcao(CHAVES, 'private."FC_DISPARAR_ROBO"');
    expect(nova).toContain(
      "'classificacao.yml', jsonb_build_array('modo', 'listas'));",
    );
    expect(
      nova.replace(
        ",\n    'classificacao.yml', jsonb_build_array('modo', 'listas'));",
        ");",
      ),
    ).toBe(antiga);
  });

  it("o preparo segue a MAD, liga a RLS, não abre acesso direto e não guarda dado pessoal", () => {
    expect(MIGRATION).toContain('create table public."TB_PREPARO_DESEMPATE"');
    expect(MIGRATION).toContain(
      'constraint "FK_LISTACLASSIF_PREPARODESEMP" foreign key ("CO_LISTA_CLASSIFICACAO")',
    );
    expect(MIGRATION).toContain(
      'check ("DS_MENSAGEM" is null or "DS_MENSAGEM" !~ \'@|[0-9]{11}\')',
    );
    expect(MIGRATION).toContain(
      'alter table public."TB_PREPARO_DESEMPATE" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on table public."TB_PREPARO_DESEMPATE" from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(/create policy/i);
    const tabela = MIGRATION.slice(
      MIGRATION.indexOf('create table public."TB_PREPARO_DESEMPATE"'),
      MIGRATION.indexOf('comment on table public."TB_PREPARO_DESEMPATE"'),
    );
    const colunas = [
      ...tabela.matchAll(/^\s+"([A-Z]{2}_[A-Z_]+)" [a-z]/gm),
    ].map((m) => m[1]);
    expect(colunas.length).toBe(7);
    for (const coluna of colunas)
      expect(MIGRATION, coluna).toContain(
        `comment on column public."TB_PREPARO_DESEMPATE"."${coluna}"`,
      );
  });

  it("a marcação do job não faz PRONTO; a gravação do relatório faz, com as conferências de antes", () => {
    const marcar = funcao(MIGRATION, "public.classificacao_marcar_preparo");
    expect(marcar).toContain(
      "p_situacao not in ('PREPARANDO', 'NAO_CONFERE', 'FALHOU')",
    );
    expect(marcar).toContain("v_mensagem ~ '@|[0-9]{11}'");
    const gravar = funcao(MIGRATION, "public.classificacao_gravar_desempate");
    const antes = funcao(ETAPA_1, "public.classificacao_gravar_desempate");
    for (const trecho of [
      'p_hash is distinct from v_lista."DS_HASH"',
      "p_relatorio->>'tipo' is distinct from v_lista.\"TP_LISTA\"",
      "'$.vagas[*].grupos[*].candidatos[*].analiseId'",
      "'@|[0-9]{11}'",
    ]) {
      expect(antes).toContain(trecho);
      expect(gravar).toContain(trecho);
    }
    expect(gravar).toContain(`set "TP_SITUACAO" = 'PRONTO'`);
  });

  it("a tela lê o relatório e o preparo com o porteiro da Classificação", () => {
    const f = funcao(MIGRATION, "public.obter_desempate_da_lista");
    expect(f).toContain(
      'private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_edital, 1)',
    );
    expect(f).toContain("'preparo', v_preparo");
    expect(f).toContain("if v_preparo is null and v_relatorio is null then");
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_desempate_da_lista(uuid) to authenticated, service_role;",
    );
  });

  it("o rollback volta à etapa 1 (apelidos, sem preparo, sem a chave nem o workflow)", () => {
    for (const trecho of [
      "drop function if exists public.classificacao_marcar_preparo(text, uuid, text, text);",
      "drop function if exists public.classificacao_ler_lista(uuid);",
      "drop function if exists public.classificacao_ler_pedidos_desempate(uuid[]);",
      'drop function if exists private."FC_PEDIR_DESEMPATE"(uuid, uuid);',
      'drop table if exists public."TB_PREPARO_DESEMPATE";',
      'delete from public."TL_DISPARO_ROBO" where "NO_WORKFLOW" = \'classificacao.yml\';',
      'delete from public."TB_CHAVE_AUTOMACAO" where "CO_CHAVE" = \'classificacao\';',
      funcao(ETAPA_1, "public.classificacao_ler_edital"),
      funcao(ETAPA_1, "public.classificacao_gravar_desempate"),
      funcao(ETAPA_1, "public.obter_desempate_da_lista"),
      funcao(CHAVES, 'private."FC_DISPARAR_ROBO"'),
    ])
      expect(ROLLBACK).toContain(trecho);
    expect(ROLLBACK).toContain(
      "create collation private.\"CL_NOME_PT_BR_BASE\" (provider = icu, locale = 'pt-BR-u-ks-level1', deterministic = false);",
    );
    expect(
      funcao(ROLLBACK, "public.registrar_lista_classificacao"),
    ).not.toContain("FC_PEDIR_DESEMPATE");
  });
});
