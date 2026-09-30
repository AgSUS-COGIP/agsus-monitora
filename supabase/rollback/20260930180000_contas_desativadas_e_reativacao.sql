-- Desfaz contas desativadas/reativação: volta desativar e listar_solicitacoes, tira as RPCs novas.
begin;

drop function if exists public.reativar_acesso_usuario(uuid, text, text, text[], text);
drop function if exists public.listar_contas_desativadas(text);

CREATE OR REPLACE FUNCTION public.desativar_acesso_usuario(p_perfil_usuario_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  v_email text;
  v_nome text;
  v_paineis integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode desativar acesso';
  end if;

  if p_perfil_usuario_id is null then
    raise exception 'Perfil de usuario nao informado';
  end if;

  update public."TB_PERFIL_USUARIO"
  set ativo = false,
      p_ind = false,
      p_cores = false,
      p_paineis = false,
      p_config = false,
      p_admin = false,
      updated_at = now()
  where id = p_perfil_usuario_id
    and coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  returning email, nome into v_email, v_nome;

  if not found then
    raise exception 'Perfil de usuario nao encontrado ou tentativa de auto-desativacao';
  end if;

  update public."RL_PERFIL_USUARIO_PAINEL_EXT"
  set ativo = false,
      updated_at = now()
  where perfil_usuario_id = p_perfil_usuario_id
    and ativo is true;
  get diagnostics v_paineis = row_count;

  return jsonb_build_object('ok', true, 'perfil_usuario_id', p_perfil_usuario_id, 'email', v_email, 'nome', v_nome, 'paineis_revogados', v_paineis, 'motivo', nullif(btrim(p_motivo), ''));
end;
$function$;

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
      'coordenacao_nome', c."NO_COORDENACAO", 'area', c."CO_AREA"
    ) order by s.created_at)
      from public."TB_SOLICITACAO_ACESSO" s
      left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
     where s.status = coalesce(nullif(btrim(p_status), ''), 'pendente')
       and (v_gestor = 'admin' or s."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"())
     limit 200), '[]'::jsonb);
end;
$function$;

commit;
