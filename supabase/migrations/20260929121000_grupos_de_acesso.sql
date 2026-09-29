/*
  GRUPOS DE ACESSO CONFIGURÁVEIS (permissões, parte 1)

  Até aqui o papel do usuário (TB_PERFIL_USUARIO.perfil) dava os níveis padrão
  por módulo numa função fixa (private.nivel_padrao_recurso, 20260923181135) e
  TB_PERMISSAO_RECURSO guardava só as exceções. Agora o papel vira dado, com o nome de GRUPO:

    TB_GRUPO_ACESSO          o grupo (modelo de acesso), editável pelo admin
    TA_GRUPO_ACESSO_RECURSO  nível de cada módulo no grupo

  Nível efetivo = exceção do usuário (TB_PERMISSAO_RECURSO) ?? nível do grupo.
  Painel externo continua exigindo linha explícita por usuário.

  Na virada ninguém muda de acesso: os perfis usuario, edital_gestor,
  contratador e admin são semeados com EXATAMENTE o que nivel_padrao_recurso
  devolve (a migration confere isso e aborta se divergir). Entra o grupo novo
  "coordenador" e o módulo novo "acessos" (sem_acesso | editor), que dá a
  gestão delegada dos acessos da própria coordenação (parte 2).

  Admin global = grupo com ST_ADMIN_GLOBAL (só o grupo de sistema "admin").
  TB_PERFIL_USUARIO.perfil (nome legado da coluna) guarda o código do grupo.
  private.is_master() passa a ler isso em vez do texto 'admin'.

  nivel_padrao_recurso continua existindo até a limpeza do legado (as RPCs da
  matriz ainda a chamam; a parte 4 as reescreve).

  ROLLBACK
    begin;
    -- reaplicar is_master, monitora_role e nivel_recurso de 20260918160000/20260923181135;
    alter table public."TB_PERFIL_USUARIO" drop constraint "FK_GRUPOACESSO_PERFILUSUARIO";
    alter table public."TB_PERFIL_USUARIO" add constraint perfis_usuarios_perfil_check
      check (perfil in ('usuario','edital_gestor','contratador','admin'));
    -- recolocar o CHECK de recurso de TB_PERMISSAO_RECURSO sem 'acessos';
    drop function private."FC_NIVEL_EFETIVO"(uuid, text, text);
    drop function private."FC_NIVEL_DO_GRUPO"(text, text);
    drop function private."FC_RECURSOS_MODULO"();
    drop table public."TA_GRUPO_ACESSO_RECURSO";
    drop table public."TB_GRUPO_ACESSO";
    commit;
*/
begin;

-- 1. Módulos (lista única) ----------------------------------------------------
create function private."FC_RECURSOS_MODULO"()
returns text[]
language sql
immutable
set search_path to ''
as $$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos']::text[];
$$;
comment on function private."FC_RECURSOS_MODULO"() is
  'Módulos da matriz de permissões (espelho de RESOURCES em src/lib/permissoes-recursos.js).';
revoke all on function private."FC_RECURSOS_MODULO"() from public, anon;
grant execute on function private."FC_RECURSOS_MODULO"() to authenticated;

-- 2. Grupos ---------------------------------------------------------------------
create table public."TB_GRUPO_ACESSO" (
  "CO_GRUPO_ACESSO" text not null,
  "NO_GRUPO_ACESSO" text not null,
  "DS_GRUPO_ACESSO" text,
  "ST_SISTEMA" boolean not null default false,
  "ST_ADMIN_GLOBAL" boolean not null default false,
  "NU_ORDEM" smallint not null default 100,
  "NU_REVISAO" integer not null default 1,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_GRUPO_ACESSO" primary key ("CO_GRUPO_ACESSO"),
  constraint "UK_GRUPOACESSO_NOME" unique ("NO_GRUPO_ACESSO"),
  constraint "CK_GRUPOACESSO_CODIGO" check ("CO_GRUPO_ACESSO" ~ '^[a-z]+(_[a-z]+)*$'),
  constraint "CK_GRUPOACESSO_ADMINSISTEMA" check (not "ST_ADMIN_GLOBAL" or "ST_SISTEMA")
);
create unique index "UK_GRUPOACESSO_ADMINGLOBAL" on public."TB_GRUPO_ACESSO" (("ST_ADMIN_GLOBAL")) where "ST_ADMIN_GLOBAL";

comment on table public."TB_GRUPO_ACESSO" is
  'Grupos de acesso: modelo de níveis por módulo. O usuário segue o grupo; exceções em TB_PERMISSAO_RECURSO.';
