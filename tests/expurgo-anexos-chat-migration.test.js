import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";
import { roboDeCarga } from "../src/lib/robos-de-carga.js";

/*
  A migration do expurgo diário dos anexos do chat (ainda não aplicada: o
  ensaio begin…rollback está em supabase/ensaios/). Invariantes estáticas: as
  RPCs do expurgo aceitam a service_role sem abrir para mais ninguém, o log
  das execuções no padrão MAD e sem acesso direto, o registro só da
  service_role, o Status das atualizações com 'expurgo_chat', o workflow
  diário às 9h30 UTC e o rollback/ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007250000_expurgo_diario_dos_anexos_do_chat.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const WORKFLOW = ler(".github/workflows/expurgo-anexos-chat.yml");
const REGISTRAR =
  "public.registrar_expurgo_anexos_chat(text, text, uuid, text, timestamptz, jsonb, text)";

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};

describe("migration do expurgo diário: ordem e permissões", () => {
  it("vem depois da v2 do chat, sem repetir horário", () => {
    const datas = readdirSync("supabase/migrations")
      .filter((n) => /^\d{14}_/.test(n) && n !== NOME)
      .map((n) => n.slice(0, 14));
    expect(NOME.slice(0, 14) > "20261007210000").toBe(true);
    expect(datas).not.toContain(NOME.slice(0, 14));
    expect(MIGRATION).toContain("Aplique antes 20261007210000_chat_v2.sql.");
  });

  it("preparar e confirmar aceitam a service_role e, fora dela, só o administrador global", () => {
    const checagem = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"()',
    );
    expect(checagem).toContain("(select auth.role()) = 'service_role'");
    expect(checagem).toContain('return private."FC_CHAT_EXIGIR_ADMIN"();');
    for (const cabeca of [
      "create or replace function public.preparar_expurgo_anexos_chat()",
      "create or replace function public.confirmar_expurgo_anexos_chat(p_caminhos text[])",
    ]) {
      const corpo = corpoDaFuncao(MIGRATION, cabeca);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain('private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"()');
    }
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"() from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(/grant [^;]* to anon/);
    // As políticas do bucket não mudam: authenticated continua só com o administrador global.
    expect(MIGRATION).not.toMatch(/create policy|drop policy/);
  });

  it("o log é TL_, MAIÚSCULO, comentado, com RLS e sem grant direto", () => {
    expect(MIGRATION).toContain(
      'create table public."TL_EXPURGO_ANEXO_CHAT" (',
    );
    expect(MIGRATION).toContain(
      'alter table public."TL_EXPURGO_ANEXO_CHAT" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TL_EXPURGO_ANEXO_CHAT" from public, anon, authenticated;',
    );
    const constraints = [
      ...MIGRATION.matchAll(/^ {2}constraint "([A-Z0-9_]+)"/gm),
    ].map((m) => m[1]);
    expect(constraints.length).toBeGreaterThan(5);
    for (const nome of constraints) {
      expect(nome.length, nome).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on constraint "${nome}"`);
    }
    for (const coluna of MIGRATION.matchAll(
      /^ {2}"([A-Z_]+)" (?:text|timestamptz|uuid|integer)/gm,
    ))
      expect(MIGRATION).toContain(
        `comment on column public."TL_EXPURGO_ANEXO_CHAT"."${coluna[1]}"`,
      );
    // Só contagens: nenhuma coluna de caminho ou nome de arquivo.
    expect(MIGRATION).not.toMatch(
      /"TL_EXPURGO_ANEXO_CHAT"[^;]*"(DS_CAMINHO|NO_ARQUIVO)"/,
    );
  });

  it("registrar é só da service_role e omite mensagem com caminho", () => {
    expect(MIGRATION).toContain(
      `revoke all on function ${REGISTRAR} from public, anon, authenticated;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${REGISTRAR} to service_role;`,
    );
    const corpo = corpoDaFuncao(
      MIGRATION,
      "create function public.registrar_expurgo_anexos_chat(",
    );
    expect(corpo).toContain("a mensagem foi omitida");
    expect(corpo).toMatch(
      /'lotes', 'removidos', 'confirmados', 'falhas', 'pendentes'/,
    );
  });

  it("get_saude_das_cargas ganha 'expurgo_chat' e o rollback volta sem ela", () => {
    const nova = corpoDaFuncao(
      MIGRATION,
      "CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()",
    );
    expect(nova).toContain("'expurgo_chat', (");
    expect(nova).toContain("'pre_classificacao', (");
    expect(nova).toContain("encerrada_por_inatividade");
    const antiga = corpoDaFuncao(
      ROLLBACK,
      "CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()",
    );
    expect(antiga).not.toContain("expurgo_chat");
    expect(antiga).toContain("encerrada_por_inatividade");
    expect(CONTRATO_RPC.get_saude_das_cargas.resumo).toMatch(/expurgo/);
    expect(CONTRATO_RPC.preparar_expurgo_anexos_chat.resumo).toMatch(
      /service_role/,
    );
  });
});

describe("rollback, ensaio e workflow", () => {
  it("o rollback volta preparar e confirmar a só administrador e apaga o que criou", () => {
    expect(ROLLBACK).not.toContain(
      ':= private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"()',
    );
    expect(
      (ROLLBACK.match(/:= private\."FC_CHAT_EXIGIR_ADMIN"\(\);/g) || []).length,
    ).toBe(2);
    expect(ROLLBACK).toContain(`drop function if exists ${REGISTRAR};`);
    expect(ROLLBACK).toContain(
      'drop table if exists public."TL_EXPURGO_ANEXO_CHAT";',
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"();',
    );
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("begin;\n") + "begin;\n".length,
      MIGRATION.lastIndexOf("notify pgrst"),
    ).trim();
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });

  it("o workflow roda às 9h30 UTC, com modo seco, concorrência e só leitura do repositório", () => {
    expect(WORKFLOW).toContain('cron: "30 9 * * *"');
    expect(WORKFLOW).toMatch(/options:\n\s+- normal\n\s+- seco/);
    expect(WORKFLOW).toContain("group: expurgo-anexos-chat");
    expect(WORKFLOW).toMatch(/permissions:\n\s+contents: read/);
    expect(WORKFLOW).toContain("${{ secrets.SUPABASE_URL }}");
    expect(WORKFLOW).toContain("${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}");
    expect(
      [...WORKFLOW.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]).sort(),
    ).toEqual(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"]);
    expect(roboDeCarga("expurgo_chat")?.workflow).toBe(
      "expurgo-anexos-chat.yml",
    );
  });
});
