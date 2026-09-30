/*
  Contas desativadas: histórico, lista, reativação e pedido de reativação.

  Desativar escondia a conta de vez: sumia de Acessos, não havia como
  reativar e o motivo (p_motivo) era descartado, sem registro de quem fez.
  1. desativar_acesso_usuario grava o histórico (#conta: ativa -> desativada,
     motivo, autor) e exige motivo. Continua só para o administrador global.
  2. listar_contas_desativadas(p_busca): a aba "Desativadas" (admin global) —
     quando, por quem, motivo, grupo e áreas de antes, e se há pedido de
     reativação pendente.
  3. reativar_acesso_usuario(p_perfil_usuario_id, p_grupo, p_coordenacao,
     p_areas, p_motivo): reativa com grupo, coordenação e áreas escolhidos
     (mesmas regras da matriz: não-admin precisa de área ou coordenação; quem
     gerencia acessos precisa de coordenação) e grava o histórico.
  4. listar_solicitacoes_acesso marca o pedido de quem tem conta desativada
     como reativação ('reativacao', 'desativada_em', 'desativada_por',
     'motivo_desativacao', 'grupo_anterior'). Aprovar já reativava a conta.

  Rollback: supabase/rollback/20260930180000_contas_desativadas_e_reativacao.sql
*/
begin;

create or replace function public.desativar_acesso_usuario(p_perfil_usuario_id uuid, p_motivo text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'auth'
as $function$
declare
  v_email text;
  v_nome text;
  v_paineis integer := 0;
begin
  if auth.uid() is null then raise exception 'Usuario nao autenticado'; end if;
  if not private.is_master() then raise exception 'Somente perfil master pode desativar acesso'; end if;
  if p_perfil_usuario_id is null then raise exception 'Perfil de usuario nao informado'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe o motivo da desativação (3 a 500 caracteres)' using errcode = '22023';
  end if;

  update public."TB_PERFIL_USUARIO"
     set ativo = false, p_ind = false, p_cores = false, p_paineis = false,
         p_config = false, p_admin = false, updated_at = now()
   where id = p_perfil_usuario_id
     and ativo
     and coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  returning email, nome into v_email, v_nome;
  if not found then
    raise exception 'Perfil de usuario nao encontrado, ja desativado ou tentativa de auto-desativacao';
  end if;

  update public."RL_PERFIL_USUARIO_PAINEL_EXT"
     set ativo = false, updated_at = now()
   where perfil_usuario_id = p_perfil_usuario_id and ativo is true;
  get diagnostics v_paineis = row_count;

  insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
  values (p_perfil_usuario_id, '#conta', 'ativa', 'desativada', auth.uid(), btrim(p_motivo));

  return jsonb_build_object('ok', true, 'perfil_usuario_id', p_perfil_usuario_id, 'email', v_email,
    'nome', v_nome, 'paineis_revogados', v_paineis, 'motivo', btrim(p_motivo));
end;
$function$;
revoke all on function public.desativar_acesso_usuario(uuid, text) from public, anon;
grant execute on function public.desativar_acesso_usuario(uuid, text) to authenticated;

create function public.listar_contas_desativadas(p_busca text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_busca text := left(coalesce(p_busca, ''), 100);
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê as contas desativadas' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'contas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', u.id, 'email', u.email, 'nome', u.nome,
          'grupo', u.perfil,
          'grupo_nome', (select g."NO_GRUPO_ACESSO" from public."TB_GRUPO_ACESSO" g where g."CO_GRUPO_ACESSO" = u.perfil),
          'coordenacao', u."CO_COORDENACAO",
          'areas', coalesce((select jsonb_agg(r."CO_AREA" order by r."CO_AREA")
                               from public."RL_PERFIL_USUARIO_AREA" r where r."CO_PERFIL_USUARIO" = u.id), '[]'::jsonb),
          'desativada_em', coalesce(h.alterado_em, u.updated_at),
          'desativada_por', h.autor,
          'motivo', h.motivo,
          'pedido_pendente', exists (
            select 1 from public."TB_SOLICITACAO_ACESSO" s
             where s.status = 'pendente'
               and ((u.user_id is not null and s.user_id = u.user_id) or lower(s.email) = lower(u.email))),
          'ultimo_acesso', (select max(au.last_sign_in_at) from auth.users au
                             where au.id = u.user_id or lower(au.email) = lower(u.email))
        ) order by coalesce(h.alterado_em, u.updated_at) desc)
        from public."TB_PERFIL_USUARIO" u
        left join lateral (
          select t.alterado_em, t.motivo,
                 (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id = t.alterado_por limit 1) autor
            from public."TH_PERMISSAO_RECURSO" t
           where t.perfil_usuario_id = u.id and t.recurso = '#conta'
           order by t.alterado_em desc limit 1) h on true
       where not u.ativo
         and (coalesce(u.nome, '') ilike '%' || v_busca || '%' or u.email ilike '%' || v_busca || '%')
    ), '[]'::jsonb)
  );
end;
$function$;
comment on function public.listar_contas_desativadas(text) is
  'Aba Desativadas de Acessos (só administrador global): quando, por quem e por que cada conta foi desativada, grupo/coordenação/áreas de antes e se há pedido de reativação pendente.';
