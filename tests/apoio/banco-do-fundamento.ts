/*
  Banco de teste do fundamento conferido da eliminação (migration 20261110215930,
  issue #593), num Postgres de verdade (PGlite).

  O que é de verdade, copiado letra por letra do retrato de produção
  (supabase/esquema-atual.sql): a sessão e os papéis — private.is_master,
  private.current_profile, private."FC_GESTOR_DO_EDITAL" (gestor OU coordenador),
  private."FC_PAPEL_AVALIACAO", private."FC_EXIGIR_COORD_AVALIACAO" — e
  private."FC_MOTIVO_COM_SENTIDO" e public.conferir_eliminados_pre_classificacao de
  hoje (a guarda md5 da migration confere que são os mesmos do retrato).

  O que é imitação: auth.uid()/auth.jwt() leem request.jwt.claims, como no Supabase;
  o nível de cada pessoa na Avaliação documental e se ela vê o edital vêm de
  teste."ACESSO" (no banco, de grupos, áreas e coordenações); as tabelas trazem só as
  colunas que estas funções leem. Dados fictícios.
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

export const NOME_DA_MIGRATION =
  "20261110215930_fundamento_conferido_da_eliminacao.sql";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
export const MIGRATION = ler(`supabase/migrations/${NOME_DA_MIGRATION}`);
export const ROLLBACK = ler(`supabase/rollback/${NOME_DA_MIGRATION}`);
export const ENSAIO = ler(`supabase/ensaios/${NOME_DA_MIGRATION}`);
const RETRATO = ler("supabase/esquema-atual.sql");

/** A definição de uma função no retrato, do CREATE até o "$$;" (executável). */
export function funcaoDoRetrato(cabecalho: string): string {
  const inicio = RETRATO.indexOf(`CREATE FUNCTION ${cabecalho}(`);
  if (inicio < 0) throw new Error(`Sem ${cabecalho} no retrato`);
  const fim = RETRATO.indexOf("\n$$;", inicio);
  return RETRATO.slice(inicio, fim + 4);
}

const FUNCOES_DO_RETRATO = [
  "private.is_master",
  "private.current_profile",
  'private."FC_MOTIVO_COM_SENTIDO"',
  'private."FC_GESTOR_DO_EDITAL"',
  'private."FC_PAPEL_AVALIACAO"',
  'private."FC_EXIGIR_COORD_AVALIACAO"',
  "public.conferir_eliminados_pre_classificacao",
];

export const EDITAL = "aaaaaaaa-0000-4000-8000-000000000114";
export const OUTRO_EDITAL = "aaaaaaaa-0000-4000-8000-000000000999";

/** As pessoas fictícias: [user_id, perfil, nível na Avaliação documental, vê o edital]. */
export const PESSOAS = {
  admin: ["10000000-0000-4000-8000-000000000001", "admin", 0, false],
  gestor: ["10000000-0000-4000-8000-000000000002", "edital_gestor", 3, true],
  coordenador: ["10000000-0000-4000-8000-000000000003", "coordenador", 3, true],
  coordenadorDaEquipe: [
    "10000000-0000-4000-8000-000000000004",
    "usuario",
    3,
    true,
  ],
  analista: ["10000000-0000-4000-8000-000000000005", "usuario", 2, true],
  gestorDeOutraArea: [
    "10000000-0000-4000-8000-000000000006",
    "edital_gestor",
    3,
    false,
  ],
  gestorSemNivel: [
    "10000000-0000-4000-8000-000000000007",
    "edital_gestor",
    2,
    true,
  ],
} as const;
export type Pessoa = keyof typeof PESSOAS;

