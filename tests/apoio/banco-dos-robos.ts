/*
  Banco de teste dos robôs e das chaves da automação, num Postgres de verdade
  (PGlite: o PostgreSQL compilado para WebAssembly, com plpgsql).

  O que é de verdade: as funções do MONITORA que a migration 20261109180000
  toca ou das quais depende, copiadas das migrations antigas para a fixture
  tests/fixtures/banco-antes-do-catalogo-dos-robos.sql (definicaoVigente), e as tabelas TB_CHAVE_AUTOMACAO, TH_CHAVE_AUTOMACAO e
  TL_DISPARO_ROBO com as constraints de hoje.

  O que é imitação (o Supabase tem, o PGlite não): o pg_cron (cron.job,
  cron.schedule, cron.alter_job, cron.unschedule), o Vault, o pg_net (cada
  http_post fica em net."PEDIDO"; com teste.net_falha = on, recusa), a sessão
  (auth.uid() lê teste.uid; private.is_master() lê teste.master) e as poucas
  tabelas que disparar_robo consulta fora deste assunto.

  Nada aqui fala com rede: o PGlite roda dentro do processo do teste.
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

export const NOME_DA_MIGRATION =
  "20261109180000_catalogo_dos_robos_e_chave_unica.sql";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
export const lerMigration = (arquivo: string) =>
  ler(`supabase/migrations/${arquivo}`);
export const MIGRATION = lerMigration(NOME_DA_MIGRATION);
export const ROLLBACK = ler(`supabase/rollback/${NOME_DA_MIGRATION}`);
export const ENSAIO = ler(`supabase/ensaios/${NOME_DA_MIGRATION}`);

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");

/*
  O banco antes de 20261109180000: as migrations antigas saíram do repositório (seguem aplicadas
  no banco), e os trechos que estes testes usam ficaram copiados nesta fixture.
*/
export const BANCO_DE_ANTES = ler(
  "tests/fixtures/banco-antes-do-catalogo-dos-robos.sql",
);

/** A definição de uma função antes do catálogo, do "create" até "$function$;". */
export function definicaoVigente(nome: string): string {
  const texto = BANCO_DE_ANTES;
  const achados = [
    ...texto.matchAll(
      new RegExp(`^create (or replace )?function ${escapar(nome)}\\(`, "gim"),
    ),
  ];
  const ultimo = achados[achados.length - 1];
  if (!ultimo || ultimo.index === undefined)
    throw new Error(`Sem ${nome} na fixture do banco de antes`);
  const fim = texto.indexOf("$function$;", ultimo.index);
  return texto
    .slice(ultimo.index, fim + "$function$;".length)
    .replace(/^create function/i, "create or replace function");
}

/* As funções reais usadas pelo banco de teste (todas na fixture). */
export const FUNCOES_DE_HOJE: readonly string[] = [
  'private."FC_MOTIVO_COM_SENTIDO"',
  'private."FC_AUTOMACAO_LIGADA"',
  'private."FC_CHAVE_DA_TAREFA"',
  'private."FC_CHAVE_DO_WORKFLOW"',
  'private."FC_DISPARAR_ROBO"',
  "public.registrar_disparo_externo",
  "public.alterar_chave_da_automacao",
  "public.obter_chaves_da_automacao",
  "public.automacao_ligada",
  "public.disparar_robo",
];

/*
  O "comment on" de cada objeto antes desta migration: o banco de teste fica com os
  comentários de hoje, e o teste do rollback confere que eles voltam.
*/
const LITERAL = String.raw`'(?:[^']|'')*'`;
function comentarioVigente(objeto: string): string {
  const re = new RegExp(`comment on ${escapar(objeto)} is\\s+${LITERAL};`, "g");
  let achado = "";
  for (const m of BANCO_DE_ANTES.matchAll(re)) achado = m[0];
  if (!achado) throw new Error(`Sem comentário de ${objeto}`);
  return achado;
}
export const COMENTARIOS_DE_HOJE = [
  'function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)',
  'function private."FC_CHAVE_DO_WORKFLOW"(text)',
  'function private."FC_CHAVE_DA_TAREFA"(text)',
  'function private."FC_AUTOMACAO_LIGADA"(text)',
  'function private."FC_MOTIVO_COM_SENTIDO"(text)',
  "function public.registrar_disparo_externo(text, text, text, text)",
  "function public.alterar_chave_da_automacao(text, boolean, text)",
  "function public.obter_chaves_da_automacao()",
  "function public.automacao_ligada(text)",
  "function public.disparar_robo(text, jsonb)",
  'constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO"',
  'column public."TL_DISPARO_ROBO"."NO_WORKFLOW"',
].map(comentarioVigente);

