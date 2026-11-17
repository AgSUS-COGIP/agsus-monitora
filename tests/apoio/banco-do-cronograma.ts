/*
  Banco de teste do estado do cronograma (migration 20261117190000), num
  Postgres de verdade (PGlite).

  O que é de verdade: os corpos de hoje de private."FC_ESTADO_DO_CRONOGRAMA" e
  public.get_nucleo_cronograma_resumo, lidos do rollback (copiados do banco com
  pg_get_functiondef; a guarda md5 da migration confere que são esses), e
  public.get_monitoramento_cronograma_estado do retrato (supabase/esquema-atual.sql).

  O que é imitação: as permissões (private.pode_recurso e o recorte de área e de
  editais deixam tudo passar) e as tabelas, só com as colunas que essas funções
  leem. Dados fictícios.
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { moldeDeBanco } from "./molde-de-banco.ts";

export const NOME_DA_MIGRATION =
  "20261117190000_cronograma_manual_e_datas_do_cadastro.sql";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
export const MIGRATION = ler(`supabase/migrations/${NOME_DA_MIGRATION}`);
export const ROLLBACK = ler(`supabase/rollback/${NOME_DA_MIGRATION}`);
const RETRATO = ler("supabase/esquema-atual.sql");

/** Os dois corpos de hoje, como o rollback os restaura (cada um com o seu comentário). */
function corposDeHoje(): string {
  const inicio = ROLLBACK.indexOf(
    'CREATE OR REPLACE FUNCTION private."FC_ESTADO_DO_CRONOGRAMA"',
  );
  const fim = ROLLBACK.lastIndexOf("commit;");
  if (inicio < 0 || fim < 0) throw new Error("Rollback sem os corpos de hoje");
  return ROLLBACK.slice(inicio, fim);
}

/** Uma função do retrato, do CREATE até o "$$;" (executável). */
function funcaoDoRetrato(cabecalho: string): string {
  const inicio = RETRATO.indexOf(`CREATE FUNCTION ${cabecalho}(`);
  if (inicio < 0) throw new Error(`Sem ${cabecalho} no retrato`);
  const fim = RETRATO.indexOf("\n$$;", inicio);
  return RETRATO.slice(inicio, fim + 4);
}

const INFRAESTRUTURA = String.raw`
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema auth;

create table public."TB_MONITORAMENTO_INDIGENA" (
  id uuid primary key, edital text, unidade text, "CO_AREA" text default 'saude-indigena',
  ativo boolean not null default true, status text, etapa text,
  data_inicio date, data_fim date, cronograma_automatico boolean not null default false,
  status_override text, etapa_override text);
create table public."TB_CRONOGRAMA_MONIT_INDIG" (
  id uuid primary key default gen_random_uuid(), monitoramento_id uuid not null,
  ordem integer not null, atividade text not null, tipo_atividade text,
  data_inicio date not null, data_fim date not null, origem text);

-- Imitações: permissão e recorte deixam tudo passar.
create function private.pode_recurso(p_recurso text, p_nivel integer default 1) returns boolean
language sql stable set search_path = '' as $$ select true $$;
create function private."FC_AREAS_USUARIO"() returns text[]
language sql stable set search_path = '' as $$ select array['saude-indigena'] $$;
create function private."FC_EDITAIS_VISIVEIS"() returns uuid[]
language sql stable set search_path = '' as $$ select null::uuid[] $$;
`;

export type Banco = PGlite;

export const MANUAL = "cccccccc-0000-4000-8000-000000000120";
export const AUTOMATICO = "cccccccc-0000-4000-8000-000000000054";
export const DIVERGENTE = "cccccccc-0000-4000-8000-000000000105";
export const SEM_ETAPAS = "cccccccc-0000-4000-8000-000000000999";

