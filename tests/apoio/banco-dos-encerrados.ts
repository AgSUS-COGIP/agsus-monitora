/*
  Banco de teste da confirmação em lote dos editais com cronograma encerrado (migration
  20261119120000), num Postgres de verdade (PGlite).

  O que é de verdade: a migration, aplicada e registrada em 19/11/2026 e guardada sem mudança em
  tests/fixtures/sql-do-banco/ (o rollback e o ensaio saíram com ela, regra do #712), a tabela do
  histórico do cronograma (TH_CRONOGRAMA_MONIT_INDIG, já com a CHECK nova) e as funções de que
  ela depende, como estão em produção (supabase/esquema-atual.sql): FC_ESTADO_DO_CRONOGRAMA,
  snapshot_monitoramento_cronograma, FC_NUMERO_EDITAL, FC_EH_TREINAMENTO e
  FC_TEXTO_SEGURO_DO_AVISO.

  O que é imitação: os papéis; a sessão (auth.uid() lê teste.uid, auth.jwt() devolve o e-mail de
  teste.email); o nível em nucleo (private.pode_recurso lê teste.nivel: 0 sem acesso, 1 leitor, 2
  editor); a área do edital (FC_PODE_VER_EDITAL esconde o id de teste.esconder); quem vê e quem
  dispensa o aviso (FC_PODE_VER_AVISO sempre; FC_PODE_IGNORAR_AVISO lê teste.gestor); as tabelas
  do edital, das etapas e dos avisos, só com as colunas lidas. Dados fictícios.
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { moldeDeBanco } from "./molde-de-banco.ts";
import { lembrarBanco } from "./bancos-abertos.ts";

export type Banco = PGlite;

export const NOME_DA_MIGRATION =
  "20261119120000_concluir_editais_com_cronograma_encerrado.sql";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
/* A migration aplicada, guardada em tests/fixtures/sql-do-banco/ só para montar o banco. */
export const migration = () =>
  ler(`tests/fixtures/sql-do-banco/${NOME_DA_MIGRATION}`);

const RETRATO = ler("supabase/esquema-atual.sql");

/** Um bloco do retrato, do cabeçalho até o fim dele (executável). */
function doRetrato(cabecalho: string, fim: string): string {
  const inicio = RETRATO.indexOf(cabecalho);
  if (inicio < 0) throw new Error(`Sem ${cabecalho} no retrato`);
  const ate = RETRATO.indexOf(fim, inicio);
  return RETRATO.slice(inicio, ate + fim.length);
}
const funcao = (nome: string) => doRetrato(`CREATE FUNCTION ${nome}(`, "\n$$;");

export const USUARIO = "11111111-1111-4111-8111-111111111111";

const INFRAESTRUTURA = String.raw`
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema auth;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('email', nullif(current_setting('teste.email', true), ''))
$$;
create function private.pode_recurso(p_recurso text, p_minimo integer default 1)
returns boolean language sql stable as $$
  select p_recurso = 'nucleo'
     and coalesce(nullif(current_setting('teste.nivel', true), ''), '0')::integer >= greatest(1, p_minimo)
$$;
create function private."FC_PODE_VER_EDITAL"(p_edital uuid) returns boolean language sql stable as $$
  select p_edital::text is distinct from nullif(current_setting('teste.esconder', true), '')
$$;
create function private."FC_PODE_VER_AVISO"(p_modulo text, p_area text, p_edital uuid)
returns boolean language sql stable as $$ select private."FC_PODE_VER_EDITAL"(p_edital) $$;
create function private."FC_PODE_IGNORAR_AVISO"(p_modulo text, p_area text, p_edital uuid)
returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('teste.gestor', true), ''), 'nao') = 'sim'
$$;

create table public."TB_MONITORAMENTO_INDIGENA" (
  id uuid primary key, edital text, unidade text, "CO_AREA" text default 'saude-indigena',
  ativo boolean not null default true, status text, etapa text,
  data_inicio date, data_fim date, cronograma_automatico boolean not null default true,
  status_override text, etapa_override text, "ST_TREINAMENTO" character varying(1) default 'N' not null,
  updated_by uuid, updated_at timestamptz);
create table public."TB_CRONOGRAMA_MONIT_INDIG" (
  id uuid primary key default gen_random_uuid(), monitoramento_id uuid not null,
  ordem integer not null, atividade text not null, tipo_atividade text,
  data_inicio date not null, data_fim date not null, concluida boolean, observacao text, origem text);
create table public."TB_AVISO_CONFERENCIA" (
  "CO_AVISO_CONFERENCIA" uuid primary key default gen_random_uuid(),
  "CO_CONFERENCIA" character varying(60) not null, "CO_MODULO" character varying(20) not null,
  "CO_AREA" text, "CO_MONITORAMENTO" uuid, "QT_OCORRENCIA" integer not null default 1,
  "TP_GRAVIDADE" character varying(12) not null default 'ATENCAO',
  "TP_SITUACAO" character varying(10) not null default 'ABERTO',
  "TP_TRATAMENTO" character varying(25) not null default 'PENDENTE',
  "DT_ULTIMA_VEZ" timestamptz not null default now());
`;

