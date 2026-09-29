/*
  ADICIONAR PESSOA E CONTAS QUE SÃO COORDENAÇÕES (permissões, parte 6)

  1. adicionar_pessoa_acesso(email, nome, grupo, coordenacao, areas, motivo)
     Cadastra alguém pelo e-mail, antes de a pessoa entrar: o perfil nasce sem
     user_id e é encontrado pelo e-mail no primeiro login (current_profile e
     is_master já casam por e-mail). Admin global: qualquer grupo; coordenador:
     só na própria coordenação e com grupo dentro do teto. Sem coordenação (e
     sem ser admin global), escolhe as áreas. E-mail com perfil ativo: recusa;
     com perfil desativado: reativa com o que foi escolhido.

  2. mover_conta_para_coordenacoes(perfil_usuario_id, area, motivo)
     Há contas de e-mail compartilhado cadastradas como pessoas (ex.: "COET –
     Coordenação de …"). Esta RPC (só admin global) cria a coordenação com o
     nome da conta — ou reaproveita a que já tem esse nome — e DESATIVA a
     conta. Reversível: a conta fica desativada, não apagada, e tudo vai para
     o histórico. Conta desativada não volta sozinha pelo acesso básico.

  ROLLBACK
    begin;
    drop function public.mover_conta_para_coordenacoes(uuid, text, text);
    drop function public.adicionar_pessoa_acesso(text, text, text, text, text[], text);
    drop function private."FC_CODIGO_DE_COORDENACAO"(text);
    commit;
*/
begin;

