-- Granular overrides. Existing profiles keep their role defaults until edited.
-- Definer helpers are private, use a fixed search_path, and resolve auth.uid()
-- themselves. Clients cannot pass a different identity to an authorization check.
create table public."TB_PERMISSAO_RECURSO" (
  perfil_usuario_id uuid not null references public."TB_PERFIL_USUARIO"(id) on delete cascade,
  recurso text not null,
  nivel text not null check (nivel in ('sem_acesso','leitor','editor','admin')),
  revisao integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  primary key (perfil_usuario_id,recurso),
  check (recurso in ('dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes') or recurso ~ '^painel:[0-9a-f-]{36}$')
);
create table public."TH_PERMISSAO_RECURSO" (
  id bigint generated always as identity primary key,
  perfil_usuario_id uuid not null,
  recurso text not null,
  nivel_anterior text not null,
  nivel_novo text not null,
  alterado_por uuid not null,
  alterado_em timestamptz not null default now(),
  motivo text not null
);
create index on public."TH_PERMISSAO_RECURSO" (alterado_em desc);
alter table public."TB_PERMISSAO_RECURSO" enable row level security;
alter table public."TH_PERMISSAO_RECURSO" enable row level security;
revoke all on public."TB_PERMISSAO_RECURSO",public."TH_PERMISSAO_RECURSO" from anon,authenticated;
grant select on public."TB_PERMISSAO_RECURSO",public."TH_PERMISSAO_RECURSO" to authenticated;
create policy leitura_permissao on public."TB_PERMISSAO_RECURSO" for select to authenticated
using (perfil_usuario_id = (select (private.current_profile()).id) or (select private.is_master()));
create policy leitura_auditoria on public."TH_PERMISSAO_RECURSO" for select to authenticated using ((select private.is_master()));

create function private.nivel_padrao_recurso(p_perfil text,p_recurso text) returns text
language sql immutable set search_path='' as $$
  select case
    when p_perfil not in ('usuario','edital_gestor','contratador','admin') then 'sem_acesso'
    when p_recurso like 'painel:%' then 'leitor'
    when p_recurso not in ('dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes') then 'sem_acesso'
    when p_perfil='admin' then 'admin'
    when p_recurso='configuracoes' then 'sem_acesso'
    when p_recurso='importacao' then case when p_perfil in ('edital_gestor','contratador') then 'editor' else 'sem_acesso' end
    when p_recurso in ('nucleo','calendario') and p_perfil in ('edital_gestor','contratador') then 'editor'
    when p_recurso='aprovados' and p_perfil='contratador' then 'editor'
    else 'leitor' end;
$$;

create function private.nivel_recurso(p_recurso text) returns text
language plpgsql stable security definer set search_path='' as $$
declare p public."TB_PERFIL_USUARIO"; v text;
begin
  if (select auth.uid()) is null then return 'sem_acesso'; end if;
  p := private.current_profile();
  if p.id is null or p.ativo is not true then return 'sem_acesso'; end if;
  select nivel into v from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id=p.id and recurso=p_recurso;
  if v is not null then return v; end if;
  -- New panels require an explicit grant; the migration seeds existing panels.
  if p_recurso like 'painel:%' then return 'sem_acesso'; end if;
  return private.nivel_padrao_recurso(private.monitora_role(),p_recurso);
end;
$$;
create function private.pode_recurso(p_recurso text,p_minimo integer default 1) returns boolean
language sql stable security definer set search_path='' as $$
  select case private.nivel_recurso(p_recurso) when 'admin' then 3 when 'editor' then 2 when 'leitor' then 1 else 0 end >= greatest(p_minimo,1);
$$;
create function private.papel_recurso(p_recurso text) returns text
language sql stable security definer set search_path='' as $$
  select case private.nivel_recurso(p_recurso) when 'admin' then 'admin' when 'editor' then 'contratador' when 'leitor' then 'usuario' else '' end;
$$;
revoke all on function private.nivel_padrao_recurso(text,text),private.nivel_recurso(text),private.pode_recurso(text,integer),private.papel_recurso(text) from public,anon;
grant execute on function private.nivel_recurso(text),private.pode_recurso(text,integer),private.papel_recurso(text) to authenticated;

insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id,recurso,nivel,updated_by)
select u.id,'painel:'||p.id,'leitor',coalesce(u.user_id,'00000000-0000-0000-0000-000000000000'::uuid)
from public."TB_PERFIL_USUARIO" u cross join public."TB_PAINEL_EXTERNO" p where u.ativo and p.ativo;

create or replace function public.obter_contexto_monitora() returns jsonb
language sql stable set search_path='' as $$
select jsonb_build_object('profile',to_jsonb(p)||jsonb_build_object('permissoes',
  (select jsonb_object_agg(m,private.nivel_recurso(m)) from unnest(array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes']) m)),
  'panel_ids',coalesce((select jsonb_agg(e.id::text) from public."TB_PAINEL_EXTERNO" e
    where e.ativo and private.pode_recurso('paineis') and private.pode_recurso('painel:'||e.id)),'[]'::jsonb))
from private.current_profile() p where p.id is not null and p.ativo;
$$;

create function public.obter_matriz_acessos(p_busca text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;
begin
  if not private.is_master() then raise exception 'Somente administradores podem gerenciar acessos' using errcode='42501'; end if;
  with usuarios as (
    select u.id,u.user_id,u.email,u.nome,u.perfil,u.ativo from public."TB_PERFIL_USUARIO" u
    where u.ativo and (coalesce(u.nome,'') ilike '%'||left(p_busca,100)||'%' or u.email ilike '%'||left(p_busca,100)||'%')
    order by lower(u.email),u.id limit 30 offset greatest(p_offset,0)
  ), recursos as (
    select m recurso from unnest(array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes']) m
    union all select 'painel:'||id from public."TB_PAINEL_EXTERNO" where ativo
  )
  select jsonb_build_object('usuarios',coalesce((select jsonb_agg(to_jsonb(u)||jsonb_build_object('permissoes',
    (select jsonb_object_agg(r.recurso,jsonb_build_object('nivel',coalesce(g.nivel,case when r.recurso like 'painel:%' then 'sem_acesso' else private.nivel_padrao_recurso(u.perfil,r.recurso) end),'revisao',coalesce(g.revisao,0)))
    from recursos r left join public."TB_PERMISSAO_RECURSO" g on g.perfil_usuario_id=u.id and g.recurso=r.recurso))) from usuarios u),'[]'::jsonb),
    'total',(select count(*) from public."TB_PERFIL_USUARIO" u where u.ativo and (coalesce(u.nome,'') ilike '%'||left(p_busca,100)||'%' or u.email ilike '%'||left(p_busca,100)||'%')),
    'paineis',coalesce((select jsonb_agg(jsonb_build_object('id',id,'titulo',titulo) order by ordem,titulo) from public."TB_PAINEL_EXTERNO" where ativo),'[]'::jsonb),
    'historico',coalesce((select jsonb_agg(to_jsonb(h)) from (
      select h.*,u.email,autor.email autor from public."TH_PERMISSAO_RECURSO" h
      left join public."TB_PERFIL_USUARIO" u on u.id=h.perfil_usuario_id
      left join lateral (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id=h.alterado_por order by a.updated_at desc limit 1) autor on true
      order by h.alterado_em desc,h.id desc limit 50) h),'[]'::jsonb)) into resultado;
  return resultado;
end;
$$;

create function public.salvar_matriz_acessos(p_alteracoes jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb; alvo public."TB_PERFIL_USUARIO"; anterior text; revisao_atual integer; recurso_atual text; novo text; quantidade integer:=0;
begin
  if not private.is_master() then raise exception 'Somente administradores podem gerenciar acessos' using errcode='42501'; end if;
  if jsonb_typeof(p_alteracoes) is distinct from 'array' or jsonb_array_length(p_alteracoes) not between 1 and 500 then raise exception 'Alterações inválidas'; end if;
  if length(btrim(coalesce(p_motivo,''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  -- Serializes absent-row inserts as well as updates. Revision checks avoid lost updates.
  perform pg_advisory_xact_lock(73923124153);
  for item in select value from jsonb_array_elements(p_alteracoes) loop
    select * into alvo from public."TB_PERFIL_USUARIO" where id=(item->>'usuario_id')::uuid and ativo for update;
    if alvo.id is null then raise exception 'Usuário ativo não encontrado'; end if;
    if alvo.user_id=(select auth.uid()) or lower(alvo.email)=lower(coalesce((select auth.jwt()->>'email'),'')) then raise exception 'Outro administrador deve alterar seu acesso'; end if;
    recurso_atual:=item->>'recurso'; novo:=item->>'nivel';
    if recurso_atual is null or (recurso_atual not in ('dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes') and not exists(select 1 from public."TB_PAINEL_EXTERNO" where 'painel:'||id=recurso_atual and ativo)) then raise exception 'Recurso inválido'; end if;
    if novo is null or novo not in ('sem_acesso','leitor','editor','admin') then raise exception 'Nível inválido'; end if;
    if recurso_atual='configuracoes' and novo='leitor' then raise exception 'Configurações exige Editor ou Administrador'; end if;
    if recurso_atual like 'painel:%' and novo not in ('sem_acesso','leitor') then raise exception 'Painel externo permite apenas acesso de leitura no portal'; end if;
    select nivel,revisao into anterior,revisao_atual from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id=alvo.id and recurso=recurso_atual;
    if item->>'revisao' is null or coalesce(revisao_atual,0)<>(item->>'revisao')::integer then raise exception 'Permissão alterada por outro administrador. Recarregue a matriz.' using errcode='40001'; end if;
    anterior:=coalesce(anterior,case when recurso_atual like 'painel:%' then 'sem_acesso' else private.nivel_padrao_recurso(alvo.perfil,recurso_atual) end);
    if anterior=novo then continue; end if;
    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id,recurso,nivel,updated_by) values(alvo.id,recurso_atual,novo,(select auth.uid()))
    on conflict(perfil_usuario_id,recurso) do update set nivel=excluded.nivel,revisao="TB_PERMISSAO_RECURSO".revisao+1,updated_at=now(),updated_by=excluded.updated_by;
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id,recurso,nivel_anterior,nivel_novo,alterado_por,motivo)
    values(alvo.id,recurso_atual,anterior,novo,(select auth.uid()),btrim(p_motivo));
    quantidade:=quantidade+1;
  end loop;
  return jsonb_build_object('alteradas',quantidade);
end;
$$;
revoke all on function public.obter_matriz_acessos(text,integer),public.salvar_matriz_acessos(jsonb,text) from public,anon;
grant execute on function public.obter_matriz_acessos(text,integer),public.salvar_matriz_acessos(jsonb,text) to authenticated;

-- Legacy flags remain for existing functions, with resource checks below as
-- restrictive gates. An editor cannot manage accounts through a config grant.
create or replace function private.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path='' as $$
select case p_perm
  when 'ind' then private.pode_recurso('dashboard')
  when 'cores' then private.pode_recurso('nucleo') or private.pode_recurso('calendario')
  when 'paineis' then private.pode_recurso('paineis')
  when 'config' then private.pode_recurso('configuracoes',2)
  when 'admin' then private.is_master()
  else false end;
$$;
create or replace function public.usuario_pode_ler_analises() returns boolean
language sql stable security definer set search_path='' as $$ select private.pode_recurso('analises'); $$;

-- Restrictive policies compose with existing permissive policies: old broad
-- role policies cannot override a resource denial. No direct grant mutation.
create policy recurso_painel on public."TB_PAINEL_EXTERNO" as restrictive for select to authenticated
using ((select private.is_master()) or ((select private.pode_recurso('paineis')) and private.pode_recurso('painel:'||id)));
do $$
declare t text; regra text;
begin
  foreach t in array array['TB_MONITORAMENTO_INDIGENA','TH_MONITORAMENTO'] loop
    execute format('create policy recurso_leitura on public.%I as restrictive for select to authenticated using (private.pode_recurso(''dashboard'') or private.pode_recurso(''nucleo'') or private.pode_recurso(''calendario'') or private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao''))',t);
  end loop;
  foreach t in array array['TB_ANALISE_CURRICULAR','TB_EDITAL_ANALISE','TM_ANALISE_CURRICULAR','TL_SYNC_ANALISE','TB_LISTA_APROVADO','TB_CANDIDATO_APROVADO','TH_CANDIDATO_APROVADO','TB_CONVOCACAO_EDITAL','TB_CATEGORIA_CONVOCACAO','TB_MODELO_CONVOCACAO','TB_VAGA_IMEDIATA'] loop
    regra:=case when t like '%ANALISE%' then 'analises' else 'aprovados' end;
    execute format('create policy recurso_leitura on public.%I as restrictive for select to authenticated using (private.pode_recurso(%L))',t,regra);
  end loop;
end;
$$;
create policy recurso_escrita on public."TB_MONITORAMENTO_INDIGENA" as restrictive for all to authenticated
using (private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))
with check (private.pode_recurso('nucleo',2) or private.pode_recurso('calendario',2));
create policy recurso_exclusao on public."TB_MONITORAMENTO_INDIGENA" as restrictive for delete to authenticated
using (private.pode_recurso('nucleo',3) or private.pode_recurso('calendario',3));

notify pgrst,'reload schema';
-- Preserve deployed business logic (including new statuses and convocations).
-- Only authorization expressions are changed; fail if a named RPC disappears.
do $migration$
declare item record; f record; source text; total integer;
begin
  for item in select * from (values
    ('get_monitoramento_dashboard_payload','(private.pode_recurso(''dashboard'') or private.pode_recurso(''nucleo'') or private.pode_recurso(''calendario'') or private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao''))',''),
    ('remover_lista_aprovados','private.pode_recurso(''importacao'',3)','importacao'),
    ('get_analises_dashboard_contadores','private.pode_recurso(''analises'')',''),
    ('get_analises_dashboard_recorte','private.pode_recurso(''analises'')',''),
    ('get_acessos_config_master','private.is_master()',''),
    ('get_analises_dashboard_payload','private.pode_recurso(''analises'')',''),
    ('salvar_monitoramento_com_cronograma_v2','(private.pode_recurso(''nucleo'',2) or private.pode_recurso(''calendario'',2))',''),
    ('definir_lista_aprovados_ativa','private.pode_recurso(''importacao'',2)','importacao'),
    ('get_configuracoes_snapshot','private.pode_recurso(''configuracoes'')',''),
    ('get_monitoramento_cronograma_historico','(private.pode_recurso(''dashboard'') or private.pode_recurso(''nucleo'') or private.pode_recurso(''calendario'') or private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao''))',''),
    ('incluir_sub_judice','private.pode_recurso(''aprovados'',2)','aprovados'),
    ('get_analises_dashboard_filtrado','private.pode_recurso(''analises'')',''),
    ('get_configuracoes_historico','private.pode_recurso(''configuracoes'')',''),
    ('restaurar_configuracoes_versao','private.pode_recurso(''configuracoes'',2)',''),
    ('get_monitoramento_cronograma_estado','(private.pode_recurso(''dashboard'') or private.pode_recurso(''nucleo'') or private.pode_recurso(''calendario'') or private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao''))',''),
    ('salvar_monitoramento_com_cronograma','(private.pode_recurso(''nucleo'',2) or private.pode_recurso(''calendario'',2))',''),
    ('get_monitoramento_cronograma','(private.pode_recurso(''dashboard'') or private.pode_recurso(''nucleo'') or private.pode_recurso(''calendario'') or private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao''))',''),
    ('get_nucleo_cronograma_resumo','(private.pode_recurso(''dashboard'') or private.pode_recurso(''nucleo'') or private.pode_recurso(''calendario'') or private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao''))',''),
    ('importar_lista_aprovados','private.pode_recurso(''importacao'',2)','importacao'),
    ('listar_listas_aprovados','(private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao'',2))','aprovados'),
    ('remover_sub_judice','private.pode_recurso(''aprovados'',2)','aprovados'),
    ('salvar_configuracoes_e_paineis','private.pode_recurso(''configuracoes'',2)',''),
    ('salvar_configuracoes_e_paineis_v2','private.pode_recurso(''configuracoes'',2)',''),
    ('salvar_monitoramento_indigena','(private.pode_recurso(''nucleo'',2) or private.pode_recurso(''calendario'',2))',''),
    ('get_analises_dashboard_payload_v2','private.pode_recurso(''analises'')',''),
    ('alterar_status_candidato_aprovado','private.pode_recurso(''aprovados'',2)','aprovados'),
    ('listar_candidatos_aprovados','private.pode_recurso(''aprovados'',1)','aprovados'),
    ('listar_modelos_convocacao','(private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao'',2))',''),
    ('salvar_modelo_convocacao','private.pode_recurso(''importacao'',2)','importacao'),
    ('remover_modelo_convocacao','private.pode_recurso(''importacao'',2)','importacao'),
    ('listar_configuracao_convocacao','(private.pode_recurso(''aprovados'') or private.pode_recurso(''importacao'',2))',''),
    ('salvar_configuracao_convocacao','private.pode_recurso(''importacao'',2)','importacao')
  ) rules(name,guard,module_role) loop
    total:=0;
    for f in select p.oid,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
      where n.nspname='public' and p.proname=item.name and p.prokind='f' loop
      total:=total+1;
      source:=pg_get_functiondef(f.oid);
      if item.module_role<>'' then
        source:=replace(source,'private.monitora_role()',format('private.papel_recurso(%L)',item.module_role));
      end if;
      if item.name='listar_listas_aprovados' then
        source:=replace(source,'private.papel_recurso(''aprovados'') = ''''','not ('||item.guard||')');
      end if;
      if item.name like '%convocacao' then
        source:=replace(source,'private.monitora_role_in(array[''edital_gestor'',''contratador'',''admin'']::text[])','private.pode_recurso(''importacao'',2)');
      end if;
      if item.name like 'get_analises_dashboard%' then
        source:=regexp_replace(source,'private\.has_perm\(''paineis''\)[[:space:]]+or private\.has_perm\(''ind''\)[[:space:]]+or private\.has_perm\(''config''\)[[:space:]]+or private\.has_perm\(''admin''\)','private.pode_recurso(''analises'')');
      end if;
      if item.name like 'get_configuracoes%' then source:=replace(source,'private.has_perm(''config'')','private.pode_recurso(''configuracoes'')'); end if;
      if item.name='get_acessos_config_master' then source:=replace(source,'= ''master''','= ''admin'''); end if;
      if f.lanname='plpgsql' then
        if source !~* '\mbegin\M' then raise exception 'RPC % sem bloco begin',item.name; end if;
        source:=regexp_replace(source,'\mbegin\M',E'begin\n  if not ('||item.guard||E') then raise exception ''Sem permissão para este recurso'' using errcode=''42501''; end if;','i');
      elsif item.name='get_analises_dashboard_contadores' then
        source:=replace(source,'from public."VW_ANALISES_DASHBOARD_BASE";','from public."VW_ANALISES_DASHBOARD_BASE" where private.pode_recurso(''analises'');');
      elsif item.name='get_analises_dashboard_recorte' then
        source:=regexp_replace(source,'\mwhere\M','where private.pode_recurso(''analises'') and','i');
      else raise exception 'Linguagem inesperada para RPC %',item.name;
      end if;
      if source=pg_get_functiondef(f.oid) then raise exception 'RPC % não foi atualizada',item.name; end if;
      execute source;
    end loop;
    if total<>1 then raise exception 'Esperada uma assinatura para RPC %, encontradas %',item.name,total; end if;
  end loop;
end;
$migration$;


-- Views must obey the caller's table policies instead of bypassing them.
do $$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v' and (c.relname like 'VW_ANALISES%' or c.relname like 'VW_MONITORAMENTO%')
  loop execute format('alter view public.%I set (security_invoker=true)',v.relname); end loop;
end;
$$;

alter policy cronogramas_editais_insert on storage.objects with check (bucket_id='cronogramas-editais' and (private.pode_recurso('nucleo',2) or private.pode_recurso('calendario',2)));
alter policy cronogramas_editais_update on storage.objects using (bucket_id='cronogramas-editais' and (private.pode_recurso('nucleo',2) or private.pode_recurso('calendario',2))) with check (bucket_id='cronogramas-editais' and (private.pode_recurso('nucleo',2) or private.pode_recurso('calendario',2)));
alter policy cronogramas_editais_delete on storage.objects using (bucket_id='cronogramas-editais' and (private.pode_recurso('nucleo',2) or private.pode_recurso('calendario',2)));
alter policy listas_aprovados_storage_select on storage.objects using (bucket_id='listas-aprovados' and (private.pode_recurso('aprovados') or private.pode_recurso('importacao',2)));
alter policy listas_aprovados_storage_insert on storage.objects with check (bucket_id='listas-aprovados' and private.pode_recurso('importacao',2));
alter policy listas_aprovados_storage_delete_admin on storage.objects using (bucket_id='listas-aprovados' and private.pode_recurso('importacao',3));

revoke all on function public.get_configuracoes_historico(integer) from public,anon;
grant execute on function public.get_configuracoes_historico(integer) to authenticated;

-- All resource-aware RPCs above must remain unavailable to anonymous clients.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) like '%private.pode_recurso(%'
  loop execute format('revoke all on function %s from public,anon',f.assinatura); end loop;
end;
$$;
notify pgrst,'reload schema';

grant execute on function public.salvar_configuracao_convocacao(text,boolean,uuid,integer,jsonb) to authenticated;
grant execute on function public.listar_candidatos_aprovados() to authenticated;
grant execute on function public.listar_modelos_convocacao() to authenticated;
grant execute on function public.salvar_modelo_convocacao(jsonb) to authenticated;
grant execute on function public.remover_modelo_convocacao(uuid) to authenticated;
grant execute on function public.listar_configuracao_convocacao() to authenticated;
grant execute on function public.alterar_status_candidato_aprovado(uuid,text,text,text) to authenticated;
grant execute on function public.usuario_pode_ler_analises() to authenticated;
grant execute on function public.get_monitoramento_dashboard_payload() to authenticated;
grant execute on function public.remover_lista_aprovados(uuid) to authenticated;
grant execute on function public.get_acessos_config_master(integer,integer,integer) to authenticated;
grant execute on function public.salvar_monitoramento_com_cronograma_v2(jsonb,jsonb,text,text) to authenticated;
grant execute on function public.definir_lista_aprovados_ativa(uuid,boolean) to authenticated;
grant execute on function public.get_configuracoes_snapshot() to authenticated;
grant execute on function public.get_monitoramento_cronograma_historico(uuid,integer) to authenticated;
grant execute on function public.incluir_sub_judice(text,text,text,numeric) to authenticated;
grant execute on function public.get_analises_dashboard_filtrado(text,text[],text[],integer,integer,boolean) to authenticated;
grant execute on function public.restaurar_configuracoes_versao(uuid,text) to authenticated;
grant execute on function public.get_configuracoes_historico(integer) to authenticated;
grant execute on function public.get_monitoramento_cronograma_estado(uuid,date) to authenticated;
grant execute on function public.salvar_monitoramento_com_cronograma(jsonb,jsonb) to authenticated;
grant execute on function public.get_monitoramento_cronograma(uuid) to authenticated;
grant execute on function public.get_nucleo_cronograma_resumo() to authenticated;
grant execute on function public.obter_contexto_monitora() to authenticated;
grant execute on function public.listar_listas_aprovados() to authenticated;
grant execute on function public.importar_lista_aprovados(text,boolean,text,text,jsonb,boolean) to authenticated;
grant execute on function public.remover_sub_judice(uuid) to authenticated;
grant execute on function public.salvar_configuracoes_e_paineis(jsonb,jsonb) to authenticated;
grant execute on function public.salvar_configuracoes_e_paineis_v2(jsonb,jsonb,text) to authenticated;
grant execute on function public.salvar_monitoramento_indigena(jsonb) to authenticated;
grant execute on function public.get_analises_dashboard_payload_v2(text) to authenticated;