export const USUARIO_MASTER = "11111111-1111-1111-1111-111111111111";
export const USUARIO_COMUM = "22222222-2222-2222-2222-222222222222";

/* As chaves como estão no banco (22/10 a 09/11/2026): Entrevistas e Seleção pausadas de propósito. */
export const CHAVES: readonly (readonly [string, string, number, "S" | "N"])[] =
  [
    ["entrevistas", "Entrevistas", 1, "N"],
    ["selecao", "Seleção", 2, "N"],
    ["kpis_do_edital", "KPIs do edital", 3, "S"],
    ["robo_de_inscricoes", "Robô de inscrições", 4, "S"],
    ["pre_classificacao", "Triagem automática", 5, "S"],
    ["conferencias", "Conferências", 6, "S"],
    ["paineis", "Pacotes dos painéis", 7, "S"],
    ["manutencao", "Manutenção do banco", 8, "S"],
    ["classificacao", "Classificação em Python", 9, "S"],
    ["classificacao_calculo", "Gerar listas pelo Python", 10, "N"],
  ];

/* As tarefas do pg_cron como estão no banco (docs/agenda-dos-robos.md). */
export const TAREFAS: readonly (readonly [string, string, boolean])[] = [
  ["agsus_robo_sincronizar_entrevistas", "5 0-10,15,21-23 * * *", false],
  ["agsus_robo_sincronizar_selecao", "10 11,16,21 * * *", false],
  ["agsus_robo_conferencias", "0 9 * * *", true],
  ["agsus_robo_conferir_disparos", "*/15 * * * *", true],
  ["agsus_kpis_do_edital_pela_selecao", "0 13 * * *", true],
  ["agsus_analises_cache_do_painel", "*/5 * * * *", true],
  ["agsus_aprovados_cache_por_area", "35 * * * *", true],
  ["agsus_entrevistas_cache_do_painel", "25 * * * *", true],
  ["agsus_analises_analyze_diario", "30 7 * * *", true],
  ["agsus_fila_estatisticas", "45 * * * *", true],
  ["agsus_analises_encerrar_inativas", "*/10 * * * *", true],
  ["agsus_eventos_acesso_limpeza_mensal", "0 6 1 * *", true],
  ["agsus_analises_limpar_manifesto", "40 6 * * *", true],
  ["agsus_cron_limpar_historico", "52 6 * * *", true],
];

