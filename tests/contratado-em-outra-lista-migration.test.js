import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration "Contratado em outra lista" (20261024120000), ainda não aplicada:
  o ensaio begin…rollback está em supabase/ensaios/. Aqui, as invariantes
  estáticas: o status novo no domínio, o instantâneo do job Python fechado
  (RLS, só pelas RPCs de service_role), as contagens de contratados e a
  leitura da conferência mudando SÓ a condição que lê o instantâneo (o resto
  de cada função é o do rollback, que é o que está no banco), os gatilhos que
  refazem a decisão e a mesma lista de motivos da regra em Python.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261024120000_contratado_em_outra_lista.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const REGRA = ler("python/monitora/aprovados/contratacao.py");

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** A definição de uma função (do create até o $function$; que fecha). */
function funcao(sql, nome) {
  const baixo = sql.toLowerCase();
  const inicio = baixo.indexOf(
    `create or replace function ${nome.toLowerCase()}(`,
  );
  expect(inicio, nome).toBeGreaterThanOrEqual(0);
  const fim = baixo.indexOf(
    "$function$;",
    baixo.indexOf("$function$", inicio) + 1,
  );
  return sql.slice(inicio, fim);
}

const CONDICAO = ' and not private."FC_EM_OUTRA_LISTA"(c.id)';
const CONTAGENS = [
  ['private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"', 1],
  ['private."FC_ATUALIZAR_KPIS_PELA_SELECAO"', 1],
  ["public.get_selecao_da_area", 2],
  ["public.listar_acompanhamento_da_visao_geral", 1],
];