comment on column public."TB_GRUPO_ACESSO"."CO_GRUPO_ACESSO" is 'Código do perfil; é o valor de TB_PERFIL_USUARIO.perfil.';
comment on column public."TB_GRUPO_ACESSO"."NO_GRUPO_ACESSO" is 'Nome do grupo na tela.';
comment on column public."TB_GRUPO_ACESSO"."DS_GRUPO_ACESSO" is 'Para que serve o grupo.';
comment on column public."TB_GRUPO_ACESSO"."ST_SISTEMA" is 'Grupo do sistema: não se remove nem se renomeia o código.';
comment on column public."TB_GRUPO_ACESSO"."ST_ADMIN_GLOBAL" is 'Administrador global: vê todas as áreas e gerencia tudo. Só um grupo, de sistema.';
comment on column public."TB_GRUPO_ACESSO"."NU_ORDEM" is 'Ordem de exibição.';
comment on column public."TB_GRUPO_ACESSO"."NU_REVISAO" is 'Revisão para trava de concorrência na edição.';
comment on column public."TB_GRUPO_ACESSO"."DT_ATUALIZACAO" is 'Última alteração.';

create table public."TA_GRUPO_ACESSO_RECURSO" (
  "CO_GRUPO_ACESSO" text not null,
  "NO_RECURSO" text not null,
  "TP_NIVEL" text not null,
  constraint "PK_TA_GRUPO_ACESSO_RECURSO" primary key ("CO_GRUPO_ACESSO", "NO_RECURSO"),
  constraint "FK_GRUPOACESSO_GRUPACESSOREC" foreign key ("CO_GRUPO_ACESSO")
    references public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO") on delete cascade on update cascade,
  constraint "CK_GRUPACESSOREC_RECURSO" check ("NO_RECURSO" = any (private."FC_RECURSOS_MODULO"())),
  constraint "CK_GRUPACESSOREC_NIVEL" check ("TP_NIVEL" in ('sem_acesso','leitor','editor','admin')),
  constraint "CK_GRUPACESSOREC_CONFIG" check ("NO_RECURSO" <> 'configuracoes' or "TP_NIVEL" <> 'leitor'),
  constraint "CK_GRUPACESSOREC_ACESSOS" check ("NO_RECURSO" <> 'acessos' or "TP_NIVEL" in ('sem_acesso','editor'))
);
comment on table public."TA_GRUPO_ACESSO_RECURSO" is 'Nível de cada módulo em cada grupo de acesso.';
comment on column public."TA_GRUPO_ACESSO_RECURSO"."CO_GRUPO_ACESSO" is 'TB_GRUPO_ACESSO.CO_GRUPO_ACESSO.';
comment on column public."TA_GRUPO_ACESSO_RECURSO"."NO_RECURSO" is 'Módulo (FC_RECURSOS_MODULO).';
comment on column public."TA_GRUPO_ACESSO_RECURSO"."TP_NIVEL" is 'sem_acesso, leitor, editor ou admin.';

alter table public."TB_GRUPO_ACESSO" enable row level security;
alter table public."TA_GRUPO_ACESSO_RECURSO" enable row level security;
revoke all on public."TB_GRUPO_ACESSO", public."TA_GRUPO_ACESSO_RECURSO" from public, anon, authenticated;
grant select on public."TB_GRUPO_ACESSO", public."TA_GRUPO_ACESSO_RECURSO" to authenticated;
create policy "PL_GRUPO_ACESSO_LEITURA" on public."TB_GRUPO_ACESSO" for select to authenticated using (true);
create policy "PL_GRUPO_ACESSO_RECURSO_LEITURA" on public."TA_GRUPO_ACESSO_RECURSO" for select to authenticated using (true);
-- Gravação só pelas RPCs de gestão (parte 4).