const INFRAESTRUTURA = `
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema cron;
create schema vault;
create schema net;
create schema auth;
create schema extensions;

-- pg_cron
create table cron.job (
  jobid bigserial primary key,
  schedule text not null,
  command text not null,
  nodename text not null default 'localhost',
  nodeport integer not null default 5432,
  database text not null default 'postgres',
  username text not null default 'postgres',
  active boolean not null default true,
  jobname text unique
);
create table cron.job_run_details (
  jobid bigint, runid bigserial primary key, job_pid integer, database text, username text,
  command text, status text, return_message text, start_time timestamptz, end_time timestamptz
);
create function cron.schedule(job_name text, schedule text, command text) returns bigint
language plpgsql as $$
declare v bigint;
begin
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into v;
  return v;
end $$;
create function cron.alter_job(job_id bigint, schedule text default null, command text default null,
  database text default null, username text default null, active boolean default null) returns void
language plpgsql as $$
begin
  if not exists (select 1 from cron.job j where j.jobid = job_id) then
    raise exception 'Job % does not exist', job_id;
  end if;
  update cron.job j set
    schedule = coalesce(alter_job.schedule, j.schedule),
    command = coalesce(alter_job.command, j.command),
    active = coalesce(alter_job.active, j.active)
   where j.jobid = job_id;
end $$;
create function cron.unschedule(job_name text) returns boolean
language plpgsql as $$
begin
  delete from cron.job where jobname = job_name;
  if not found then raise exception 'could not find valid entry for job ''%''', job_name; end if;
  return true;
end $$;

-- Vault
create table vault.secrets (name text primary key, secret text, updated_at timestamptz default now());
create view vault.decrypted_secrets as
  select s.name, s.secret as decrypted_secret, s.updated_at from vault.secrets s;

-- pg_net
create table net."PEDIDO" (id bigserial primary key, url text, body jsonb, headers jsonb, timeout integer);
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000) returns bigint
language plpgsql as $$
declare v bigint;
begin
  if current_setting('teste.net_falha', true) = 'on' then
    raise exception 'pg_net fora do ar' using errcode = 'XX000';
  end if;
  insert into net."PEDIDO" (url, body, headers, timeout)
  values (url, body, headers, timeout_milliseconds) returning id into v;
  return v;
end $$;

-- Sessão
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid
$$;
create function private.is_master() returns boolean language sql stable as $$
  select coalesce(current_setting('teste.master', true), '') = 'on'
$$;
create function private."FC_NOME_USUARIO"(p_usuario uuid) returns text language sql stable as $$
  select 'Pessoa ' || left(p_usuario::text, 8)
$$;
create function public.pode_disparar_carga() returns boolean language sql stable as $$
  select private.is_master()
$$;
create function public.pode_recalcular_pre_classificacao(p_edital uuid) returns boolean
language sql stable as $$ select false $$;
create function private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(p_workflow text) returns boolean
language sql stable as $$ select false $$;
create function private."FC_NUMERO_EDITAL"(p_edital text) returns text language sql stable as $$
  select p_edital
$$;
create table public."TL_PRE_CLASSIFICACAO" (
  "DT_INICIO" timestamptz, "DT_FIM" timestamptz, "TP_SITUACAO" text, "TP_DISPARO" text
);

-- As tabelas do assunto, com as constraints de hoje (20261022190000, 20261023200000,
-- 20261008140000, 20261020170000 e 20261030090000).
create table public."TB_CHAVE_AUTOMACAO" (
  "CO_CHAVE" character varying(40) not null,
  "NO_CHAVE" character varying(80) not null,
  "NU_ORDEM" smallint not null,
  "ST_LIGADA" character varying(1) not null default 'S',
  "DS_MOTIVO" character varying(500) not null,
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_CHAVE_AUTOMACAO" primary key ("CO_CHAVE"),
  constraint "CK_CHAVEAUTOM_COCHAVE" check ("CO_CHAVE" in (
    'entrevistas', 'selecao', 'kpis_do_edital', 'robo_de_inscricoes',
    'pre_classificacao', 'conferencias', 'paineis', 'manutencao', 'classificacao', 'classificacao_calculo')),
  constraint "CK_CHAVEAUTOM_STLIGADA" check ("ST_LIGADA" in ('S', 'N')),
  constraint "CK_CHAVEAUTOM_DSMOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 500)
);
create table public."TH_CHAVE_AUTOMACAO" (
  "CO_EVENTO" bigint generated always as identity,
  "CO_CHAVE" character varying(40) not null,
  "ST_LIGADA" character varying(1) not null,
  "DS_MOTIVO" character varying(500) not null,
  "CO_USUARIO" uuid,
  "DS_TAREFAS" text[] not null default '{}',
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TH_CHAVE_AUTOMACAO" primary key ("CO_EVENTO"),
  constraint "FK_CHAVEAUTOM_HISTCHAVEAUTOM" foreign key ("CO_CHAVE")
    references public."TB_CHAVE_AUTOMACAO" ("CO_CHAVE") on delete cascade,
  constraint "CK_HISTCHAVEAUTOM_STLIGADA" check ("ST_LIGADA" in ('S', 'N')),
  constraint "CK_HISTCHAVEAUTOM_DSMOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 500)
);
create table public."TL_DISPARO_ROBO" (
  "CO_DISPARO" bigint generated always as identity,
  "NO_WORKFLOW" text not null,
  "DT_DISPARO" timestamptz not null default now(),
  "TP_ORIGEM" text not null,
  "CO_USUARIO" uuid,
  "CO_PEDIDO_HTTP" bigint,
  "TP_SITUACAO" text not null,
  "NU_STATUS_HTTP" integer,
  "DT_RESPOSTA" timestamptz,
  "DS_MENSAGEM" text,
  "NO_ATOR_GITHUB" character varying(100),
  "DS_URL_EXECUCAO" character varying(300),
  constraint "PK_TL_DISPARO_ROBO" primary key ("CO_DISPARO"),
  constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array[
    'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml',
    'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml',
    'contratacao-dos-aprovados.yml', 'pacotes-dos-paineis.yml', 'casamento-da-lista.yml'])),
  constraint "CK_DISPROBO_TPORIGEM" check ("TP_ORIGEM" in ('AGENDA', 'Yeendé', 'MANUAL', 'GITHUB')),
  constraint "CK_DISPROBO_USUARIO" check (("TP_ORIGEM" = 'Yeendé') = ("CO_USUARIO" is not null)),
  constraint "CK_DISPROBO_TPSITUACAO" check ("TP_SITUACAO" in ('PEDIDO', 'ACEITO', 'FALHOU', 'SEM_TOKEN', 'INICIADO')),
  constraint "CK_DISPROBO_PEDIDO" check (
    ("TP_SITUACAO" in ('SEM_TOKEN', 'INICIADO') and "CO_PEDIDO_HTTP" is null)
    or ("TP_SITUACAO" in ('PEDIDO', 'ACEITO') and "CO_PEDIDO_HTTP" is not null)
    or "TP_SITUACAO" = 'FALHOU'),
  constraint "CK_DISPROBO_NUSTATUS" check ("NU_STATUS_HTTP" is null or "NU_STATUS_HTTP" between 100 and 599),
  constraint "CK_DISPROBO_DSMENSAGEM" check (coalesce(length("DS_MENSAGEM"), 0) <= 300),
  constraint "CK_DISPROBO_GITHUB" check (
    (("TP_ORIGEM" = 'GITHUB') = ("TP_SITUACAO" = 'INICIADO'))
    and (("TP_ORIGEM" = 'GITHUB') = ("DS_URL_EXECUCAO" is not null))
    and ("TP_ORIGEM" = 'GITHUB' or "NO_ATOR_GITHUB" is null)),
  constraint "CK_DISPROBO_DSURL" check (
    "DS_URL_EXECUCAO" is null
    or "DS_URL_EXECUCAO" ~ '^https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[0-9]+$')
);
create unique index "UK_DISPROBO_DSURL_GITHUB" on public."TL_DISPARO_ROBO" ("DS_URL_EXECUCAO") where "TP_ORIGEM" = 'GITHUB';
-- disparar_robo consulta estas no caminho do congelamento (modos que gravam).
create table public."TB_CONGELAMENTO_INSCRICAO" ("CO_MONITORAMENTO" uuid, "ST_CONGELADO" text);
create table public."TH_CONGELAMENTO_INSCRICAO" (
  "CO_MONITORAMENTO" uuid, "TP_EVENTO" text, "DS_MOTIVO" text, "CO_USUARIO" uuid,
  "CO_LIBERACAO" uuid, "DT_VALIDADE" timestamptz, "CO_DISPARO" bigint
);
create table public."TB_EMPREGARE_VAGA" ("CO_VAGA" text, "CO_MONITORAMENTO" uuid);
create table public."TB_MONITORAMENTO_INDIGENA" (id uuid, edital text);
`;

