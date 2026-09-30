/*
  A tela de pedido sabe, pelo banco, que a conta está desativada.

  A tela de acesso adivinhava "conta desativada" (pedido antigo aprovado sem
  perfil ativo, ou uma marca no navegador). Depois do primeiro pedido de
  reativação a pista sumia e a tela virava um "Pedido enviado" comum (30/09).
  public.minha_conta_desativada(): true quando quem está logado tem perfil
  (pelo user_id ou pelo e-mail) e nenhum perfil ativo. Não expõe nada além
  disso.
  E reativar_acesso_usuario passa a resolver (aprovado) o pedido pendente da
  pessoa: em 30/09 uma conta reativada pela aba Desativadas ficou com um
  pedido pendente esquecido.

  Rollback: supabase/rollback/20260930190000_minha_conta_desativada.sql
*/
begin;

create function public.minha_conta_desativada()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
           select 1 from public."TB_PERFIL_USUARIO" u
            where not u.ativo
              and (u.user_id = (select auth.uid())
                   or lower(u.email) = lower(coalesce((select auth.jwt() ->> 'email'), '-'))))
     and not exists (
           select 1 from public."TB_PERFIL_USUARIO" u
            where u.ativo
              and (u.user_id = (select auth.uid())
                   or lower(u.email) = lower(coalesce((select auth.jwt() ->> 'email'), '-'))));
$function$;
comment on function public.minha_conta_desativada() is
  'true quando quem está logado tem conta no MONITORA e ela está desativada (nenhum perfil ativo). Usada pela tela de pedido de acesso.';
revoke all on function public.minha_conta_desativada() from public, anon;
grant execute on function public.minha_conta_desativada() to authenticated, service_role;

create or replace function public.reativar_acesso_usuario(
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

  -- Pedido pendente da pessoa (reativação ou comum) fica resolvido junto.
  update public."TB_SOLICITACAO_ACESSO" s
     set status = 'aprovado', avaliado_por = (select auth.uid()), avaliado_em = now(),
         observacao_admin = coalesce(nullif(btrim(s.observacao_admin), ''), 'Conta reativada pela aba Desativadas: ' || btrim(p_motivo)),
         updated_at = now()
   where s.status = 'pendente'
     and ((v_alvo.user_id is not null and s.user_id = v_alvo.user_id) or lower(s.email) = lower(v_alvo.email));

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_alvo.id, 'email', v_alvo.email,
    'grupo', p_grupo, 'coordenacao', v_coordenacao, 'areas', to_jsonb(v_areas));
end;
$function$;;

commit;
