import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPCOES_DOS_ROBOS, ROBOS_DE_CARGA } from "../src/lib/robos-de-carga.js";

/*
  Migration 20261008140000 (agenda dos robôs pelo banco: pg_cron + pg_net →
  workflow_dispatch do GitHub; o ensaio begin…rollback está em
  supabase/ensaios/). Invariantes estáticas: lista fixa = ROBOS_DE_CARGA,
  revoke de todos menos o dono, sem chave = SEM_TOKEN sem erro, a chave nunca
  sai da função, as tarefas do pg_cron, a tabela MAD sem acesso direto e os
  workflows sem `schedule` (o banco é o único agendador).
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008140000_agenda_dos_robos_pelo_banco.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const WORKFLOWS = ROBOS_DE_CARGA.map((r) => r.workflow);

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const DISPARAR = corpoDaFuncao(
  MIGRATION,
  'create function private."FC_DISPARAR_ROBO"',
);
const CONFERIR = corpoDaFuncao(
  MIGRATION,
  'create function private."FC_CONFERIR_DISPAROS_ROBO"',
);

describe("migration da agenda dos robôs (20261008140000)", () => {
  it("liga o pg_net no schema extensions", () => {
    expect(MIGRATION).toContain(
      "create extension if not exists pg_net with schema extensions;",
    );
  });

  it("a lista fixa da função e da tabela é a mesma de ROBOS_DE_CARGA", () => {
    const daFuncao = [
      ...DISPARAR.matchAll(/'([a-z-]+\.yml)', jsonb_build_array/g),
    ].map((m) => m[1]);
    expect(daFuncao.sort()).toEqual([...WORKFLOWS].sort());
    const check = MIGRATION.slice(
      MIGRATION.indexOf('"CK_DISPROBO_NOWORKFLOW" check'),
      MIGRATION.indexOf('"CK_DISPROBO_TPSITUACAO"'),
    );
    expect(
      [...check.matchAll(/'([a-z-]+\.yml)'/g)].map((m) => m[1]).sort(),
    ).toEqual([...WORKFLOWS].sort());
    expect(DISPARAR).toMatch(
      /not \(c_aceitos \? p_workflow\)[\s\S]*errcode = '22023'/,
    );
  });

  it("só os inputs do workflow, em texto; disparado_por = AGENDA ou quem pediu; ramo main", () => {
    expect(DISPARAR).toContain("not ((c_aceitos -> p_workflow) ? i.key)");
    expect(DISPARAR).toContain("jsonb_typeof(i.value) <> 'string'");
    expect(DISPARAR).toContain(
      "v_inputs || jsonb_build_object('disparado_por', v_disparado_por)",
    );
    expect(DISPARAR).toContain("'ref', 'main'");
    expect(DISPARAR).toContain(
      "'https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/' || p_workflow || '/dispatches'",
    );
    for (const cabecalho of [
      "'Accept', 'application/vnd.github+json'",
      "'Authorization', 'Bearer ' || v_chave",
      "'X-GitHub-Api-Version', '2022-11-28'",
      "'User-Agent', 'agsus-monitora-agenda'",
    ])
      expect(DISPARAR).toContain(cabecalho);
  });

  it("sem a chave no Vault: registra SEM_TOKEN e sai sem erro, antes de qualquer HTTP", () => {
    expect(DISPARAR).toContain("from vault.decrypted_secrets s");
    expect(DISPARAR).toContain("'github_disparo_robos'");
    const semChave = DISPARAR.indexOf("if v_chave is null then");
    expect(semChave).toBeGreaterThan(-1);
    const bloco = DISPARAR.slice(
      semChave,
      DISPARAR.indexOf("end if;", semChave),
    );
    expect(bloco).toContain("'SEM_TOKEN'");
    expect(bloco).toContain("return v_disparo;");
    expect(bloco).not.toMatch(/raise exception/);
    expect(semChave).toBeLessThan(DISPARAR.indexOf("net.http_post"));
  });

  it("a chave só vai ao cabeçalho do pg_net: nunca a log, notice, tabela ou mensagem", () => {
    const usos = DISPARAR.split("\n").filter((l) => /v_chave/.test(l));
    for (const linha of usos)
      expect(linha).toMatch(
        /v_chave text;|into v_chave|if v_chave is null|'Bearer ' \|\| v_chave|v_chave := null;/,
      );
    expect(DISPARAR).not.toMatch(/raise (notice|warning|log|info)/);
    expect(DISPARAR).not.toMatch(/sqlerrm/i);
    expect(MIGRATION).not.toMatch(/\b(ghp|github_pat)_[A-Za-z0-9_]{10,}/);
  });

  it("SECURITY DEFINER, search_path vazio e revoke de todos menos o dono", () => {
    for (const [corpo, assinatura] of [
      [DISPARAR, 'private."FC_DISPARAR_ROBO"(text, jsonb, uuid)'],
      [CONFERIR, 'private."FC_CONFERIR_DISPAROS_ROBO"(bigint)'],
    ]) {
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon, authenticated, service_role;`,
      );
      expect(MIGRATION).not.toMatch(
        new RegExp(`grant [^;]*${assinatura.replace(/[().*"]/g, "\\$&")}`),
      );
    }
  });

  it("tabela de registro no padrão MAD, com RLS e sem acesso direto", () => {
    expect(MIGRATION).toContain('create table public."TL_DISPARO_ROBO"');
    for (const coluna of [
      "CO_DISPARO",
      "NO_WORKFLOW",
      "DT_DISPARO",
      "CO_PEDIDO_HTTP",
      "TP_SITUACAO",
      "NU_STATUS_HTTP",
      "DT_RESPOSTA",
      "DS_MENSAGEM",
    ])
      expect(MIGRATION).toContain(
        `comment on column public."TL_DISPARO_ROBO"."${coluna}"`,
      );
    expect(MIGRATION).toContain(
      "check (\"TP_SITUACAO\" in ('PEDIDO', 'ACEITO', 'FALHOU', 'SEM_TOKEN'))",
    );
    expect(MIGRATION).toContain(
      'alter table public."TL_DISPARO_ROBO" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TL_DISPARO_ROBO" from public, anon, authenticated, service_role;',
    );
  });

  it("a conferência lê net._http_response: 2xx = ACEITO, sem resposta em 1 h = FALHOU, limpa 30 dias", () => {
    expect(CONFERIR).toContain("from net._http_response r");
    expect(CONFERIR).toContain(
      "when r.status_code between 200 and 299 and not coalesce(r.timed_out, false) then 'ACEITO'",
    );
    expect(CONFERIR).toContain("interval '1 hour'");
    expect(CONFERIR).toContain("interval '30 days'");
  });

  it("agenda do pg_cron: entrevistas de hora em hora, seleção 3 vezes ao dia, conferências 9h, expurgo 9h30 e a conferência a cada 5 min", () => {
    const agenda = {
      agsus_robo_sincronizar_entrevistas: [
        "5 * * * *",
        "sincronizar-entrevistas.yml",
      ],
      agsus_robo_sincronizar_selecao: [
        "10 11,16,21 * * *",
        "sincronizar-selecao.yml",
      ],
      agsus_robo_conferencias: ["0 9 * * *", "conferencias.yml"],
      agsus_robo_expurgo_anexos_chat: ["30 9 * * *", "expurgo-anexos-chat.yml"],
    };
    for (const [tarefa, [cron, workflow]] of Object.entries(agenda))
      expect(MIGRATION).toContain(
        `jsonb_build_array('${tarefa}', '${cron}',\n      'select private."FC_DISPARAR_ROBO"(''${workflow}'', ''{"modo": "normal"}'');')`,
      );
    expect(MIGRATION).toContain(
      `jsonb_build_array('agsus_robo_conferir_disparos', '*/5 * * * *',\n      'select private."FC_CONFERIR_DISPAROS_ROBO"();')`,
    );
    expect(MIGRATION).toContain("perform cron.alter_job(v_id, schedule =>");
  });

  it("get_saude_das_cargas ganha agenda_dos_robos sem expor a chave (só se existe)", () => {
    expect(MIGRATION).toContain("'agenda_dos_robos', json_build_object(");
    expect(MIGRATION).toContain(
      "select exists (select 1 from vault.secrets s where s.name = 'github_disparo_robos')",
    );
    const saude = MIGRATION.slice(
      MIGRATION.indexOf(
        "CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()",
      ),
    );
    expect(saude).not.toContain("decrypted");
    expect(saude).toContain("'expurgo_chat', (");
    expect(saude).toContain("private.is_master()");
  });

  it("o ensaio aplica o mesmo corpo, simula a chave ausente sem tocar no Vault e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + 8,
      MIGRATION.lastIndexOf("notify pgrst"),
    ).trim();
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO).toContain(
      "set_config('agsus.segredo_disparo_robos', 'github_disparo_robos_ausente_no_ensaio', true)",
    );
    const conferencias = ENSAIO.slice(ENSAIO.indexOf(corpo) + corpo.length);
    expect(conferencias).not.toMatch(/decrypted/);
    expect(conferencias).not.toMatch(
      /(update|delete from|insert into) vault\./i,
    );
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });

  it("o rollback desliga as tarefas, apaga funções e tabela e volta get_saude_das_cargas", () => {
    expect(ROLLBACK).toContain("perform cron.unschedule(v_id);");
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_DISPARAR_ROBO"(text, jsonb, uuid);',
    );
    expect(ROLLBACK).toContain(
      'drop table if exists public."TL_DISPARO_ROBO";',
    );
    expect(ROLLBACK).toContain(
      "CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()",
    );
    expect(ROLLBACK).not.toContain("'agenda_dos_robos'");
    expect(ROLLBACK).toContain("drop extension if exists pg_net;");
    expect(ROLLBACK).toContain(
      "drop function if exists public.disparar_robo(text, jsonb);",
    );
    expect(ROLLBACK).toContain(
      "drop function if exists public.situacao_do_disparo_robo(bigint);",
    );
  });
});

