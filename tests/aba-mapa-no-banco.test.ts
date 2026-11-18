// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { moldeDeBanco } from "./apoio/molde-de-banco.ts";

/*
  A migration 20261118160000 (aba Mapa na Saúde Indígena) num Postgres de
  verdade (PGlite), sobre o catálogo de abas de hoje: as tabelas e a função
  do menu copiadas do banco (fixtures/sql-do-banco/catalogo-de-abas-em-18-11.sql)
  e as linhas da resposta real do menu
  (fixtures/listar-abas-do-menu-triagem.json, já com o Mapa: o "hoje" é ela
  sem o Mapa e com as abas uma posição acima).

  hoje × migrada (a resposta da fixture) × migrada + rollback (hoje de novo),
  e o ensaio, que não grava nada.
*/

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261118160000_aba_mapa_na_saude_indigena.sql";
const migration = () => ler(`supabase/migrations/${NOME}`);
const rollback = () => ler(`supabase/rollback/${NOME}`);
const ensaio = () => ler(`supabase/ensaios/${NOME}`);

interface AreaDoMenu {
  co_area: string;
  nu_ordem: number;
  co_view: string;
  ds_icone: string;
}
interface AbaDoMenu {
  co_aba: string;
  no_aba: string;
  ds_icone: string;
  nu_ordem: number;
  co_view: string;
  co_recurso: string;
  tp_aba: string;
  st_beta: boolean;
  areas: AreaDoMenu[];
}
const DEPOIS: AbaDoMenu[] = JSON.parse(
  ler("tests/fixtures/listar-abas-do-menu-triagem.json"),
);
/* O catálogo de hoje: sem o Mapa, as abas da ordem 3 em diante uma posição acima. */
const subir = (n: number) => (n >= 3 ? n - 1 : n);
const HOJE: AbaDoMenu[] = DEPOIS.filter((a) => a.co_aba !== "mapa").map(
  (a) => ({
    ...a,
    nu_ordem: subir(a.nu_ordem),
    areas: a.areas.map((x) => ({ ...x, nu_ordem: subir(x.nu_ordem) })),
  }),
);
const AREAS = ["saude-indigena", "sede", "projetos"];

const texto = (v: string) => `'${v.replace(/'/g, "''")}'`;
function semear(abas: readonly AbaDoMenu[]): string {
  const linhas = [
    ...AREAS.map(
      (area, i) =>
        `insert into public."TB_AREA" ("CO_AREA","NO_AREA","NO_GRUPO_PLANILHA","NU_ORDEM") values (${texto(area)}, ${texto(area)}, ${texto(area)}, ${i + 1});`,
    ),
  ];
  for (const a of abas) {
    linhas.push(
      `insert into public."TB_ABA" ("CO_ABA","NO_ABA","DS_ICONE","NU_ORDEM","CO_VIEW","CO_RECURSO","TP_ABA","ST_BETA") values (${texto(a.co_aba)}, ${texto(a.no_aba)}, ${texto(a.ds_icone)}, ${a.nu_ordem}, ${texto(a.co_view)}, ${texto(a.co_recurso)}, ${texto(a.tp_aba)}, ${a.st_beta ? "'S'" : "'N'"});`,
    );
    for (const x of a.areas)
      linhas.push(
        `insert into public."RL_ABA_AREA" ("CO_ABA","CO_AREA","NU_ORDEM") values (${texto(a.co_aba)}, ${texto(x.co_area)}, ${x.nu_ordem === a.nu_ordem ? "null" : x.nu_ordem});`,
      );
  }
  return linhas.join("\n");
}

const banco = moldeDeBanco(async () => {
  const db = await PGlite.create();
  await db.exec(
    ler("tests/fixtures/sql-do-banco/catalogo-de-abas-em-18-11.sql"),
  );
  await db.exec(semear(HOJE));
  return db;
});

/* O menu como o front o lê: aba, ordem, view, ícone e as áreas com ordem. */
async function menu(db: PGlite) {
  const { rows } = await db.query<{ menu: AbaDoMenu[] }>(
    "select public.listar_abas_do_menu() as menu",
  );
  return resumo(rows[0]?.menu ?? []);
}
const resumo = (abas: readonly AbaDoMenu[]) =>
  abas.map((a) => ({
    aba: a.co_aba,
    ordem: a.nu_ordem,
    view: a.co_view,
    icone: a.ds_icone,
    recurso: a.co_recurso,
    areas: a.areas.map((x) => `${x.co_area}:${x.nu_ordem}`),
  }));

describe("migration 20261118160000: a aba Mapa no catálogo", () => {
  it("põe o Mapa na ordem 2, só na Saúde Indígena, e empurra as outras", async () => {
    const db = await banco();
    expect(await menu(db)).toEqual(resumo(HOJE));
    await db.exec(migration());
    const depois = await menu(db);
    expect(depois).toEqual(resumo(DEPOIS));
    expect(depois[1]).toEqual({
      aba: "mapa",
      ordem: 2,
      view: "mapa",
      icone: "map-pinned",
      recurso: "dashboard",
      areas: ["saude-indigena:2"],
    });
  });

  it("não aplica duas vezes", async () => {
    const db = await banco();
    await db.exec(migration());
    await expect(db.exec(migration())).rejects.toThrow(/já existe/);
  });

  it("o rollback volta ao catálogo de hoje", async () => {
    const db = await banco();
    await db.exec(migration());
    await db.exec(rollback());
    expect(await menu(db)).toEqual(resumo(HOJE));
    await expect(db.exec(rollback())).rejects.toThrow(/nada a desfazer/);
  });

  it("o ensaio passa e não grava nada", async () => {
    const db = await banco();
    await db.exec(ensaio());
    expect(await menu(db)).toEqual(resumo(HOJE));
  });
});