/*
  Os editais fictícios. Datas "passadas" ficam em 2020 e "futuras" em 2099: o estado é calculado
  no dia de hoje em Brasília, como no banco.
*/
export const E = {
  /** Automático, terminou, "Em andamento": entra. */
  encerrado: "aaaaaaaa-0000-4000-8000-000000000001",
  /** Automático, terminou, com aviso pendente e outra pendência: entra. */
  comAviso: "aaaaaaaa-0000-4000-8000-000000000002",
  /** Terminou, mas o aviso foi dispensado na central: fora da lista (concluir ainda aceita). */
  dispensado: "aaaaaaaa-0000-4000-8000-000000000003",
  /** Cronograma até 2099: fora, recusado. */
  emAndamento: "aaaaaaaa-0000-4000-8000-000000000004",
  /** Status já Concluído: fora, recusado. */
  concluido: "aaaaaaaa-0000-4000-8000-000000000005",
  /** Status gravado Cancelado: fora, recusado. */
  cancelado: "aaaaaaaa-0000-4000-8000-000000000006",
  /** Status manual (override Suspenso): fora, recusado pelo estado. */
  suspenso: "aaaaaaaa-0000-4000-8000-000000000007",
  /** Edital de treinamento: fora da lista. */
  treinamento: "aaaaaaaa-0000-4000-8000-000000000008",
  /** Inativo: fora da lista. */
  inativo: "aaaaaaaa-0000-4000-8000-000000000009",
  /** Cálculo manual, "Em andamento" digitado: o estado é o digitado, recusado. */
  manual: "aaaaaaaa-0000-4000-8000-000000000010",
  /** Sem etapas: recusado. */
  semEtapas: "aaaaaaaa-0000-4000-8000-000000000011",
} as const;

async function montar(): Promise<Banco> {
  const db = lembrarBanco(await PGlite.create());
  await db.exec(INFRAESTRUTURA);
  await db.exec(
    doRetrato('CREATE TABLE public."TH_CRONOGRAMA_MONIT_INDIG" (', "\n);"),
  );
  for (const nome of [
    'private."FC_ESTADO_DO_CRONOGRAMA"',
    "private.snapshot_monitoramento_cronograma",
    'private."FC_NUMERO_EDITAL"',
    'private."FC_EH_TREINAMENTO"',
    'private."FC_TEXTO_SEGURO_DO_AVISO"',
  ])
    await db.exec(funcao(nome));

  const editais: [string, string, string, Record<string, unknown>][] = [
    [E.encerrado, "41/2099", "DSEI Fictício A", {}],
    [E.comAviso, "42/2099", "DSEI Fictício B", {}],
    [E.dispensado, "43/2099", "DSEI Fictício C", {}],
    [E.emAndamento, "44/2099", "DSEI Fictício D", {}],
    [E.concluido, "45/2099", "DSEI Fictício E", { status: "Concluído" }],
    [E.cancelado, "46/2099", "DSEI Fictício F", { status: "Cancelado" }],
    [E.suspenso, "47/2099", "DSEI Fictício G", { status_override: "Suspenso" }],
    [E.treinamento, "48/2099", "DSEI Fictício H", { ST_TREINAMENTO: "S" }],
    [E.inativo, "49/2099", "DSEI Fictício I", { ativo: false }],
    [E.manual, "50/2099", "DSEI Fictício J", { cronograma_automatico: false }],
    [E.semEtapas, "51/2099", "DSEI Fictício K", {}],
  ];
  for (const [id, edital, unidade, extra] of editais)
    await db.query(
      `insert into public."TB_MONITORAMENTO_INDIGENA"
         (id, edital, unidade, status, etapa, ativo, cronograma_automatico, status_override, "ST_TREINAMENTO")
       values ($1, $2, $3, $4, 'Período de inscrição', $5, $6, $7, $8)`,
      [
        id,
        edital,
        unidade,
        extra.status ?? "Em andamento",
        extra.ativo ?? true,
        extra.cronograma_automatico ?? true,
        extra.status_override ?? null,
        extra.ST_TREINAMENTO ?? "N",
      ],
    );
  for (const [id] of editais) {
    if (id === E.semEtapas) continue;
    const fim = id === E.emAndamento ? "2099-12-31" : "2020-03-31";
    await db.query(
      `insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim)
       values ($1, 1, 'Publicação do Edital', '2020-01-10', '2020-01-10'),
              ($1, 2, 'Resultado final do Processo Seletivo', $2, $2)`,
      [id, fim],
    );
  }
  await db.query(
    `insert into public."TB_AVISO_CONFERENCIA"
       ("CO_CONFERENCIA", "CO_MODULO", "CO_AREA", "CO_MONITORAMENTO", "TP_GRAVIDADE", "TP_TRATAMENTO", "QT_OCORRENCIA") values
       ('EDITAL_CRONOGRAMA_ENCERRADO', 'editais', 'saude-indigena', $1, 'ATENCAO', 'PENDENTE', 1),
       ('APROVADOS_SEM_STATUS', 'aprovados', 'saude-indigena', $1, 'CRITICA', 'EM_ANALISE', 3),
       ('RECURSO_ABERTO', 'analises', 'saude-indigena', $1, 'ATENCAO', 'DISPENSADO', 2),
       ('EDITAL_CRONOGRAMA_ENCERRADO', 'editais', 'saude-indigena', $2, 'ATENCAO', 'DISPENSADO', 1)`,
    [E.comAviso, E.dispensado],
  );
  return db;
}

