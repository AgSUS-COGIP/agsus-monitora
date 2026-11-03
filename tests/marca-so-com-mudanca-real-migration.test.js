import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  20261103150000: a marca das leituras por versão só muda quando alguma linha
  muda (gatilho por evento com tabela de transição; foto/avatar do perfil fora),
  as cargas da Seleção e das Entrevistas só regravam a linha que mudou, e
  work_mem nas funções que ordenavam em disco. O ensaio no banco (03/11/2026)
  conferiu tudo com escrita de verdade; aqui, as invariantes do arquivo.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261103150000_marca_so_com_mudanca_real.sql";
const migration = ler(`supabase/migrations/${NOME}`);
const ensaio = ler(`supabase/ensaios/${NOME}`);
const rollback = ler(`supabase/rollback/${NOME}`);

const corpo = (sql, inicio) => {
  const i = sql.indexOf(inicio);
  expect(i, inicio).toBeGreaterThan(0);
  return sql.slice(i, sql.indexOf("$function$;", i));
};

describe(NOME, () => {
  it("numa transação, com a guarda das funções que troca", () => {
    expect(migration.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
    expect(migration).toContain(
      "Função(ões) diferente(s) da que esta migration conhece",
    );
    expect(migration).toContain("md5(replace(p.prosrc, E'\\r', ''))");
    for (const nome of [
      "FC_TG_VERSAO_FONTE",
      "FC_ATUALIZAR_FONTES_DAS_LEITURAS",
      "registrar_presenca_monitora",
      "sincronizar_selecao",
      "finalizar_sync_selecao",
      "sincronizar_entrevistas",
      "finalizar_sync_entrevistas",
      "FC_ATUALIZAR_KPIS_PELA_SELECAO",
    ]) {
      expect(migration).toMatch(new RegExp(`'${nome}', '[0-9a-f]{32}'`));
    }
    // Não mexe nas RPCs por versão nem nas marcas (E1/E2 de 20261029170000 valem).
    expect(migration).not.toMatch(
      /create or replace function public\.\w+_se_mudou\(/,
    );
    expect(migration).not.toContain('function private."FC_MARCA_DA_RPC"');
    expect(migration).not.toContain('function private."FC_MARCA_DA_LEITURA"');
  });

  it("o gatilho só grava com linha na tabela de transição; truncate e por linha contam", () => {
    const g = corpo(
      migration,
      'create or replace function private."FC_TG_VERSAO_FONTE"()',
    );
    expect(g).toMatch(
      /if tg_level = 'STATEMENT' then[\s\S]*tg_op in \('INSERT', 'UPDATE'\)[\s\S]*not exists \(select 1 from novas\)[\s\S]*tg_op = 'DELETE'[\s\S]*not exists \(select 1 from antigas\)/,
    );
    expect(g).toContain('insert into private."TL_VERSAO_FONTE"');
    expect(g).not.toMatch(/\bupdate\s+private\."TL_VERSAO_FONTE"/);
    expect(g).not.toMatch(/tg_op = 'TRUNCATE'/);
  });

  it("FC_ATUALIZAR_FONTES_DAS_LEITURAS põe os quatro gatilhos em ALWAYS e tira o antigo", () => {
    const f = corpo(
      migration,
      'create or replace function private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"',
    );
    for (const g of [
      "TG_VERSAO_FONTE_INS",
      "TG_VERSAO_FONTE_UPD",
      "TG_VERSAO_FONTE_DEL",
      "TG_VERSAO_FONTE_TRUNC",
    ]) {
      expect(f).toContain(`'${g}'`);
    }
    expect(f).toContain("'referencing new table as novas for each statement'");
    expect(f).toContain(
      "'referencing old table as antigas for each statement'",
    );
    expect(f).toContain("'update of ' || v_colunas");
    expect(f).toContain("'for each row'");
    expect(f).toContain("enable always trigger %I");
    expect(f).toContain(`drop trigger "TG_VERSAO_FONTE" on %s`);
    expect(f).toContain('private."FC_CODIGO_DA_LEITURA"(');
    expect(f).toContain("cita coluna(s) fora da marca");
    // Roda no fim, depois de tudo.
    expect(migration).toMatch(
      /select private\."FC_ATUALIZAR_FONTES_DAS_LEITURAS"\(\);\s+notify pgrst, 'reload schema';\s+commit;\s*$/,
    );
  });

  it("perfil: só foto/avatar ficam fora da marca; a presença não regrava a mesma foto", () => {
    const fora = migration.slice(
      migration.indexOf('insert into private."TD_COLUNA_SEM_MARCA"'),
      migration.indexOf(
        "on conflict",
        migration.indexOf('insert into private."TD_COLUNA_SEM_MARCA"'),
      ),
    );
    const colunas = [...fora.matchAll(/'public\.TB_PERFIL_USUARIO', '(\w+)'/g)]
      .map((m) => m[1])
      .sort();
    expect(colunas).toEqual([
      "avatar_config",
      "avatar_source",
      "avatar_url",
      "google_avatar_url",
    ]);
    const p = corpo(
      migration,
      "create or replace function public.registrar_presenca_monitora(",
    );
    expect(p).toMatch(
      /if v_foto is not null\s+and exists \(select 1 from public\."TB_PERFIL_USUARIO" p[\s\S]*google_avatar_url is distinct from v_foto\) then\s+update public\."TB_PERFIL_USUARIO"/,
    );
  });

  it.each([
    [
      "sincronizar_selecao",
      'insert into public."TB_SELECAO_VAGA"',
      "SELECAO",
      's."QT_INSCRITO"',
    ],
    [
      "sincronizar_entrevistas",
      'insert into public."TB_ENTREVISTA"',
      "ENTREVISTA",
      'e."VL_NOTA_TOTAL"',
    ],
  ])(
    "%s só atualiza a linha que mudou e guarda as chaves",
    (rpc, upsert, tipo, coluna) => {
      const f = corpo(migration, `create or replace function public.${rpc}(`);
      const u = f.slice(f.indexOf(upsert));
      const guarda = u.slice(
        u.indexOf("on conflict"),
        u.indexOf(";", u.indexOf("is distinct from")),
      );
      expect(guarda).toContain(coluna);
      expect(guarda).toMatch(/\)\s+is distinct from\s+\(excluded\./);
      expect(f).toContain(
        `select '${tipo}', p_sync, t.chave from pg_temp.tmp_`,
      );
    },
  );

  it.each([
    ["finalizar_sync_selecao", "SELECAO", "TL_SYNC_SELECAO"],
    ["finalizar_sync_entrevistas", "ENTREVISTA", "TL_SYNC_ENTREVISTA"],
  ])(
    "%s desativa só quem não veio e apaga as chaves das cargas fechadas",
    (rpc, tipo, log) => {
      const f = corpo(migration, `create or replace function public.${rpc}(`);
      expect(f).toMatch(
        new RegExp(
          `"CO_SYNC" is distinct from p_sync\\s+and not exists \\(select 1 from private\\."TL_CHAVE_DA_CARGA" k\\s+where k\\."TP_CARGA" = '${tipo}' and k\\."CO_SYNC" = p_sync`,
        ),
      );
      // Na recusa e no fim.
      expect(
        f.split(`delete from private."TL_CHAVE_DA_CARGA" k`).length - 1,
      ).toBe(2);
      expect(f).toContain(`from public."${log}" t`);
    },
  );

  it("KPIs: a data da Seleção é a da última mudança nas vagas, não a da última carga", () => {
    const f = corpo(
      migration,
      'create or replace function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()',
    );
    expect(f).not.toContain("v_carga_selecao");
    expect(f).toContain('max(s."DT_ATUALIZACAO") em');
    expect(f).toContain("when 'SELECAO' then s.em");
  });

  it("work_mem 16MB só nas cinco funções; o 64MB do painel fica", () => {
    const sets = [
      ...migration.matchAll(/alter function ([^;]+) set work_mem = '(\w+)';/g),
    ].map((m) => `${m[1]}=${m[2]}`);
    expect(sets).toEqual([
      "public.get_analises_dashboard_payload_v2_se_mudou(text, text, text)=16MB",
      "public.pendencias_ler_aprovados()=16MB",
      "public.obter_pre_classificacao(uuid)=16MB",
      "public.obter_pre_classificacao_se_mudou(uuid, text)=16MB",
      "public.paineis_gravar_pacote(text, text, timestamp with time zone, bigint[], json, text)=16MB",
    ]);
    expect(migration).not.toMatch(
      /alter function public\.get_analises_dashboard_payload_v2\(/,
    );
  });

  it("não roda nem religa carga nenhuma", () => {
    const sql = migration.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sql).not.toMatch(/cron\.(schedule|alter_job|unschedule)/i);
    expect(sql).not.toMatch(/perform public\.(sincronizar|finalizar_sync)_/);
    expect(sql).not.toMatch(/select public\.(sincronizar|finalizar_sync)_/);
  });

  it("ensaio termina em rollback e confere E3 a E12", () => {
    expect(ensaio.trim()).toMatch(/rollback;$/);
    expect(ensaio).not.toMatch(/^\s*commit;/m);
    expect(ensaio).toContain(
      `-- >>> cole aqui supabase/migrations/${NOME} (sem begin/commit) <<<`,
    );
    for (const etapa of [
      "E3",
      "E4",
      "E5",
      "E6",
      "E7",
      "E8",
      "E9",
      "E10",
      "E11",
      "E12",
    ]) {
      expect(ensaio).toContain(`-- ${etapa}.`);
    }
    // KPIs não são recalculados no ensaio (o 114/2026 está congelado).
    expect(ensaio).toContain(
      `create or replace function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() returns integer\n    language sql set search_path to '' as 'select 0';`,
    );
  });

  it("rollback volta o gatilho único, as funções de antes e tira as tabelas novas", () => {
    expect(rollback.trim()).toMatch(/^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/);
    expect(rollback).toContain(
      "'for each statement execute function private.\"FC_TG_VERSAO_FONTE\"()'",
    );
    expect(rollback).toContain(
      "'TG_VERSAO_FONTE_INS', 'TG_VERSAO_FONTE_UPD', 'TG_VERSAO_FONTE_DEL', 'TG_VERSAO_FONTE_TRUNC'",
    );
    expect(rollback).toContain(
      'drop table if exists private."TL_CHAVE_DA_CARGA"',
    );
    expect(rollback).toContain(
      'drop table if exists private."TD_COLUNA_SEM_MARCA"',
    );
    expect(rollback).toContain("v_carga_selecao");
    expect(rollback.match(/reset work_mem;/g)).toHaveLength(5);
    expect(rollback).not.toContain('TL_CHAVE_DA_CARGA" (');
  });
});