describe("Contratado em outra lista (20261024120000)", () => {
  it("é uma transação, com pré-requisitos, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261024090000_contratado_por_vinculo.sql.'",
    );
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    // O ensaio não pede nada ao GitHub: sem a chave, o pedido fica SEM_TOKEN.
    expect(ENSAIO).toContain(
      "set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';",
    );
    expect(ROLLBACK).toMatch(/\nbegin;\n/);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("o status novo entra no domínio e na RPC; o rollback o tira", () => {
    expect(MIGRATION).toMatch(
      /status in \('Convocado', 'Contratado', 'Contratado em outra lista', 'Desistente', 'Migração',\n\s+'Documentação Rejeitada'\)/,
    );
    const rpc = funcao(MIGRATION, "public.alterar_status_candidato_aprovado");
    expect(rpc).toContain("'Contratado em outra lista', 'Desistente'");
    expect(rpc).toContain(
      "when v_status in ('Contratado', 'Migração', 'Contratado em outra lista') then v_matricula",
    );
    // Nenhum dado gravado muda: nem update nem delete nas linhas dos aprovados.
    const foraDasFuncoes = corpo(MIGRATION).replace(
      /\$function\$[\s\S]*?\$function\$/g,
      "",
    );
    expect(foraDasFuncoes).not.toMatch(
      /^\s*(update|delete from) public\."TB_CANDIDATO_APROVADO"/m,
    );
    expect(
      funcao(ROLLBACK, "public.alterar_status_candidato_aprovado"),
    ).not.toContain("outra lista");
    expect(ROLLBACK).toContain(
      "or status in ('Convocado', 'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada')",
    );
  });

  it.each(CONTAGENS)(
    "%s só ganha a condição do instantâneo; o resto é o do rollback",
    (nome, vezes) => {
      const nova = funcao(MIGRATION, nome);
      const antes = funcao(ROLLBACK, nome);
      expect(nova.split(CONDICAO)).toHaveLength(vezes + 1);
      expect(nova.split(CONDICAO).join("")).toBe(antes);
    },
  );

  it("a conferência deixa de ler a linha em outra lista; o pacote leva a situação", () => {
    const conferencia = funcao(MIGRATION, "public.conferencia_ler_aprovados");
    expect(conferencia).toContain(
      'and not private."FC_EM_OUTRA_LISTA"(c.id)\n',
    );
    const pacote = funcao(MIGRATION, 'private."FC_MONTAR_APROVADOS_AREA"');
    expect(pacote).toContain(
      "'contratacao', (select coalesce(json_object_agg(",
    );
    expect(pacote).toContain("where c.status = 'Contratado')");
    expect(
      funcao(ROLLBACK, 'private."FC_MONTAR_APROVADOS_AREA"'),
    ).not.toContain("'contratacao'");
  });

  it("o instantâneo é fechado: RLS, sem grant, só pelas RPCs de service_role", () => {
    expect(MIGRATION).toContain(
      'alter table public."TB_CONTRATACAO_APROVADO" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TB_CONTRATACAO_APROVADO" from public, anon, authenticated, service_role;',
    );
    for (const rpc of [
      "public.contratacao_ler_aprovados()",
      "public.gravar_contratacao_dos_aprovados(text, jsonb, uuid[])",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${rpc} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${rpc} to service_role;`,
      );
    }
    // A leitura não leva matrícula nem nome: só o hash do vínculo.
    const leitura = MIGRATION.slice(
      MIGRATION.indexOf("create function public.contratacao_ler_aprovados()"),
      MIGRATION.indexOf(
        "comment on function public.contratacao_ler_aprovados()",
      ),
    );
    expect(leitura).not.toMatch(/'matricula'|'nome'|c\.nome/);
    expect(leitura).toContain('private."FC_VINCULO_DA_MATRICULA"(c.matricula)');
  });

  it("a gravação só valida e guarda, e recalcula os contratados", () => {
    const gravar = MIGRATION.slice(
      MIGRATION.indexOf(
        "create function public.gravar_contratacao_dos_aprovados(",
      ),
      MIGRATION.indexOf(
        "comment on function public.gravar_contratacao_dos_aprovados(",
      ),
    );
    expect(gravar).toContain("raise exception 'Decisão recusada (%)'");
    for (const motivo of [
      "duplicada",
      "campos",
      "linha",
      "base",
      "escolha",
      "grupo",
    ])
      expect(gravar).toContain(`'${motivo}'`);
    expect(gravar).toContain('private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(e)');
    expect(gravar).toContain('private."FC_MARCAR_CACHE"(');
  });

  it("a base mudou: o gatilho apaga a decisão e pede o job, sem derrubar quem chamou", () => {
    expect(MIGRATION).toContain(
      'create trigger "TG_HISTCANDAPROV_CONTRATACAO"\n  after insert on public."TH_CANDIDATO_APROVADO"',
    );
    expect(MIGRATION).toContain(
      'create trigger "TG_HISTPUBLICAPROV_CONTRATACAO"\n  after insert on public."TH_PUBLICACAO_APROVADO"',
    );
    const pedir = MIGRATION.slice(
      MIGRATION.indexOf(
        'create function private."FC_PEDIR_CONTRATACAO_DOS_APROVADOS"()',
      ),
    );
    expect(pedir).toContain('private."FC_AUTOMACAO_LIGADA"');
    expect(pedir).toContain("exception when others then");
    expect(funcao(MIGRATION, 'private."FC_DISPARAR_ROBO"')).toContain(
      "'contratacao-dos-aprovados.yml', jsonb_build_array('modo'));",
    );
    expect(funcao(MIGRATION, 'private."FC_CHAVE_DO_WORKFLOW"')).toContain(
      "when 'contratacao-dos-aprovados.yml' then 'conferencias'",
    );
    for (const sql of [ROLLBACK]) {
      expect(sql).toContain(
        'drop trigger if exists "TG_HISTCANDAPROV_CONTRATACAO"',
      );
      expect(funcao(sql, 'private."FC_DISPARAR_ROBO"')).not.toContain(
        "contratacao-dos-aprovados.yml",
      );
    }
  });

  it("os motivos e a versão são os da regra em Python", () => {
    const motivosPython = /MOTIVOS = \(([^)]*)\)/
      .exec(REGRA)[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const valores = motivosPython.map(
      (nome) => new RegExp(`^${nome} = "([A-Z_]+)"`, "m").exec(REGRA)[1],
    );
    const ck =
      /"CK_CONTRATAPROV_TPMOTIVO" check \("TP_MOTIVO" in \(\n?\s*([^)]*)\)\)/.exec(
        MIGRATION,
      )[1];
    expect(ck.match(/'([A-Z_]+)'/g).map((s) => s.slice(1, -1))).toEqual(
      valores,
    );
    expect(REGRA).toMatch(/^VERSAO = 1$/m);
  });
});
