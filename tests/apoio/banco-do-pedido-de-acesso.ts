/*
  Banco de teste do pedido de mais acesso (migration 20261124210000), num Postgres de verdade
  (PGlite).

  O que é de verdade: a migration, como entrou no banco em 24/11/2026
  (tests/fixtures/sql-do-banco/), e, como estavam em produção antes dela (os trechos do retrato
  daquele dia, tests/fixtures/sql-do-banco/retrato-do-pedido-de-acesso-em-24-11.sql): as tabelas do pedido e dos acessos (perfil, grupos e níveis,
  áreas, coordenações, permissões individuais e o histórico), o índice de um pedido pendente por
  pessoa, as RPCs do pedido (registrar, aprovar, recusar, cancelar, obter a minha, listar) com
  os grants, e as funções de permissão de que elas dependem (is_master, current_profile,
  nivel_recurso, pode_recurso, nível efetivo, teto do gestor, gestão do usuário, áreas do
  perfil, cargos e motivos de recusa).

  O que é imitação: os papéis; a sessão (auth.uid() lê teste.uid, auth.jwt() devolve o e-mail
  de teste.email, auth.role() é authenticated); as listas de DSEI e de projetos (TD_UNIDADE e
  TA_UNIDADE_AREA, só as colunas lidas). Sem as chaves estrangeiras. Dados fictícios.
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { moldeDeBanco } from "./molde-de-banco.ts";
import { lembrarBanco } from "./bancos-abertos.ts";

export type Banco = PGlite;

export const NOME_DA_MIGRATION = "20261124210000_ampliar_pedido_de_acesso.sql";

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
export const migration = () =>
  ler(`tests/fixtures/sql-do-banco/${NOME_DA_MIGRATION}`);

/* O retrato de antes da migration (o atual já a tem aplicada). */
export const RETRATO = ler(
  "tests/fixtures/sql-do-banco/retrato-do-pedido-de-acesso-em-24-11.sql",
);

/** Um bloco do retrato, do começo até o fim dele (executável). */
function doRetrato(inicio: string, fim: string): string {
  const de = RETRATO.indexOf(inicio);
  if (de < 0) throw new Error(`Sem ${inicio} no retrato`);
  const ate = RETRATO.indexOf(fim, de + inicio.length);
  if (ate < 0) throw new Error(`Sem o fim de ${inicio} no retrato`);
  return RETRATO.slice(de, ate + fim.length);
}
/** A função do retrato, com o delimitador que ela usar ($$, $_$…). */
export function funcaoDoRetrato(nome: string): string {
  const cabecalho = `CREATE FUNCTION ${nome}(`;
  const de = RETRATO.indexOf(cabecalho);
  if (de < 0) throw new Error(`Sem ${nome} no retrato`);
  const delimitador = /AS (\$[A-Za-z_]*\$)/.exec(RETRATO.slice(de))?.[1];
  if (!delimitador) throw new Error(`Sem o corpo de ${nome}`);
  const corpo =
    RETRATO.indexOf(`AS ${delimitador}`, de) + 3 + delimitador.length;
  const fim = RETRATO.indexOf(`${delimitador};`, corpo);
  return RETRATO.slice(de, fim + delimitador.length + 1);
}
const tabela = (nome: string) =>
  doRetrato(`CREATE TABLE public."${nome}" (`, "\n);");
/** As linhas de GRANT/REVOKE de uma função do retrato. */
const grants = (nome: string) =>
  RETRATO.split("\n")
    .filter((linha) =>
      new RegExp(
        `^(GRANT|REVOKE) .* ON FUNCTION ${nome.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&")}\\(`,
      ).test(linha),
    )
    .join("\n");

