// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { moldeDeBanco } from "./apoio/molde-de-banco.ts";

/*
  O gatilho do histórico do edital ignora o UPDATE que só muda o carimbo
  (migration 20261116234000, já aplicada), num Postgres de verdade (PGlite).

  O que é de verdade: public.fn_registrar_historico como está no retrato de
  produção (supabase/esquema-atual.sql) e o gatilho. O que é imitação:
  auth.uid() (lê teste.uid), auth.users e as colunas de
  TB_MONITORAMENTO_INDIGENA e TH_MONITORAMENTO que o gatilho usa.

  A limpeza dos registros só de carimbo já gravados (20261116235000) foi uma
  correção de dados de uso único, aplicada: o teste dela saiu com ela.
*/

const LONGO = 60_000;
const RETRATO = readFileSync("supabase/esquema-atual.sql", "utf8").replace(
  /\r\n/g,
  "\n",
);

const E1 = "eeeeeeee-0000-0000-0000-000000000001";
const HUMANO = "11111111-1111-1111-1111-111111111111";

/** O corpo vigente, do retrato de produção. */
const funcaoDeHoje = () => {
  const inicio = RETRATO.indexOf(
    "CREATE FUNCTION public.fn_registrar_historico()",
  );
  if (inicio < 0) throw new Error("Sem fn_registrar_historico no retrato");
  return RETRATO.slice(inicio, RETRATO.indexOf("\n$$;", inicio) + 4);
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
    ${funcaoDeHoje()}
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

describe("gatilho ignora a mudança só de carimbo (20261116234000)", () => {
  it(
    "o UPDATE só de carimbo não grava; a mudança de conteúdo e a desativação, sim",
    async () => {
      await db.exec(
        `insert into public."TB_MONITORAMENTO_INDIGENA" (id, inscritos) values ('${E1}', 10)`,
      );
      expect(await contar("evento = 'criado'")).toBe(1);
      await db.exec(`update public."TB_MONITORAMENTO_INDIGENA"
        set updated_at = clock_timestamp(), "DT_FONTE_FUNIL" = clock_timestamp(),
            updated_by = '${HUMANO}' where id = '${E1}'`);
      expect(await contar()).toBe(1);

      await db.exec(
        `update public."TB_MONITORAMENTO_INDIGENA" set inscritos = 11, updated_at = clock_timestamp() where id = '${E1}'`,
      );
      expect(await contar("evento = 'atualizado'")).toBe(1);
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
});