-- Código de coordenação a partir do nome: minúsculas, sem acento, hífen; único.
create function private."FC_CODIGO_DE_COORDENACAO"(p_nome text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_base text := left(btrim(regexp_replace(
    translate(lower(coalesce(p_nome, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', '-', 'g'), '-'), 60);
  v_codigo text;
  v_n integer := 1;
begin
  if v_base = '' then v_base := 'coordenacao'; end if;
  v_base := btrim(v_base, '-');
  v_codigo := v_base;
  while exists (select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = v_codigo) loop
    v_n := v_n + 1;
    v_codigo := v_base || '-' || v_n;
  end loop;
  return v_codigo;
end;
$$;
revoke all on function private."FC_CODIGO_DE_COORDENACAO"(text) from public, anon, authenticated;

-- 1. Adicionar pessoa -------------------------------------------------------------------
create function public.adicionar_pessoa_acesso(
  p_email text,
  p_nome text,
  p_grupo text,
  p_coordenacao text default null,
  p_areas text[] default null,
  p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_admin boolean;
  v_areas text[];
  v_existente public."TB_PERFIL_USUARIO";
  v_id uuid;
begin
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Informe um e-mail válido'; end if;
  if length(v_nome) not between 2 and 120 then raise exception 'Informe o nome da pessoa'; end if;
  if not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo) then raise exception 'Grupo inválido'; end if;
  v_admin := exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo and a."ST_ADMIN_GLOBAL");

  if v_gestor = 'coordenador' then
    if not private."FC_GRUPO_CABE_NO_TETO"(p_grupo) then
      raise exception 'O grupo % dá mais acesso do que você tem', p_grupo using errcode = '42501';
    end if;
    v_coordenacao := private."FC_COORDENACAO_USUARIO"();
  end if;

  if v_admin then
    v_coordenacao := null;
  elsif v_coordenacao is not null then
    if not exists (select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = v_coordenacao and c."ST_ATIVO") then
      raise exception 'Coordenação inválida ou desativada';
    end if;
  else
    select coalesce(array_agg(distinct a."CO_AREA"), '{}') into v_areas
      from public."TB_AREA" a where a."CO_AREA" = any (coalesce(p_areas, '{}'));
    if cardinality(v_areas) = 0 then raise exception 'Sem coordenação, escolha ao menos uma área'; end if;
  end if;

  perform pg_advisory_xact_lock(73923124153);
  select * into v_existente from public."TB_PERFIL_USUARIO" where lower(email) = v_email
   order by ativo desc, updated_at desc nulls last limit 1 for update;
  if v_existente.id is not null and v_existente.ativo then
    raise exception 'Esta pessoa já tem acesso. Procure por ela na lista.';
  end if;

  if v_existente.id is null then
    insert into public."TB_PERFIL_USUARIO" (email, nome, perfil, "CO_COORDENACAO", ativo, p_ind, p_cores, p_paineis, p_config, p_admin)
    values (v_email, v_nome, p_grupo, v_coordenacao, true, true, true, true, v_admin, v_admin)
    returning id into v_id;
  else
    v_id := v_existente.id;
    update public."TB_PERFIL_USUARIO"
       set nome = v_nome, perfil = p_grupo, "CO_COORDENACAO" = v_coordenacao, ativo = true,
           p_ind = true, p_cores = true, p_paineis = true, p_config = v_admin, p_admin = v_admin, updated_at = now()
     where id = v_id;
    delete from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id = v_id and recurso = any (private."FC_RECURSOS_MODULO"());
  end if;

  if v_areas is not null then
    delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO" = v_id;
    insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA") select v_id, unnest(v_areas);
  end if;

  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select v_id, 'painel:' || e.id, 'leitor', (select auth.uid())
    from public."TB_PAINEL_EXTERNO" e
   where e.ativo and (v_gestor = 'admin' or private.pode_recurso('painel:' || e.id))
  on conflict (perfil_usuario_id, recurso) do nothing;

  insert into public."TH_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
  values (v_id, '#grupo', case when v_existente.id is null then '(adicionada)' else '(reativada)' end, p_grupo,
          (select auth.uid()), btrim(p_motivo));

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_id, 'reativada', v_existente.id is not null);
end;
$$;

-- 2. Conta que é coordenação -> Coordenações ---------------------------------------------
create function public.mover_conta_para_coordenacoes(p_perfil_usuario_id uuid, p_area text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_conta public."TB_PERFIL_USUARIO";
  v_codigo text;
  v_nome text;
begin
  if not private.is_master() then raise exception 'Somente administradores gerenciam coordenações' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then raise exception 'Área inválida'; end if;

  select * into v_conta from public."TB_PERFIL_USUARIO" where id = p_perfil_usuario_id and ativo for update;
  if v_conta.id is null then raise exception 'Conta ativa não encontrada'; end if;
  if v_conta.user_id = (select auth.uid()) or lower(v_conta.email) = lower(coalesce((select auth.jwt() ->> 'email'), '')) then
    raise exception 'Você não pode mover a sua própria conta' using errcode = '42501';
  end if;

  v_nome := left(coalesce(nullif(btrim(v_conta.nome), ''), split_part(v_conta.email, '@', 1)), 120);
  select c."CO_COORDENACAO" into v_codigo from public."TB_COORDENACAO" c where lower(c."NO_COORDENACAO") = lower(v_nome);
  if v_codigo is null then
    v_codigo := private."FC_CODIGO_DE_COORDENACAO"(v_nome);
    insert into public."TB_COORDENACAO" ("CO_COORDENACAO", "NO_COORDENACAO", "CO_AREA")
    values (v_codigo, v_nome, p_area);
    insert into public."TH_COORDENACAO" ("CO_COORDENACAO", "JS_ANTES", "JS_DEPOIS", "CO_ALTERADO_POR", "DS_MOTIVO")
    values (v_codigo, null, private."FC_COORDENACAO_JSON"(v_codigo), (select auth.uid()),
            btrim(p_motivo) || ' [criada a partir da conta ' || v_conta.email || ']');
  end if;

  update public."TB_PERFIL_USUARIO"
     set ativo = false, "CO_COORDENACAO" = null,
         p_ind = false, p_cores = false, p_paineis = false, p_config = false, p_admin = false, updated_at = now()
   where id = v_conta.id;

  insert into public."TH_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
  values (v_conta.id, '#grupo', v_conta.perfil, '(conta desativada: virou a coordenação ' || v_codigo || ')',
          (select auth.uid()), btrim(p_motivo));

  return private."FC_COORDENACAO_JSON"(v_codigo);
end;
$$;

revoke all on function
  public.adicionar_pessoa_acesso(text, text, text, text, text[], text),
  public.mover_conta_para_coordenacoes(uuid, text, text)
  from public, anon;
grant execute on function
  public.adicionar_pessoa_acesso(text, text, text, text, text[], text),
  public.mover_conta_para_coordenacoes(uuid, text, text)
  to authenticated;

commit;