/*
  As 13 etapas do edital manual fictício, com as datas do caso da conferência
  (120/2026): o recurso das entrevistas termina depois do resultado final.
*/
export const ETAPAS_DO_MANUAL: [string, string, string][] = [
  ["Publicação do Edital", "2026-10-21", "2026-10-21"],
  ["Impugnação do Edital", "2026-11-14", "2026-11-16"],
  ["Período de inscrição", "2026-11-19", "2026-11-23"],
  [
    "Publicação da Lista Geral de Classificação Provisória",
    "2026-11-25",
    "2026-11-25",
  ],
  [
    "Resultado Preliminar da Avaliação Documental e de Títulos",
    "2026-12-08",
    "2026-12-08",
  ],
  [
    "Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos",
    "2026-12-09",
    "2026-12-10",
  ],
  [
    "Resultado Final da Avaliação Documental e de Títulos",
    "2026-12-17",
    "2026-12-17",
  ],
  ["Convocação para a Entrevista", "2026-12-18", "2026-12-18"],
  ["Período de Entrevistas", "2027-01-05", "2027-01-11"],
  ["Resultado Preliminar das Entrevistas", "2027-01-13", "2027-01-13"],
  [
    "Prazo para recursos referentes ao resultado preliminar das entrevistas",
    "2027-01-14",
    "2027-02-25",
  ],
  ["Resultado final da Entrevista", "2027-01-21", "2027-01-21"],
  ["Resultado final do Processo Seletivo", "2027-01-21", "2027-01-21"],
];

async function etapas(
  db: Banco,
  edital: string,
  lista: [string, string, string][],
): Promise<void> {
  for (const [i, [atividade, inicio, fim]] of lista.entries())
    await db.query(
      `insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim)
       values ($1, $2, $3, $4, $5)`,
      [edital, i + 1, atividade, inicio, fim],
    );
}

/** O banco de hoje (antes da migration), com quatro editais fictícios. */
async function montarBancoDeHoje(): Promise<Banco> {
  const db = await PGlite.create();
  await db.exec(INFRAESTRUTURA);
  await db.exec(corposDeHoje());
  await db.exec(funcaoDoRetrato("public.get_monitoramento_cronograma_estado"));
  await db.query(
    `insert into public."TB_MONITORAMENTO_INDIGENA"
       (id, edital, unidade, status, etapa, data_inicio, data_fim, cronograma_automatico) values
       ($1, '120/2099', 'DSEI Fictício A', 'Suspenso', null, '2026-10-21', '2026-12-10', false),
       ($2, '54/2099', 'DSEI Fictício B', 'Em andamento', null, '2026-06-16', '2026-08-12', true),
       ($3, '105/2099', 'DSEI Fictício C', 'Em andamento', null, '2026-09-01', '2026-12-03', true),
       ($4, '999/2099', 'DSEI Fictício D', 'Em andamento', 'Inscrições', '2026-01-01', '2026-02-01', false)`,
    [MANUAL, AUTOMATICO, DIVERGENTE, SEM_ETAPAS],
  );
  await etapas(db, MANUAL, ETAPAS_DO_MANUAL);
  await etapas(db, AUTOMATICO, [
    ["Publicação do Edital", "2026-06-16", "2026-06-16"],
    ["Resultado final do Processo Seletivo", "2026-08-12", "2026-08-12"],
  ]);
  // Errata que mudou as etapas sem refazer as datas do cadastro (começa em 08/09, não 01/09).
  await etapas(db, DIVERGENTE, [
    ["Publicação do Edital", "2026-09-08", "2026-09-08"],
    ["Resultado final do Processo Seletivo", "2026-12-03", "2026-12-03"],
  ]);
  return db;
}

/** O banco de hoje (clone de um molde por arquivo). */
export const bancoDeHoje = moldeDeBanco(montarBancoDeHoje);

/** Uma chamada que devolve json (a primeira coluna da primeira linha). */
export async function valor<T = Record<string, unknown>>(
  db: Banco,
  sql: string,
  parametros: unknown[] = [],
): Promise<T> {
  const r = await db.query<{ r: T }>(`select ${sql} as r`, parametros);
  return r.rows[0]?.r as T;
}

export const estado = (db: Banco, edital: string, dia: string) =>
  valor<Record<string, unknown>>(
    db,
    `private."FC_ESTADO_DO_CRONOGRAMA"($1, $2::date)`,
    [edital, dia],
  );

export const datasDoCadastro = async (db: Banco, edital: string) =>
  (
    await db.query<{ inicio: string; fim: string }>(
      `select data_inicio::text as inicio, data_fim::text as fim
         from public."TB_MONITORAMENTO_INDIGENA" where id = $1`,
      [edital],
    )
  ).rows[0];

/** md5 do prosrc (sem \r), como a guarda da migration. */
export const md5DoCorpo = (db: Banco, assinatura: string) =>
  valor<string | null>(
    db,
    `md5(replace((select prosrc from pg_proc where oid = to_regprocedure($1)), chr(13), ''))`,
    [assinatura],
  );