/* As RPCs do pedido que o front chama. */
const RPCS = [
  "public.registrar_solicitacao_acesso",
  "public.aprovar_solicitacao_acesso",
  "public.recusar_solicitacao_acesso",
  "public.cancelar_minha_solicitacao_acesso",
  "public.obter_minha_solicitacao_acesso",
  "public.listar_solicitacoes_acesso",
  "public.listar_opcoes_da_solicitacao_acesso",
];
const FUNCOES_INTERNAS = [
  "private.is_master",
  "private.current_profile",
  "private.nivel_recurso",
  "private.pode_recurso",
  'private."FC_NIVEL_DO_GRUPO"',
  'private."FC_NIVEL_EFETIVO"',
  'private."FC_TETO_DO_GESTOR"',
  'private."FC_GRUPO_CABE_NO_TETO"',
  'private."FC_COORDENACAO_USUARIO"',
  'private."FC_GESTOR_DE_ACESSOS"',
  'private."FC_EXIGIR_GESTOR_DE_ACESSOS"',
  'private."FC_EXIGIR_GESTAO_DO_USUARIO"',
  'private."FC_AREAS_DO_PERFIL"',
  'private."FC_CARGO_SOLICITACAO_ACESSO"',
  'private."FC_MOTIVO_RECUSA_SOLICITACAO"',
];

const INFRAESTRUTURA = String.raw`
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema auth;
create schema arquivo;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('email', nullif(current_setting('teste.email', true), ''))
$$;
create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;

create table public."TD_UNIDADE" (nome_oficial text primary key, sigla text, tipo text, ativo boolean not null default true);
create table public."TA_UNIDADE_AREA" ("NO_UNIDADE" text primary key, "CO_AREA" text not null);
`;

async function montarHoje(): Promise<Banco> {
  const db = lembrarBanco(await PGlite.create());
  await db.exec(INFRAESTRUTURA);
  // As CHECKs das tabelas chamam estas três.
  for (const nome of [
    'private."FC_RECURSOS_MODULO"',
    'private."FC_RANK_NIVEL"',
    'private."FC_MOTIVO_PARECE_TEXTO"',
  ])
    await db.exec(funcaoDoRetrato(nome));
  for (const nome of [
    "TB_PERFIL_USUARIO",
    "TB_GRUPO_ACESSO",
    "TA_GRUPO_ACESSO_RECURSO",
    "TB_AREA",
    "RL_PERFIL_USUARIO_AREA",
    "TB_COORDENACAO",
    "TB_PERMISSAO_RECURSO",
    "TH_PERMISSAO_RECURSO",
    "TB_PAINEL_EXTERNO",
    "TB_SOLICITACAO_ACESSO",
  ])
    await db.exec(tabela(nome));
  await db.exec(String.raw`
    alter table public."TB_PERFIL_USUARIO" add primary key (id);
    alter table public."TB_GRUPO_ACESSO" add primary key ("CO_GRUPO_ACESSO");
    alter table public."TA_GRUPO_ACESSO_RECURSO" add primary key ("CO_GRUPO_ACESSO", "NO_RECURSO");
    alter table public."TB_AREA" add primary key ("CO_AREA");
    alter table public."RL_PERFIL_USUARIO_AREA" add primary key ("CO_PERFIL_USUARIO", "CO_AREA");
    alter table public."TB_COORDENACAO" add primary key ("CO_COORDENACAO");
    alter table public."TB_PERMISSAO_RECURSO" add primary key (perfil_usuario_id, recurso);
    alter table public."TH_PERMISSAO_RECURSO" alter column id add generated by default as identity;
    alter table public."TB_SOLICITACAO_ACESSO" add primary key (id);
    ${doRetrato("CREATE UNIQUE INDEX solicitacoes_acesso_user_pendente_uidx", ";")}
  `);
  for (const nome of [...FUNCOES_INTERNAS, ...RPCS])
    await db.exec(funcaoDoRetrato(nome));
  for (const nome of RPCS) await db.exec(grants(nome));
  await semear(db);
  return db;
}

/** O banco de hoje (antes da migration), um clone por chamada. */
export const bancoDeHoje = moldeDeBanco(montarHoje);

/* ── Pessoas e dados (fictícios) ─────────────────────────────────────── */

export type Pessoa = Readonly<{ uid: string; email: string; perfil: string }>;
const pessoa = (n: number, nome: string): Pessoa =>
  Object.freeze({
    uid: `00000000-0000-4000-8000-00000000000${n}`,
    perfil: `aaaaaaaa-0000-4000-8000-00000000000${n}`,
    email: `${nome}@teste.gov.br`,
  });
