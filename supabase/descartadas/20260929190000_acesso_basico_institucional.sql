/*
  ACESSO BÁSICO PARA CONTA INSTITUCIONAL + SETOR INFORMADO (permissões, parte 5)

  1. Quem entra com e-mail @agenciasus.org.br e ainda não tem perfil recebe o
     acesso básico sem pedir: grupo "usuario" (leitor), área Saúde Indígena
     (o padrão de todo não-admin desde 25/09) e leitura dos painéis ativos. O
     front chama public.garantir_acesso_basico() quando obter_contexto_monitora
     não acha perfil.
     Conta DESATIVADA não volta sozinha: se existe perfil (ativo ou não), nada
     muda. Pedido pendente da mesma pessoa é marcado como aprovado.

  2. obter_matriz_acessos passa a trazer, por pessoa, o setor que ela escreveu
     no último pedido de acesso (`setor`): é a única pista do banco sobre a
     coordenação de quem já tem acesso, e ajuda o admin a vincular.

  ROLLBACK
    begin;
    drop function public.garantir_acesso_basico();
    -- reaplicar obter_matriz_acessos de 20260929121300;
    commit;
*/
begin;

create function public.garantir_acesso_basico()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_meta jsonb := coalesce((select auth.jwt() -> 'user_metadata'), '{}'::jsonb);
  v_nome text;
  v_id uuid;
begin
  if v_uid is null or v_email = '' then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;
  if split_part(v_email, '@', 2) <> 'agenciasus.org.br' then
    return jsonb_build_object('criado', false, 'motivo', 'dominio');
  end if;
  -- Existe perfil (mesmo desativado): nada a fazer. Desativado continua desativado.
  if exists (
    select 1 from public."TB_PERFIL_USUARIO" p
     where p.user_id = v_uid or lower(p.email) = v_email
  ) then
    return jsonb_build_object('criado', false, 'motivo', 'existente');
  end if;

  v_nome := coalesce(nullif(btrim(v_meta ->> 'full_name'), ''), nullif(btrim(v_meta ->> 'name'), ''), split_part(v_email, '@', 1));
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo, p_ind, p_cores, p_paineis, p_config, p_admin)
  values (v_uid, v_email, v_nome, 'usuario', true, true, true, true, false, false)
  returning id into v_id;

  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA") values (v_id, 'saude-indigena');

  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select v_id, 'painel:' || e.id, 'leitor', v_uid from public."TB_PAINEL_EXTERNO" e where e.ativo
  on conflict (perfil_usuario_id, recurso) do nothing;

  update public."TB_SOLICITACAO_ACESSO"
     set status = 'aprovado', avaliado_em = now(), updated_at = now(),
         observacao_admin = 'Acesso básico automático (conta institucional).'
   where user_id = v_uid and status = 'pendente';

  insert into public."TH_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
  values (v_id, '#grupo', '(nenhum)', 'usuario', v_uid, 'Acesso básico automático (conta institucional)');

  return jsonb_build_object('criado', true, 'perfil_usuario_id', v_id);
end;
$$;
comment on function public.garantir_acesso_basico() is
  'Cria o acesso básico (grupo usuario, Saúde Indígena, painéis em leitura) para conta @agenciasus.org.br sem perfil. Não reativa perfil desativado.';
revoke all on function public.garantir_acesso_basico() from public, anon;
grant execute on function public.garantir_acesso_basico() to authenticated;