const RPC = corpoDaFuncao(MIGRATION, "create function public.disparar_robo(");
const SITUACAO = corpoDaFuncao(
  MIGRATION,
  "create function public.situacao_do_disparo_robo(",
);

describe("Rodar agora pelo banco: disparar_robo (substitui api/rodar-carga.js)", () => {
  it("os robôs da RPC são os de ROBOS_DE_CARGA, cada um com o seu workflow", () => {
    for (const robo of ROBOS_DE_CARGA) {
      const inicio = RPC.indexOf(`'${robo.id}', jsonb_build_object(`);
      expect(inicio, robo.id).toBeGreaterThan(-1);
      expect(RPC.slice(inicio, RPC.indexOf("\n", inicio))).toContain(
        `'workflow', '${robo.workflow}'`,
      );
    }
  });

  it("só authenticated executa; SECURITY DEFINER e search_path vazio", () => {
    for (const [corpo, assinatura] of [
      [RPC, "public.disparar_robo(text, jsonb)"],
      [SITUACAO, "public.situacao_do_disparo_robo(bigint)"],
    ]) {
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to authenticated;`,
      );
    }
  });

  it("quem pode é o mesmo de antes: administrador global ou a coordenação do edital na pré-classificação", () => {
    expect(RPC).toContain("if not public.pode_disparar_carga() then");
    expect(RPC).toContain(
      "public.pode_recalcular_pre_classificacao(v_editais[1]::uuid)",
    );
    expect(RPC).toContain(
      "if v_modo <> 'normal' or cardinality(v_vagas) > 0 or v_limite is not null",
    );
    expect(RPC).toContain("or cardinality(v_editais) <> 1");
    expect(RPC).toContain("errcode = '28000'");
    expect(RPC).toContain("errcode = '42501'");
  });

  it("a lista branca de cada robô é a mesma de OPCOES_DOS_ROBOS", () => {
    for (const [id, aceitas] of Object.entries(OPCOES_DOS_ROBOS)) {
      const inicio = RPC.indexOf(`'${id}', jsonb_build_object(`);
      const bloco = RPC.slice(inicio, RPC.indexOf("),\n    '", inicio + 1));
      const modos = aceitas.modos.map((m) => `'${m.valor}'`).join(", ");
      expect(bloco, id).toContain(`'modos', jsonb_build_array(${modos})`);
      if (aceitas.editais)
        expect(bloco, id).toContain(`'editais', '${aceitas.editais}'`);
    }
    for (const trecho of [
      String.raw`'^\d{1,4}/\d{4}$'`,
      String.raw`'^\d{1,20}$'`,
      "not between 1 and 500",
      "cardinality(v_editais) > 100",
      "cardinality(v_vagas) > 500",
    ])
      expect(RPC).toContain(trecho);
  });

  it("pede pelo mesmo FC_DISPARAR_ROBO com o id de quem pediu e barra o pedido repetido em 2 min", () => {
    expect(RPC).toContain(
      `return private."FC_DISPARAR_ROBO"(v_robo ->> 'workflow', v_saida, v_uid);`,
    );
    expect(RPC).toContain("interval '2 minutes'");
    expect(RPC).toContain("errcode = '55006'");
  });

  it("situacao_do_disparo_robo: só quem pediu ou o administrador global; fecha o pedido pela resposta", () => {
    expect(SITUACAO).toContain('d."CO_USUARIO" = v_uid or private.is_master()');
    expect(SITUACAO).toContain(
      'perform private."FC_CONFERIR_DISPAROS_ROBO"(p_disparo);',
    );
    expect(SITUACAO).not.toMatch(/decrypted|vault\./);
  });
});

describe("workflows: o banco é o único agendador", () => {
  it.each(WORKFLOWS)(
    "%s não tem schedule e aceita workflow_dispatch com modo e disparado_por",
    (arquivo) => {
      const yml = ler(`.github/workflows/${arquivo}`);
      expect(yml).not.toMatch(/^\s*schedule:/m);
      expect(yml).not.toMatch(/^\s*-\s*cron:/m);
      expect(yml).not.toContain("github.event_name == 'schedule'");
      expect(yml).toMatch(/^ {2}workflow_dispatch:\n {4}inputs:/m);
      expect(yml).toMatch(/^ {6}modo:/m);
      expect(yml).toMatch(/^ {6}disparado_por:/m);
    },
  );
});
