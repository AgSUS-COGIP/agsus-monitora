// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type Banco,
  bancoComRelatoriosProntos,
  erroDe,
  uma,
} from "./apoio/banco-dos-paineis.ts";

/*
  Migration 20261116235500 num Postgres de verdade (PGlite): o recálculo dos
  relatórios dos Painéis grava só a posição que mudou. As linhas guardadas
  depois do recálculo são as mesmas que o delete + insert de antes deixaria
  (o que o painel mostra não muda), e a linha igual não ganha versão nova
  (ctid igual). O cálculo é a imitação de tests/apoio/banco-dos-paineis.ts
  (lê public.linha_de_teste).
*/

const LONGO = 60_000;
const NOME = "20261116235500_relatorios_dos_paineis_gravam_so_o_que_mudou.sql";
const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
const migration = () => ler(`supabase/migrations/${NOME}`);
const rollback = () => ler(`supabase/rollback/${NOME}`);

const SI = "saude-indigena";
const REL = "editais-por-cargo";
const A = "aaaaaaaa-0000-0000-0000-00000000000a";
const B = "aaaaaaaa-0000-0000-0000-00000000000b";
const MD5_ANTES = "6310777671e9060e9a891ec3012cd42a";

type Guardada = { n: number; edital: string; linha: Record<string, unknown> };

let db: Banco;
beforeAll(() => bancoComRelatoriosProntos(), 60_000);
beforeEach(async () => {
  db = await bancoComRelatoriosProntos();
  // 10 linhas: as 5 primeiras do edital A, as outras do B.
  await db.query(
    `insert into public.linha_de_teste (area, relatorio, n, linha)
     select $1, $2, n, jsonb_build_object('edital_id', case when n <= 5 then $3 else $4 end, 'posicao', n)
       from generate_series(1, 10) n`,
    [SI, REL, A, B],
  );
}, LONGO);

const calcular = () =>
  db.query(
    `select private."FC_CALCULAR_RELATORIO_PAINEL"($1, $2, null, null)`,
    [SI, REL],
  );
const guardadas = async () =>
  (
    await db.query<Guardada>(
      `select "NU_POSICAO" as n, "CO_MONITORAMENTO"::text as edital, "DS_LINHA" as linha
         from public."TB_LINHA_RELATORIO_PAINEL"
        where "CO_AREA" = $1 and "CO_RELATORIO" = $2 order by 1`,
      [SI, REL],
    )
  ).rows;
const versoes = async () =>
  new Map(
    (
      await db.query<{ n: number; v: string }>(
        `select "NU_POSICAO" as n, ctid::text as v from public."TB_LINHA_RELATORIO_PAINEL"
          where "CO_AREA" = $1 and "CO_RELATORIO" = $2`,
        [SI, REL],
      )
    ).rows.map((r) => [r.n, r.v]),
  );
const md5DaFuncao = async () =>
  (
    await uma<{ m: string }>(
      db,
      `select md5(prosrc) as m from pg_proc
        where oid = to_regprocedure('private."FC_CALCULAR_RELATORIO_PAINEL"(text, text, uuid, interval)')`,
    )
  )?.m;

/** O que o delete + insert de antes deixaria: as linhas de teste na ordem, de 1 em diante. */
const esperado = async () =>
  (
    await db.query<Guardada>(
      `select (row_number() over (order by n))::integer as n, linha ->> 'edital_id' as edital, linha
         from public.linha_de_teste where area = $1 and relatorio = $2 order by n`,
      [SI, REL],
    )
  ).rows;

describe("recálculo grava só o que mudou", () => {
  it(
    "a guarda reconhece o corpo de 20261116160000 e a migration aplica",
    async () => {
      expect(await md5DaFuncao()).toBe(MD5_ANTES);
      await db.exec(migration());
      expect(await md5DaFuncao()).not.toBe(MD5_ANTES);
      expect(
        await uma(
          db,
          `select reloptions from pg_class where oid = 'public."TB_LINHA_RELATORIO_PAINEL"'::regclass`,
        ),
      ).toEqual({ reloptions: ["fillfactor=90"] });
    },
    LONGO,
  );

  it(
    "sem mudança, nenhuma linha é regravada",
    async () => {
      await db.exec(migration());
      await calcular();
      const antes = await versoes();
      await calcular();
      expect(await versoes()).toEqual(antes);
      expect(await guardadas()).toEqual(await esperado());
    },
    LONGO,
  );

  it(
    "linha mudada, sumida e nova: o guardado é o cálculo, e só elas mudam",
    async () => {
      await db.exec(migration());
      await calcular();
      const antes = await versoes();
      await db.query(
        `update public.linha_de_teste set linha = linha || '{"inscritos": 3}' where n = 3`,
      );
      await db.query(`delete from public.linha_de_teste where n = 6`);
      await calcular();
      // Sem a 6, as posições 6 a 9 recebem as linhas 7 a 10 e a posição 10 sai.
      expect(await guardadas()).toEqual(await esperado());
      const depois = await versoes();
      expect(depois.size).toBe(9);
      const mudaram = [...depois].filter(([n, v]) => antes.get(n) !== v);
      expect(mudaram.map(([n]) => n)).toEqual([3, 6, 7, 8, 9]);

      await db.query(
        `insert into public.linha_de_teste values ($1, $2, 11, jsonb_build_object('edital_id', $3::text, 'posicao', 11))`,
        [SI, REL, A],
      );
      await calcular();
      expect(await guardadas()).toEqual(await esperado());
      expect((await versoes()).size).toBe(10);
    },
    LONGO,
  );

  it(
    "relatório que fica vazio perde todas as linhas",
    async () => {
      await db.exec(migration());
      await calcular();
      await db.query(`delete from public.linha_de_teste`);
      await calcular();
      expect(await guardadas()).toEqual([]);
      expect(
        await uma(
          db,
          `select "QT_LINHA" as qt from public."TB_CALCULO_RELATORIO_PAINEL"
            where "CO_AREA" = $1 and "CO_RELATORIO" = $2`,
          [SI, REL],
        ),
      ).toEqual({ qt: 0 });
    },
    LONGO,
  );
});

describe("rollback", () => {
  it(
    "volta o corpo de antes e o fillfactor padrão",
    async () => {
      await db.exec(migration());
      await db.exec(rollback());
      expect(await md5DaFuncao()).toBe(MD5_ANTES);
      expect(
        await uma(
          db,
          `select reloptions from pg_class where oid = 'public."TB_LINHA_RELATORIO_PAINEL"'::regclass`,
        ),
      ).toEqual({ reloptions: null });
      await calcular();
      expect(await guardadas()).toEqual(await esperado());
    },
    LONGO,
  );

  it(
    "aborta se a migration não estiver aplicada, e a migration não aplica duas vezes",
    async () => {
      const semMigration = await erroDe(db.exec(rollback()));
      await db.exec("rollback");
      expect(semMigration?.mensagem).toMatch(/não está aplicada/);
      await db.exec(migration());
      const duasVezes = await erroDe(db.exec(migration()));
      await db.exec("rollback");
      expect(duasVezes?.mensagem).toMatch(/md5/);
    },
    LONGO,
  );
});