revoke all on function public.listar_contas_desativadas(text) from public, anon;
grant execute on function public.listar_contas_desativadas(text) to authenticated, service_role;

create function public.reativar_acesso_usuario(
  p_perfil_usuario_id uuid,
  p_grupo text,
  p_coordenacao text,
  p_areas text[],
  p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_alvo public."TB_PERFIL_USUARIO";
  v_admin boolean;
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_areas text[];
  v_nivel_acessos text;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global reativa contas' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe o motivo da reativação (3 a 500 caracteres)' using errcode = '22023';
  end if;
  select * into v_alvo from public."TB_PERFIL_USUARIO" where id = p_perfil_usuario_id for update;
  if v_alvo.id is null then raise exception 'Conta não encontrada' using errcode = '22023'; end if;
  if v_alvo.ativo then raise exception 'Esta conta já está ativa' using errcode = '22023'; end if;
  if not exists (select 1 from public."TB_GRUPO_ACESSO" g where g."CO_GRUPO_ACESSO" = p_grupo) then
    raise exception 'Grupo inválido: %', p_grupo using errcode = '22023';
  end if;
  v_admin := exists (select 1 from public."TB_GRUPO_ACESSO" g where g."CO_GRUPO_ACESSO" = p_grupo and g."ST_ADMIN_GLOBAL");

  if v_admin then
    v_coordenacao := null;
    v_areas := '{}';
  else
    if v_coordenacao is not null and not exists (
         select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = v_coordenacao and c."ST_ATIVO") then
      raise exception 'Coordenação inválida ou desativada' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct a."CO_AREA"), '{}') into v_areas
      from public."TB_AREA" a where a."CO_AREA" = any (coalesce(p_areas, '{}'));
    if v_coordenacao is null and cardinality(v_areas) = 0 then
      raise exception 'Sem coordenação, escolha ao menos uma área' using errcode = '23514';
    end if;
    v_nivel_acessos := private."FC_NIVEL_EFETIVO"(v_alvo.id, p_grupo, 'acessos');
    if v_coordenacao is null
       and private."FC_RANK_NIVEL"(v_nivel_acessos) >= private."FC_RANK_NIVEL"('editor') then
      raise exception 'O grupo % gerencia acessos: escolha a coordenação da pessoa', p_grupo using errcode = '23514';
    end if;
  end if;

  update public."TB_PERFIL_USUARIO"
     set ativo = true, perfil = p_grupo, "CO_COORDENACAO" = v_coordenacao,
         p_ind = true, p_cores = true, p_paineis = true, p_config = v_admin, p_admin = v_admin,
         updated_at = now()
   where id = v_alvo.id;

  delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO" = v_alvo.id;
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select v_alvo.id, x from unnest(v_areas) x;

  insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
  values (v_alvo.id, '#conta', 'desativada', 'ativa', (select auth.uid()), btrim(p_motivo));
  if v_alvo.perfil is distinct from p_grupo then
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    values (v_alvo.id, '#grupo', v_alvo.perfil, p_grupo, (select auth.uid()), btrim(p_motivo));
  end if;

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_alvo.id, 'email', v_alvo.email,
    'grupo', p_grupo, 'coordenacao', v_coordenacao, 'areas', to_jsonb(v_areas));
end;
$function$;
comment on function public.reativar_acesso_usuario(uuid, text, text, text[], text) is
  'Reativa uma conta desativada com grupo, coordenação e áreas escolhidos (regras da matriz de acessos) e grava o histórico. Só administrador global.';
revoke all on function public.reativar_acesso_usuario(uuid, text, text, text[], text) from public, anon;
grant execute on function public.reativar_acesso_usuario(uuid, text, text, text[], text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listar_solicitacoes_acesso(p_status text DEFAULT 'pendente'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'user_id', s.user_id, 'email', s.email, 'nome', s.nome, 'setor', s.setor,
      'justificativa', s.justificativa, 'status', s.status, 'created_at', s.created_at,
      'observacao_admin', s.observacao_admin, 'coordenacao', s."CO_COORDENACAO",
      'coordenacao_nome', c."NO_COORDENACAO", 'area', c."CO_AREA",
      'reativacao', p.id is not null,
      'desativada_em', h.alterado_em,
      'desativada_por', h.autor,
      'motivo_desativacao', h.motivo,
      'grupo_anterior', p.perfil
    ) order by s.created_at)
      from public."TB_SOLICITACAO_ACESSO" s
      left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
      -- Pedido de quem tem conta desativada = pedido de reativação (com o histórico).
      left join lateral (
        select u.id, u.perfil from public."TB_PERFIL_USUARIO" u
         where not u.ativo
           and ((s.user_id is not null and u.user_id = s.user_id) or lower(u.email) = lower(s.email))
         order by u.updated_at desc limit 1) p on true
      left join lateral (
        select t.alterado_em, t.motivo,
               (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id = t.alterado_por limit 1) autor
          from public."TH_PERMISSAO_RECURSO" t
         where p.id is not null and t.perfil_usuario_id = p.id and t.recurso = '#conta'
         order by t.alterado_em desc limit 1) h on true
     where s.status = coalesce(nullif(btrim(p_status), ''), 'pendente')
       and (v_gestor = 'admin' or s."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"())
     limit 200), '[]'::jsonb);
end;
$function$;

commit;
