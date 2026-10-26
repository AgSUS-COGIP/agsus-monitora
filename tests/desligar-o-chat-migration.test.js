import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROBOS_DE_CARGA } from "../src/lib/robos-de-carga.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  O chat saiu (14/10/2026, "vamos tirar o chat, ele pesa"): o front inteiro e,
  no banco (20261014160000), o que rodava sozinho — sem apagar dado nenhum.
  O ensaio (supabase/ensaios/) confere no banco; aqui, as invariantes do texto.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261014160000_desligar_o_chat.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const SQL = MIGRATION.replace(/\/\*[\s\S]*?\*\//g, "");

const TABELAS = [
  "TB_MENSAGEM",
  "RL_CONVERSA_PARTICIPANTE",
  "RL_MENSAGEM_REACAO",
  "TB_CONVERSA",
];

const corpo = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

describe("desligar o chat: nada é apagado", () => {
  it("sem DELETE, TRUNCATE nem DROP de tabela, função ou bucket", () => {
    expect(SQL).not.toMatch(/\b(delete\s+from|truncate)\b/i);
    // "drop table" só o da publicação (a tabela fica).
    expect(SQL).not.toMatch(
      /(?<!supabase_realtime )\bdrop\s+(table|function|schema)\b/i,
    );
    expect(SQL).not.toMatch(/storage\.buckets/i);
    // Só políticas saem (as de escrita do bucket e as do canal privado).
    expect(
      [...SQL.matchAll(/drop policy if exists ([^ ]+) on/g)].map((m) => m[1]),
    ).toEqual([
      '"PL_CHAT_REALTIME_LEITURA"',
      '"PL_CHAT_REALTIME_ENVIO"',
      "chat_anexos_storage_insert",
      "chat_anexos_storage_delete",
    ]);
    expect(SQL).not.toContain("chat_anexos_storage_select");
  });

  it("a transação inteira, com a guarda do que precisa existir antes", () => {
    expect(MIGRATION).toMatch(/\*\/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      "to_regprocedure('public.listar_conversas_chat()') is null",
    );
  });
});

describe("o que rodava sozinho para", () => {
  it("as duas tarefas do pg_cron saem (expurgo dos anexos e retenção, que apaga)", () => {
    expect(SQL).toContain(
      "foreach v_job in array array['agsus_robo_expurgo_anexos_chat', 'agsus_chat_retencao_diaria'] loop",
    );
    expect(SQL).toContain("perform cron.unschedule(v_job);");
  });

  it("as quatro tabelas saem da publicação supabase_realtime (só se estão nela)", () => {
    for (const tabela of TABELAS) expect(SQL).toContain(`'${tabela}'`);
    expect(SQL).toContain(
      "execute format('alter publication supabase_realtime drop table public.%I', v_tabela);",
    );
    expect(SQL).not.toContain("TB_MONITORAMENTO_INDIGENA");
  });

  it("as 26 RPCs do chat que o app chamava deixam de valer para authenticated", () => {
    const revogadas = [
      ...SQL.matchAll(
        /revoke execute on function public\.([a-z_]+)\([^)]*\) from public, anon, authenticated;/g,
      ),
    ].map((m) => m[1]);
    expect(revogadas).toHaveLength(26);
    expect(revogadas.every((n) => n.endsWith("_chat"))).toBe(true);
    expect(SQL).not.toMatch(/\bfrom[^;]*service_role/);
    // E o contrato do front não tem mais nenhuma.
    expect(
      Object.keys(CONTRATO_RPC).filter((n) => n.endsWith("_chat")),
    ).toEqual([]);
  });
});

