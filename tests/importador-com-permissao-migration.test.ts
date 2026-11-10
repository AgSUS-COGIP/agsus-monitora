import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration do porteiro do importador de anexos (auditoria SEG-02). As
  travas que não podem se perder numa edição: a regra é a mesma de quem grava
  o resultado (editar Núcleo ou Calendário), a função é SECURITY DEFINER com
  search_path vazio, fica fora do anon, e o endpoint a chama com o Bearer de
  quem pediu, recusando quando não consegue conferir.
*/
const ler = (arquivo: string) =>
  readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261110130000_permissao_do_importador_de_anexos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ENDPOINT = ler("api/anexos-do-edital.py");
const REGRA =
  "select private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2);";

/** O `create or replace function` até o `$$;` que o fecha. */
const funcao = (sql: string) => {
  const inicio = sql.indexOf(
    "create or replace function public.pode_importar_anexos_do_edital()",
  );
  return sql.slice(inicio, sql.indexOf("$$;", inicio) + 3);
};

describe("porteiro do importador de anexos (migration)", () => {
  it("mesma regra de quem grava, SECURITY DEFINER e search_path vazio", () => {
    const corpo = funcao(MIGRATION);
    expect(corpo).toContain(REGRA);
    expect(corpo).toMatch(
      /returns boolean\s+language sql\s+stable\s+security definer\s+set search_path to ''/,
    );
    // A regra do quadro de vagas, que grava o resultado da importação.
    expect(
      ler("supabase/migrations/20260930233000_quadro_de_vagas_do_edital.sql"),
    ).toContain(
      "private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)",
    );
  });

  it("fora do anon, para authenticated, em transação", () => {
    expect(MIGRATION).toMatch(
      /revoke all on function public\.pode_importar_anexos_do_edital\(\) from public, anon;/,
    );
    expect(MIGRATION).toMatch(
      /grant execute on function public\.pode_importar_anexos_do_edital\(\) to authenticated;/,
    );
    expect(MIGRATION).toMatch(/begin;[\s\S]*commit;\s*$/);
  });

  it("rollback com guarda; ensaio com a mesma função e terminando em rollback", () => {
    expect(ROLLBACK).toMatch(
      /raise exception 'Migration 20261110130000 nao aplicada/,
    );
    expect(ROLLBACK).toMatch(
      /drop function public\.pode_importar_anexos_do_edital\(\);/,
    );
    expect(funcao(ENSAIO)).toBe(funcao(MIGRATION));
    expect(ENSAIO).toMatch(/Perfil inativo poderia importar/);
    expect(ENSAIO).toMatch(/anon pode chamar a funcao/);
    expect(ENSAIO).toMatch(/rollback;\s*$/);
  });

  it("o endpoint chama a RPC e recusa antes de ler o PDF", () => {
    expect(ENDPOINT).toContain("/rest/v1/rpc/pode_importar_anexos_do_edital");
    const post = ENDPOINT.slice(ENDPOINT.indexOf("def do_POST"));
    const conferir = post.indexOf("pode_importar(autorizacao)");
    expect(conferir).toBeGreaterThan(-1);
    expect(conferir).toBeLessThan(post.indexOf("self.rfile.read"));
    expect(post).toContain("self._responder(503");
    expect(post).toContain("self._responder(403");
  });
});
