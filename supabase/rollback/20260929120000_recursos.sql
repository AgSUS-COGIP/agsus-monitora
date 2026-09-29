-- Desfaz 20260929120000_recursos.sql.
-- Apaga a aba Recursos (catálogo, tabelas, RPCs e funções auxiliares), tira o
-- recurso de permissão 'recursos' (linhas explícitas de TB_PERMISSAO_RECURSO
-- saem; o histórico TH_PERMISSAO_RECURSO fica) e devolve as quatro funções de
-- permissão às definições de antes (copiadas de produção em 29/09/2026).
-- ATENÇÃO: apaga os recursos cadastrados. Para guardar, copie antes
-- TB_RECURSO_CANDIDATO e TH_RECURSO_CANDIDATO para o schema arquivo.
begin;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'recursos';
delete from public."TB_ABA" where "CO_ABA" = 'recursos';

drop function if exists public.get_recursos_da_area(text);
drop function if exists public.get_recurso_candidato_detalhe(uuid);
drop function if exists public.buscar_candidatos_recurso(uuid, text);
drop function if exists public.salvar_recurso_candidato(jsonb);
drop function if exists public.marcar_etapa_recurso(uuid, text, boolean);
drop function if exists public.excluir_recurso_candidato(uuid, text);
drop function if exists private."FC_EXIGIR_RECURSOS_NA_AREA"(text, integer);
drop function if exists private."FC_TEXTO_BUSCA_RECURSO"(text);
drop function if exists private."FC_NOME_USUARIO"(uuid);

drop table if exists public."TH_RECURSO_CANDIDATO";
drop table if exists public."TB_RECURSO_CANDIDATO";
drop table if exists public."TB_ORIGEM_RECURSO";

delete from public."TB_PERMISSAO_RECURSO" where recurso = 'recursos';
alter table public."TB_PERMISSAO_RECURSO" drop constraint "TB_PERMISSAO_RECURSO_recurso_check";
alter table public."TB_PERMISSAO_RECURSO" add constraint "TB_PERMISSAO_RECURSO_recurso_check"
  check (recurso in ('dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes') or recurso ~ '^painel:[0-9a-f-]{36}$');

CREATE OR REPLACE FUNCTION private.nivel_padrao_recurso(p_perfil text, p_recurso text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.obter_matriz_acessos(p_busca text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    union all select 'area:'||a."CO_AREA" from public."TB_AREA" a
  )
  select jsonb_build_object('usuarios',coalesce((select jsonb_agg(to_jsonb(u)||jsonb_build_object('permissoes',
    (select jsonb_object_agg(r.recurso,jsonb_build_object('nivel',case when r.recurso like 'area:%' then case when exists(select 1 from public."RL_PERFIL_USUARIO_AREA" x where x."CO_PERFIL_USUARIO"=u.id and 'area:'||x."CO_AREA"=r.recurso) then 'leitor' else 'sem_acesso' end else coalesce(g.nivel,case when r.recurso like 'painel:%' then 'sem_acesso' else private.nivel_padrao_recurso(u.perfil,r.recurso) end) end,'revisao',coalesce(g.revisao,0)))
    from recursos r left join public."TB_PERMISSAO_RECURSO" g on g.perfil_usuario_id=u.id and g.recurso=r.recurso))) from usuarios u),'[]'::jsonb),
    'total',(select count(*) from public."TB_PERFIL_USUARIO" u where u.ativo and (coalesce(u.nome,'') ilike '%'||left(p_busca,100)||'%' or u.email ilike '%'||left(p_busca,100)||'%')),
    'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a."CO_AREA",'titulo',a."NO_AREA") order by a."NU_ORDEM") from public."TB_AREA" a),'[]'::jsonb),
    'paineis',coalesce((select jsonb_agg(jsonb_build_object('id',id,'titulo',titulo) order by ordem,titulo) from public."TB_PAINEL_EXTERNO" where ativo),'[]'::jsonb),
    'historico',coalesce((select jsonb_agg(to_jsonb(h)) from (
      select h.*,u.email,autor.email autor from public."TH_PERMISSAO_RECURSO" h
      left join public."TB_PERFIL_USUARIO" u on u.id=h.perfil_usuario_id
      left join lateral (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id=h.alterado_por order by a.updated_at desc limit 1) autor on true
      order by h.alterado_em desc,h.id desc limit 50) h),'[]'::jsonb)) into resultado;
  return resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_matriz_acessos(p_alteracoes jsonb, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    if recurso_atual like 'area:%' then
      if not exists(select 1 from public."TB_AREA" a where 'area:'||a."CO_AREA"=recurso_atual) then raise exception 'Área inválida'; end if;
      if novo is null or novo not in ('sem_acesso','leitor') then raise exception 'Área aceita apenas Sim ou Não'; end if;
      if lower(coalesce(alvo.perfil,''))='admin' then raise exception 'Administrador já vê todas as áreas'; end if;
      anterior:=case when exists(select 1 from public."RL_PERFIL_USUARIO_AREA" x where x."CO_PERFIL_USUARIO"=alvo.id and 'area:'||x."CO_AREA"=recurso_atual) then 'leitor' else 'sem_acesso' end;
      if anterior=novo then continue; end if;
      if novo='leitor' then
        insert into public."RL_PERFIL_USUARIO_AREA"("CO_PERFIL_USUARIO","CO_AREA") values(alvo.id,substr(recurso_atual,6));
      else
        delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO"=alvo.id and "CO_AREA"=substr(recurso_atual,6);
      end if;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id,recurso,nivel_anterior,nivel_novo,alterado_por,motivo)
      values(alvo.id,recurso_atual,anterior,novo,(select auth.uid()),btrim(p_motivo));
      quantidade:=quantidade+1;
      continue;
    end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.obter_contexto_monitora()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select jsonb_build_object('profile',to_jsonb(p)||jsonb_build_object('permissoes',
  (select jsonb_object_agg(m,private.nivel_recurso(m)) from unnest(array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes']) m),
  'areas', to_jsonb(private."FC_AREAS_USUARIO"())),
  'panel_ids',coalesce((select jsonb_agg(e.id::text) from public."TB_PAINEL_EXTERNO" e
    where e.ativo and private.pode_recurso('paineis') and private.pode_recurso('painel:'||e.id)),'[]'::jsonb))
from private.current_profile() p where p.id is not null and p.ativo;
$function$;

commit;
