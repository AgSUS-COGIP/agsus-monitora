import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261022210000: o reinício das fichas de edital com trabalho feito
  só com dois administradores globais diferentes (pedido + aprovação, número do
  edital digitado, 24 h), recusado em edital congelado ou encerrado; a RPC
  antiga só executa em edital sem ficha trabalhada. Ensaio (begin…rollback)
  com edital fictício em supabase/ensaios/.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261022210000_reinicio_das_fichas_com_dois_administradores.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler(
  "supabase/migrations/20261013180000_reinicio_volta_toda_ficha_iniciada.sql",
);

const corpo = (sql, assinatura) => {
  const ini = sql.indexOf(`create or replace function ${assinatura}`);
  if (ini < 0) return "";
  const abre = sql.indexOf("$function$", ini);
  return sql.slice(abre, sql.indexOf("$function$", abre + 10) + 10);
};

const RPCS = {
  "public.obter_reinicio_fichas_do_edital(uuid)":
    "obter_reinicio_fichas_do_edital",
  "public.pedir_reinicio_fichas_do_edital(uuid, text, text)":
    "pedir_reinicio_fichas_do_edital",
  "public.aprovar_reinicio_fichas_do_edital(bigint, text)":
    "aprovar_reinicio_fichas_do_edital",
  "public.recusar_reinicio_fichas_do_edital(bigint, text, text)":
    "recusar_reinicio_fichas_do_edital",
  "public.cancelar_reinicio_fichas_do_edital(bigint)":
    "cancelar_reinicio_fichas_do_edital",
};