/** A regra da Triagem do edital fictício: quatro motivos e o lote pela nota (item 8.2.6). */
export const REGRA = {
  formato: 1,
  requisitos: {
    eliminacao_automatica: [
      {
        codigo: "CANCELADO",
        coluna: "SITUAÇÃO",
        quando: ["CANCELADO"],
        motivo: "Cancelou a inscrição",
      },
      {
        codigo: "QUESTIONARIO",
        coluna_prefixo: "SITUAÇÃO - ",
        quando: [],
        exceto: ["FINALIZADO"],
        motivo: "Não finalizou o questionário",
      },
      {
        codigo: "REPROVADO_EMPREGARE",
        coluna: "REPROVADO",
        quando: ["SIM"],
        motivo: "Reprovado na Empregare",
      },
      {
        codigo: "TERMO",
        pergunta: "",
        quando: ["Não estou de acordo"],
        motivo: "Recusou o termo",
        item_edital: "5.7.5",
      },
    ],
  },
  lote: {
    base: "NOTA_MINIMA",
    nota_minima: 15,
    multiplo: 3,
    item_edital: "8.2.6",
  },
};

const HASH = (n: number) => String(n).padStart(64, "0");

const INFRAESTRUTURA = String.raw`
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema auth;
create schema teste;

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;

create table public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO" text primary key, "ST_ADMIN_GLOBAL" boolean not null default false);
create table public."TB_PERFIL_USUARIO" (
  id uuid primary key default gen_random_uuid(), user_id uuid, email text, nome text,
  perfil text not null default 'usuario', ativo boolean not null default true, "CO_COORDENACAO" text);
create table public."TB_MONITORAMENTO_INDIGENA" (id uuid primary key, edital text not null, unidade text, "CO_AREA" text);
create table public."RL_ANALISTA_EDITAL" (
  "CO_MONITORAMENTO" uuid not null, "CO_USUARIO" uuid not null, "TP_PAPEL" varchar(12) not null,
  "ST_ATIVO" varchar(1) not null default 'S');
create table public."TB_REGRA_TRIAGEM" (
  "CO_REGRA_TRIAGEM" uuid primary key default gen_random_uuid(), "CO_MONITORAMENTO" uuid not null unique,
  "NU_VERSAO_VIGENTE" integer not null, "TP_SITUACAO" varchar(10) not null, "DT_ATUALIZACAO" timestamptz not null default now());
create table public."TH_REGRA_TRIAGEM" (
  "CO_REGRA_TRIAGEM" uuid not null, "NU_VERSAO" integer not null, "DS_CONFIGURACAO" jsonb not null,
  "DS_HASH" varchar(64) not null, primary key ("CO_REGRA_TRIAGEM", "NU_VERSAO"));
create table public."TB_EMPREGARE_CANDIDATO" (
  "CO_EMPREGARE_CANDIDATO" uuid primary key default gen_random_uuid(), "CO_VAGA" text not null,
  "CO_CANDIDATO_EMPREGARE" varchar(60), "NO_CANDIDATO" varchar(300));
create table public."TB_PRE_CLASSIFICACAO" (
  "CO_MONITORAMENTO" uuid not null, "CO_EMPREGARE_CANDIDATO" uuid not null, "CO_VAGA" varchar(20) not null,
  "NU_VERSAO_REGRA" integer not null default 1, "TP_SITUACAO" varchar(12) not null,
  "CO_MOTIVO_ELIMINACAO" varchar(30), "DS_MOTIVO_ELIMINACAO" varchar(200), "VL_ART" numeric(8,4),
  "VL_NOTA_ORDEM" numeric(8,4), "TP_ORIGEM_NOTA" varchar(10), "VL_NOTA_DECLARADA" numeric(8,4),
  "NO_MODALIDADE" varchar(10) not null default 'AC', "NU_POSICAO" integer, "NU_LOTE" smallint,
  "TP_ENTRADA_LOTE" varchar(10), "DT_ATUALIZACAO" timestamptz not null default now());
create table public."TH_PRE_CLASSIFICACAO" (id bigint);
create table public."TB_DECISAO_LOTE" (id bigint);
create table public."TB_PRE_CLASSIF_VAGA" ("CO_MONITORAMENTO" uuid not null, "CO_VAGA" varchar(20) not null, "NO_CARGO" text);

-- Imitações: nível e visão do edital por pessoa.
create table teste."ACESSO" (user_id uuid primary key, nivel integer not null, ve boolean not null);
create function private."FC_NIVEL_AVALIACAO_DO_PERFIL"(p_perfil_usuario uuid) returns integer
language sql stable set search_path = '' as $$
  select coalesce((select a.nivel from public."TB_PERFIL_USUARIO" u join teste."ACESSO" a on a.user_id = u.user_id
                    where u.id = p_perfil_usuario and u.ativo), 0)
$$;
create function private."FC_PERFIL_VE_EDITAL"(p_perfil_usuario uuid, p_edital uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select a.ve from public."TB_PERFIL_USUARIO" u join teste."ACESSO" a on a.user_id = u.user_id
                    where u.id = p_perfil_usuario and u.ativo), false)
     and exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital)
$$;
create function private.nivel_recurso(p_recurso text) returns text
language sql stable set search_path = '' as $$
  select coalesce((select a.nivel from teste."ACESSO" a where a.user_id = (select auth.uid())), 0)::text
$$;
create function private."FC_RANK_NIVEL"(p_nivel text) returns integer
language sql immutable set search_path = '' as $$ select p_nivel::integer $$;
create function private."FC_PODE_VER_EDITAL"(p_edital uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select a.ve from teste."ACESSO" a where a.user_id = (select auth.uid())), false)
$$;
create function private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital uuid, p_minimo integer) returns text
language plpgsql stable set search_path = '' as $$
declare v_area text;
begin
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_area is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if private.is_master() then return v_area; end if;
  if coalesce((select a.nivel from teste."ACESSO" a where a.user_id = (select auth.uid())), 0) < p_minimo then
    raise exception 'Sem permissão para a Avaliação documental' using errcode = '42501';
  end if;
  if not private."FC_PODE_VER_EDITAL"(p_edital) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  return v_area;
end $$;
create function private."FC_REINICIO_TREINAMENTO_PERMITE"(p_tabela text, p_linha jsonb) returns boolean
language sql stable set search_path = '' as $$ select false $$;
`;

