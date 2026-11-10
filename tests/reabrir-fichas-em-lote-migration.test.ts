import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration da reabertura em lote e do Coordenador como Gestor
  (20261110140000). As travas que não podem se perder numa edição:
  - FC_GESTOR_DO_EDITAL aceita edital_gestor e coordenador, sempre com
    Administrador no módulo e vendo o edital;
  - reabrir_fichas exige a coordenação do edital, confere edital e versão de
    todas antes de mexer e passa cada ficha por reabrir_ficha (a mesma regra
    de motivo e histórico da reabertura pela ficha);
  - o rollback volta FC_GESTOR_DO_EDITAL letra por letra ao de 20261006100000.
*/
const ler = (arquivo: string) =>
  readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261110140000_reabrir_fichas_em_lote_e_coordenador.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ORIGINAL = ler("supabase/migrations/20261006100000_regra_da_analise.sql");

/** Um `create (or replace) function <nome>` até o `$function$;` que o fecha. */
const funcao = (sql: string, nome: string) => {
  const inicio = sql.search(
    new RegExp(
      `create (or replace )?function ${nome.replace(/[."()]/g, "\\$&")}`,
    ),
  );
  if (inicio < 0) return "";
  return sql.slice(inicio, sql.indexOf("$function$;", inicio) + 11);
};
const GESTOR = 'private."FC_GESTOR_DO_EDITAL"';
const corpo = (sql: string) =>
  funcao(sql, GESTOR).replace(/^create (or replace )?/, "");

describe("reabrir em lote e Coordenador como Gestor (migration)", () => {
  it("Coordenador entra como o Gestor, com Administrador e vendo o edital", () => {
    const f = corpo(MIGRATION);
    expect(f).toContain("u.perfil in ('edital_gestor', 'coordenador')");
    expect(f).toContain('private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 3');
    expect(f).toContain('private."FC_PERFIL_VE_EDITAL"(u.id, p_edital)');
    expect(f).toMatch(/security definer\s+set search_path to ''/);
  });

  it("reabrir_fichas: coordenação, edital e versão antes, cada ficha por reabrir_ficha", () => {
    const f = funcao(MIGRATION, "public.reabrir_fichas");
    const exige = f.indexOf('private."FC_EXIGIR_COORD_FICHAS"(p_edital)');
    const confere = f.indexOf('f."NU_VERSAO" is distinct from x.versao');
    const reabre = f.indexOf(
      "public.reabrir_ficha(v_item.ficha, v_item.versao, p_motivo, p_complemento)",
    );
    expect(exige).toBeGreaterThan(-1);
    expect(confere).toBeGreaterThan(exige);
    expect(reabre).toBeGreaterThan(confere);
    expect(f).toContain('f."CO_MONITORAMENTO" = p_edital');
    expect(f).toContain("errcode = 'PT409'");
    expect(f).toContain("not between 1 and 5000");
    expect(MIGRATION).toMatch(
      /revoke all on function public\.reabrir_fichas\(uuid, jsonb, text, text\) from public, anon;/,
    );
    expect(MIGRATION).toMatch(
      /grant execute on function public\.reabrir_fichas\(uuid, jsonb, text, text\) to authenticated;/,
    );
    expect(MIGRATION).toMatch(/begin;[\s\S]*commit;\s*$/);
  });

  it("rollback com guarda volta FC_GESTOR_DO_EDITAL ao corpo de 20261006100000", () => {
    expect(ROLLBACK).toMatch(
      /raise exception 'Migration 20261110140000 nao aplicada/,
    );
    expect(ROLLBACK).toMatch(
      /drop function public\.reabrir_fichas\(uuid, jsonb, text, text\);/,
    );
    expect(corpo(ROLLBACK)).toBe(corpo(ORIGINAL));
    const comentario = (sql: string) =>
      sql.match(
        /comment on function private\."FC_GESTOR_DO_EDITAL"\(uuid, uuid\) is\s+'[^']*';/,
      )?.[0];
    expect(comentario(ROLLBACK)).toBe(comentario(ORIGINAL));
    expect(ROLLBACK).toMatch(/begin;[\s\S]*commit;\s*$/);
  });

  it("ensaio usa as mesmas funções, confere quem perde a coordenação e termina em rollback", () => {
    expect(corpo(ENSAIO)).toBe(corpo(MIGRATION));
    expect(funcao(ENSAIO, "public.reabrir_fichas")).toBe(
      funcao(MIGRATION, "public.reabrir_fichas"),
    );
    expect(ENSAIO).toMatch(/deixariam de coordenar/);
    expect(ENSAIO).toMatch(/anon pode chamar reabrir_fichas/);
    expect(ENSAIO).toMatch(/rollback;\s*$/);
  });
});
