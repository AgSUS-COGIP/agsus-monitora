import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Fechar a view das análises e o administrador global passando em toda
  permissão (20261103120000), ainda não aplicada. O ensaio (supabase/ensaios/)
  roda o corpo no banco e desfaz: authenticated sem perfil não lê a view, todo
  administrador global passa nível 3, os níveis de quem não é administrador
  ficam iguais e o pacote do painel sai igual. Aqui, as invariantes estáticas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261103120000_fechar_view_das_analises_e_admin_global_passa.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

const VIEW = 'public."VW_ANALISES_DASHBOARD_BASE_TODOS"';
const VIEW_ATIVA = 'public."VW_ANALISES_DASHBOARD_BASE"';

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();

/** A definição de FC_NIVEL_EFETIVO (do create até o $function$; que fecha). */
function nivelEfetivo(sql) {
  const inicio = sql.indexOf(
    'create or replace function private."FC_NIVEL_EFETIVO"(',
  );
  expect(inicio).toBeGreaterThanOrEqual(0);
  return sql.slice(inicio, sql.indexOf("$function$;", inicio));
}

describe(NOME, () => {
  it("numa transação, com as guardas antes de mudar algo", () => {
    expect(MIGRATION.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
    const guardas = MIGRATION.indexOf("-- 0. Guardas");
    expect(guardas).toBeGreaterThan(0);
    expect(MIGRATION.indexOf("alter view")).toBeGreaterThan(guardas);
    expect(MIGRATION).toContain(
      'private."FC_NIVEL_EFETIVO" diferente da que esta migration conhece',
    );
    expect(MIGRATION).toContain(
      "Leitor da view das análises que esta migration não conhece",
    );
    expect(MIGRATION).not.toMatch(/\bdrop\s+(table|view|function|policy)\b/i);
    // Nenhuma permissão individual é apagada.
    expect(MIGRATION).not.toMatch(
      /\b(delete\s+from|truncate|update)\s+public\."TB_PERMISSAO_RECURSO"/i,
    );
  });

  it("as duas views ficam security_invoker e sem leitura de anon/authenticated", () => {
    for (const view of [VIEW, VIEW_ATIVA]) {
      expect(MIGRATION).toContain(
        `alter view ${view} set (security_invoker = true);`,
      );
      expect(MIGRATION).toContain(
        `revoke all on ${view} from public, anon, authenticated;`,
      );
      expect(MIGRATION).not.toMatch(
        new RegExp(
          `grant\\s+\\w+[^;]*on\\s+${view.replace(/[."]/g, "\\$&")}\\s+to\\s+[^;]*(authenticated|anon|public)`,
          "i",
        ),
      );
    }
    // service_role (o job) continua lendo: não é revogado.
    expect(MIGRATION).not.toMatch(/revoke[^;]*from[^;]*service_role/i);
  });

  it("o administrador global é admin no nível efetivo, pelo grupo do perfil", () => {
    const funcao = nivelEfetivo(MIGRATION);
    expect(funcao).toContain("security definer");
    expect(funcao).toContain("set search_path to ''");
    expect(funcao).toMatch(
      /when exists \(select 1 from public\."TB_GRUPO_ACESSO" a\s+where a\."CO_GRUPO_ACESSO" = p_grupo and a\."ST_ADMIN_GLOBAL"\) then 'admin'/,
    );
    // O atalho vem antes da permissão individual (que não rebaixa mais o administrador).
    expect(funcao.indexOf("ST_ADMIN_GLOBAL")).toBeLessThan(
      funcao.indexOf('"TB_PERMISSAO_RECURSO"'),
    );
    // Barata: nada de nova varredura de TB_PERFIL_USUARIO nem is_master() (que é de quem lê).
    expect(funcao).not.toContain("TB_PERFIL_USUARIO");
    expect(funcao).not.toContain("is_master");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_NIVEL_EFETIVO"(uuid, text, text) from public, anon, authenticated;',
    );
  });

  it("recalcula as fontes das leituras por versão (FC_NIVEL_EFETIVO está no fecho)", () => {
    expect(MIGRATION.trimEnd()).toMatch(
      /select private\."FC_ATUALIZAR_FONTES_DAS_LEITURAS"\(\);\s+notify pgrst, 'reload schema';\s+commit;$/,
    );
  });

  it("o ensaio roda o mesmo corpo, confere E1–E4 e termina em rollback", () => {
    expect(ENSAIO.trim()).toMatch(/^-- ENSAIO[\s\S]*\nbegin;[\s\S]*rollback;$/);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    const inicio = ENSAIO.indexOf("═══ CORPO DA MIGRATION (início) ═══");
    const fim = ENSAIO.indexOf("═══ CORPO DA MIGRATION (fim) ═══");
    expect(inicio).toBeGreaterThan(0);
    expect(fim).toBeGreaterThan(inicio);
    const corpoDoEnsaio = ENSAIO.slice(inicio, fim);
    // Mesmo corpo, menos o "set local lock_timeout" (no topo do ensaio) e os gatilhos das fontes.
    const corpoDaMigration = corpo(MIGRATION)
      .replace("set local lock_timeout = '5s';\n\n", "")
      .split("-- 3. As leituras por versão")[0];
    expect(corpoDoEnsaio).toContain(corpoDaMigration.trim());
    expect(corpoDoEnsaio).toContain(
      'select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(p_gatilhos => false);',
    );
    for (const etapa of ["E1", "E2", "E3", "E4"]) {
      expect(ENSAIO).toContain(`-- ${etapa}.`);
    }
    expect(ENSAIO).toContain("exception when insufficient_privilege");
    expect(ENSAIO).toContain("pode_recurso('acessos', 3)");
    expect(ENSAIO).toContain('private."FC_MONTAR_PAINEL_ANALISE"(');
    expect(ENSAIO).toContain("set local role authenticated;");
    expect(ENSAIO).toContain("set local role service_role;");
  });

  it("o rollback volta as opções, os grants e a FC_NIVEL_EFETIVO de antes", () => {
    expect(ROLLBACK.trim()).toMatch(/begin;[\s\S]*commit;$/);
    expect(ROLLBACK).toContain(`alter view ${VIEW} reset (security_invoker);`);
    expect(ROLLBACK).toContain(`grant select on ${VIEW} to authenticated;`);
    expect(ROLLBACK).toContain(
      `grant select on ${VIEW_ATIVA} to authenticated;`,
    );
    const funcao = nivelEfetivo(ROLLBACK);
    expect(funcao).not.toContain("ST_ADMIN_GLOBAL");
    expect(funcao).toContain('private."FC_NIVEL_DO_GRUPO"(p_grupo, p_recurso)');
    expect(ROLLBACK).toContain(
      'select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();',
    );
  });
});