-- obter_matriz_acessos: corpo de 20260929121300 + setor informado no último pedido.
create or replace function public.obter_matriz_acessos(p_busca text default '', p_offset integer default 0, p_coordenacao text default '', p_grupo text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_busca text := left(coalesce(p_busca, ''), 100);
  v_filtro text := coalesce(p_coordenacao, '');
  v_eu public."TB_PERFIL_USUARIO" := private.current_profile();
  resultado jsonb;
begin
  -- Coordenador vê só a própria coordenação, qualquer que seja o filtro pedido.
  if v_gestor = 'coordenador' then v_filtro := private."FC_COORDENACAO_USUARIO"(); end if;

  with filtrados as (
    select u.* from public."TB_PERFIL_USUARIO" u
     where u.ativo
       and (coalesce(u.nome, '') ilike '%' || v_busca || '%' or u.email ilike '%' || v_busca || '%')
       and (v_filtro = '' or (v_filtro = '__sem__' and u."CO_COORDENACAO" is null) or u."CO_COORDENACAO" = v_filtro)
       and (coalesce(p_grupo, '') = '' or u.perfil = p_grupo)
  ), usuarios as (
    select f.* from filtrados f order by lower(f.email), f.id limit 30 offset greatest(p_offset, 0)
  ), recursos as (
    select m recurso from unnest(private."FC_RECURSOS_MODULO"()) m
    union all select 'painel:' || id from public."TB_PAINEL_EXTERNO" where ativo
    union all select 'area:' || a."CO_AREA" from public."TB_AREA" a
  )
  select jsonb_build_object(
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object(
        'id', u.id, 'user_id', u.user_id, 'email', u.email, 'nome', u.nome, 'grupo', u.perfil, 'ativo', u.ativo,
        'coordenacao', u."CO_COORDENACAO",
        'setor', (select nullif(btrim(s.setor), '') from public."TB_SOLICITACAO_ACESSO" s
                   where s.user_id = u.user_id or lower(s.email) = lower(u.email)
                   order by s.created_at desc limit 1),
        'revisao_conta', u.updated_at::text,
        'admin_global', coalesce((select a."ST_ADMIN_GLOBAL" from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = u.perfil), false),
        'areas_efetivas', to_jsonb(private."FC_AREAS_DO_PERFIL"(u.id)),
        'permissoes', (select jsonb_object_agg(r.recurso,
            case when r.recurso like 'area:%' then jsonb_build_object(
                'nivel', case when exists (select 1 from public."RL_PERFIL_USUARIO_AREA" x
                                            where x."CO_PERFIL_USUARIO" = u.id and 'area:' || x."CO_AREA" = r.recurso)
                              then 'leitor' else 'sem_acesso' end,
                'origem', 'excecao', 'nivel_grupo', 'sem_acesso', 'revisao', 0)
            else jsonb_build_object(
                'nivel', coalesce(g.nivel, private."FC_NIVEL_DO_GRUPO"(u.perfil, r.recurso)),
                'origem', case when g.nivel is null then 'grupo' else 'excecao' end,
                'nivel_grupo', private."FC_NIVEL_DO_GRUPO"(u.perfil, r.recurso),
                'revisao', coalesce(g.revisao, 0))
            end)
          from recursos r
          left join public."TB_PERMISSAO_RECURSO" g on g.perfil_usuario_id = u.id and g.recurso = r.recurso)
      ) order by lower(u.email), u.id) from usuarios u), '[]'::jsonb),
    'total', (select count(*) from filtrados),
    'areas', coalesce((select jsonb_agg(jsonb_build_object('id', a."CO_AREA", 'titulo', a."NO_AREA") order by a."NU_ORDEM") from public."TB_AREA" a), '[]'::jsonb),
    'paineis', coalesce((select jsonb_agg(to_jsonb(e) order by e.ordem, e.titulo) from public."TB_PAINEL_EXTERNO" e where e.ativo), '[]'::jsonb),
    'grupos', coalesce((select jsonb_agg(private."FC_GRUPO_ACESSO_JSON"(a."CO_GRUPO_ACESSO") order by a."NU_ORDEM", a."NO_GRUPO_ACESSO")
                          from public."TB_GRUPO_ACESSO" a), '[]'::jsonb),
    'coordenacoes', coalesce((select jsonb_agg(private."FC_COORDENACAO_JSON"(c."CO_COORDENACAO") order by c."NO_COORDENACAO")
                                from public."TB_COORDENACAO" c
                               where v_gestor = 'admin' or c."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"()), '[]'::jsonb),
    'teto', jsonb_build_object(
        'admin_global', v_gestor = 'admin',
        'usuario_id', v_eu.id,
        'coordenacao', private."FC_COORDENACAO_USUARIO"(),
        'niveis', (select jsonb_object_agg(m, private."FC_TETO_DO_GESTOR"(m)) from unnest(private."FC_RECURSOS_MODULO"()) m),
        'paineis', coalesce((select jsonb_agg(e.id::text) from public."TB_PAINEL_EXTERNO" e
                              where e.ativo and (v_gestor = 'admin' or private.pode_recurso('painel:' || e.id))), '[]'::jsonb)),
    'historico', coalesce((select jsonb_agg(to_jsonb(h)) from (
        select h.*, u.email, autor.email autor
          from public."TH_PERMISSAO_RECURSO" h
          left join public."TB_PERFIL_USUARIO" u on u.id = h.perfil_usuario_id
          left join lateral (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id = h.alterado_por order by a.updated_at desc limit 1) autor on true
         where v_gestor = 'admin' or u."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"()
         order by h.alterado_em desc, h.id desc limit 50) h), '[]'::jsonb)
  ) into resultado;
  return resultado;
end;
$$;
commit;