export type Banco = PGlite;

export interface OpcoesDoBanco {
  /** Estado das chaves ("S"/"N") por código; o resto como em CHAVES. */
  chaves?: Record<string, "S" | "N">;
  /** Estado das tarefas (active) por nome; o resto como em TAREFAS. */
  tarefas?: Record<string, boolean>;
  /** Tarefas a mais no pg_cron (nome, agenda, ativa). */
  tarefasExtras?: readonly (readonly [string, string, boolean])[];
}

/** O banco como está hoje (antes da migration 20261109180000). */
export async function bancoDeHoje(opcoes: OpcoesDoBanco = {}): Promise<Banco> {
  const db = await PGlite.create();
  await db.exec(INFRAESTRUTURA);
  for (const nome of FUNCOES_DE_HOJE) await db.exec(definicaoVigente(nome));
  for (const comentario of COMENTARIOS_DE_HOJE) await db.exec(comentario);
  await db.query(`insert into auth.users (id) values ($1), ($2)`, [
    USUARIO_MASTER,
    USUARIO_COMUM,
  ]);
  await db.query(
    `insert into vault.secrets (name, secret) values ('github_disparo_robos', 'token-de-teste')`,
  );
  for (const [chave, nome, ordem, ligada] of CHAVES)
    await db.query(
      `insert into public."TB_CHAVE_AUTOMACAO"
         ("CO_CHAVE", "NO_CHAVE", "NU_ORDEM", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
       values ($1, $2, $3, $4, 'Estado inicial do banco de teste.', null)`,
      [chave, nome, ordem, opcoes.chaves?.[chave] ?? ligada],
    );
  for (const [nome, agenda, ativa] of [
    ...TAREFAS,
    ...(opcoes.tarefasExtras ?? []),
  ])
    await db.query(
      `insert into cron.job (jobname, schedule, command, active) values ($1, $2, 'select 1', $3)`,
      [nome, agenda, opcoes.tarefas?.[nome] ?? ativa],
    );
  return db;
}

