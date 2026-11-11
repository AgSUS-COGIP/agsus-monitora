// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { erroDe, uma } from "./apoio/banco-dos-robos.ts";

/*
  Migration 20261110190000 (exportação da Lista de aprovados) num Postgres de
  verdade (PGlite). As tabelas da lista são as colunas que a RPC lê; a sessão e
  as permissões são imitações que leem configurações do teste (teste.uid,
  teste.nivel, teste.areas, teste.visiveis). Dados fictícios.
*/

const NOME = "20261110190000_exportacao_da_lista_de_aprovados.sql";
const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const USUARIO = "11111111-1111-1111-1111-111111111111";
const EDITAL_A1 = "a0000000-0000-0000-0000-0000000000a1";
const EDITAL_A2 = "a0000000-0000-0000-0000-0000000000a2";
const EDITAL_TREINO = "a0000000-0000-0000-0000-0000000000a9";
const EDITAL_SEM_LISTA = "a0000000-0000-0000-0000-0000000000a8";
const EDITAL_B = "b0000000-0000-0000-0000-0000000000b1";

const INFRAESTRUTURA = `
create role anon;
create role authenticated;
create schema private;
create schema auth;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid
$$;
create function private.pode_recurso(p_recurso text, p_minimo integer default 1) returns boolean
language sql stable as $$
  select p_recurso = 'aprovados'
     and coalesce(nullif(current_setting('teste.nivel', true), ''), '0')::integer >= greatest(p_minimo, 1)
$$;
create function private."FC_AREAS_USUARIO"() returns text[] language sql stable as $$
  select string_to_array(coalesce(current_setting('teste.areas', true), ''), ',')
$$;
create function private."FC_EDITAIS_VISIVEIS"() returns uuid[] language sql stable as $$
  select nullif(current_setting('teste.visiveis', true), '')::uuid[]
$$;
create function private."FC_EH_TREINAMENTO"(p_marca text) returns boolean
language sql immutable as $$ select coalesce(p_marca, 'N') = 'S' $$;
create function private.autor_da_sessao(out email text, out nome text) returns record
language sql stable as $$ select 'pessoa@exemplo.org'::text, 'Pessoa de Teste'::text $$;

create table public."TB_AREA" ("CO_AREA" text primary key);
create table public."TB_MONITORAMENTO_INDIGENA" (
  id uuid primary key, edital text, unidade text, "CO_AREA" text, "ST_TREINAMENTO" text
);
create table public."TB_LISTA_APROVADO" (
  id uuid primary key default gen_random_uuid(), edital_id text, vigente boolean, ativo boolean
);
create table public."TB_CANDIDATO_APROVADO" (
  id uuid primary key default gen_random_uuid(), lista_id uuid, nome text, cargo text,
  modalidade text, removido_em timestamptz
);

insert into public."TB_AREA" values ('saude-indigena'), ('sede');
insert into public."TB_MONITORAMENTO_INDIGENA" values
  ('${EDITAL_A1}', '01/2026', 'Unidade A', 'saude-indigena', 'N'),
  ('${EDITAL_A2}', '02/2026', 'Unidade B', 'saude-indigena', 'N'),
  ('${EDITAL_TREINO}', '99/2026', 'Treino', 'saude-indigena', 'S'),
  ('${EDITAL_SEM_LISTA}', '03/2026', 'Sem lista', 'saude-indigena', 'N'),
  ('${EDITAL_B}', '10/2026', 'Sede', 'sede', 'N');
`;

async function bancoComLista(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(INFRAESTRUTURA);
  const lista = async (edital: string, vigente = true) =>
    (
      await db.query<{ id: string }>(
        `insert into public."TB_LISTA_APROVADO" (edital_id, vigente, ativo) values ($1, $2, true) returning id`,
        [edital, vigente],
      )
    ).rows[0]?.id;
  const candidatos = async (
    listaId: string | undefined,
    n: number,
    cargo: string,
    modalidade: string,
    removido = false,
  ) =>
    db.query(
      `insert into public."TB_CANDIDATO_APROVADO" (lista_id, nome, cargo, modalidade, removido_em)
       select $1, 'Pessoa ' || g, $2, $3, case when $4 then now() end from generate_series(1, $5) g`,
      [listaId, cargo, modalidade, removido, n],
    );
  const a1 = await lista(EDITAL_A1);
  await candidatos(a1, 6, "Enfermeiro", "Ampla concorrência");
  await candidatos(a1, 3, " Enfermeiro ", "Pessoas pretas e pardas");
  await candidatos(a1, 2, "Médico", "Ampla concorrência");
  await candidatos(a1, 4, "Médico", "Ampla concorrência", true); // removidos
  const antiga = await lista(EDITAL_A1, false); // substituída: não conta
  await candidatos(antiga, 50, "Enfermeiro", "Ampla concorrência");
  const a2 = await lista(EDITAL_A2);
  await candidatos(a2, 5, "Técnico", "Ampla concorrência");
  await candidatos(await lista(EDITAL_TREINO), 7, "Treino", "Ampla");
  await candidatos(await lista(EDITAL_B), 8, "Analista", "Ampla");
  return db;
}

