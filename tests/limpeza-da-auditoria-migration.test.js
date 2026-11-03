import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { motivoValido } from "../src/lib/chaves-da-automacao.ts";

/*
  Limpeza da auditoria (20261103213000), ainda não aplicada. O ensaio
  (supabase/ensaios/) roda o corpo no banco e desfaz: anon não executa as
  quatro funções privadas, todo administrador global continua master (e só
  ele), o motivo recusa teclado batido no RPC e a tarefa de limpeza do
  cron.job_run_details existe. Aqui, as invariantes estáticas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261103213000_limpeza_da_auditoria.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

const corpo = (sql) =>
  sql.slice(sql.indexOf("\nbegin;\n") + 8, sql.lastIndexOf("\ncommit;")).trim();

const FUNCOES = [
  'private."FC_JANELA_ENTREVISTA"(uuid)',
  'private."FC_QUADRO_DA_VAGA"(uuid, text)',
  'private."FC_TOKENS_VAGA"(text)',
  'private."FC_VENCIMENTO_DO_EDITAL"(date, smallint, smallint, boolean)',
];

/** A definição de uma função (do create até o $function$; que fecha). */
function definicao(sql, cabecalho) {
  const inicio = sql.indexOf(cabecalho);
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
    expect(MIGRATION.indexOf("revoke all on function")).toBeGreaterThan(
      guardas,
    );
    expect(MIGRATION).toContain(
      "private.is_master() diferente da que esta migration conhece.",
    );
    expect(MIGRATION).toContain(
      "administrador(es) global(is) ativo(s) sem user_id",
    );
    expect(MIGRATION).toContain(
      "perfil(is) sem user_id com conta no auth.users",
    );
    // Nada de apagar tabela/função nem de mexer em dados fora das funções.
    const foraDasFuncoes = MIGRATION.replace(/$function$[sS]*?$function$/g, "");
    expect(foraDasFuncoes).not.toMatch(/drops+(table|function|policy)/i);
    expect(foraDasFuncoes).not.toMatch(
      /(update|truncate|deletes+from)s+(public|auth|cron)./i,
    );
  });

  it("as quatro funções privadas sem EXECUTE de PUBLIC e anon; o rollback devolve", () => {
    for (const funcao of FUNCOES) {
      expect(MIGRATION).toContain(
        `revoke all on function ${funcao} from public, anon;`,
      );
      expect(ROLLBACK).toContain(
        `grant execute on function ${funcao} to public;`,
      );
    }
  });

  it("is_master() só pelo user_id, com o gatilho que liga o perfil à conta", () => {
    const master = definicao(
      MIGRATION,
      "create or replace function private.is_master()",
    );
    expect(master).toContain("p.user_id = (select auth.uid())");
    expect(master).not.toMatch(/email|auth\.jwt/);
    expect(master).toContain("security definer");
    expect(master).toContain("set search_path = ''");
    expect(MIGRATION).toMatch(
      /create trigger "TG_PERFILUSUARIO_AUTH_PELO_EMAIL"\s+before insert or update of email on public\."TB_PERFIL_USUARIO"\s+for each row\s+when \(new\.user_id is null\)/,
    );
    // O rollback volta a aceitar o e-mail do JWT.
    expect(
      definicao(ROLLBACK, "create or replace function private.is_master()"),
    ).toContain("auth.jwt() ->> 'email'");
  });

  it("o RPC valida o motivo pela regra nova, sem CHECK nas tabelas", () => {
    const rpc = definicao(
      MIGRATION,
      "create or replace function public.alterar_chave_da_automacao(",
    );
    expect(rpc).toContain(
      'if not private."FC_MOTIVO_COM_SENTIDO"(v_motivo) then',
    );
    expect(rpc).not.toContain("not between 10 and 500");
    expect(rpc).toContain("if not private.is_master() then");
    expect(MIGRATION).not.toMatch(
      /alter table public\."T[BH]_CHAVE_AUTOMACAO"/,
    );
    expect(
      definicao(
        ROLLBACK,
        "create or replace function public.alterar_chave_da_automacao(",
      ),
    ).toContain("if length(v_motivo) not between 10 and 500 then");
  });

  it("a regra do banco e a da tela recusam e aceitam os mesmos motivos", () => {
    const regra = definicao(
      MIGRATION,
      'create or replace function private."FC_MOTIVO_COM_SENTIDO"(',
    );
    expect(regra).toContain("length(t.m) between 15 and 500");
    expect(regra).toContain("(select count(*) from p) >= 3");
    expect(regra).toContain(">= 2");
    expect(regra).toContain(">= 5");
    for (const lixo of ["sadasdsadsadasdas", "testegcgbgfbg"]) {
      expect(motivoValido(lixo)).toBe(false);
      expect(ENSAIO).toContain(`'${lixo}'`);
    }
    expect(
      motivoValido("Religar a sincronização da seleção do edital 120/2026"),
    ).toBe(true);
  });

  it("tarefa diária de limpeza do cron.job_run_details, mantendo as últimas de cada tarefa", () => {
    expect(MIGRATION).toContain(
      "perform cron.schedule('agsus_cron_limpar_historico', '52 6 * * *', v_comando);",
    );
    const limpar = definicao(
      MIGRATION,
      'create or replace function private."FC_LIMPAR_HISTORICO_DO_CRON"(',
    );
    expect(limpar).toContain("delete from cron.job_run_details d");
    expect(limpar).toContain(
      "d.start_time < now() - make_interval(days => p_dias)",
    );
    expect(limpar).toContain("x.n <= p_manter");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_LIMPAR_HISTORICO_DO_CRON"(integer, integer) from public, anon, authenticated, service_role;',
    );
    expect(ROLLBACK).toContain(
      "perform cron.unschedule('agsus_cron_limpar_historico');",
    );
  });

  it("o ensaio roda o corpo da migration e desfaz", () => {
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trim()).toMatch(/rollback;$/);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("set local statement_timeout");
    for (const marca of ["E1:", "E2:", "E3:", "E4:"])
      expect(ENSAIO).toContain(marca);
  });
});
