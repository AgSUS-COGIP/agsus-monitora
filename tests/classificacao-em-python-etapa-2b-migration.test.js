import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROBOS_DE_CARGA } from "../src/lib/robos-de-carga.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da classificação em Python, etapa 2b (20261023200000), ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/. Aqui, as
  invariantes estáticas: a chave nova nasce DESLIGADA e, desligada, nada muda
  (pedir não grava nada; registrar_lista_classificacao é o corpo de antes); o
  registro do cálculo do Python só com o retrato da tela igual, conferido no
  banco; as RPCs do job só para service_role; a tabela com RLS e sem acesso
  direto; o Rodar agora e o registro da execução do GitHub; o Status; e o
  rollback que volta à etapa 2a.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261023200000_classificacao_em_python_etapa_2b.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ETAPA_2A = ler(
  "supabase/migrations/20261023170000_classificacao_em_python_etapa_2.sql",
);
const ROBUSTOS = ler(
  "supabase/migrations/20261022170000_robos_mais_robustos.sql",
);
const CONGELADAS = ler(
  "supabase/migrations/20261020170000_inscricoes_congeladas.sql",
);
const WORKFLOW = ler(".github/workflows/classificacao.yml");
const DISPARO_EXTERNO = ler("python/monitora/disparo_externo.py");

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** O texto de uma função criada no arquivo (create ou create or replace), até o fim do corpo. */
function funcao(sql, nome) {
  let inicio = sql.indexOf(`create or replace function ${nome}(`);
  if (inicio < 0) inicio = sql.indexOf(`create function ${nome}(`);
  expect(inicio, nome).toBeGreaterThanOrEqual(0);
  const fim = sql.indexOf("$function$;", sql.indexOf("$function$", inicio) + 1);
  return sql.slice(inicio, fim);
}
const semEspacos = (texto) => texto.replace(/\s+/g, " ").trim();

const TELA = [
  ["public.pedir_calculo_classificacao", "(uuid, text, integer)"],
  ["public.obter_calculo_classificacao", "(uuid, boolean)"],
  ["public.registrar_lista_calculada", "(uuid, jsonb)"],
  ["public.registrar_divergencia_do_calculo", "(uuid, integer, text[])"],
];
const JOB = [
  ["public.classificacao_ler_pedidos_calculo", "()"],
  ["public.classificacao_marcar_calculo", "(text, uuid, text, text)"],
  ["public.classificacao_gravar_calculo", "(text, uuid, jsonb)"],
];