async function como(
  db: PGlite,
  {
    uid = USUARIO,
    nivel = 1,
    areas = "saude-indigena",
    visiveis = "",
  }: { uid?: string; nivel?: number; areas?: string; visiveis?: string } = {},
) {
  await db.query(
    `select set_config('teste.uid', $1, false), set_config('teste.nivel', $2, false),
            set_config('teste.areas', $3, false), set_config('teste.visiveis', $4, false)`,
    [uid, String(nivel), areas, visiveis],
  );
}

type Pedido = {
  area?: string;
  formato?: string;
  editais?: string[];
  cargos?: string[];
  modalidades?: string[];
  situacoes?: string[];
  aviso?: boolean;
  total?: number | null;
  registros?: number | null;
};
const registrar = (db: PGlite, p: Pedido = {}) =>
  db.query<{
    r: {
      exportacao_id: string;
      emitida_em: string;
      recorte: number;
      registros: number;
    };
  }>(
    `select public.registrar_exportacao_aprovados($1, $2, $3::uuid[], $4, $5, $6, $7, $8, $9) as r`,
    [
      p.area ?? "saude-indigena",
      p.formato ?? "XLSX",
      p.editais ?? [EDITAL_A1, EDITAL_A2],
      p.cargos ?? [],
      p.modalidades ?? [],
      p.situacoes ?? [],
      p.aviso ?? false,
      p.total === undefined ? 16 : p.total,
      p.registros === undefined ? (p.total ?? 16) : p.registros,
    ],
  );

