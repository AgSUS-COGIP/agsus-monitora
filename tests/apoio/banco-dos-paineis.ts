/*
  Banco de teste das fontes das colunas dos Painéis, num Postgres de verdade
  (PGlite: o PostgreSQL compilado para WebAssembly, com plpgsql).

  O que é de verdade: a migration 20261113220000 (schema painel, configuração,
  histórico, catálogo, aplicação das fontes e as RPCs de fontes) e a guarda
  private."FC_EXIGIR_PAINEIS_DA_AREA", na fixture
  tests/fixtures/banco-antes-das-fontes-dos-paineis.sql (copiada da migration
  20261113210000, aplicada). As migrations aplicadas que montam o banco estão
  em tests/fixtures/sql-do-banco/, com o mesmo nome.

  O que é imitação (o Supabase tem, o PGlite não, ou é de outro assunto): os
  papéis, a sessão (auth.uid() lê teste.uid), o nível em paineis_dados
  (private.pode_recurso lê teste.nivel: 0 sem acesso … 3 Administrador), as
  áreas do usuário (private."FC_PODE_AREA" lê teste.areas, separadas por
  vírgula), TB_AREA, TB_PERFIL_USUARIO e o catálogo de recursos.
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { moldeDeBanco } from "./molde-de-banco.ts";

export type Banco = PGlite;

export const NOME_DA_MIGRATION =
  "20261113220000_fontes_das_colunas_dos_paineis.sql";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
/** Uma migration aplicada, guardada em tests/fixtures/sql-do-banco/ para montar o banco. */
export const sqlDoBanco = (nome: string) =>
  ler(`tests/fixtures/sql-do-banco/${nome}`);
export const migration = () => sqlDoBanco(NOME_DA_MIGRATION);

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
async function montarBancoDosPaineis(): Promise<Banco> {
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

/** O banco com a migration das fontes já aplicada (clone de um molde por arquivo). */
export const bancoDosPaineis = moldeDeBanco(montarBancoDosPaineis);

/**
 * A sessão: quem está logado, o nível em paineis_dados (0–3), as áreas e o
 * recorte da coordenação (`editais`: vazio = vê todos).
 */
export async function entrar(
  db: Banco,
  {
    uid,
    nivel,
    areas,
    editais = [],
  }: { uid: string | null; nivel: number; areas: string[]; editais?: string[] },
): Promise<void> {
  await db.query(
    `select set_config('teste.uid', $1, false), set_config('teste.nivel', $2, false),
            set_config('teste.areas', $3, false), set_config('teste.editais', $4, false)`,
    [uid ?? "", String(nivel), areas.join(","), editais.join(",")],
  );
}

/* ── Relatórios prontos (migration 20261116160000) ─────────────────── */

export const NOME_DOS_PRONTOS =
  "20261116160000_relatorios_dos_paineis_prontos.sql";
export const migrationDosProntos = () => sqlDoBanco(NOME_DOS_PRONTOS);

const COM_FONTES = "20261113240000_relatorios_dos_paineis_com_fontes.sql";
export const RPCS_ANTIGAS = [
  "listar_resumo_dos_editais_do_painel",
  "listar_editais_por_cargo_do_painel",
  "listar_aprovados_do_painel",
] as const;

/** O bloco `create … function <inicio> … $function$;` de um SQL. */
export function blocoDaFuncao(sql: string, inicio: string): string {
  const i = sql.indexOf(inicio);
  if (i < 0) throw new Error(`função não achada: ${inicio}`);
  const fim = sql.indexOf("$function$;", sql.indexOf("as $function$", i) + 13);
  return sql.slice(i, fim + "$function$;".length);
}
/** As três RPCs dos relatórios como estão no banco (20261113240000). */
export const rpcsAntigas = () => {
  const sql = sqlDoBanco(COM_FONTES);
  return RPCS_ANTIGAS.map((n) =>
    blocoDaFuncao(sql, `create or replace function public.${n}(p_area text)`),
  );
};

const RECORTE_DA_COORDENACAO = `
create function private."FC_EDITAIS_VISIVEIS"() returns uuid[]
language sql stable as $$
  select case when coalesce(current_setting('teste.editais', true), '') = '' then null
              else string_to_array(current_setting('teste.editais', true), ',')::uuid[] end
$$;
`;

/*
  O cálculo de verdade lê as tabelas do banco (editais, Seleção, listas), que o
  PGlite não tem: a imitação devolve as linhas de public.linha_de_teste, passa
  pelas fontes como o de verdade e falha na área de teste.falhar ('tudo' = todas).
*/
const CALCULO_DE_TESTE = `
create table public.linha_de_teste (area text, relatorio text, n integer, linha jsonb);
create or replace function private."FC_LINHAS_DO_RELATORIO_PAINEL"(p_area text, p_relatorio text)
returns jsonb language plpgsql stable set search_path to '' as $f$
begin
  if coalesce(current_setting('teste.falhar', true), '') in ('tudo', p_area) then
    raise exception 'Falha de teste em %', p_area;
  end if;
  return private."FC_APLICAR_FONTES_DO_PAINEL"(p_area, p_relatorio, coalesce(
    (select jsonb_agg(t.linha order by t.n) from public.linha_de_teste t
      where t.area = p_area and t.relatorio = p_relatorio), '[]'::jsonb));
end
$f$;
`;

/*
  A 20261116170000_limites_de_tempo_dos_paineis.sql foi aplicada e saiu do
  repositório (a main ganhou outra migration com o mesmo timestamp); o SQL dela
  e o rollback ficaram nas fixtures, como no banco.
*/
export const migrationDosLimites = () =>
  ler("tests/fixtures/limites-de-tempo-dos-paineis.migration.sql");
export const rollbackDosLimites = () =>
  ler("tests/fixtures/limites-de-tempo-dos-paineis.rollback.sql");

/** O banco com as fontes, as RPCs de 20261113240000 e as migrations dos prontos. */
async function montarBancoComRelatoriosProntos(): Promise<Banco> {
  const db = await bancoDosPaineis();
  await db.exec(RECORTE_DA_COORDENACAO);
  await db.exec(rpcsAntigas().join("\n\n"));
  await db.exec(migrationDosProntos());
  await db.exec(migrationDosLimites());
  await db.exec(CALCULO_DE_TESTE);
  return db;
}

/** O banco com os relatórios prontos (clone de um molde por arquivo). */
export const bancoComRelatoriosProntos = moldeDeBanco(
  montarBancoComRelatoriosProntos,
);

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
