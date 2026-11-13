import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  AS ADMISSÕES CONCILIADAS E O CICLO NO BANCO (migration 20261113210000)

  A tabela das admissões conciliadas com o RH, a função de carga (só a
  service_role) e a RPC da Visão geral devolvendo a 1ª e a última admissão por
  edital. O comportamento é conferido no banco pelo ensaio; aqui, que
  migration, ensaio, rollback e retrato contam a mesma história.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261113210000_admissoes_conciliadas_e_ciclo_na_visao_geral";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");
const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

function corpo(sql: string, inicio: string, abre: string, fecha: string) {
  const i = sql.indexOf(inicio);
  expect(i).toBeGreaterThan(-1);
  const de = sql.indexOf(abre, i) + abre.length;
  return sql.slice(de, sql.indexOf(fecha, de));
}
const daRpc = (sql: string) =>
  corpo(
    sql,
    "create or replace function public.listar_acompanhamento_da_visao_geral(p_area text)",
    "as $function$",
    "$function$;",
  );

describe("migration 20261113210000", () => {
  const migration = ler(`supabase/migrations/${NOME}.sql`);
  const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
  const rollback = ler(`supabase/rollback/${NOME}.sql`);
  const retrato = corpo(
    ler("supabase/esquema-atual.sql"),
    "CREATE FUNCTION public.listar_acompanhamento_da_visao_geral(p_area text)",
    "AS $$",
    "$$;",
  );
  const novo = daRpc(migration);
  const antigo = daRpc(rollback);

  it("o rollback volta ao corpo de antes (md5 conferido no banco em 13/11/2026)", () => {
    expect(md5(antigo)).toBe("1b38c7dbeb75abac997b64cc14186865");
  });

  it("o retrato mostra o corpo de antes ou o da migration", () => {
    expect([antigo, novo]).toContain(retrato);
  });

  it("a RPC devolve a 1ª e a última admissão por edital, só dos editais visíveis", () => {
    expect(novo).toContain("'admissoes', coalesce((");
    expect(novo).toContain('min(a."DT_ADMISSAO") as primeira');
    expect(novo).toContain('max(a."DT_ADMISSAO") as ultima');
    expect(novo).toContain('where a."CO_MONITORAMENTO" = any (v_editais)');
  });

  it("a tabela fica fechada e a carga é só da service_role", () => {
    expect(migration).toContain(
      'alter table public."TB_ADMISSAO_CONCILIADA" enable row level security;',
    );
    expect(migration).toContain(
      'revoke all on table public."TB_ADMISSAO_CONCILIADA" from public, anon, authenticated;',
    );
    expect(migration).toContain(
      "revoke all on function public.carregar_admissoes_conciliadas(text, jsonb) from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.carregar_admissoes_conciliadas(text, jsonb) to service_role;",
    );
  });

  it("a marca da Visão geral passa a acompanhar a tabela", () => {
    expect(migration).toContain(
      'select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();',
    );
    expect(rollback).toContain(
      'select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();',
    );
  });

  it("o ciclo é padronizado como 'Nº ciclo'", () => {
    expect(migration).toContain(
      "set ciclo = substring(ciclo from '\\d+')::integer || 'º ciclo'",
    );
  });

  it("as guardas usam o md5 do corpo de antes e do de depois", () => {
    expect(migration).toContain(`is distinct from '${md5(antigo)}'`);
    expect(migration).toContain(`v_md5 = '${md5(novo)}'`);
    expect(rollback).toContain(`is distinct from '${md5(novo)}'`);
  });

  it("o ensaio aplica o mesmo corpo, testa a carga e termina em rollback", () => {
    expect(daRpc(ensaio)).toBe(novo);
    expect(ensaio).toContain("Ensaio 20261113210000 ok");
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