-- 3. Semente: os quatro papéis de hoje + coordenador ---------------------------
insert into public."TB_GRUPO_ACESSO"
  ("CO_GRUPO_ACESSO","NO_GRUPO_ACESSO","DS_GRUPO_ACESSO","ST_SISTEMA","ST_ADMIN_GLOBAL","NU_ORDEM") values
  ('usuario','Usuário','Consulta os módulos liberados.',true,false,10),
  ('edital_gestor','Edital gestor','Cadastra editais e cronogramas e importa listas.',true,false,20),
  ('contratador','Contratador','Edital gestor que também muda o status dos candidatos.',true,false,30),
  ('coordenador','Coordenador','Coordena uma equipe: edita os módulos do dia a dia e gerencia os acessos da própria coordenação.',false,false,40),
  ('admin','Administrador global','Vê todas as áreas e gerencia perfis, coordenações e acessos.',true,true,90);

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO","NO_RECURSO","TP_NIVEL")
select p.perfil, r.recurso, private.nivel_padrao_recurso(p.perfil, r.recurso)
  from unnest(array['usuario','edital_gestor','contratador','admin']) p(perfil)
 cross join unnest(array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes']) r(recurso);

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO","NO_RECURSO","TP_NIVEL") values
  ('usuario','acessos','sem_acesso'),
  ('edital_gestor','acessos','sem_acesso'),
  ('contratador','acessos','sem_acesso'),
  ('admin','acessos','editor'),
  ('coordenador','dashboard','leitor'),
  ('coordenador','analises','leitor'),
  ('coordenador','nucleo','editor'),
  ('coordenador','calendario','editor'),
  ('coordenador','aprovados','editor'),
  ('coordenador','importacao','editor'),
  ('coordenador','paineis','leitor'),
  ('coordenador','configuracoes','sem_acesso'),
  ('coordenador','acessos','editor');

-- Conferência da semente: mesmo nível que a função fixa, célula a célula.
do $$
begin
  if exists (
    select 1
      from unnest(array['usuario','edital_gestor','contratador','admin']) p(perfil)
     cross join unnest(array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes']) r(recurso)
      left join public."TA_GRUPO_ACESSO_RECURSO" t on t."CO_GRUPO_ACESSO" = p.perfil and t."NO_RECURSO" = r.recurso
     where t."TP_NIVEL" is distinct from private.nivel_padrao_recurso(p.perfil, r.recurso)
  ) then
    raise exception 'Semente dos perfis diverge de nivel_padrao_recurso';
  end if;
end;
$$;

-- 4. Usuário -> grupo: o CHECK fixo vira chave estrangeira --------------------
alter table public."TB_PERFIL_USUARIO" drop constraint if exists perfis_usuarios_perfil_check;
alter table public."TB_PERFIL_USUARIO"
  add constraint "FK_GRUPOACESSO_PERFILUSUARIO" foreign key (perfil)
  references public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO") on update cascade;
create index if not exists "IN_FKPERFILUSUARIO_PERFIL" on public."TB_PERFIL_USUARIO" (perfil);

alter table public."TB_SOLICITACAO_ACESSO" drop constraint if exists solicitacoes_acesso_perfil_solicitado_check;
alter table public."TB_SOLICITACAO_ACESSO"
  add constraint "FK_GRUPOACESSO_SOLICACESSO" foreign key (perfil_solicitado)
  references public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO") on update cascade;

-- 5. Exceção por usuário aceita o módulo novo ---------------------------------
do $$
declare v_nome text;
begin
  for v_nome in
    select c.conname from pg_constraint c
     where c.conrelid = 'public."TB_PERMISSAO_RECURSO"'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) like '%configuracoes%'
  loop
    execute format('alter table public."TB_PERMISSAO_RECURSO" drop constraint %I', v_nome);
  end loop;
end;
$$;
alter table public."TB_PERMISSAO_RECURSO"
  add constraint "CK_PERMISSAORECURSO_RECURSO"
  check (recurso = any (private."FC_RECURSOS_MODULO"()) or recurso ~ '^painel:[0-9a-f-]{36}$');

-- 6. Nível efetivo --------------------------------------------------------------
create function private."FC_NIVEL_DO_GRUPO"(p_grupo text, p_recurso text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select t."TP_NIVEL" from public."TA_GRUPO_ACESSO_RECURSO" t
      where t."CO_GRUPO_ACESSO" = p_grupo and t."NO_RECURSO" = p_recurso),
    'sem_acesso');
$$;
comment on function private."FC_NIVEL_DO_GRUPO"(text, text) is
  'Nível do módulo no grupo de acesso; sem linha (ou painel externo) = sem_acesso.';

create function private."FC_NIVEL_EFETIVO"(p_perfil_usuario uuid, p_grupo text, p_recurso text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select g.nivel from public."TB_PERMISSAO_RECURSO" g
      where g.perfil_usuario_id = p_perfil_usuario and g.recurso = p_recurso),
    private."FC_NIVEL_DO_GRUPO"(p_grupo, p_recurso));
$$;
comment on function private."FC_NIVEL_EFETIVO"(uuid, text, text) is
  'Nível efetivo de um usuário: exceção (TB_PERMISSAO_RECURSO) ?? nível do grupo.';

revoke all on function private."FC_NIVEL_DO_GRUPO"(text, text), private."FC_NIVEL_EFETIVO"(uuid, text, text) from public, anon, authenticated;

create or replace function private.nivel_recurso(p_recurso text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare p public."TB_PERFIL_USUARIO";
begin
  if (select auth.uid()) is null then return 'sem_acesso'; end if;
  p := private.current_profile();
  if p.id is null or p.ativo is not true then return 'sem_acesso'; end if;
  return private."FC_NIVEL_EFETIVO"(p.id, p.perfil, p_recurso);
end;
$$;

-- 7. Admin global e "tem perfil" leem o grupo de acesso ------------------------
create or replace function private.is_master()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.ativo is true
       and a."ST_ADMIN_GLOBAL"
       and (
         p.user_id = (select auth.uid())
         or lower(p.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
       )
  );
$$;

-- Devolve o código do grupo de acesso ('' sem grupo ativo). Quem compara com
-- '' só quer saber se há grupo; o papel de módulo sai de papel_recurso.
create or replace function private.monitora_role()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((
    select a."CO_GRUPO_ACESSO"
      from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.ativo is true
       and (
         p.user_id = (select auth.uid())
         or lower(p.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
       )
     order by case when p.user_id = (select auth.uid()) then 0 else 1 end,
              p.updated_at desc nulls last
     limit 1), '');
$$;

commit;