/** O banco de hoje, sem as funções da migration (clone de um molde por arquivo). */
export const bancoDeHoje = moldeDeBanco(montar);

/** O banco com a migration aplicada. */
export async function bancoMigrado(): Promise<Banco> {
  const db = await bancoDeHoje();
  await db.exec(migration());
  return db;
}

/** Entra como a pessoa de teste, com o nível em nucleo e (opcional) o edital escondido. */
export async function entrar(
  db: Banco,
  {
    nivel = 2,
    esconder = "",
    gestor = false,
  }: { nivel?: number; esconder?: string; gestor?: boolean } = {},
): Promise<void> {
  await db.exec(`
    select set_config('teste.uid', '${USUARIO}', false),
           set_config('teste.email', 'equipe@teste', false),
           set_config('teste.nivel', '${nivel}', false),
           set_config('teste.esconder', '${esconder}', false),
           set_config('teste.gestor', '${gestor ? "sim" : "nao"}', false);
  `);
}

/** Uma chamada que devolve json (a primeira coluna da primeira linha). */
export async function valor<T = Record<string, unknown>>(
  db: Banco,
  sql: string,
  parametros: unknown[] = [],
): Promise<T> {
  const r = await db.query<{ r: T }>(`select ${sql} as r`, parametros);
  return r.rows[0]?.r as T;
}

export interface ListaDosEncerrados {
  pode_concluir: boolean;
  editais: {
    id: string;
    numero: string;
    status: string;
    etapa: string;
    fim: string;
    aviso: {
      id: string;
      tratamento: string;
      pode_dispensar: boolean;
    } | null;
    pendencias: { conferencia: string; quantidade: number }[];
  }[];
}

export const listar = (db: Banco) =>
  valor<ListaDosEncerrados>(
    db,
    "public.listar_editais_com_cronograma_encerrado()",
  );

export interface ResultadoDoLote {
  concluidos: { id: string; edital: string; status_anterior: string }[];
  recusados: { id: string; edital: string | null; motivo: string }[];
}

export const concluir = (db: Banco, ids: string[], motivo: string) =>
  valor<ResultadoDoLote>(
    db,
    "public.concluir_editais_com_cronograma_encerrado($1::uuid[], $2)",
    [ids, motivo],
  );

/** O erro (código e mensagem) de uma chamada que deve falhar. */
export async function erroDe(
  promessa: Promise<unknown>,
): Promise<{ code?: string; message: string }> {
  try {
    await promessa;
  } catch (erro) {
    return erro as { code?: string; message: string };
  }
  throw new Error("A chamada devia falhar");
}
