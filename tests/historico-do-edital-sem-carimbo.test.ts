// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { moldeDeBanco } from "./apoio/molde-de-banco.ts";

/*
  Migrations 20261116234000 (o gatilho do histórico do edital ignora o UPDATE
  que só muda o carimbo) e 20261116235000 (apaga os registros só de carimbo já
  gravados) num Postgres de verdade (PGlite).

  O que é de verdade: public.fn_registrar_historico com o corpo de 16/11/2026
  (o do rollback, que o banco tinha), o gatilho, as migrations e os rollbacks.
  O que é imitação: auth.uid() (lê teste.uid), auth.users e as colunas de
  TB_MONITORAMENTO_INDIGENA e TH_MONITORAMENTO que o gatilho e a limpeza usam.
*/

const LONGO = 60_000;
const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
const GATILHO = "20261116234000_historico_do_edital_ignora_so_carimbo.sql";
const LIMPEZA = "20261116235000_limpar_historico_do_edital_so_carimbo.sql";
const migration = (nome: string) => ler(`supabase/migrations/${nome}`);
const rollback = (nome: string) => ler(`supabase/rollback/${nome}`);
const MD5_ANTES = "3a95b60de55006aac09a8d0169d68244";

const E1 = "eeeeeeee-0000-0000-0000-000000000001";
const E2 = "eeeeeeee-0000-0000-0000-000000000002";
const HUMANO = "11111111-1111-1111-1111-111111111111";

/** O corpo de antes, do rollback (o que o banco tinha em 16/11/2026). */
const funcaoDeAntes = () => {
  const sql = rollback(GATILHO);
  const inicio = sql.indexOf("CREATE OR REPLACE FUNCTION");
  const fim = sql.indexOf("$function$;", inicio) + "$function$;".length;
  return sql.slice(inicio, fim);
};

async function montar() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
    create table public."TB_MONITORAMENTO_INDIGENA" (
      id uuid primary key, ativo boolean not null default true, observacoes text,
      inscritos integer, updated_at timestamptz default now(), updated_by uuid,
      "DT_FONTE_FUNIL" timestamptz);
    create table public."TH_MONITORAMENTO" (
      id uuid primary key default gen_random_uuid(), id_registro uuid, usuario_id uuid,
      usuario_email text, evento text check (evento in ('criado', 'atualizado', 'desativado')),
      campo_alterado text, valor_anterior text, valor_novo text, snapshot_json jsonb,
      created_at timestamptz default now());
    insert into auth.users values ('${HUMANO}', 'pessoa@exemplo.org');
    ${funcaoDeAntes()}
    create trigger trg_historico_monitoramento after insert or update
      on public."TB_MONITORAMENTO_INDIGENA" for each row execute function fn_registrar_historico();
  `);
  return db;
}
const bancoDoHistorico = moldeDeBanco(montar);

let db: PGlite;
beforeAll(() => bancoDoHistorico(), LONGO);
beforeEach(async () => {
  db = await bancoDoHistorico();
}, LONGO);

const contar = async (onde = "true") =>
  Number(
    (
      await db.query<{ n: number }>(
        `select count(*)::integer as n from public."TH_MONITORAMENTO" where ${onde}`,
      )
    ).rows[0]?.n,
  );
const md5DaFuncao = async () =>
  (
    await db.query<{ m: string }>(
      `select md5(prosrc) as m from pg_proc where oid = to_regprocedure('public.fn_registrar_historico()')`,
    )
  ).rows[0]?.m;
const erroDe = async (sql: string) => {
  try {
    await db.exec(sql);
    return null;
  } catch (e) {
    await db.exec("rollback");
    return (e as Error).message;
  }
};

describe("gatilho ignora a mudança só de carimbo (20261116234000)", () => {
  it(
    "o corpo de antes é o do banco (md5 da guarda)",
    async () => {
      expect(await md5DaFuncao()).toBe(MD5_ANTES);
    },
    LONGO,
  );

  it(
    "antes gravava o carimbo; depois, só a mudança de conteúdo",
    async () => {
      await db.exec(
        `insert into public."TB_MONITORAMENTO_INDIGENA" (id, inscritos) values ('${E1}', 10)`,
      );
      const carimbo = `update public."TB_MONITORAMENTO_INDIGENA"
        set updated_at = clock_timestamp(), "DT_FONTE_FUNIL" = clock_timestamp(),
            updated_by = '${HUMANO}' where id = '${E1}'`;
      await db.exec(carimbo);
      expect(await contar()).toBe(2);

      await db.exec(migration(GATILHO));
      await db.exec(carimbo);
      expect(await contar()).toBe(2);

      await db.exec(
        `update public."TB_MONITORAMENTO_INDIGENA" set inscritos = 11, updated_at = clock_timestamp() where id = '${E1}'`,
      );
      expect(await contar("evento = 'atualizado'")).toBe(2);
      expect(
        await contar(
          `evento = 'atualizado' and (snapshot_json ->> 'inscritos')::integer = 11`,
        ),
      ).toBe(1);

      await db.exec(`select set_config('teste.uid', '${HUMANO}', false)`);
      await db.exec(
        `update public."TB_MONITORAMENTO_INDIGENA" set ativo = false where id = '${E1}'`,
      );
      expect(
        await contar(
          `evento = 'desativado' and usuario_email = 'pessoa@exemplo.org'`,
        ),
      ).toBe(1);
    },
    LONGO,
  );

  it(
    "rollback volta o corpo de antes; aborta se não aplicada; não aplica duas vezes",
    async () => {
      expect(await erroDe(rollback(GATILHO))).toMatch(/não está aplicada/);
      await db.exec(migration(GATILHO));
      expect(await erroDe(migration(GATILHO))).toMatch(/md5/);
      await db.exec(rollback(GATILHO));
      expect(await md5DaFuncao()).toBe(MD5_ANTES);
    },
    LONGO,
  );
});

/*
  Histórico de teste: E1 com 'criado' e 9.100 registros automáticos só de
  carimbo, entremeados de mudanças de conteúdo (automáticas e humanas), um
  registro humano só de carimbo, uma troca de área e dois registros no mesmo
  instante; E2 com 'criado' e um só de carimbo.
*/
const HISTORICO = `
insert into public."TH_MONITORAMENTO" (id_registro, usuario_id, evento, campo_alterado, snapshot_json, created_at)
select '${E1}', null, case when n = 0 then 'criado' else 'atualizado' end, null,
       jsonb_build_object('id', '${E1}', 'inscritos', n / 1000, 'updated_at', n, 'DT_FONTE_FUNIL', n),
       timestamptz '2026-06-01' + n * interval '1 minute'
  from generate_series(0, 9109) n;