describe("reinício das fichas com dois administradores", () => {
  it("transação, pré-requisitos e tabelas com RLS e sem grant", () => {
    expect(MIGRATION).toMatch(/^begin;$/m);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain("raise exception 'Aplique antes");
    for (const tabela of [
      "TB_PEDIDO_REINICIO_FICHA",
      "TH_PEDIDO_REINICIO_FICHA",
    ]) {
      expect(MIGRATION).toContain(
        `create table if not exists public."${tabela}"`,
      );
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${tabela}" from public, anon, authenticated, service_role;`,
      );
    }
    expect(MIGRATION).not.toMatch(/\bdelete\s+from\b/i);
    expect(MIGRATION).not.toMatch(/disable row level security/i);
  });

  it("o banco garante dois administradores diferentes e um pendente por edital", () => {
    expect(MIGRATION).toMatch(
      /'EXECUTADO' and "CO_USUARIO_DECISAO" is not null and "DT_DECISAO" is not null\s+and "CO_USUARIO_DECISAO" <> "CO_USUARIO_PEDIDO"/,
    );
    expect(MIGRATION).toMatch(
      /'CANCELADO' and "CO_USUARIO_DECISAO" = "CO_USUARIO_PEDIDO"/,
    );
    expect(MIGRATION).toMatch(
      /create unique index if not exists "UK_PEDREINFICHA_PENDENTE"[^;]+where "TP_SITUACAO" = 'PENDENTE';/,
    );
    const aprovar = corpo(
      MIGRATION,
      "public.aprovar_reinicio_fichas_do_edital",
    );
    expect(aprovar).toContain('if v_p."CO_USUARIO_PEDIDO" = v_usuario then');
    expect(aprovar).toContain(
      "A aprovação precisa ser de outro administrador global.",
    );
    expect(aprovar).toContain('if v_p."DT_VALIDADE" <= now() then');
    expect(aprovar).toContain(
      'private."FC_CONFIRMACAO_DO_EDITAL"(v_edital, p_confirmacao)',
    );
    expect(aprovar).toContain('private."FC_REINICIAR_FICHAS_DO_EDITAL"(');
    expect(aprovar).toContain("'EXECUTAR'");
  });

  it("o pedido confere motivo que parece texto, número do edital e validade de 24 h", () => {
    const pedir = corpo(MIGRATION, "public.pedir_reinicio_fichas_do_edital");
    expect(pedir).toContain('private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 3)');
    expect(pedir).toContain("length(v_motivo) not between 10 and 1000");
    expect(pedir).toContain(
      'private."FC_CONFIRMACAO_DO_EDITAL"(p_edital, p_confirmacao)',
    );
    expect(pedir).toContain("now() + interval '24 hours'");
    expect(pedir).toContain("'VENCER'");
    expect(pedir).toContain('private."FC_BLOQUEIO_REINICIO_FICHAS"(p_edital)');
  });

  it("congelado ou encerrado: trava de raiz no reinício, com o resto do corpo igual", () => {
    const bloqueio = corpo(MIGRATION, 'private."FC_BLOQUEIO_REINICIO_FICHAS"');
    expect(bloqueio).toContain('private."FC_INSCRICOES_CONGELADAS"(p_edital)');
    expect(bloqueio).toContain('private."FC_EDITAIS_ENCERRADOS"()');
    const novo = corpo(MIGRATION, 'private."FC_REINICIAR_FICHAS_DO_EDITAL"');
    expect(novo).toContain(
      'v_bloqueio := private."FC_BLOQUEIO_REINICIO_FICHAS"(p_edital);',
    );
    // Fora a trava e o helper do admin, o laço é o mesmo de 20261013180000.
    const laco = (s) => s.slice(s.indexOf("  for v_f in"));
    expect(laco(novo)).toBe(
      laco(corpo(ANTERIOR, 'private."FC_REINICIAR_FICHAS_DO_EDITAL"')),
    );
  });

  it("a RPC antiga recusa edital com ficha trabalhada e orienta o pedido", () => {
    const antiga = corpo(MIGRATION, "public.reiniciar_fichas_do_edital");
    expect(antiga).toContain("if not private.is_master() then");
    expect(antiga).toContain("(v_impacto ->> 'exige_aprovacao')::boolean");
    expect(antiga).toContain(
      "peça o reinício e outro administrador global aprova",
    );
    expect(antiga).toContain("for update");
    const impacto = corpo(MIGRATION, 'private."FC_IMPACTO_REINICIO_FICHAS"');
    expect(impacto).toContain(
      "'exige_aprovacao', s.concluidas + s.com_lancamento > 0",
    );
    expect(impacto).toContain(`f."DS_LANCAMENTO" is not null`);
    expect(MIGRATION).not.toMatch(
      /function public.reiniciar_edital_treinamento/,
    );
  });

  it("security definer com search_path vazio; grants e contrato das RPCs", () => {
    const funcoes =
      MIGRATION.match(/create or replace function [^(]+\(/g) ?? [];
    expect(funcoes.length).toBe(12);
    expect((MIGRATION.match(/set search_path to ''/g) ?? []).length).toBe(
      funcoes.length,
    );
    for (const [assinatura, nome] of Object.entries(RPCS)) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to authenticated;`,
      );
      expect(CONTRATO_RPC[nome]).toBeDefined();
    }
    expect(CONTRATO_RPC.pedir_reinicio_fichas_do_edital.argumentos).toEqual([
      "p_edital",
      "p_motivo",
      "p_confirmacao",
    ]);
    expect(CONTRATO_RPC.aprovar_reinicio_fichas_do_edital.argumentos).toEqual([
      "p_pedido",
      "p_confirmacao",
    ]);
    for (const privada of [
      'private."FC_ADMIN_GLOBAL_ATIVO"(uuid)',
      'private."FC_IMPACTO_REINICIO_FICHAS"(uuid)',
      'private."FC_BLOQUEIO_REINICIO_FICHAS"(uuid)',
      'private."FC_CONFIRMACAO_DO_EDITAL"(uuid, text)',
      'private."FC_LER_REINICIO_FICHAS"(uuid, uuid)',
      'private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid)',
    ])
      expect(MIGRATION).toContain(
        `revoke all on function ${privada} from public, anon, authenticated, service_role;`,
      );
  });

  it("o ensaio cobre os casos num edital fictício e termina em rollback", () => {
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("session_replication_role = replica");
    expect(ENSAIO).toContain("Edital 998/2099");
    expect(ENSAIO).not.toContain("bcecfb08-88ef-4e06-8401-bcad6bf88fd0");
    for (const passo of [
      "R2 antiga com concluídas",
      "R3 pedido",
      "R4 mesmo admin aprova",
      "R5 aprovar congelado",
      "R6 aprovar vencido",
      "R8 recusado",
      "R9 aprovado e executado",
      "R10 pedir encerrado",
      "o 114/2026 mudou",
    ])
      expect(ENSAIO).toContain(passo);
  });

  it("o rollback volta a RPC antiga e o reinício de 20261013180000 e tira o resto", () => {
    expect(ROLLBACK).toContain(
      corpo(ANTERIOR, 'private."FC_REINICIAR_FICHAS_DO_EDITAL"'),
    );
    expect(ROLLBACK).toContain(
      'return private."FC_REINICIAR_FICHAS_DO_EDITAL"(p_edital, p_motivo, (select auth.uid()));',
    );
    for (const assinatura of Object.keys(RPCS))
      expect(ROLLBACK).toContain(`drop function if exists ${assinatura};`);
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_PEDIDO_REINICIO_FICHA";',
    );
    expect(
      ROLLBACK.indexOf(
        'drop function if exists private."FC_ADMIN_GLOBAL_ATIVO"',
      ),
    ).toBeGreaterThan(
      ROLLBACK.indexOf(
        'create or replace function private."FC_REINICIAR_FICHAS_DO_EDITAL"',
      ),
    );
  });
});
