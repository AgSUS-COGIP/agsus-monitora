/*
  Banco de teste das fontes das colunas dos Painéis, num Postgres de verdade
  (PGlite: o PostgreSQL compilado para WebAssembly, com plpgsql).

  O que é de verdade: a migration 20261113220000 (schema painel, configuração,
  histórico, catálogo, aplicação das fontes e as RPCs de fontes) e a guarda
  private."FC_EXIGIR_PAINEIS_DA_AREA", na fixture
  tests/fixtures/banco-antes-das-fontes-dos-paineis.sql (copiada da migration
  20261113210000, aplicada).

  O que é imitação (o Supabase tem, o PGlite não, ou é de outro assunto): os
  papéis, a sessão (auth.uid() lê teste.uid), o nível em paineis_dados
  (private.pode_recurso lê teste.nivel: 0 sem acesso … 3 Administrador), as
  áreas do usuário (private."FC_PODE_AREA" lê teste.areas, separadas por
  vírgula), TB_AREA, TB_PERFIL_USUARIO e o catálogo de recursos.
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

export type Banco = PGlite;

export const NOME_DA_MIGRATION =
  "20261113220000_fontes_das_colunas_dos_paineis.sql";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
export const migration = () => ler(`supabase/migrations/${NOME_DA_MIGRATION}`);
export const rollback = () => ler(`supabase/rollback/${NOME_DA_MIGRATION}`);

/*
  A guarda dos relatórios, do jeito que está no banco: a migration 20261113210000 foi aplicada
  e saiu do repositório; o trecho que os testes usam ficou na fixture.
*/
const guardaDosPaineis = () =>
  ler("tests/fixtures/banco-antes-das-fontes-dos-paineis.sql");

export const USUARIO_ADMIN = "11111111-1111-1111-1111-111111111111";
export const USUARIO_LEITOR = "22222222-2222-2222-2222-222222222222";

const INFRAESTRUTURA = `
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema auth;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid
$$;

create table public."TB_AREA" ("CO_AREA" text primary key);
insert into public."TB_AREA" values ('saude-indigena'), ('sede'), ('projetos');

create table public."TB_PERFIL_USUARIO" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  nome text not null,
  ativo boolean not null default true
);

create function private.pode_recurso(p_recurso text, p_minimo integer default 1)
returns boolean language sql stable as $$
  select p_recurso = 'paineis_dados'
     and coalesce(nullif(current_setting('teste.nivel', true), ''), '0')::integer
         >= greatest(1, p_minimo)
$$;

create function private."FC_PODE_AREA"(p_area text) returns boolean
language sql stable as $$
  select p_area = any (string_to_array(coalesce(current_setting('teste.areas', true), ''), ','))
$$;

create function private."FC_RECURSOS_MODULO"() returns text[]
language sql immutable as $$
  select array['dashboard', 'selecao', 'aprovados_pendencias', 'paineis_dados']::text[]
$$;
`;

/** O banco com a migration das fontes já aplicada (e dois usuários com nome). */
export async function bancoDosPaineis(): Promise<Banco> {
  const db = await PGlite.create();
  await db.exec(INFRAESTRUTURA);
  await db.exec(guardaDosPaineis());
  await db.query(
    `insert into public."TB_PERFIL_USUARIO" (user_id, nome) values ($1, 'Pessoa Administradora'), ($2, 'Pessoa Leitora')`,
    [USUARIO_ADMIN, USUARIO_LEITOR],
  );
  await db.exec(migration());
  return db;
}

/** A sessão: quem está logado, o nível em paineis_dados (0–3) e as áreas. */
export async function entrar(
  db: Banco,
  { uid, nivel, areas }: { uid: string | null; nivel: number; areas: string[] },
): Promise<void> {
  await db.query(
    `select set_config('teste.uid', $1, false), set_config('teste.nivel', $2, false),
            set_config('teste.areas', $3, false)`,
    [uid ?? "", String(nivel), areas.join(",")],
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