/** Roda um arquivo inteiro (begin … commit) como o SQL Editor rodaria. */
export async function rodarArquivo(db: Banco, sql: string): Promise<void> {
  await db.exec(sql);
}

/** Sessão: quem está logado e se é administrador global (vale até a próxima troca). */
export async function entrar(
  db: Banco,
  usuario: string | null,
  master = false,
): Promise<void> {
  await db.query(
    `select set_config('teste.uid', $1, false), set_config('teste.master', $2, false)`,
    [usuario ?? "", master ? "on" : "off"],
  );
}

/** Uma linha só, ou nulo. */
export async function uma<T>(
  db: Banco,
  sql: string,
  parametros: unknown[] = [],
): Promise<T | null> {
  const r = await db.query<T>(sql, parametros);
  return r.rows[0] ?? null;
}

/** O código do erro (SQLSTATE) e a mensagem, ou nulo se não deu erro. */
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

/** md5 do corpo (prosrc) de cada função, para conferir que o rollback devolve o de antes. */
export async function corposDasFuncoes(
  db: Banco,
): Promise<Record<string, string>> {
  const r = await db.query<{
    nome: string;
    md5: string;
    volatil: string;
    definer: boolean;
  }>(
    `select p.oid::regprocedure::text as nome, md5(p.prosrc) as md5,
            p.provolatile::text as volatil, p.prosecdef as definer
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
      order by 1`,
  );
  return Object.fromEntries(
    r.rows.map((l) => [l.nome, `${l.md5}:${l.volatil}:${l.definer}`]),
  );
}

/** As constraints de uma tabela, como o Postgres as mostra. */
export async function constraintsDe(
  db: Banco,
  tabela: string,
): Promise<string[]> {
  const r = await db.query<{ c: string }>(
    `select conname || ' ' || pg_get_constraintdef(oid) as c
       from pg_constraint where conrelid = $1::regclass order by conname`,
    [`public."${tabela}"`],
  );
  return r.rows.map((l) => l.c);
}

/** O que o pg_cron tem: nome → ativa. */
export async function estadoDoCron(
  db: Banco,
): Promise<Record<string, boolean>> {
  const r = await db.query<{ jobname: string; active: boolean }>(
    `select jobname, active from cron.job order by jobname`,
  );
  return Object.fromEntries(r.rows.map((l) => [l.jobname, l.active]));
}