describe("robôs: o expurgo sai da lista fixa, do Rodar agora e do Status", () => {
  const FC = corpo(
    MIGRATION,
    'create or replace function private."FC_DISPARAR_ROBO"',
  );
  const RPC = corpo(
    MIGRATION,
    "create or replace function public.disparar_robo(",
  );
  const SAUDE = corpo(
    MIGRATION,
    "create or replace function public.get_saude_das_cargas()",
  );
  /* Os robôs de ROBOS_DE_CARGA que vieram depois desta migration (classificacao.yml: 20261023200000). */
  const NA_EPOCA = ROBOS_DE_CARGA.filter(
    (r) => r.workflow !== "classificacao.yml",
  );

  it("a lista fixa de FC_DISPARAR_ROBO é a de ROBOS_DE_CARGA (sem o expurgo)", () => {
    const daFuncao = [
      ...FC.matchAll(/'([a-z-]+\.yml)', jsonb_build_array/g),
    ].map((m) => m[1]);
    expect(daFuncao.sort()).toEqual(NA_EPOCA.map((r) => r.workflow).sort());
  });

  it("os robôs de disparar_robo são os de ROBOS_DE_CARGA", () => {
    const daRpc = [
      ...RPC.matchAll(/^ {4}'([a-z_]+)', jsonb_build_object\('nome'/gm),
    ].map((m) => m[1]);
    expect(daRpc.sort()).toEqual(NA_EPOCA.map((r) => r.id).sort());
  });

  it("get_saude_das_cargas não devolve mais expurgo_chat; o resto fica", () => {
    expect(SAUDE).not.toMatch(/expurgo/i);
    for (const chave of [
      "'conferencias'",
      "'pre_classificacao'",
      "'agenda_dos_robos'",
      "'tarefas'",
    ])
      expect(SAUDE).toContain(chave);
  });

  it("o workflow e o job Python saíram junto", () => {
    expect(existsSync(".github/workflows/expurgo-anexos-chat.yml")).toBe(false);
    expect(existsSync("scripts/expurgo_anexos_chat")).toBe(false);
  });
});

describe("rollback e ensaio", () => {
  it("o rollback devolve agendas, publicação, políticas, permissões e o expurgo nos robôs", () => {
    expect(ROLLBACK).toContain(
      "select cron.schedule('agsus_robo_expurgo_anexos_chat', '30 9 * * *',",
    );
    expect(ROLLBACK).toContain(
      "select cron.schedule('agsus_chat_retencao_diaria', '15 6 * * *',",
    );
    expect(ROLLBACK).toContain(
      "execute format('alter publication supabase_realtime add table public.%I', v_tabela);",
    );
    for (const politica of [
      '"PL_CHAT_REALTIME_LEITURA"',
      '"PL_CHAT_REALTIME_ENVIO"',
      "chat_anexos_storage_insert",
      "chat_anexos_storage_delete",
    ])
      expect(ROLLBACK).toContain(`create policy ${politica}`);
    expect(
      ROLLBACK.match(/^grant execute on function public\.[a-z_]+_chat\(/gm),
    ).toHaveLength(26);
    expect(
      corpo(ROLLBACK, 'create or replace function private."FC_DISPARAR_ROBO"'),
    ).toContain("'expurgo-anexos-chat.yml', jsonb_build_array('modo')");
    expect(
      corpo(
        ROLLBACK,
        "create or replace function public.get_saude_das_cargas()",
      ),
    ).toContain("'expurgo_chat', (");
  });

  it("fora o expurgo, as funções do rollback são as mesmas da migration", () => {
    for (const cabeca of [
      'create or replace function private."FC_DISPARAR_ROBO"',
      "create or replace function public.disparar_robo(",
      "create or replace function public.get_saude_das_cargas()",
    ]) {
      const semExpurgo = (t) =>
        corpo(t, cabeca)
          .replace(
            / {4}-- \[expurgo-diario\][\s\S]*?"TL_EXPURGO_ANEXO_CHAT"[^\n]*\n {4}\),\n/,
            "",
          )
          .replace(
            / {4}'expurgo_chat', jsonb_build_object\([^\n]*\n[^\n]*\n/,
            "",
          )
          .replace(/ {4}'expurgo-anexos-chat\.yml', [^\n]*\n/, "");
      expect(semExpurgo(ROLLBACK)).toBe(semExpurgo(MIGRATION));
    }
  });

  it("o ensaio confere no banco e termina em rollback", () => {
    expect(ENSAIO).toContain(
      "has_function_privilege('authenticated', v_rpc, 'execute')",
    );
    expect(ENSAIO).toContain(
      "TB_MONITORAMENTO_INDIGENA não pode sair da publicação",
    );
    expect(ENSAIO).toContain("chat_anexos_storage_select");
    expect(ENSAIO).toContain("exception when sqlstate '22023'");
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
