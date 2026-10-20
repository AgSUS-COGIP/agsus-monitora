import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Invariantes da migration 20261020120000 (relatório de motivos): a RPC leve,
  paginada, só para quem coordena o edital, sem gravar nada e sem dado
  pessoal além de código e nome; ensaio (só begin … rollback) e rollback ao
  lado.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261020120000_relatorio_de_motivos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ASSINATURA = "public.listar_relatorio_de_motivos(uuid, jsonb)";

const inicio = MIGRATION.search(
  /create or replace function public\.listar_relatorio_de_motivos\(/,
);
const RPC = MIGRATION.slice(
  inicio,
  MIGRATION.indexOf("\n$function$;\n", inicio),
);

describe("a migration", () => {
  it("transação com lock_timeout", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("SECURITY DEFINER, search_path vazio, stable, com teto de tempo e só quem coordena", () => {
    expect(inicio).toBeGreaterThan(0);
    expect(RPC).toMatch(/security definer/);
    expect(RPC).toMatch(/set search_path = ''/);
    expect(RPC).toMatch(/\nstable\n/);
    expect(RPC).toMatch(/set statement_timeout = '5s'/);
    expect(RPC).toContain(`private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3)`);
    expect(RPC).toMatch(
      /private\."FC_PAPEL_AVALIACAO"\(p_edital\) is distinct from 'COORDENADOR'[\s\S]*?errcode = '42501'/,
    );
    expect(RPC).not.toMatch(/\b(insert|update|delete|truncate)\b/i);
  });

  it("sem CPF, e-mail ou telefone: só código e nome do candidato", () => {
    expect(RPC).not.toMatch(
      /CPF|EMAIL|E_MAIL|TELEFONE|CELULAR|DS_RESPOSTA|NU_CPF/i,
    );
    expect(RPC).toContain(`'codigo', c."CO_CANDIDATO_EMPREGARE"`);
    expect(RPC).toContain(`'nome', c."NO_CANDIDATO"`);
    // Os blocos vão reduzidos (nada de observação, vínculos ou cursos do lançamento).
    expect(RPC).not.toContain(`'observacao'`);
    expect(RPC).not.toMatch(/'vinculos'|'cursos'|'titulos'/);
  });

  it("filtros validados (22023) e páginas de até 500 pela chave da ficha", () => {
    expect(RPC).toContain(
      "least(greatest(coalesce((v_f ->> 'limite')::integer, 500), 1), 500)",
    );
    expect(RPC).toContain("fl.id > v_apos");
    expect(RPC).toContain("order by fl.id");
    expect(RPC).toContain(
      "'proximo', case when v_n = v_limite then v_ultimo end",
    );
    expect(RPC.match(/errcode = '22023'/g).length).toBeGreaterThanOrEqual(4);
    for (const s of [
      "CONFORME",
      "NAO_CONFORME",
      "NAO_ENVIADO",
      "NAO_SE_APLICA",
    ])
      expect(RPC).toContain(`'${s}'`);
  });

  it("sem índice nem tabela nova; COMMENT e grant só a authenticated", () => {
    expect(MIGRATION).not.toMatch(
      /create (unique )?index|create table|alter table/i,
    );
    expect(MIGRATION).toContain(`comment on function ${ASSINATURA} is`);
    expect(MIGRATION).toContain(
      `revoke all on function ${ASSINATURA} from public, anon;`,
    );
    expect(MIGRATION).toContain(
      `grant execute on function ${ASSINATURA} to authenticated;`,
    );
    expect(MIGRATION).not.toMatch(/to (anon|service_role|public)\b/);
  });

  it("contrato de RPC declarado com os dois argumentos", () => {
    expect(CONTRATO_RPC.listar_relatorio_de_motivos.argumentos).toEqual([
      "p_edital",
      "p_filtros",
    ]);
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio só lê, como usuário, e nunca confirma", () => {
    expect(ENSAIO).toContain("set local role authenticated");
    expect(ENSAIO).toContain("request.jwt.claims");
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).not.toMatch(
      /\b(insert into public|update public|delete from public)\b/i,
    );
    expect(ENSAIO).toContain("rollback;");
  });

  it("o rollback derruba só a função nova", () => {
    expect(ROLLBACK).toContain(`drop function if exists ${ASSINATURA};`);
    expect(ROLLBACK.match(/drop /g)).toHaveLength(1);
  });
});
