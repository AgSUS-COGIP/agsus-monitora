/*
  Banco de teste do vínculo da vaga com o quadro de vagas, num Postgres de verdade (PGlite).

  O que é de verdade: as tabelas e as funções do quadro, da Empregare e da Classificação, como
  estão em produção (tests/fixtures/banco-antes-do-vinculo-do-quadro.sql, copiadas do retrato),
  e a migration 20261118120000, aplicada e guardada sem mudança em
  tests/fixtures/sql-do-banco/.

  O que é imitação (o Supabase tem, o PGlite não, ou é de outro assunto): os papéis, a sessão
  (auth.uid() lê teste.uid), o nível em nucleo (private.pode_recurso lê teste.nivel: 0 sem
  acesso, 1 leitor, 2 editor), a área do edital (FC_PODE_VER_EDITAL lê teste.ve_edital), o
  pg_cron (cron.job, schedule, unschedule) e as partes da Classificação que não são do quadro
  (regra, listas, desempates e ajustes devolvem nulo).
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { moldeDeBanco } from "./molde-de-banco.ts";

export type Banco = PGlite;

export const NOME_DA_MIGRATION =
  "20261118120000_vinculo_da_vaga_com_o_quadro.sql";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
export const migration = () =>
  ler(`tests/fixtures/sql-do-banco/${NOME_DA_MIGRATION}`);
export const bancoAntes = () =>
  ler("tests/fixtures/banco-antes-do-vinculo-do-quadro.sql");

export const USUARIO = "11111111-1111-1111-1111-111111111111";

const INFRAESTRUTURA = `
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema auth;
create schema cron;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid
$$;

create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true);
create function cron.schedule(p_nome text, p_agenda text, p_comando text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_nome, p_agenda, p_comando)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid
$$;
create function cron.unschedule(p_id bigint) returns boolean language sql as $$
  with x as (delete from cron.job where jobid = p_id returning 1) select exists (select 1 from x)
$$;

create function private.pode_recurso(p_recurso text, p_minimo integer default 1)
returns boolean language sql stable as $$
  select p_recurso = 'nucleo'
     and coalesce(nullif(current_setting('teste.nivel', true), ''), '0')::integer >= greatest(1, p_minimo)
$$;
create function private."FC_PODE_VER_EDITAL"(p_edital uuid) returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('teste.ve_edital', true), ''), 'sim') = 'sim'
$$;
create function private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital uuid) returns json language sql stable as $$ select null::json $$;
create function private."FC_LISTA_CLASSIFICACAO_JSON"(p_lista uuid) returns json language sql stable as $$ select null::json $$;
create function private."FC_DESEMPATE_CLASSIFICACAO_JSON"(p_desempate uuid) returns json language sql stable as $$ select null::json $$;
create function private."FC_AJUSTE_PONTUACAO_JSON"(p_ajuste uuid) returns json language sql stable as $$ select null::json $$;
`;

async function montarAntes(): Promise<Banco> {
  const db = await PGlite.create();
  await db.exec(INFRAESTRUTURA);
  await db.exec(bancoAntes());
  await db.query(
    `insert into public."TB_PERFIL_USUARIO" (user_id, nome, email) values ($1, 'Pessoa da Equipe', 'equipe@teste')`,
    [USUARIO],
  );
  return db;
}

/** O banco de hoje (antes da migration), um clone por chamada. */
export const bancoDeHoje = moldeDeBanco(montarAntes);

/** A sessão: quem está logado e o nível em nucleo (0 a 2). */
export async function entrar(
  db: Banco,
  nivel: number,
  uid: string | null = USUARIO,
): Promise<void> {
  await db.query(
    `select set_config('teste.uid', $1, false), set_config('teste.nivel', $2, false)`,
    [uid ?? "", String(nivel)],
  );
}

/* ── Dados ─────────────────────────────────────────────────────────── */

export const EDITAL = "aaaaaaaa-0000-0000-0000-000000000001";
export const EDITAL_SEM_CODIGO = "aaaaaaaa-0000-0000-0000-000000000002";
export const EDITAL_CANCELADO = "aaaaaaaa-0000-0000-0000-000000000003";

export type LinhaDoQuadro = {
  cargo: string;
  lotacao?: string | null;
  vagas_imediatas?: number;
};

/** Edital da Saúde Indígena com número, status e área. */
export async function criarEdital(
  db: Banco,
  id: string,
  edital: string,
  status = "Em andamento",
): Promise<void> {
  await db.query(
    `insert into public."TB_MONITORAMENTO_INDIGENA" (id, edital, unidade, status, "CO_AREA")
     values ($1, $2, 'DSEI Teste', $3, 'saude-indigena')`,
    [id, edital, status],
  );
}

/** O quadro do edital, gravado direto (como o salvar_quadro_de_vagas grava). */
export async function gravarQuadro(
  db: Banco,
  edital: string,
  linhas: LinhaDoQuadro[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, l] of linhas.entries()) {
    const { rows } = await db.query<{ id: string }>(
      `insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO", "QT_VAGA_IMEDIATA")
       values ($1, $2, $3, $4, $5) returning "CO_QUADRO_VAGA" as id`,
      [edital, i + 1, l.cargo, l.lotacao ?? null, l.vagas_imediatas ?? 1],
    );
    ids.push(rows[0]!.id);
  }
  return ids;
}

/** Uma análise ativa de uma vaga (o que faz a vaga existir no edital). */
export async function criarAnalise(
  db: Banco,
  edital: string,
  codigo: string,
  nome: string | null,
): Promise<void> {
  await db.query(
    `insert into public."TB_ANALISE_CURRICULAR" (edital, unidade, chave_natural, "CO_PLANILHA", codigo_vaga, nome_vaga,
                                                 candidato, ativo, "CO_AREA")
     values ($1, 'DSEI Teste', 'chave-' || $2 || '-' || gen_random_uuid(), 'planilha', $2, $3, 'Pessoa ' || $2, true, 'saude-indigena')`,
    [edital, codigo, nome],
  );
}

/** Uma vaga da Seleção (planilha da Auditoria); código nulo = vaga externa, sem código. */
export async function criarVagaDaSelecao(
  db: Banco,
  edital: string,
  codigo: string | null,
  nome: string,
): Promise<void> {
  await db.query(
    `insert into public."TB_SELECAO_VAGA" ("CO_AREA", "CO_MONITORAMENTO", "DS_EDITAL", "CO_VAGA", "DS_VAGA_PLANILHA", "NO_CARGO", "DS_CHAVE_ORIGEM")
     values ('saude-indigena', $1, 'Edital', $2, coalesce($2, 'sem código'), $3, 'origem-' || gen_random_uuid())`,
    [edital, codigo, nome],
  );
}

export type Vinculo = {
  vaga: string;
  situacao: string;
  origem: string;
  regra: string | null;
  quadro: string | null;
  candidatas: string[];
  pendencia: string | null;
};

/** Os vínculos do edital, em ordem de código. */
export async function vinculos(db: Banco, edital: string): Promise<Vinculo[]> {
  const { rows } = await db.query<Vinculo>(
    `select v."CO_VAGA" as vaga, v."TP_VINCULO" as situacao, v."TP_ORIGEM" as origem, v."TP_REGRA" as regra,
            v."CO_QUADRO_VAGA" as quadro, array(select c ->> 'id' from jsonb_array_elements(v."DS_CANDIDATA") c) as candidatas,
            v."DS_PENDENCIA" as pendencia
       from public."TA_VAGA_QUADRO_EDITAL" v where v."CO_MONITORAMENTO" = $1 order by v."CO_VAGA"`,
    [edital],
  );
  return rows;
}
