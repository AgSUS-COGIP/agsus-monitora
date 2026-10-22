import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261022190000 (chaves da automação). Invariantes estáticas: as
  tabelas MAD sem acesso direto, quem chama cada função, a agenda que respeita
  a chave em FC_DISPARAR_ROBO (só na origem AGENDA), o estado trazido do
  pg_cron sem religar nada, o corpo do ensaio igual ao da migration e o
  rollback que desfaz tudo sem mexer no pg_cron.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261022190000_chaves_da_automacao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261020170000_inscricoes_congeladas.sql",
);
const corpo = (texto) =>
  texto.slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"));
const CHAVES = [
  "entrevistas",
  "selecao",
  "kpis_do_edital",
  "robo_de_inscricoes",
  "pre_classificacao",
  "conferencias",
  "paineis",
  "manutencao",
];

describe("migration das chaves da automação", () => {
  it("tabelas MAD, com RLS e sem acesso direto", () => {
    for (const tabela of ["TB_CHAVE_AUTOMACAO", "TH_CHAVE_AUTOMACAO"]) {
      expect(MIGRATION).toContain(`create table public."${tabela}"`);
      expect(MIGRATION).toContain(`constraint "PK_${tabela}" primary key`);
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${tabela}" from public, anon, authenticated, service_role;`,
      );
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
    }
    // Toda coluna comentada.
    for (const [, tabela, colunas] of MIGRATION.matchAll(
      /create table public\."(\w+)" \(([\s\S]*?)\n\);/g,
    ))
      for (const [, coluna] of colunas.matchAll(/^\s+"(\w+)" /gm))
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
  });

  it("a lista fixa de chaves é a mesma no check, no estado inicial e na tela", () => {
    const check =
      /"CK_CHAVEAUTOM_COCHAVE" check \("CO_CHAVE" in \(([^)]*)\)\)/.exec(
        MIGRATION,
      );
    expect(check?.[1].match(/'(\w+)'/g)?.map((c) => c.slice(1, -1))).toEqual(
      CHAVES,
    );
    for (const chave of CHAVES) expect(MIGRATION).toContain(`('${chave}', '`);
  });

  it("motivo obrigatório de 10 a 500 e quem pode cada função", () => {
    expect(MIGRATION).toContain(
      `check (length(btrim("DS_MOTIVO")) between 10 and 500)`,
    );
    expect(MIGRATION).toContain(
      "if length(v_motivo) not between 10 and 500 then",
    );
    expect(MIGRATION.match(/if not private\.is_master\(\) then/g)).toHaveLength(
      2,
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_chaves_da_automacao() to authenticated;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.alterar_chave_da_automacao(text, boolean, text) to authenticated;",
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.automacao_ligada(text) from public, anon, authenticated;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.automacao_ligada(text) to service_role;",
    );
    for (const privada of [
      'private."FC_CHAVE_DA_TAREFA"(text)',
      'private."FC_CHAVE_DO_WORKFLOW"(text)',
      'private."FC_AUTOMACAO_LIGADA"(text)',
    ])
      expect(MIGRATION).toContain(
        `revoke all on function ${privada} from public, anon, authenticated, service_role;`,
      );
    expect(
      MIGRATION.match(/set search_path to ''/g).length,
    ).toBeGreaterThanOrEqual(7);
  });

  it("a agenda respeita a chave só na origem AGENDA; o resto de FC_DISPARAR_ROBO não muda", () => {
    expect(MIGRATION).toContain(`if v_origem = 'AGENDA'
     and not private."FC_AUTOMACAO_LIGADA"(private."FC_CHAVE_DO_WORKFLOW"(p_workflow)) then
    return null;`);
    const funcao = (texto) => {
      const inicio = texto.indexOf(
        'function private."FC_DISPARAR_ROBO"(\n  p_workflow',
      );
      return texto.slice(inicio, texto.indexOf("$function$;", inicio));
    };
    const semChecagem = funcao(MIGRATION).replace(
      /\n {2}-- \[chaves-da-automacao\][\s\S]*?return null;\n {2}end if;\n/,
      "",
    );
    expect(semChecagem).toBe(funcao(ANTERIOR));
  });

  it("ligar e desligar mexe junto nas tarefas do pg_cron da chave e guarda o histórico", () => {
    expect(MIGRATION).toContain(
      "perform cron.alter_job(v_tarefa.jobid, active := p_ligar);",
    );
    expect(MIGRATION).toContain(
      `insert into public."TH_CHAVE_AUTOMACAO" ("CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS")
  values (p_chave, case when p_ligar then 'S' else 'N' end, v_motivo, v_uid, v_tarefas);`,
    );
    expect(MIGRATION).toContain("using errcode = '55000'");
  });

  it("o estado inicial vem do pg_cron e a migration não religa nada", () => {
    expect(MIGRATION).toContain(
      "v_ligada := not (cardinality(v_tarefas) > 0 and v_ativas = 0);",
    );
    expect(MIGRATION).toContain("pausa de propósito desde 16/10/2026");
    // Fora da função de alterar, nenhum cron.alter_job/schedule/unschedule.
    const fora = MIGRATION.replace(
      /create function public\.alterar_chave_da_automacao[\s\S]*?\$function\$;/,
      "",
    );
    expect(fora).not.toMatch(/cron\.(alter_job|schedule|unschedule)\(/);
    expect(MIGRATION).toContain("'a01afddb-f64b-47d9-80e8-476a1ed14e43'");
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain(
      "set local agsus.segredo_disparo_robos = 'ensaio_sem_chave';",
    );
  });

  it("o rollback volta FC_DISPARAR_ROBO de 20261020170000 e apaga o resto, sem mexer no pg_cron", () => {
    expect(ROLLBACK).not.toContain("chaves-da-automacao");
    expect(ROLLBACK).toContain(
      'create or replace function private."FC_DISPARAR_ROBO"(',
    );
    for (const objeto of [
      "public.automacao_ligada(text)",
      "public.alterar_chave_da_automacao(text, boolean, text)",
      "public.obter_chaves_da_automacao()",
      'private."FC_AUTOMACAO_LIGADA"(text)',
      'private."FC_CHAVE_DO_WORKFLOW"(text)',
      'private."FC_CHAVE_DA_TAREFA"(text)',
      'public."TH_CHAVE_AUTOMACAO"',
      'public."TB_CHAVE_AUTOMACAO"',
    ])
      expect(ROLLBACK).toContain(
        `drop ${objeto.includes("(") ? "function" : "table"} if exists ${objeto};`,
      );
    expect(ROLLBACK).not.toMatch(/cron\.(alter_job|schedule|unschedule)\(/);
  });
});