describe("registrar_exportacao_aprovados (PGlite)", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await bancoComLista();
    await db.exec(MIGRATION);
    await como(db);
  });

  it("registra a exportação com o total da lista vigente contado no banco", async () => {
    const { rows } = await registrar(db, { formato: "csv" });
    const r = rows[0]?.r;
    expect(r?.recorte).toBe(16);
    expect(r?.registros).toBe(16);
    expect(r?.exportacao_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r?.emitida_em).toBeTruthy();
    const linha = await uma<Record<string, unknown>>(
      db,
      `select "CO_AREA", "TP_FORMATO", "DS_FILTRO", "QT_EDITAL", "QT_RECORTE", "QT_REGISTRO",
              "CO_USUARIO", "NO_USUARIO" from public."TL_EXPORTACAO_APROVADO"`,
    );
    expect(linha).toEqual({
      CO_AREA: "saude-indigena",
      TP_FORMATO: "CSV",
      DS_FILTRO: {
        editais: [EDITAL_A1, EDITAL_A2],
        cargos: [],
        modalidades: [],
        situacoes: [],
        recorte_do_aviso: false,
      },
      QT_EDITAL: 2,
      QT_RECORTE: 16,
      QT_REGISTRO: 16,
      CO_USUARIO: USUARIO,
      NO_USUARIO: "Pessoa de Teste",
    });
  });

  it("aplica cargo e modalidade no banco (sem espaço nas pontas) e aceita zero registros", async () => {
    const enf = await registrar(db, { cargos: ["Enfermeiro"], total: 9 });
    expect(enf.rows[0]?.r.recorte).toBe(9);
    const ppp = await registrar(db, {
      cargos: ["Enfermeiro"],
      modalidades: ["Pessoas pretas e pardas"],
      total: 3,
    });
    expect(ppp.rows[0]?.r.recorte).toBe(3);
    const nada = await registrar(db, {
      cargos: ["Cargo que não existe"],
      total: 0,
    });
    expect(nada.rows[0]?.r.recorte).toBe(0);
  });

  it("com situação ou recorte do aviso, os registros podem ser menos que o recorte, nunca mais", async () => {
    const parte = await registrar(db, {
      situacoes: ["Contratado", "__sem_status__"],
      registros: 4,
    });
    expect(parte.rows[0]?.r.registros).toBe(4);
    const aviso = await registrar(db, { aviso: true, registros: 1 });
    expect(aviso.rows[0]?.r.registros).toBe(1);
    expect(
      await erroDe(registrar(db, { situacoes: ["Contratado"], registros: 17 })),
    ).toMatchObject({
      codigo: "22023",
    });
    expect(await erroDe(registrar(db, { registros: 15 }))).toMatchObject({
      codigo: "22023",
    });
  });

  it("recusa quando a tela tem outro total (lista mudou)", async () => {
    const erro = await erroDe(registrar(db, { total: 15 }));
    expect(erro?.codigo).toBe("40001");
    expect(erro?.mensagem).toContain("15 na tela, 16 no banco");
    expect(
      (
        await uma<{ n: number }>(
          db,
          `select count(*)::int n from public."TL_EXPORTACAO_APROVADO"`,
        )
      )?.n,
    ).toBe(0);
  });

  it("confere sessão, perfil e área", async () => {
    await como(db, { uid: "" });
    expect((await erroDe(registrar(db)))?.codigo).toBe("28000");
    await como(db, { nivel: 0 });
    expect((await erroDe(registrar(db)))?.codigo).toBe("42501");
    await como(db, { areas: "sede" });
    expect((await erroDe(registrar(db)))?.codigo).toBe("42501");
    await como(db);
    expect((await erroDe(registrar(db, { area: "nao-existe" })))?.codigo).toBe(
      "22023",
    );
  });

  it("não aceita edital de outra área, sem lista vigente, de treinamento ou fora da coordenação", async () => {
    for (const editais of [
      [EDITAL_A1, EDITAL_B],
      [EDITAL_SEM_LISTA],
      [EDITAL_TREINO],
      ["c0000000-0000-0000-0000-000000000000"],
    ])
      expect((await erroDe(registrar(db, { editais })))?.codigo).toBe("42501");
    await como(db, { visiveis: `{${EDITAL_A2}}` });
    expect((await erroDe(registrar(db)))?.codigo).toBe("42501");
    const so = await registrar(db, { editais: [EDITAL_A2], total: 5 });
    expect(so.rows[0]?.r.recorte).toBe(5);
  });

  it("valida formato, situação, quantidades e tamanho dos filtros", async () => {
    const casos: Pedido[] = [
      { formato: "XLS" },
      { formato: "" },
      { situacoes: ["Aprovado"] },
      { editais: [] },
      { total: null },
      { registros: -1 },
      { cargos: ["x".repeat(301)] },
      { cargos: Array.from({ length: 1001 }, (_, i) => `Cargo ${i}`) },
    ];
    for (const caso of casos)
      expect(
        (await erroDe(registrar(db, caso)))?.codigo,
        JSON.stringify(caso).slice(0, 80),
      ).toBe("22023");
  });

  it("deixa a tabela fechada para o app e a RPC só para authenticated", async () => {
    const r = await uma<Record<string, boolean>>(
      db,
      `select has_table_privilege('authenticated', 'public."TL_EXPORTACAO_APROVADO"', 'select') as ler,
              has_table_privilege('authenticated', 'public."TL_EXPORTACAO_APROVADO"', 'insert') as gravar,
              has_function_privilege('anon', 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)', 'execute') as autenticado,
              (select relrowsecurity from pg_class where oid = 'public."TL_EXPORTACAO_APROVADO"'::regclass) as rls`,
    );
    expect(r).toEqual({
      ler: false,
      gravar: false,
      anon: false,
      autenticado: true,
      rls: true,
    });
  });

  it("a migration recusa ser aplicada duas vezes", async () => {
    expect(await erroDe(db.exec(MIGRATION))).toMatchObject({
      mensagem: expect.stringContaining("já foi aplicada"),
    });
  });
});

describe("rollback e ensaio de 20261110190000", () => {
  it("o rollback volta ao estado de antes e recusa descartar registros sem confirmação", async () => {
    const db = await bancoComLista();
    await db.exec(MIGRATION);
    await como(db);
    await registrar(db);
    expect(await erroDe(db.exec(ROLLBACK))).toMatchObject({
      mensagem: expect.stringContaining("1 exportações registradas"),
    });
    await db.exec("rollback");
    await db.exec(`set agsus.rollback_descartar_exportacoes = 'sim'`);
    await db.exec(ROLLBACK);
    const r = await uma<Record<string, unknown>>(
      db,
      `select to_regclass('public."TL_EXPORTACAO_APROVADO"') as tabela,
              to_regproc('public.registrar_exportacao_aprovados') as funcao`,
    );
    expect(r).toEqual({ tabela: null, funcao: null });
    expect(await erroDe(db.exec(ROLLBACK))).toMatchObject({
      mensagem: expect.stringContaining("não está aplicada"),
    });
    await db.exec("rollback");
    // E a migration volta a aplicar.
    await db.exec(MIGRATION);
  });

  it("o ensaio traz o corpo da migration letra por letra", () => {
    const ini = MIGRATION.indexOf("\nbegin;\n") + "\nbegin;\n".length;
    const corpo = MIGRATION.slice(
      ini,
      MIGRATION.lastIndexOf("\ncommit;"),
    ).trim();
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