-- Humano que só mudou o carimbo (fica: é humano).
update public."TH_MONITORAMENTO" set usuario_id = '${HUMANO}'
 where id_registro = '${E1}' and created_at = timestamptz '2026-06-01' + 500 * interval '1 minute';
-- Troca de área (fica: tem campo_alterado).
update public."TH_MONITORAMENTO" set campo_alterado = 'CO_AREA'
 where id_registro = '${E1}' and created_at = timestamptz '2026-06-01' + 600 * interval '1 minute';
-- Dois registros no mesmo instante (ordem incerta: ficam, e o seguinte também).
insert into public."TH_MONITORAMENTO" (id_registro, usuario_id, evento, snapshot_json, created_at)
values ('${E1}', null, 'atualizado', jsonb_build_object('id', '${E1}', 'inscritos', 9, 'updated_at', -1, 'DT_FONTE_FUNIL', -1),
        timestamptz '2026-06-01' + 9105 * interval '1 minute');
insert into public."TH_MONITORAMENTO" (id_registro, usuario_id, evento, snapshot_json, created_at) values
  ('${E2}', null, 'criado', jsonb_build_object('id', '${E2}', 'inscritos', 1, 'updated_at', 0), timestamptz '2026-06-01'),
  ('${E2}', null, 'atualizado', jsonb_build_object('id', '${E2}', 'inscritos', 1, 'updated_at', 1), timestamptz '2026-06-02');
`;

describe("limpeza dos registros só de carimbo (20261116235000)", () => {
  it(
    "exige o gatilho novo",
    async () => {
      await db.exec(HISTORICO);
      expect(await erroDe(migration(LIMPEZA))).toMatch(/20261116234000/);
    },
    LONGO,
  );

  it(
    "apaga só o automático sem conteúdo e mantém todo estado de conteúdo",
    async () => {
      await db.exec(HISTORICO);
      await db.exec(migration(GATILHO));
      const estados = `select id_registro, count(distinct snapshot_json - array['updated_at', 'updated_by', 'DT_FONTE_FUNIL']) as qt
                         from public."TH_MONITORAMENTO" group by 1 order by 1`;
      const antes = (await db.query(estados)).rows;
      const total = await contar();

      await db.exec(migration(LIMPEZA));

      // E1: 9.110 registros. Ficam o 'criado', as 9 mudanças de inscritos (1.000, 2.000 …
      // 9.000), o humano, a troca de área, os dois do mesmo instante e o seguinte a eles.
      // E2: fica o 'criado', sai o só de carimbo.
      expect(await contar(`id_registro = '${E1}'`)).toBe(1 + 9 + 1 + 1 + 2 + 1);
      expect(await contar(`id_registro = '${E2}'`)).toBe(1);
      expect(total - (await contar())).toBe(9111 - 15 + 1);
      expect(await contar(`usuario_id is not null`)).toBe(1);
      expect(await contar(`campo_alterado is not null`)).toBe(1);
      expect((await db.query(estados)).rows).toEqual(antes);
    },
    LONGO,
  );

  it(
    "com poucos registros a apagar, a guarda recusa (algo mudou: medir de novo)",
    async () => {
      await db.exec(migration(GATILHO));
      await db.exec(`
        insert into public."TH_MONITORAMENTO" (id_registro, evento, snapshot_json, created_at) values
          ('${E2}', 'criado', '{"inscritos": 1, "updated_at": 0}', timestamptz '2026-06-01'),
          ('${E2}', 'atualizado', '{"inscritos": 1, "updated_at": 1}', timestamptz '2026-06-02')`);
      expect(await erroDe(migration(LIMPEZA))).toMatch(/Meça de novo/);
      expect(await contar()).toBe(2);
    },
    LONGO,
  );
});
