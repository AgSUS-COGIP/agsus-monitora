import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
  Migrations 20261022140000 e 20261022140100 (ainda não aplicadas; ensaios
  begin…rollback em supabase/ensaios/).

  - 140000: o fluxo FULL (processar_sync_analises_lote, finalizar_sync_analises_lotes)
    recusa sync INCREMENTAL_ACTIVE; o incremental continua passando pelo próprio
    wrapper, que marca a transação. Corpos a partir das definições do banco.
  - 140100: só as RPCs SECURITY DEFINER gravam no pedido de acesso (sem
    INSERT/UPDATE/DELETE para anon e authenticated, sem policies de escrita).
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const arquivos = (nome) => ({
  migration: ler(`supabase/migrations/${nome}`),
  ensaio: ler(`supabase/ensaios/${nome}`),
  rollback: ler(`supabase/rollback/${nome}`),
});
const corpo = (sql) =>
  sql.slice(sql.indexOf("\nbegin;\n") + 8, sql.lastIndexOf("\ncommit;")).trim();
const funcao = (sql, nome) => {
  const ini = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`);
  expect(ini, nome).toBeGreaterThan(-1);
  return sql.slice(ini, sql.indexOf("$function$;", ini));
};

const SYNC = arquivos("20261022140000_full_nao_processa_sync_incremental.sql");
const ACESSO = arquivos("20261022140100_solicitacao_de_acesso_so_pela_rpc.sql");
const GUC = "agsus.sync_analise_incremental";

describe("o fluxo FULL não processa sync incremental (20261022140000)", () => {
  it("transação única, sem apagar nada; ensaio com o mesmo corpo e em rollback", () => {
    expect(SYNC.migration).toMatch(/\nbegin;\n[\s\S]*\ncommit;\n$/);
    expect(SYNC.migration).not.toMatch(/drop table|drop function|truncate/i);
    expect(SYNC.ensaio).toContain(corpo(SYNC.migration));
    expect(SYNC.ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    expect(SYNC.ensaio).not.toMatch(/\ncommit;/);
  });

  it("processar_sync_analises_lote recusa modo diferente de FULL, salvo o incremental marcado", () => {
    const f = funcao(SYNC.migration, "processar_sync_analises_lote");
    expect(f).toContain("SECURITY DEFINER");
    expect(f).toContain("into v_cursor,v_validada,v_modo");
    expect(f).toContain("if coalesce(v_modo, 'FULL') <> 'FULL'");
    expect(f).toContain(
      `and coalesce(current_setting('${GUC}', true), '') = p_sync_id::text) then`,
    );
    expect(f).toContain("using errcode = '22023'");
    // A trava vem antes do porteiro e de qualquer escrita.
    expect(f.indexOf("[so-full]")).toBeLessThan(
      f.indexOf('perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"'),
    );
  });

  it("finalizar_sync_analises_lotes recusa modo diferente de FULL antes de desativar", () => {
    const f = funcao(SYNC.migration, "finalizar_sync_analises_lotes");
    expect(f).toContain("into v_cursor,v_alteradas,v_modo");
    expect(f).toContain("if coalesce(v_modo, 'FULL') <> 'FULL' then");
    expect(f.indexOf("[so-full]")).toBeLessThan(
      f.indexOf("create temporary table tmp_keys"),
    );
  });

  it("o incremental marca a transação só durante a chamada", () => {
    const f = funcao(
      SYNC.migration,
      "processar_sync_analises_incremental_lote",
    );
    expect(f).not.toContain("SECURITY DEFINER");
    expect(f).toContain(
      `perform set_config('${GUC}', p_sync_id::text, true);\n  v_result := public.processar_sync_analises_lote(p_sync_id,p_limite);\n  perform set_config('${GUC}', '', true);`,
    );
  });

  it("grants só para service_role; rollback volta as três funções sem a trava", () => {
    for (const assinatura of [
      "processar_sync_analises_lote(uuid, integer)",
      "finalizar_sync_analises_lotes(uuid)",
      "processar_sync_analises_incremental_lote(uuid, integer)",
    ]) {
      expect(SYNC.migration).toContain(
        `revoke all on function public.${assinatura} from public, anon, authenticated;`,
      );
      expect(SYNC.migration).toContain(
        `grant execute on function public.${assinatura} to service_role;`,
      );
    }
    for (const nome of [
      "processar_sync_analises_lote",
      "finalizar_sync_analises_lotes",
      "processar_sync_analises_incremental_lote",
    ])
      expect(funcao(SYNC.rollback, nome)).not.toContain("[so-full]");
    expect(SYNC.rollback).not.toContain(GUC);
  });

  it("o ensaio prova a recusa, o caminho do incremental e o FULL", () => {
    expect(SYNC.ensaio).toContain(
      "assert v_falhou, 'processar_sync_analises_lote aceitou um sync INCREMENTAL_ACTIVE';",
    );
    expect(SYNC.ensaio).toContain(
      "assert v_falhou, 'finalizar_sync_analises_lotes aceitou um sync INCREMENTAL_ACTIVE';",
    );
    expect(SYNC.ensaio).toContain(
      "v_r := public.processar_sync_analises_incremental_lote(v_inc, 10);",
    );
    expect(SYNC.ensaio).toContain(
      "v_r := public.processar_sync_analises_lote(v_full, 10);",
    );
  });
});

describe("pedido de acesso só pelas RPCs (20261022140100)", () => {
  const TABELAS = ['"TB_SOLICITACAO_ACESSO"', '"RL_SOLIC_ACESSO_PAINEL"'];
  const POLICIES = [
    "solicitacoes_insert_own",
    "solicitacoes_update_admin",
    "solicitacoes_delete_admin",
    "solicitacoes_paineis_insert_own_pending",
    "solicitacoes_paineis_delete_own_pending_or_admin",
  ];

  it("revoga a escrita de anon e authenticated e tira as policies de escrita", () => {
    for (const t of TABELAS)
      expect(ACESSO.migration).toContain(
        `revoke insert, update, delete, truncate on table public.${t} from anon, authenticated;`,
      );
    for (const p of POLICIES)
      expect(ACESSO.migration).toMatch(
        new RegExp(`drop policy if exists ${p} on public\\.`),
      );
    expect(ACESSO.migration).not.toMatch(/revoke[^;]*select/i);
    expect(ACESSO.migration).not.toMatch(/create (or replace )?function/i);
  });

  it("ensaio com o mesmo corpo, em rollback; rollback recria grants e policies", () => {
    expect(ACESSO.ensaio).toContain(corpo(ACESSO.migration));
    expect(ACESSO.ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    for (const p of POLICIES)
      expect(ACESSO.rollback).toMatch(
        new RegExp(`create policy ${p} on public\\.`),
      );
    for (const t of TABELAS)
      expect(ACESSO.rollback).toContain(
        `grant insert, update, delete on table public.${t} to authenticated;`,
      );
  });

  it("nenhum código de src/, api/ ou server/ usa essas tabelas direto (só as RPCs)", () => {
    const arquivosDe = (pasta) =>
      readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
        const caminho = join(pasta, item.name);
        if (item.isDirectory()) return arquivosDe(caminho);
        return /\.(js|jsx|ts|tsx|mjs)$/.test(item.name) ? [caminho] : [];
      });
    const fontes = ["src", "api", "server"].flatMap(arquivosDe);
    expect(fontes.length).toBeGreaterThan(100);
    const diretos = fontes.filter((f) =>
      /\.from\(\s*["'`](TB_SOLICITACAO_ACESSO|RL_SOLIC_ACESSO_PAINEL)["'`]/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(diretos).toEqual([]);
  });
});