export type Banco = PGlite;

/** O banco de hoje (antes da migration), com o edital fictício, a regra e a Triagem gravada. */
export async function bancoDeHoje(): Promise<Banco> {
  const db = await PGlite.create();
  await db.exec(INFRAESTRUTURA);
  for (const f of FUNCOES_DO_RETRATO) await db.exec(funcaoDoRetrato(f));
  await db.exec(`
    insert into public."TB_GRUPO_ACESSO" values ('admin', true), ('edital_gestor', false), ('coordenador', false), ('usuario', false);
    insert into public."TB_MONITORAMENTO_INDIGENA" values
      ('${EDITAL}', 'Edital 114/2026', 'DSEI Fictício', 'SI'),
      ('${OUTRO_EDITAL}', 'Edital 999/2099', 'DSEI Fictício', 'SI');
  `);
  for (const [nome, [uid, perfil, nivel, ve]] of Object.entries(PESSOAS)) {
    await db.query(
      `insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil) values ($1, $2, $3, $4)`,
      [uid, `${nome}@exemplo.test`, `Pessoa ${nome}`, perfil],
    );
    await db.query(`insert into teste."ACESSO" values ($1, $2, $3)`, [
      uid,
      nivel,
      ve,
    ]);
  }
  await db.query(
    `insert into public."RL_ANALISTA_EDITAL" values ($1, $2, 'COORDENADOR', 'S'), ($1, $3, 'ANALISTA', 'S')`,
    [EDITAL, PESSOAS.coordenadorDaEquipe[0], PESSOAS.analista[0]],
  );
  await db.query(
    `insert into public."TB_REGRA_TRIAGEM" ("CO_REGRA_TRIAGEM", "CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "TP_SITUACAO")
     values ('bbbbbbbb-0000-4000-8000-000000000114', $1, 1, 'CONFERIDA')`,
    [EDITAL],
  );
  await db.query(
    `insert into public."TH_REGRA_TRIAGEM" values ('bbbbbbbb-0000-4000-8000-000000000114', 1, $1, $2)`,
    [JSON.stringify(REGRA), HASH(1)],
  );
  await db.exec(
    `insert into public."TB_PRE_CLASSIF_VAGA" values ('${EDITAL}', '101', 'Enfermeiro(a)');`,
  );
  // Seis inscritos fictícios da vaga 101.
  const inscritos: [
    string,
    string,
    string | null,
    string | null,
    number | null,
  ][] = [
    ["9001", "ELIMINADO", "QUESTIONARIO", "Não finalizou o questionário", 0],
    ["9002", "ELIMINADO", "CANCELADO", "Cancelou a inscrição", 0],
    ["9003", "ELIMINADO", "REPROVADO_EMPREGARE", "Reprovado na Empregare", 0],
    ["9004", "RANQUEADO", null, null, 12],
    ["9005", "NO_LOTE", null, null, 40],
    [
      "9006",
      "ELIMINADO",
      "SAIU_DA_EMPREGARE",
      "Saiu do arquivo da Empregare",
      null,
    ],
  ];
  for (const [codigo, situacao, motivo, texto, art] of inscritos) {
    const c = await db.query<{ id: string }>(
      `insert into public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA", "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO")
       values ('101', $1, $2) returning "CO_EMPREGARE_CANDIDATO" as id`,
      [codigo, `Candidato Fictício ${codigo}`],
    );
    await db.query(
      `insert into public."TB_PRE_CLASSIFICACAO"
         ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "TP_SITUACAO", "CO_MOTIVO_ELIMINACAO",
          "DS_MOTIVO_ELIMINACAO", "VL_ART", "VL_NOTA_DECLARADA", "NU_POSICAO", "NU_LOTE", "TP_ENTRADA_LOTE")
       values ($1, $2, '101', $3, $4, $5, $6, $6, $7, $8, $9)`,
      [
        EDITAL,
        c.rows[0]?.id,
        situacao,
        motivo,
        texto,
        art,
        situacao === "ELIMINADO" ? null : 1,
        situacao === "NO_LOTE" ? 1 : null,
        situacao === "NO_LOTE" ? "INICIAL" : null,
      ],
    );
  }
  return db;
}

