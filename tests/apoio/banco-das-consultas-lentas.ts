/*
  Banco de teste das migrations das consultas lentas (26/11/2026; aplicadas em 27/11/2026), num
  Postgres de verdade (PGlite).

  O que é de verdade: as tabelas, chaves, índices e funções que as migrations mudam, como
  estavam em produção antes delas (tests/fixtures/banco-antes-das-consultas-lentas.sql, copiadas
  do retrato de 26/11/2026), e as migrations, guardadas sem mudança em
  tests/fixtures/sql-do-banco/ (o hash registrado é o delas). A guarda, o rollback e o ensaio
  saíram com elas (regra do #712).

  O que é imitação (o Supabase tem, o PGlite não, ou é de outro assunto): os papéis, a sessão
  (auth.uid() lê teste.uid; jwt e papel fixos), as permissões (private.pode_recurso: quem tem
  perfil ativo; FC_PODE_AREA e FC_AREAS_USUARIO: as três áreas; FC_EDITAIS_VISIVEIS: o recorte
  em teste.visiveis, vazio = área inteira) e as funções raiz das duas leituras com marca, que
  só leem o que o fecho de verdade lê (a permissão, que cita TB_PERFIL_USUARIO, e o
  monitoramento). Uma terceira leitura lê os perfis como conteúdo: ela deve continuar com
  TB_PERFIL_USUARIO entre as fontes.
*/
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { moldeDeBanco } from "./molde-de-banco.ts";

export type Banco = PGlite;

export const MIGRATIONS = {
  classificacao:
    "20261126190000_editais_da_classificacao_sem_funcao_por_analise.sql",
  vagas: "20261126190100_vagas_por_cargo_sem_funcao_por_linha.sql",
  marca: "20261126190200_marca_das_leituras_sem_o_perfil_dos_outros.sql",
} as const;

const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
export const migration = (nome: string) =>
  ler(`tests/fixtures/sql-do-banco/${nome}`);

export const EU = "11111111-1111-4111-8111-111111111111";
export const OUTRA_PESSOA = "22222222-2222-4222-8222-222222222222";

const INFRAESTRUTURA = `
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema auth;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('email', 'eu@teste')
$$;
create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
`;

/* Depois das tabelas (as imitações citam TB_PERFIL_USUARIO, como as funções de verdade). */
const IMITACOES = `
create function private.pode_recurso(p_recurso text, p_minimo integer default 1)
returns boolean language sql stable as $$
  select exists (select 1 from public."TB_PERFIL_USUARIO" p where p.user_id = auth.uid() and p.ativo)
$$;
create function private."FC_PODE_AREA"(p_area text) returns boolean language sql stable as $$ select true $$;
create function private."FC_AREAS_USUARIO"() returns text[] language sql stable as $$
  select array['saude-indigena', 'sede', 'projetos']
$$;
create function private."FC_EDITAIS_VISIVEIS"() returns uuid[] language sql stable as $$
  select nullif(current_setting('teste.visiveis', true), '')::uuid[]
$$;

create function public.listar_acompanhamento_da_visao_geral(p_area text) returns jsonb
language plpgsql stable as $$
begin
  if not private.pode_recurso('dashboard') then raise exception 'sem permissão'; end if;
  return (select jsonb_agg(m.id) from public."TB_MONITORAMENTO_INDIGENA" m
           where m."CO_AREA" = p_area
             and (private."FC_EDITAIS_VISIVEIS"() is null or m.id = any (private."FC_EDITAIS_VISIVEIS"())));
end;
$$;
create function public.get_selecao_da_area(p_area text) returns json
language plpgsql stable as $$
begin
  if not private.pode_recurso('selecao', 1) then raise exception 'sem permissão'; end if;
  return (select json_agg(m.id) from public."TB_MONITORAMENTO_INDIGENA" m where m."CO_AREA" = p_area);
end;
$$;
create function public.listar_perfis_de_teste() returns json language sql stable as $$
  select json_agg(p.nome) from public."TB_PERFIL_USUARIO" p
$$;

insert into private."TD_LEITURA_POR_MARCA" ("NO_LEITURA", "DS_FUNCOES", "DS_LEITURA") values
  ('acompanhamento_visao_geral', '{listar_acompanhamento_da_visao_geral}', 'Visão geral'),
  ('selecao_area', '{get_selecao_da_area}', 'Seleção'),
  ('perfis_de_teste', '{listar_perfis_de_teste}', 'Lê os perfis como conteúdo');
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(true);

insert into public."TB_AREA" ("CO_AREA", "NO_AREA", "NO_GRUPO_PLANILHA", "NU_ORDEM") values
  ('saude-indigena', 'Saúde Indígena', 'SI', 1), ('sede', 'SEDE', 'SEDE', 2),
  ('projetos', 'Projetos', 'PROJETOS', 3);
insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, ativo) values
  ('${EU}', 'eu@teste', 'Pessoa Um', true),
  ('${OUTRA_PESSOA}', 'outra@teste', 'Pessoa Dois', true);
`;

async function montarAntes(): Promise<Banco> {
  const db = await PGlite.create();
  await db.exec(INFRAESTRUTURA);
  await db.exec(ler("tests/fixtures/banco-antes-das-consultas-lentas.sql"));
  await db.exec(IMITACOES);
  return db;
}

/** Um clone limpo do banco de antes das migrations (fechado pelo bloco que o pede). */
export const bancoAntes = moldeDeBanco(montarAntes);