describe("classificação em Python, etapa 2b (20261023200000)", () => {
  it("é uma transação, com pré-requisitos, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261023170000",
    );
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261022190000",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    // O ensaio nunca usa o segredo real do disparo.
    expect(ENSAIO).toContain(
      "set_config('agsus.segredo_disparo_robos', 'ensaio_disparo_classificacao_2b', true)",
    );
  });

  it("a chave 'Gerar listas pelo Python' nasce DESLIGADA, e sem a linha conta como desligada", () => {
    expect(MIGRATION).toContain(
      "values ('classificacao_calculo', 'Gerar listas pelo Python', 10, 'N', c_motivo, v_autor)",
    );
    expect(MIGRATION).toContain(
      "values ('classificacao_calculo', 'N', c_motivo, v_autor, '{}')",
    );
    expect(MIGRATION).toContain("'classificacao', 'classificacao_calculo'));");
    const ligada = funcao(MIGRATION, 'private."FC_CALCULO_PELO_PYTHON"');
    expect(ligada).toContain(
      `select exists (select 1 from public."TB_CHAVE_AUTOMACAO" c`,
    );
    expect(ligada).toContain(`c."ST_LIGADA" = 'S'`);
    expect(ligada).not.toContain("FC_AUTOMACAO_LIGADA");
  });

  it("as funções são SECURITY DEFINER com search_path vazio", () => {
    for (const [nome] of [
      ...TELA,
      ...JOB,
      ['private."FC_CALCULO_PELO_PYTHON"'],
      ['private."FC_REGISTRAR_LISTA_CLASSIFICACAO"'],
      ["public.registrar_lista_classificacao"],
      ["public.disparar_robo"],
      ["public.registrar_disparo_externo"],
      ["public.get_saude_das_cargas"],
    ]) {
      const f = funcao(MIGRATION, nome).toLowerCase();
      expect(f, nome).toContain("security definer");
      expect(f, nome).toContain("set search_path to ''");
    }
  });

  it("a tela chama as suas RPCs (authenticated, nunca anon); o job, só service_role", () => {
    for (const [nome, args] of TELA) {
      expect(MIGRATION).toContain(
        `revoke all on function ${nome}${args} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${nome}${args} to authenticated;`,
      );
      expect(CONTRATO_RPC[nome.replace("public.", "")], nome).toBeTruthy();
    }
    for (const [nome, args] of JOB) {
      expect(MIGRATION).toContain(
        `revoke all on function ${nome}${args} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${nome}${args} to service_role;`,
      );
      expect(CONTRATO_RPC[nome.replace("public.", "")], nome).toBeUndefined();
    }
    for (const nome of [
      'private."FC_CALCULO_PELO_PYTHON"()',
      'private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(uuid, text, integer, jsonb)',
    ])
      expect(MIGRATION).toContain(
        `revoke all on function ${nome} from public, anon, authenticated, service_role;`,
      );
  });

  it("a tabela dos pedidos: RLS sem política e sem acesso direto; situações da lista fixa", () => {
    expect(MIGRATION).toContain(
      'alter table public."TB_PEDIDO_CALCULO_CLASSIFICACAO" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on table public."TB_PEDIDO_CALCULO_CLASSIFICACAO" from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(
      /create policy[^;]*TB_PEDIDO_CALCULO_CLASSIFICACAO/,
    );
    expect(MIGRATION).toContain(
      "'PEDIDO', 'CALCULANDO', 'PRONTO', 'FALHOU', 'NAO_CONFERE', 'REGISTRADO', 'SEM_DISPARO', 'SUBSTITUIDO'",
    );
    expect(MIGRATION).toContain(
      `check ("DS_MENSAGEM" is null or "DS_MENSAGEM" !~ '@|[0-9]{11}')`,
    );
  });

  it("desligada, nada muda: pedir não grava nem pede nada, e o registro é o corpo de antes", () => {
    const pedir = funcao(MIGRATION, "public.pedir_calculo_classificacao");
    const desligada = pedir.indexOf(
      `if not private."FC_CALCULO_PELO_PYTHON"() then
    return json_build_object('ligada', false);`,
    );
    expect(desligada).toBeGreaterThan(-1);
    expect(desligada).toBeLessThan(pedir.indexOf("insert into"));
    expect(desligada).toBeLessThan(pedir.indexOf("FC_DISPARAR_ROBO"));
    expect(desligada).toBeLessThan(pedir.indexOf("update "));

    // FC_REGISTRAR_LISTA_CLASSIFICACAO = o corpo de registrar_lista_classificacao da 2a sem o porteiro.
    const antes = funcao(ETAPA_2A, "public.registrar_lista_classificacao");
    const depois = funcao(
      MIGRATION,
      'private."FC_REGISTRAR_LISTA_CLASSIFICACAO"',
    );
    const miolo = (f, de, ate) =>
      semEspacos(f.slice(f.indexOf(de), f.indexOf(ate)));
    expect(miolo(depois, "if p_tipo is null", "return v_id;")).toBe(
      miolo(antes, "if p_tipo is null", "return private."),
    );
    const registrar = funcao(MIGRATION, "public.registrar_lista_classificacao");
    expect(registrar).toContain(
      `private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2)`,
    );
    // Dois comandos: a leitura STABLE tem de ver a lista recém-gravada.
    expect(registrar).toContain(
      `v_id := private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(p_edital, p_tipo, p_versao, p_resultado);
  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_id);`,
    );
  });

  it("ligada: o caminho antigo recusa e o pedido vai ao GitHub em nome de quem gerou", () => {
    const registrar = funcao(MIGRATION, "public.registrar_lista_classificacao");
    expect(registrar).toContain(`if private."FC_CALCULO_PELO_PYTHON"() then`);
    expect(registrar).toContain("using errcode = '55000'");
    const pedir = funcao(MIGRATION, "public.pedir_calculo_classificacao");
    expect(pedir).toContain(
      `private."FC_DISPARAR_ROBO"('classificacao.yml', jsonb_build_object('modo', 'calculo'), (select auth.uid()))`,
    );
    expect(pedir).toContain("'PT409'");
    expect(pedir).toContain(
      `private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2)`,
    );
    // O pronto abandonado sai, sem o retrato.
    expect(pedir).toContain(
      `set "TP_SITUACAO" = 'SUBSTITUIDO', "DS_RETRATO" = null`,
    );
  });

  it("registra o retrato do Python só igual ao da tela, conferido no banco", () => {
    const f = funcao(MIGRATION, "public.registrar_lista_calculada");
    expect(f).toContain(`if v."TP_SITUACAO" <> 'PRONTO' then`);
    expect(f).toContain(
      `if p_resultado is null or not (p_resultado = v."DS_RETRATO") then`,
    );
    expect(f).toContain(
      "return json_build_object('nao_confere', true, 'pedido', p_pedido);",
    );
    expect(f).toContain(
      `v_lista := private."FC_REGISTRAR_LISTA_CLASSIFICACAO"(v."CO_MONITORAMENTO", v."TP_LISTA", v."NU_VERSAO_REGRA", v."DS_RETRATO");`,
    );
    expect(f).toContain(`"TP_SITUACAO" = 'REGISTRADO'`);
    expect(f).toContain(`"DS_RETRATO" = null`);
    // A gravação do job confere forma, versão, regra vigente e candidatos, e calcula o hash como o registro.
    const gravar = funcao(MIGRATION, "public.classificacao_gravar_calculo");
    expect(gravar).toContain(
      `p_retrato ->> 'tipo' is distinct from v."TP_LISTA"`,
    );
    expect(gravar).toContain(
      `(p_retrato ->> 'regra_versao')::numeric <> v."NU_VERSAO_REGRA"`,
    );
    expect(gravar).toContain(
      `private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(v."CO_MONITORAMENTO", p_retrato)`,
    );
    expect(gravar).toContain(
      "encode(sha256(convert_to(p_retrato::text, 'UTF8')), 'hex')",
    );
    expect(
      funcao(MIGRATION, 'private."FC_REGISTRAR_LISTA_CLASSIFICACAO"'),
    ).toContain("encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex')");
    // A divergência leva só caminhos, sem valores.
    const divergencia = funcao(
      MIGRATION,
      "public.registrar_divergencia_do_calculo",
    );
    expect(divergencia).toContain(
      String.raw`c !~ '^[A-Za-z0-9_.\[\]-]{1,200}$'`,
    );
    expect(divergencia).toContain("cardinality(v_caminhos) > 20");
  });

  it("as listas que esperam o relatório incluem SEM_DISPARO (o resto é o corpo da 2a)", () => {
    const antes = funcao(
      ETAPA_2A,
      "public.classificacao_ler_pedidos_desempate",
    );
    const depois = funcao(
      MIGRATION,
      "public.classificacao_ler_pedidos_desempate",
    );
    expect(depois).toContain(
      `x."TP_SITUACAO" in ('PEDIDO', 'PREPARANDO', 'SEM_DISPARO')`,
    );
    expect(
      semEspacos(
        depois
          .replace("create or replace function", "create function")
          .replace(", 'SEM_DISPARO')", ")"),
      ),
    ).toBe(semEspacos(antes));
  });

  it("Rodar agora: disparar_robo é o corpo de 20261022170000 + o robô do relatório; o robô está em ROBOS_DE_CARGA", () => {
    const antes = funcao(ROBUSTOS, "public.disparar_robo");
    const depois = funcao(MIGRATION, "public.disparar_robo");
    const entrada = depois.slice(
      depois.indexOf("),\n    -- [classificacao-python]"),
      depois.indexOf("jsonb_build_array('normal')));") +
        "jsonb_build_array('normal')))".length,
    );
    expect(entrada).toContain(
      "'classificacao_desempate', jsonb_build_object('nome', 'Relatório de desempate (Classificação em Python)'",
    );
    expect(entrada).toContain("'workflow', 'classificacao.yml'");
    expect(semEspacos(depois.replace(entrada, "))"))).toBe(semEspacos(antes));
    // Os robôs de disparar_robo são, de novo, os de ROBOS_DE_CARGA.
    expect(
      [...depois.matchAll(/^ {4}'([a-z_]+)', jsonb_build_object\('nome'/gm)]
        .map((m) => m[1])
        .sort(),
    ).toEqual(ROBOS_DE_CARGA.map((r) => r.id).sort());
    const robo = ROBOS_DE_CARGA.find((r) => r.id === "classificacao_desempate");
    expect(robo?.workflow).toBe("classificacao.yml");
  });

  it("a execução iniciada no GitHub é registrada (banco, Python e workflow)", () => {
    const antes = funcao(ROBUSTOS, "public.registrar_disparo_externo");
    const depois = funcao(MIGRATION, "public.registrar_disparo_externo");
    expect(depois).toContain(
      "'leitura-de-arquivos.yml', 'classificacao.yml') then",
    );
    expect(semEspacos(depois.replace(", 'classificacao.yml'", ""))).toBe(
      semEspacos(antes),
    );
    expect(DISPARO_EXTERNO).toContain('"classificacao.yml",');
    expect(WORKFLOW).toContain("- name: Registrar a execução no MONITORA");
    expect(WORKFLOW).toContain(
      "run: python -m monitora.disparo_externo classificacao.yml",
    );
  });

  it("o workflow aceita os três modos e roda o modo certo, com os inputs por variável de ambiente", () => {
    for (const modo of ["normal", "calculo", "desempate"])
      expect(WORKFLOW).toContain(`          - ${modo}\n`);
    expect(WORKFLOW).toContain(
      "python scripts/classificacao/classificacao.py --calculo",
    );
    expect(WORKFLOW).toContain(
      'python scripts/classificacao/classificacao.py --desempate --lista "$LISTAS"',
    );
    // Os inputs nunca são interpolados no shell.
    expect(WORKFLOW.slice(WORKFLOW.indexOf("        run: |"))).not.toContain(
      "${{",
    );
    expect(WORKFLOW).toContain("group: classificacao");
  });

  it("Status das atualizações: o corpo de 20261020170000 + os preparos e os pedidos", () => {
    const antes = funcao(CONGELADAS, "public.get_saude_das_cargas");
    const depois = funcao(MIGRATION, "public.get_saude_das_cargas");
    const bloco = depois.slice(
      depois.indexOf("    -- [classificacao-python]"),
      depois.indexOf("    'tarefas', v_tarefas"),
    );
    expect(bloco).toContain("'classificacao_python', json_build_object(");
    expect(bloco).toContain(`from public."TB_PREPARO_DESEMPATE" t`);
    expect(bloco).toContain(`from public."TB_PEDIDO_CALCULO_CLASSIFICACAO" t`);
    expect(bloco).not.toContain("DS_RETRATO");
    expect(semEspacos(depois.replace(bloco, ""))).toBe(semEspacos(antes));
  });

  it("o rollback volta à etapa 2a", () => {
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    for (const [nome, args] of [
      ...TELA,
      ...JOB,
      [
        'private."FC_REGISTRAR_LISTA_CLASSIFICACAO"',
        "(uuid, text, integer, jsonb)",
      ],
      ['private."FC_CALCULO_PELO_PYTHON"', "()"],
    ])
      expect(ROLLBACK).toContain(`drop function if exists ${nome}${args};`);
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_PEDIDO_CALCULO_CLASSIFICACAO";',
    );
    expect(ROLLBACK).toContain(
      `delete from public."TB_CHAVE_AUTOMACAO" where "CO_CHAVE" = 'classificacao_calculo';`,
    );
    // Os corpos de antes, iguais aos das migrations de origem.
    for (const [nome, origem] of [
      ["public.registrar_lista_classificacao", ETAPA_2A],
      ["public.disparar_robo", ROBUSTOS],
      ["public.registrar_disparo_externo", ROBUSTOS],
      ["public.get_saude_das_cargas", CONGELADAS],
    ])
      expect(semEspacos(funcao(ROLLBACK, nome)), nome).toBe(
        semEspacos(funcao(origem, nome)),
      );
    expect(
      semEspacos(
        funcao(ROLLBACK, "public.classificacao_ler_pedidos_desempate"),
      ),
    ).toBe(
      semEspacos(
        funcao(ETAPA_2A, "public.classificacao_ler_pedidos_desempate").replace(
          "create function",
          "create or replace function",
        ),
      ),
    );
    // Restaurar as funções antes de tirar a tabela que a 2b lê.
    expect(ROLLBACK.indexOf("public.get_saude_das_cargas()")).toBeLessThan(
      ROLLBACK.indexOf(
        'drop table if exists public."TB_PEDIDO_CALCULO_CLASSIFICACAO"',
      ),
    );
  });
});
