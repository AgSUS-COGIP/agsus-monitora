/*
  Rollback de 20261021140000_solicitacao_de_acesso_por_area.sql: volta as
  RPCs do pedido de acesso às definições anteriores (registrar com 4
  argumentos, recusar com observação livre, listar_coordenacoes_ativas) e
  tira as colunas novas. Área, cargo e motivo da recusa dos pedidos feitos
  depois da migration se perdem (a lotação fica em setor e a justificativa e
  o texto da recusa em observacao_admin continuam).
*/
begin;

drop function if exists public.listar_opcoes_da_solicitacao_acesso();
drop function if exists public.cancelar_minha_solicitacao_acesso();
drop function if exists public.registrar_solicitacao_acesso(text, text, text, text, text, text, text);
drop function if exists public.recusar_solicitacao_acesso(uuid, text, text);

CREATE OR REPLACE FUNCTION public.listar_coordenacoes_ativas()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('codigo', c."CO_COORDENACAO", 'nome', c."NO_COORDENACAO",
                                               'area', c."CO_AREA", 'area_nome', a."NO_AREA")
                            order by a."NU_ORDEM", c."NO_COORDENACAO"), '[]'::jsonb)
    from public."TB_COORDENACAO" c
    join public."TB_AREA" a on a."CO_AREA" = c."CO_AREA"
   where c."ST_ATIVO" and (select auth.uid()) is not null;
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.obter_minha_solicitacao_acesso()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object('id', s.id, 'status', s.status, 'nome', s.nome, 'setor', s.setor,
                            'justificativa', s.justificativa, 'created_at', s.created_at, 'avaliado_em', s.avaliado_em,
                            'observacao_admin', s.observacao_admin, 'coordenacao', s."CO_COORDENACAO",
                            'coordenacao_nome', c."NO_COORDENACAO")
    from public."TB_SOLICITACAO_ACESSO" s
    left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
   where s.user_id = (select auth.uid())
      or lower(s.email) = lower(coalesce((select auth.jwt() ->> 'email'), '-'))
   order by s.created_at desc
   limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.recusar_solicitacao_acesso(p_solicitacao_id uuid, p_observacao_admin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_req public."TB_SOLICITACAO_ACESSO";
begin
  select * into v_req from public."TB_SOLICITACAO_ACESSO" where id = p_solicitacao_id for update;
  if v_req.id is null then raise exception 'Solicitação de acesso não encontrada'; end if;
  if v_req.status <> 'pendente' then raise exception 'Solicitação já avaliada (status atual: %)', v_req.status; end if;
  if v_gestor = 'coordenador' and v_req."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
    raise exception 'Solicitação de outra coordenação' using errcode = '42501';
  end if;
  update public."TB_SOLICITACAO_ACESSO"
     set status = 'recusado', avaliado_por = (select auth.uid()), avaliado_em = now(),
         observacao_admin = nullif(btrim(p_observacao_admin), ''), updated_at = now()
   where id = p_solicitacao_id;
  return jsonb_build_object('ok', true, 'solicitacao_id', v_req.id, 'email', v_req.email, 'status', 'recusado');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_setor text DEFAULT NULL::text, p_justificativa text DEFAULT NULL::text, p_coordenacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_id uuid;
begin
  if v_uid is null or v_email = '' then raise exception 'Usuário não autenticado' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_nome, ''))) not between 2 and 120 then raise exception 'Informe seu nome'; end if;
  if length(coalesce(p_setor, '')) > 200 or length(coalesce(p_justificativa, '')) > 2000 then raise exception 'Texto muito longo'; end if;
  if v_coordenacao is not null and not exists (select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = v_coordenacao and c."ST_ATIVO") then
    raise exception 'Coordenação inválida';
  end if;
  if exists (select 1 from public."TB_SOLICITACAO_ACESSO" s where s.user_id = v_uid and s.status = 'pendente') then
    raise exception 'Você já tem uma solicitação pendente';
  end if;
  insert into public."TB_SOLICITACAO_ACESSO" (user_id, email, nome, setor, justificativa, perfil_solicitado, status, "CO_COORDENACAO")
  values (v_uid, v_email, btrim(p_nome), nullif(btrim(coalesce(p_setor, '')), ''), nullif(btrim(coalesce(p_justificativa, '')), ''),
          'usuario', 'pendente', v_coordenacao)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente');
end;
$function$
;

revoke all on function public.registrar_solicitacao_acesso(text, text, text, text) from public, anon;
grant execute on function public.registrar_solicitacao_acesso(text, text, text, text) to authenticated;
revoke all on function public.recusar_solicitacao_acesso(uuid, text) from public, anon;
grant execute on function public.recusar_solicitacao_acesso(uuid, text) to authenticated;
revoke all on function public.listar_coordenacoes_ativas() from public, anon;
grant execute on function public.listar_coordenacoes_ativas() to authenticated;
comment on function public.obter_minha_solicitacao_acesso() is null;
comment on function public.listar_solicitacoes_acesso(text) is null;

drop function if exists private."FC_CARGO_SOLICITACAO_ACESSO"(text, text);
drop function if exists private."FC_MOTIVO_RECUSA_SOLICITACAO"(text);

alter table public."TB_SOLICITACAO_ACESSO"
  drop constraint if exists "CK_SOLICACESSO_MOTIVORECUSA",
  drop constraint if exists "CK_SOLICACESSO_CARGOOUTRO",
  drop constraint if exists "CK_SOLICACESSO_CARGO",
  drop constraint if exists "FK_AREA_SOLICACESSO";
drop index if exists public."IN_FKSOLICACESSO_COAREA";
alter table public."TB_SOLICITACAO_ACESSO"
  drop column if exists "CO_MOTIVO_RECUSA",
  drop column if exists "DS_CARGO_OUTRO",
  drop column if exists "CO_CARGO_SOLICITADO",
  drop column if exists "CO_AREA";
comment on table public."TB_SOLICITACAO_ACESSO" is null;
comment on column public."TB_SOLICITACAO_ACESSO".setor is null;

commit;
