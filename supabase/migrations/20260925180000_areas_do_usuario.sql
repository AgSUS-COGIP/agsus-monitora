/*
  ÁREAS DO USUÁRIO (etapa 5 de docs/arquitetura.md, parte 1: o banco sabe)

  Cada usuário recebe uma ou mais áreas (TB_AREA). As permissões por módulo
  (TB_PERMISSAO_RECURSO, nivel_padrao_recurso) continuam como estão: a área só
  recorta QUAIS dados o usuário vê. Admin (private.is_master) vê todas as áreas
  sem precisar de linha aqui.

  Decisão do responsável (25/09/2026): na virada, todo perfil que não é admin
  recebe Saúde Indígena — o que o sistema atendia até agora. SEDE e Projetos
  são dados depois, em Configurações → Acessos.

  Esta migration só cria o dado e o expõe em obter_contexto_monitora
  (profile.areas). Nenhuma tela é filtrada ainda: isso vem na parte 2.

  ROLLBACK
    begin;
    -- obter_contexto_monitora: reaplicar a definição anterior (abaixo, sem 'areas').
    drop function private."FC_PODE_AREA"(text);
    drop function private."FC_AREAS_USUARIO"();
    drop table public."RL_PERFIL_USUARIO_AREA";
    commit;
*/
begin;

create table public."RL_PERFIL_USUARIO_AREA" (
  "CO_PERFIL_USUARIO" uuid not null,
  "CO_AREA" text not null,
  "DT_INCLUSAO" timestamptz not null default now(),
  constraint "PK_RL_PERFIL_USUARIO_AREA" primary key ("CO_PERFIL_USUARIO", "CO_AREA"),
  constraint "FK_PERFILUSUARIO_PERFUSUAREA" foreign key ("CO_PERFIL_USUARIO")
    references public."TB_PERFIL_USUARIO" (id) on delete cascade,
  constraint "FK_AREA_PERFUSUAREA" foreign key ("CO_AREA")
    references public."TB_AREA" ("CO_AREA")
);
create index "IN_FKPERFUSUAREA_COAREA" on public."RL_PERFIL_USUARIO_AREA" ("CO_AREA");

comment on table public."RL_PERFIL_USUARIO_AREA" is
  'Áreas de cada usuário. Recorta os dados que ele vê; as permissões por módulo continuam em TB_PERMISSAO_RECURSO. Admin vê todas sem linha aqui.';
comment on column public."RL_PERFIL_USUARIO_AREA"."CO_PERFIL_USUARIO" is 'TB_PERFIL_USUARIO.id.';
comment on column public."RL_PERFIL_USUARIO_AREA"."CO_AREA" is 'TB_AREA.CO_AREA.';
comment on column public."RL_PERFIL_USUARIO_AREA"."DT_INCLUSAO" is 'Quando a área foi dada ao usuário.';

alter table public."RL_PERFIL_USUARIO_AREA" enable row level security;
revoke all on public."RL_PERFIL_USUARIO_AREA" from public, anon, authenticated;
-- Leitura e gravação só pelas RPCs (SECURITY DEFINER); nenhuma policy de propósito.

insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
select p.id, 'saude-indigena'
  from public."TB_PERFIL_USUARIO" p
 where lower(coalesce(p.perfil, '')) <> 'admin';

-- Áreas que o usuário logado vê -----------------------------------------------------
create function private."FC_AREAS_USUARIO"()
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when coalesce((select auth.role()) = 'service_role', false) or private.is_master()
      then (select coalesce(array_agg(a."CO_AREA" order by a."NU_ORDEM"), '{}') from public."TB_AREA" a)
    else coalesce((
      select array_agg(r."CO_AREA" order by a."NU_ORDEM")
        from public."RL_PERFIL_USUARIO_AREA" r
        join public."TB_AREA" a on a."CO_AREA" = r."CO_AREA"
        join private.current_profile() p on p.id = r."CO_PERFIL_USUARIO"
       where p.ativo
    ), '{}')
  end;
$$;
comment on function private."FC_AREAS_USUARIO"() is
  'Áreas que o usuário logado vê: todas para admin e service_role; senão as de RL_PERFIL_USUARIO_AREA.';
revoke all on function private."FC_AREAS_USUARIO"() from public, anon;
grant execute on function private."FC_AREAS_USUARIO"() to authenticated;

create function private."FC_PODE_AREA"(p_area text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_area = any (private."FC_AREAS_USUARIO"());
$$;
comment on function private."FC_PODE_AREA"(text) is
  'O usuário logado vê a área? Usado pelas RPCs e policies para recortar dados por área.';
revoke all on function private."FC_PODE_AREA"(text) from public, anon;
grant execute on function private."FC_PODE_AREA"(text) to authenticated;

-- Contexto do usuário ganha as áreas -------------------------------------------------------
create or replace function public.obter_contexto_monitora()
returns jsonb
language sql
stable
set search_path to ''
as $function$
select jsonb_build_object('profile',to_jsonb(p)||jsonb_build_object('permissoes',
  (select jsonb_object_agg(m,private.nivel_recurso(m)) from unnest(array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes']) m),
  'areas', to_jsonb(private."FC_AREAS_USUARIO"())),
  'panel_ids',coalesce((select jsonb_agg(e.id::text) from public."TB_PAINEL_EXTERNO" e
    where e.ativo and private.pode_recurso('paineis') and private.pode_recurso('painel:'||e.id)),'[]'::jsonb))
from private.current_profile() p where p.id is not null and p.ativo;
$function$;

commit;