/** Administrador global. */
export const ADMIN = pessoa(1, "admin");
/** Coordenador da coordenação "coord-sede" (Gestão de acessos como Editor). */
export const COORDENADOR = pessoa(2, "coordenador");
/** Usuária na coordenação do coordenador. */
export const ANA = pessoa(3, "ana");
/** Usuária sem coordenação, com a área SEDE. */
export const BIA = pessoa(4, "bia");
/** Conta desativada. */
export const CAIO = pessoa(5, "caio");
/** Quem nunca teve conta. */
export const DANI = pessoa(6, "dani");

async function semear(db: Banco): Promise<void> {
  const perfil = (
    p: Pessoa,
    nome: string,
    grupo: string,
    coordenacao: string | null,
    ativo = true,
  ) =>
    `insert into public."TB_PERFIL_USUARIO" (id, user_id, email, nome, perfil, "CO_COORDENACAO", ativo, updated_at)
     values ('${p.perfil}', '${p.uid}', '${p.email}', '${nome}', '${grupo}', ${coordenacao ? `'${coordenacao}'` : "null"}, ${ativo}, now() - interval '1 day');`;
  await db.exec(`
    insert into public."TB_AREA" ("CO_AREA", "NO_AREA", "NO_GRUPO_PLANILHA", "NU_ORDEM") values
      ('saude-indigena', 'Saúde Indígena', 'SI', 1), ('sede', 'SEDE', 'SEDE', 2), ('projetos', 'Projetos', 'PROJ', 3);
    insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "ST_SISTEMA", "ST_ADMIN_GLOBAL", "NU_ORDEM") values
      ('admin_global', 'Administrador global', true, true, 1),
      ('usuario', 'Usuário', true, false, 2),
      ('edital_gestor', 'Gestor', true, false, 3),
      ('coordenador', 'Coordenador', true, false, 4),
      ('superior', 'Acima do coordenador', false, false, 5);
    insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL") values
      ('usuario', 'dashboard', 'leitor'), ('usuario', 'nucleo', 'leitor'),
      ('edital_gestor', 'dashboard', 'editor'), ('edital_gestor', 'nucleo', 'editor'), ('edital_gestor', 'calendario', 'editor'),
      ('coordenador', 'dashboard', 'editor'), ('coordenador', 'nucleo', 'editor'), ('coordenador', 'calendario', 'editor'),
      ('coordenador', 'acessos', 'editor'),
      ('superior', 'nucleo', 'admin');
    insert into public."TB_COORDENACAO" ("CO_COORDENACAO", "NO_COORDENACAO", "CO_AREA") values
      ('coord-sede', 'Coordenação da SEDE', 'sede'), ('coord-si', 'Coordenação Norte', 'saude-indigena');
    insert into public."TD_UNIDADE" values ('DSEI Teste');
    ${perfil(ADMIN, "Pessoa Admin", "admin_global", null)}
    ${perfil(COORDENADOR, "Pessoa Coordenadora", "coordenador", "coord-sede")}
    ${perfil(ANA, "Ana Teste", "usuario", "coord-sede")}
    ${perfil(BIA, "Bia Teste", "usuario", null)}
    ${perfil(CAIO, "Caio Teste", "usuario", null, false)}
    insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA") values
      ('${BIA.perfil}', 'sede'), ('${CAIO.perfil}', 'sede');
  `);
}

/** Entra como a pessoa (null = sem sessão). */
export async function entrar(db: Banco, quem: Pessoa | null): Promise<void> {
  await db.query(
    `select set_config('teste.uid', $1, false), set_config('teste.email', $2, false)`,
    [quem?.uid ?? "", quem?.email ?? ""],
  );
}

/** Chama uma RPC com argumentos nomeados e devolve o JSON. */
export async function rpc<T = Record<string, unknown>>(
  db: Banco,
  nome: string,
  argumentos: Record<string, unknown> = {},
): Promise<T> {
  const nomes = Object.keys(argumentos);
  const sql = `select public.${nome}(${nomes.map((n, i) => `${n} => $${i + 1}`).join(", ")}) as r`;
  const { rows } = await db.query<{ r: T }>(sql, Object.values(argumentos));
  return rows[0]!.r;
}

/** A mensagem do erro da RPC ("" se não deu erro). */
export async function erroDe(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
    return "";
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
}

export const JUSTIFICATIVA =
  "Preciso editar o cronograma dos editais da minha unidade.";