/** Nova versão da regra da Triagem (vigente e conferida). */
export async function novaVersaoDaRegra(
  db: Banco,
  versao: number,
  regra: unknown,
  situacao: "CONFERIDA" | "CONFERIR" = "CONFERIDA",
): Promise<void> {
  await db.query(
    `insert into public."TH_REGRA_TRIAGEM" values ('bbbbbbbb-0000-4000-8000-000000000114', $1, $2, $3)`,
    [versao, JSON.stringify(regra), HASH(versao)],
  );
  await db.query(
    `update public."TB_REGRA_TRIAGEM" set "NU_VERSAO_VIGENTE" = $1, "TP_SITUACAO" = $2 where "CO_MONITORAMENTO" = $3`,
    [versao, situacao, EDITAL],
  );
}

/** Sessão: a pessoa logada (nulo = sem sessão), como o PostgREST põe em request.jwt.claims. */
export async function entrar(db: Banco, pessoa: Pessoa | null): Promise<void> {
  const uid = pessoa ? PESSOAS[pessoa][0] : "";
  await db.query(
    `select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)`,
    [uid ? JSON.stringify({ sub: uid, role: "authenticated" }) : "", uid],
  );
}

export async function erroDe(
  promessa: Promise<unknown>,
): Promise<{ codigo: string; mensagem: string } | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    const erro = e as { code?: string; message?: string };
    return { codigo: erro.code ?? "?", mensagem: erro.message ?? String(e) };
  }
}

/** Uma chamada de RPC que devolve json (a primeira coluna da primeira linha). */
export async function rpc<T = Record<string, unknown>>(
  db: Banco,
  sql: string,
  parametros: unknown[] = [],
): Promise<T> {
  const r = await db.query<{ r: T }>(`select ${sql} as r`, parametros);
  return r.rows[0]?.r as T;
}

/** Retrato da Triagem gravada, para conferir que nada muda. */
export async function retratoDaTriagem(db: Banco): Promise<string> {
  const r = await db.query<{ t: string }>(
    `select string_agg(row_to_json(a)::text, ',' order by a."CO_EMPREGARE_CANDIDATO") as t
       from public."TB_PRE_CLASSIFICACAO" a`,
  );
  return r.rows[0]?.t ?? "";
}
