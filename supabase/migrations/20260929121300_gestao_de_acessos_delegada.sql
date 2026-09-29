/*
  GESTÃO DE ACESSOS: GRUPOS, COORDENAÇÕES E COORDENADOR (permissões, parte 4)

  Depende das partes 1 a 3 (20260929121000, 121100, 121200).

  Quem gerencia:
    * admin global (private.is_master): tudo;
    * coordenador = quem tem o módulo "acessos" >= editor E uma coordenação:
      só os usuários da própria coordenação, com TETO:
        - não altera a si mesmo nem admin global;
        - nível concedido <= o próprio nível efetivo no módulo; painel só se
          ele mesmo tem o painel; nunca concede "acessos"; não mexe em área;
        - grupo atribuído só se TODOS os níveis do grupo couberem no teto e
          o grupo não der "acessos";
        - não muda coordenação de ninguém; aprova/recusa só as solicitações da
          própria coordenação.

  RPCs:
    obter_matriz_acessos(p_busca, p_offset, p_coordenacao, p_grupo)
      célula = {nivel, origem: 'grupo'|'excecao', nivel_grupo, revisao};
      traz perfis, coordenações e o teto de quem pede.
    salvar_matriz_acessos(p_alteracoes, p_motivo)            (mesma assinatura)
      item {tipo:'nivel'|'grupo'|'coordenacao', usuario_id, …, revisao};
      sem tipo = 'nivel' (compatível com a tela antiga); nivel null = apagar a
      exceção (volta ao grupo). Tudo auditado em TH_PERMISSAO_RECURSO
      (grupo e coordenação com recurso '#grupo' / '#coordenacao').
    salvar_grupo_acesso / remover_grupo_acesso             (admin)
    salvar_coordenacao / desativar_coordenacao               (admin)
    obter_contexto_de_usuario(id)                            ("Ver como", só leitura)
    listar_solicitacoes_acesso(p_status)
    aprovar_solicitacao_acesso(id, grupo, coordenacao, areas, observação)
      (nova assinatura: define grupo + coordenação; sem coordenação, as áreas)
    recusar_solicitacao_acesso(id, observação)               (coordenador também)
    listar_coordenacoes_ativas()                             (autenticado, p/ pedir acesso)
    registrar_solicitacao_acesso(nome, setor, justificativa, coordenacao)
    obter_minha_solicitacao_acesso()

  ROLLBACK: reaplicar obter_matriz_acessos/salvar_matriz_acessos de
  20260925190000, aprovar/recusar de 20260918160000 e dropar as RPCs novas,
  os helpers FC_* desta parte e TH_GRUPO_ACESSO/TH_COORDENACAO.
*/
begin;

-- 1. Histórico de perfis e coordenações ----------------------------------------------
create table public."TH_GRUPO_ACESSO" (
  "CO_HISTORICO" bigint generated always as identity,
  "CO_GRUPO_ACESSO" text not null,
  "JS_ANTES" jsonb,
  "JS_DEPOIS" jsonb,
  "CO_ALTERADO_POR" uuid not null,
  "DT_ALTERACAO" timestamptz not null default now(),
  "DS_MOTIVO" text not null,
  constraint "PK_TH_GRUPO_ACESSO" primary key ("CO_HISTORICO")
);
create index "IN_THGRUPOACESSO_DTALTERACAO" on public."TH_GRUPO_ACESSO" ("DT_ALTERACAO" desc);
comment on table public."TH_GRUPO_ACESSO" is 'Histórico de criação, edição e remoção de grupos de acesso.';
comment on column public."TH_GRUPO_ACESSO"."JS_ANTES" is 'Grupo e níveis antes (null na criação).';
comment on column public."TH_GRUPO_ACESSO"."JS_DEPOIS" is 'Grupo e níveis depois (null na remoção).';

create table public."TH_COORDENACAO" (
  "CO_HISTORICO" bigint generated always as identity,
  "CO_COORDENACAO" text not null,
  "JS_ANTES" jsonb,
  "JS_DEPOIS" jsonb,
  "CO_ALTERADO_POR" uuid not null,
  "DT_ALTERACAO" timestamptz not null default now(),
  "DS_MOTIVO" text not null,
  constraint "PK_TH_COORDENACAO" primary key ("CO_HISTORICO")
);
create index "IN_THCOORDENACAO_DTALTERACAO" on public."TH_COORDENACAO" ("DT_ALTERACAO" desc);
comment on table public."TH_COORDENACAO" is 'Histórico de criação, edição e desativação de coordenações.';
comment on column public."TH_COORDENACAO"."JS_ANTES" is 'Coordenação, unidades e editais antes (null na criação).';
comment on column public."TH_COORDENACAO"."JS_DEPOIS" is 'Coordenação, unidades e editais depois.';

alter table public."TH_GRUPO_ACESSO" enable row level security;
alter table public."TH_COORDENACAO" enable row level security;
revoke all on public."TH_GRUPO_ACESSO", public."TH_COORDENACAO" from public, anon, authenticated;

-- 2. Helpers de gestão -----------------------------------------------------------------
create function private."FC_RANK_NIVEL"(p_nivel text)
returns integer
language sql
immutable
set search_path to ''
as $$
  select case p_nivel when 'admin' then 3 when 'editor' then 2 when 'leitor' then 1 else 0 end;
$$;

-- 'admin' | 'coordenador' | null
create function private."FC_GESTOR_DE_ACESSOS"()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when private.is_master() then 'admin'
    when private."FC_COORDENACAO_USUARIO"() is not null and private.pode_recurso('acessos', 2) then 'coordenador'
    else null
  end;
$$;

create function private."FC_EXIGIR_GESTOR_DE_ACESSOS"()
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v text := private."FC_GESTOR_DE_ACESSOS"();
begin
  if v is null then
    raise exception 'Somente administradores ou coordenadores podem gerenciar acessos' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- O usuário logado pode gerenciar este alvo? (não a si mesmo; coordenador só a
-- própria coordenação e nunca admin global)
create function private."FC_EXIGIR_GESTAO_DO_USUARIO"(p_alvo public."TB_PERFIL_USUARIO")
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
declare v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
begin
  if p_alvo.id is null then raise exception 'Usuário ativo não encontrado'; end if;
  if p_alvo.user_id = (select auth.uid())
     or lower(p_alvo.email) = lower(coalesce((select auth.jwt() ->> 'email'), '')) then
    raise exception 'Outra pessoa deve alterar seu acesso' using errcode = '42501';
  end if;
  if v_gestor = 'coordenador' then
    if p_alvo."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
      raise exception 'Usuário fora da sua coordenação' using errcode = '42501';
    end if;
    if exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_alvo.perfil and a."ST_ADMIN_GLOBAL") then
      raise exception 'Só um administrador altera outro administrador' using errcode = '42501';
    end if;
  end if;
end;
$$;

-- Nível que o coordenador pode conceder no recurso (teto). Admin: 'admin'.
create function private."FC_TETO_DO_GESTOR"(p_recurso text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when private.is_master() then 'admin'
    when p_recurso = 'acessos' or p_recurso like 'area:%' then 'sem_acesso'
    else private.nivel_recurso(p_recurso)
  end;
$$;

-- O grupo cabe no teto de quem está logado?
create function private."FC_GRUPO_CABE_NO_TETO"(p_grupo text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.is_master() or (
    exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo and not a."ST_ADMIN_GLOBAL")
    and not exists (
      select 1 from public."TA_GRUPO_ACESSO_RECURSO" t
       where t."CO_GRUPO_ACESSO" = p_grupo
         and private."FC_RANK_NIVEL"(t."TP_NIVEL") > private."FC_RANK_NIVEL"(private."FC_TETO_DO_GESTOR"(t."NO_RECURSO"))
    )
  );
$$;

create function private."FC_GRUPO_ACESSO_JSON"(p_grupo text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'codigo', a."CO_GRUPO_ACESSO", 'nome', a."NO_GRUPO_ACESSO", 'descricao', a."DS_GRUPO_ACESSO",
    'sistema', a."ST_SISTEMA", 'admin_global', a."ST_ADMIN_GLOBAL", 'ordem', a."NU_ORDEM", 'revisao', a."NU_REVISAO",
    'niveis', coalesce((select jsonb_object_agg(t."NO_RECURSO", t."TP_NIVEL") from public."TA_GRUPO_ACESSO_RECURSO" t
                         where t."CO_GRUPO_ACESSO" = a."CO_GRUPO_ACESSO"), '{}'::jsonb),
    'usuarios', (select count(*) from public."TB_PERFIL_USUARIO" u where u.perfil = a."CO_GRUPO_ACESSO" and u.ativo))
  from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo;
$$;

create function private."FC_COORDENACAO_JSON"(p_coordenacao text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'codigo', c."CO_COORDENACAO", 'nome', c."NO_COORDENACAO", 'area', c."CO_AREA",
    'responsavel', c."TP_RESPONSAVEL", 'ativo', c."ST_ATIVO", 'revisao', c."NU_REVISAO",
    'unidades', coalesce((select jsonb_agg(u."NO_UNIDADE" order by u."NO_UNIDADE") from public."RL_COORDENACAO_UNIDADE" u
                           where u."CO_COORDENACAO" = c."CO_COORDENACAO"), '[]'::jsonb),
    'editais', coalesce((select jsonb_agg(e."CO_EDITAL"::text order by e."CO_EDITAL") from public."RL_COORDENACAO_EDITAL" e
                          where e."CO_COORDENACAO" = c."CO_COORDENACAO"), '[]'::jsonb),
    'usuarios', (select count(*) from public."TB_PERFIL_USUARIO" x where x."CO_COORDENACAO" = c."CO_COORDENACAO" and x.ativo))
  from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = p_coordenacao;
$$;

revoke all on function
  private."FC_RANK_NIVEL"(text), private."FC_GESTOR_DE_ACESSOS"(), private."FC_EXIGIR_GESTOR_DE_ACESSOS"(),
  private."FC_EXIGIR_GESTAO_DO_USUARIO"(public."TB_PERFIL_USUARIO"), private."FC_TETO_DO_GESTOR"(text),
  private."FC_GRUPO_CABE_NO_TETO"(text), private."FC_GRUPO_ACESSO_JSON"(text), private."FC_COORDENACAO_JSON"(text)
  from public, anon, authenticated;

-- 3. Matriz ------------------------------------------------------------------------------
drop function public.obter_matriz_acessos(text, integer);

create function public.obter_matriz_acessos(p_busca text default '', p_offset integer default 0, p_coordenacao text default '', p_grupo text default '')
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

create or replace function public.salvar_matriz_acessos(p_alteracoes jsonb, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  item jsonb; alvo public."TB_PERFIL_USUARIO"; v_tipo text;
  anterior text; revisao_atual integer; recurso_atual text; novo text; v_nivel_grupo text;
  quantidade integer := 0;
begin
  if jsonb_typeof(p_alteracoes) is distinct from 'array' or jsonb_array_length(p_alteracoes) not between 1 and 500 then raise exception 'Alterações inválidas'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  -- Serializa inserções de linhas ausentes e updates; a revisão evita perda de alteração.
  perform pg_advisory_xact_lock(73923124153);
  for item in select value from jsonb_array_elements(p_alteracoes) loop
    select * into alvo from public."TB_PERFIL_USUARIO" where id = (item ->> 'usuario_id')::uuid and ativo for update;
    perform private."FC_EXIGIR_GESTAO_DO_USUARIO"(alvo);
    v_tipo := coalesce(item ->> 'tipo', 'nivel');

    -- Grupo de acesso ----------------------------------------------------------
    if v_tipo = 'grupo' then
      novo := item ->> 'grupo';
      if not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo) then raise exception 'Grupo inválido'; end if;
      if item ->> 'revisao' is distinct from alvo.updated_at::text and alvo.updated_at <> now() then
        raise exception 'Conta alterada por outra pessoa. Recarregue a matriz.' using errcode = '40001';
      end if;
      if not private."FC_GRUPO_CABE_NO_TETO"(novo) then
        raise exception 'O grupo % dá mais acesso do que você tem', novo using errcode = '42501';
      end if;
      if alvo.perfil = novo then continue; end if;
      anterior := alvo.perfil;
      update public."TB_PERFIL_USUARIO"
         set perfil = novo,
             "CO_COORDENACAO" = case when exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL")
                                     then null else "CO_COORDENACAO" end,
             p_config = exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL"),
             p_admin = exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL"),
             updated_at = now()
       where id = alvo.id;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, '#grupo', anterior, novo, (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    -- Coordenação (só admin) --------------------------------------------------------
    if v_tipo = 'coordenacao' then
      if v_gestor <> 'admin' then raise exception 'Só o administrador muda a coordenação de alguém' using errcode = '42501'; end if;
      novo := nullif(btrim(coalesce(item ->> 'coordenacao', '')), '');
      if item ->> 'revisao' is distinct from alvo.updated_at::text and alvo.updated_at <> now() then
        raise exception 'Conta alterada por outra pessoa. Recarregue a matriz.' using errcode = '40001';
      end if;
      if novo is not null and not exists (select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = novo and c."ST_ATIVO") then
        raise exception 'Coordenação inválida ou desativada';
      end if;
      if novo is not null and exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = alvo.perfil and a."ST_ADMIN_GLOBAL") then
        raise exception 'Administrador global não fica em coordenação';
      end if;
      if alvo."CO_COORDENACAO" is not distinct from novo then continue; end if;
      anterior := coalesce(alvo."CO_COORDENACAO", '(sem coordenação)');
      update public."TB_PERFIL_USUARIO" set "CO_COORDENACAO" = novo, updated_at = now() where id = alvo.id;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, '#coordenacao', anterior, coalesce(novo, '(sem coordenação)'), (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    if v_tipo <> 'nivel' then raise exception 'Tipo de alteração inválido'; end if;
    recurso_atual := item ->> 'recurso';
    novo := item ->> 'nivel';

    -- Área (só admin) ---------------------------------------------------------------
    if recurso_atual like 'area:%' then
      if v_gestor <> 'admin' then raise exception 'Só o administrador muda as áreas de alguém' using errcode = '42501'; end if;
      if not exists (select 1 from public."TB_AREA" a where 'area:' || a."CO_AREA" = recurso_atual) then raise exception 'Área inválida'; end if;
      if novo is null or novo not in ('sem_acesso', 'leitor') then raise exception 'Área aceita apenas Sim ou Não'; end if;
      if exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = alvo.perfil and a."ST_ADMIN_GLOBAL") then
        raise exception 'Administrador já vê todas as áreas';
      end if;
      anterior := case when exists (select 1 from public."RL_PERFIL_USUARIO_AREA" x
                                     where x."CO_PERFIL_USUARIO" = alvo.id and 'area:' || x."CO_AREA" = recurso_atual)
                       then 'leitor' else 'sem_acesso' end;
      if anterior = novo then continue; end if;
      if novo = 'leitor' then
        insert into public."RL_PERFIL_USUARIO_AREA"("CO_PERFIL_USUARIO", "CO_AREA") values (alvo.id, substr(recurso_atual, 6));
      else
        delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO" = alvo.id and "CO_AREA" = substr(recurso_atual, 6);
      end if;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, recurso_atual, anterior, novo, (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    -- Módulo ou painel ------------------------------------------------------------------
    if recurso_atual is null or (recurso_atual <> all (private."FC_RECURSOS_MODULO"())
        and not exists (select 1 from public."TB_PAINEL_EXTERNO" where 'painel:' || id = recurso_atual and ativo)) then
      raise exception 'Recurso inválido';
    end if;
    if novo is not null and novo not in ('sem_acesso', 'leitor', 'editor', 'admin') then raise exception 'Nível inválido'; end if;
    if recurso_atual = 'configuracoes' and novo = 'leitor' then raise exception 'Configurações exige Editor ou Administrador'; end if;
    if recurso_atual = 'acessos' and novo not in ('sem_acesso', 'editor') then raise exception 'Acessos aceita Sem acesso ou Editor'; end if;
    if recurso_atual like 'painel:%' and novo not in ('sem_acesso', 'leitor') then raise exception 'Painel externo permite apenas acesso de leitura no portal'; end if;

    select g.nivel, g.revisao into anterior, revisao_atual
      from public."TB_PERMISSAO_RECURSO" g where g.perfil_usuario_id = alvo.id and g.recurso = recurso_atual;
    if item ->> 'revisao' is null or coalesce(revisao_atual, 0) <> (item ->> 'revisao')::integer then
      raise exception 'Permissão alterada por outra pessoa. Recarregue a matriz.' using errcode = '40001';
    end if;
    v_nivel_grupo := private."FC_NIVEL_DO_GRUPO"(alvo.perfil, recurso_atual);

    -- Teto do coordenador: o nível resultante (exceção ou padrão do grupo).
    if v_gestor = 'coordenador' then
      if recurso_atual = 'acessos' then raise exception 'Só o administrador concede Acessos' using errcode = '42501'; end if;
      if private."FC_RANK_NIVEL"(coalesce(novo, v_nivel_grupo)) > private."FC_RANK_NIVEL"(private."FC_TETO_DO_GESTOR"(recurso_atual)) then
        raise exception 'Você não pode conceder mais do que o seu próprio nível em %', recurso_atual using errcode = '42501';
      end if;
    end if;

    if novo is null then
      -- Voltar ao padrão do grupo: apaga a exceção.
      if anterior is null then continue; end if;
      delete from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id = alvo.id and recurso = recurso_atual;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, recurso_atual, anterior, v_nivel_grupo, (select auth.uid()), btrim(p_motivo) || ' [padrão do grupo]');
      quantidade := quantidade + 1;
      continue;
    end if;

    if anterior is not distinct from novo then continue; end if;
    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by) values (alvo.id, recurso_atual, novo, (select auth.uid()))
    on conflict (perfil_usuario_id, recurso) do update
      set nivel = excluded.nivel, revisao = "TB_PERMISSAO_RECURSO".revisao + 1, updated_at = now(), updated_by = excluded.updated_by;
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    values (alvo.id, recurso_atual, coalesce(anterior, v_nivel_grupo), novo, (select auth.uid()), btrim(p_motivo));
    quantidade := quantidade + 1;
  end loop;
  return jsonb_build_object('alteradas', quantidade);
end;
$$;

-- 4. Grupos (admin) -----------------------------------------------------------------------
create function public.salvar_grupo_acesso(p_grupo jsonb, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_codigo text := lower(btrim(coalesce(p_grupo ->> 'codigo', '')));
  v_nome text := btrim(coalesce(p_grupo ->> 'nome', ''));
  v_niveis jsonb := coalesce(p_grupo -> 'niveis', '{}'::jsonb);
  v_atual public."TB_GRUPO_ACESSO";
  v_antes jsonb;
  v_recurso text;
  v_nivel text;
begin
  if not private.is_master() then raise exception 'Somente administradores gerenciam grupos' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  if v_codigo !~ '^[a-z]+(_[a-z]+)*$' then raise exception 'Código inválido: use letras minúsculas e _'; end if;
  if length(v_nome) not between 2 and 80 then raise exception 'Informe um nome entre 2 e 80 caracteres'; end if;
  if jsonb_typeof(v_niveis) <> 'object' then raise exception 'Níveis inválidos'; end if;

  perform pg_advisory_xact_lock(73923124154);
  select * into v_atual from public."TB_GRUPO_ACESSO" where "CO_GRUPO_ACESSO" = v_codigo for update;
  if v_atual."CO_GRUPO_ACESSO" is not null then
    if v_atual."ST_ADMIN_GLOBAL" then raise exception 'O grupo de administrador global não é editável'; end if;
    if (p_grupo ->> 'revisao') is null or (p_grupo ->> 'revisao')::integer <> v_atual."NU_REVISAO" then
      raise exception 'Grupo alterado por outra pessoa. Recarregue.' using errcode = '40001';
    end if;
    v_antes := private."FC_GRUPO_ACESSO_JSON"(v_codigo);
    update public."TB_GRUPO_ACESSO"
       set "NO_GRUPO_ACESSO" = v_nome,
           "DS_GRUPO_ACESSO" = nullif(btrim(coalesce(p_grupo ->> 'descricao', '')), ''),
           "NU_ORDEM" = coalesce((p_grupo ->> 'ordem')::smallint, "NU_ORDEM"),
           "NU_REVISAO" = "NU_REVISAO" + 1,
           "DT_ATUALIZACAO" = now()
     where "CO_GRUPO_ACESSO" = v_codigo;
  else
    if (p_grupo ->> 'revisao') is not null then raise exception 'Grupo não encontrado. Recarregue.' using errcode = '40001'; end if;
    insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "NU_ORDEM")
    values (v_codigo, v_nome, nullif(btrim(coalesce(p_grupo ->> 'descricao', '')), ''), coalesce((p_grupo ->> 'ordem')::smallint, 100));
  end if;

  -- Todo módulo tem nível no grupo; o que não veio fica sem acesso.
  delete from public."TA_GRUPO_ACESSO_RECURSO" where "CO_GRUPO_ACESSO" = v_codigo;
  foreach v_recurso in array private."FC_RECURSOS_MODULO"() loop
    v_nivel := coalesce(v_niveis ->> v_recurso, 'sem_acesso');
    insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL") values (v_codigo, v_recurso, v_nivel);
  end loop;

  insert into public."TH_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "JS_ANTES", "JS_DEPOIS", "CO_ALTERADO_POR", "DS_MOTIVO")
  values (v_codigo, v_antes, private."FC_GRUPO_ACESSO_JSON"(v_codigo), (select auth.uid()), btrim(p_motivo));
  return private."FC_GRUPO_ACESSO_JSON"(v_codigo);
end;
$$;

create function public.remover_grupo_acesso(p_codigo text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_atual public."TB_GRUPO_ACESSO"; v_antes jsonb;
begin
  if not private.is_master() then raise exception 'Somente administradores gerenciam grupos' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  select * into v_atual from public."TB_GRUPO_ACESSO" where "CO_GRUPO_ACESSO" = p_codigo for update;
  if v_atual."CO_GRUPO_ACESSO" is null then raise exception 'Grupo não encontrado'; end if;
  if v_atual."ST_SISTEMA" then raise exception 'Grupo do sistema não pode ser removido'; end if;
  if exists (select 1 from public."TB_PERFIL_USUARIO" u where u.perfil = p_codigo) then
    raise exception 'Há usuários neste grupo. Troque o grupo deles antes de remover.';
  end if;
  if exists (select 1 from public."TB_SOLICITACAO_ACESSO" s where s.perfil_solicitado = p_codigo) then
    raise exception 'Há solicitações de acesso com este grupo.';
  end if;
  v_antes := private."FC_GRUPO_ACESSO_JSON"(p_codigo);
  delete from public."TB_GRUPO_ACESSO" where "CO_GRUPO_ACESSO" = p_codigo;
  insert into public."TH_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "JS_ANTES", "JS_DEPOIS", "CO_ALTERADO_POR", "DS_MOTIVO")
  values (p_codigo, v_antes, null, (select auth.uid()), btrim(p_motivo));
  return jsonb_build_object('ok', true, 'codigo', p_codigo);
end;
$$;

-- 5. Coordenações (admin) ------------------------------------------------------------------
create function public.salvar_coordenacao(p_coordenacao jsonb, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_codigo text := lower(btrim(coalesce(p_coordenacao ->> 'codigo', '')));
  v_nome text := btrim(coalesce(p_coordenacao ->> 'nome', ''));
  v_area text := btrim(coalesce(p_coordenacao ->> 'area', ''));
  v_responsavel text := nullif(upper(btrim(coalesce(p_coordenacao ->> 'responsavel', ''))), '');
  v_ativo boolean := coalesce((p_coordenacao ->> 'ativo')::boolean, true);
  v_atual public."TB_COORDENACAO";
  v_antes jsonb;
  v_unidade text;
  v_edital text;
begin
  if not private.is_master() then raise exception 'Somente administradores gerenciam coordenações' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  if v_codigo !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Código inválido: use letras minúsculas, números e hífen'; end if;
  if length(v_nome) not between 2 and 120 then raise exception 'Informe um nome entre 2 e 120 caracteres'; end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then raise exception 'Área inválida'; end if;
  if v_responsavel is not null and v_responsavel not in ('USI', 'CORES') then raise exception 'Responsável inválido'; end if;
  if jsonb_typeof(coalesce(p_coordenacao -> 'unidades', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_coordenacao -> 'editais', '[]'::jsonb)) <> 'array' then
    raise exception 'Unidades e editais devem ser listas';
  end if;

  perform pg_advisory_xact_lock(73923124155);
  select * into v_atual from public."TB_COORDENACAO" where "CO_COORDENACAO" = v_codigo for update;
  if v_atual."CO_COORDENACAO" is not null then
    if (p_coordenacao ->> 'revisao') is null or (p_coordenacao ->> 'revisao')::integer <> v_atual."NU_REVISAO" then
      raise exception 'Coordenação alterada por outra pessoa. Recarregue.' using errcode = '40001';
    end if;
    if not v_ativo and exists (select 1 from public."TB_PERFIL_USUARIO" u where u."CO_COORDENACAO" = v_codigo and u.ativo) then
      raise exception 'Há usuários nesta coordenação. Mude-os de coordenação antes de desativar.';
    end if;
    v_antes := private."FC_COORDENACAO_JSON"(v_codigo);
    update public."TB_COORDENACAO"
       set "NO_COORDENACAO" = v_nome, "CO_AREA" = v_area, "TP_RESPONSAVEL" = v_responsavel, "ST_ATIVO" = v_ativo,
           "NU_REVISAO" = "NU_REVISAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_COORDENACAO" = v_codigo;
  else
    if (p_coordenacao ->> 'revisao') is not null then raise exception 'Coordenação não encontrada. Recarregue.' using errcode = '40001'; end if;
    insert into public."TB_COORDENACAO" ("CO_COORDENACAO", "NO_COORDENACAO", "CO_AREA", "TP_RESPONSAVEL", "ST_ATIVO")
    values (v_codigo, v_nome, v_area, v_responsavel, v_ativo);
  end if;

  delete from public."RL_COORDENACAO_UNIDADE" where "CO_COORDENACAO" = v_codigo;
  for v_unidade in select distinct btrim(value) from jsonb_array_elements_text(coalesce(p_coordenacao -> 'unidades', '[]'::jsonb)) where btrim(value) <> '' loop
    if private."FC_AREA_DA_UNIDADE"(v_unidade) is distinct from v_area then
      raise exception 'A unidade % não é da área escolhida', v_unidade;
    end if;
    insert into public."RL_COORDENACAO_UNIDADE" ("CO_COORDENACAO", "NO_UNIDADE") values (v_codigo, v_unidade);
  end loop;

  delete from public."RL_COORDENACAO_EDITAL" where "CO_COORDENACAO" = v_codigo;
  for v_edital in select distinct value from jsonb_array_elements_text(coalesce(p_coordenacao -> 'editais', '[]'::jsonb)) loop
    if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = v_edital and m."CO_AREA" = v_area) then
      raise exception 'Edital % não encontrado nesta área', v_edital;
    end if;
    insert into public."RL_COORDENACAO_EDITAL" ("CO_COORDENACAO", "CO_EDITAL") values (v_codigo, v_edital::uuid);
  end loop;

  insert into public."TH_COORDENACAO" ("CO_COORDENACAO", "JS_ANTES", "JS_DEPOIS", "CO_ALTERADO_POR", "DS_MOTIVO")
  values (v_codigo, v_antes, private."FC_COORDENACAO_JSON"(v_codigo), (select auth.uid()), btrim(p_motivo));
  return private."FC_COORDENACAO_JSON"(v_codigo);
end;
$$;

create function public.desativar_coordenacao(p_codigo text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_antes jsonb;
begin
  if not private.is_master() then raise exception 'Somente administradores gerenciam coordenações' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  v_antes := private."FC_COORDENACAO_JSON"(p_codigo);
  if v_antes is null then raise exception 'Coordenação não encontrada'; end if;
  if exists (select 1 from public."TB_PERFIL_USUARIO" u where u."CO_COORDENACAO" = p_codigo and u.ativo) then
    raise exception 'Há usuários nesta coordenação. Mude-os de coordenação antes de desativar.';
  end if;
  update public."TB_COORDENACAO" set "ST_ATIVO" = false, "NU_REVISAO" = "NU_REVISAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_COORDENACAO" = p_codigo;
  insert into public."TH_COORDENACAO" ("CO_COORDENACAO", "JS_ANTES", "JS_DEPOIS", "CO_ALTERADO_POR", "DS_MOTIVO")
  values (p_codigo, v_antes, private."FC_COORDENACAO_JSON"(p_codigo), (select auth.uid()), btrim(p_motivo));
  return private."FC_COORDENACAO_JSON"(p_codigo);
end;
$$;

-- 6. "Ver como" (só leitura) -------------------------------------------------------------------
create function public.obter_contexto_de_usuario(p_perfil_usuario_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  u public."TB_PERFIL_USUARIO";
  v_editais uuid[];
  v_areas text[];
begin
  select * into u from public."TB_PERFIL_USUARIO" where id = p_perfil_usuario_id and ativo;
  if u.id is null then raise exception 'Usuário ativo não encontrado'; end if;
  if private."FC_EXIGIR_GESTOR_DE_ACESSOS"() = 'coordenador'
     and u."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
    raise exception 'Usuário fora da sua coordenação' using errcode = '42501';
  end if;

  v_areas := coalesce(private."FC_AREAS_DO_PERFIL"(u.id), '{}');
  v_editais := case when exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = u.perfil and a."ST_ADMIN_GLOBAL")
                    then null else private."FC_EDITAIS_DA_COORDENACAO"(u."CO_COORDENACAO") end;

  return jsonb_build_object(
    'profile', jsonb_build_object('id', u.id, 'user_id', u.user_id, 'email', u.email, 'nome', u.nome, 'perfil', u.perfil, 'ativo', u.ativo,
      'permissoes', (select jsonb_object_agg(m, private."FC_NIVEL_EFETIVO"(u.id, u.perfil, m)) from unnest(private."FC_RECURSOS_MODULO"()) m),
      'areas', to_jsonb(v_areas),
      'admin_global', coalesce((select a."ST_ADMIN_GLOBAL" from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = u.perfil), false),
      'grupo', (select jsonb_build_object('codigo', a."CO_GRUPO_ACESSO", 'nome', a."NO_GRUPO_ACESSO")
                          from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = u.perfil),
      'coordenacao', (select jsonb_build_object('codigo', c."CO_COORDENACAO", 'nome', c."NO_COORDENACAO", 'area', c."CO_AREA")
                        from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = u."CO_COORDENACAO")),
    'panel_ids', coalesce((select jsonb_agg(e.id::text) from public."TB_PAINEL_EXTERNO" e
       where e.ativo
         and private."FC_RANK_NIVEL"(private."FC_NIVEL_EFETIVO"(u.id, u.perfil, 'paineis')) >= 1
         and private."FC_RANK_NIVEL"(private."FC_NIVEL_EFETIVO"(u.id, u.perfil, 'painel:' || e.id)) >= 1), '[]'::jsonb),
    'escopo', jsonb_build_object(
      'editais_da_area', (select count(*) from public."TB_MONITORAMENTO_INDIGENA" m where m.ativo and m."CO_AREA" = any (v_areas)),
      'editais_visiveis', case when v_editais is null
                               then (select count(*) from public."TB_MONITORAMENTO_INDIGENA" m where m.ativo and m."CO_AREA" = any (v_areas))
                               else (select count(*) from public."TB_MONITORAMENTO_INDIGENA" m where m.ativo and m.id = any (v_editais)) end,
      'recortado', v_editais is not null)
  );
end;
$$;

-- 7. Solicitações de acesso ------------------------------------------------------------------
create function public.listar_solicitacoes_acesso(p_status text default 'pendente')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
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
$$;

drop function public.aprovar_solicitacao_acesso(uuid, text, jsonb, uuid[], text);

create function public.aprovar_solicitacao_acesso(
  p_solicitacao_id uuid,
  p_grupo text,
  p_coordenacao text default null,
  p_areas text[] default null,
  p_observacao_admin text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_req public."TB_SOLICITACAO_ACESSO";
  v_perfil_id uuid;
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_admin boolean;
  v_areas text[];
begin
  select * into v_req from public."TB_SOLICITACAO_ACESSO" where id = p_solicitacao_id for update;
  if v_req.id is null then raise exception 'Solicitação de acesso não encontrada'; end if;
  if v_req.status <> 'pendente' then raise exception 'Solicitação já avaliada (status atual: %)', v_req.status; end if;
  if not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo) then
    raise exception 'Grupo inválido: %', p_grupo;
  end if;
  v_admin := exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p_grupo and a."ST_ADMIN_GLOBAL");

  if v_gestor = 'coordenador' then
    if v_req."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
      raise exception 'Solicitação de outra coordenação' using errcode = '42501';
    end if;
    v_coordenacao := private."FC_COORDENACAO_USUARIO"();
    if not private."FC_GRUPO_CABE_NO_TETO"(p_grupo) then
      raise exception 'O grupo % dá mais acesso do que você tem', p_grupo using errcode = '42501';
    end if;
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
    if cardinality(v_areas) = 0 then
      raise exception 'Sem coordenação, escolha ao menos uma área';
    end if;
  end if;

  select id into v_perfil_id
    from public."TB_PERFIL_USUARIO"
   where (v_req.user_id is not null and user_id = v_req.user_id) or lower(email) = lower(v_req.email)
   order by case when user_id = v_req.user_id then 0 else 1 end, updated_at desc
   limit 1
   for update;

  if v_perfil_id is null then
    insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, "CO_COORDENACAO", ativo, p_ind, p_cores, p_paineis, p_config, p_admin)
    values (v_req.user_id, v_req.email, coalesce(nullif(btrim(v_req.nome), ''), v_req.email),
            p_grupo, v_coordenacao, true, true, true, true, v_admin, v_admin)
    returning id into v_perfil_id;
  else
    if v_gestor = 'coordenador' and exists (
      select 1 from public."TB_PERFIL_USUARIO" u where u.id = v_perfil_id and u.ativo
         and u."CO_COORDENACAO" is distinct from v_coordenacao) then
      raise exception 'Esta pessoa já tem acesso por outra coordenação' using errcode = '42501';
    end if;
    update public."TB_PERFIL_USUARIO"
       set user_id = coalesce(user_id, v_req.user_id),
           email = v_req.email,
           nome = coalesce(nullif(btrim(v_req.nome), ''), nome, v_req.email),
           perfil = p_grupo,
           "CO_COORDENACAO" = v_coordenacao,
           ativo = true, p_ind = true, p_cores = true, p_paineis = true, p_config = v_admin, p_admin = v_admin,
           updated_at = now()
     where id = v_perfil_id;
  end if;

  if v_areas is not null then
    delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO" = v_perfil_id;
    insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA") select v_perfil_id, unnest(v_areas);
  end if;

  -- Painéis ativos em leitura, como na carga de 23/09 (o grupo decide se vê "Painéis").
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select v_perfil_id, 'painel:' || e.id, 'leitor', (select auth.uid())
    from public."TB_PAINEL_EXTERNO" e
   where e.ativo and (v_gestor = 'admin' or private.pode_recurso('painel:' || e.id))
  on conflict (perfil_usuario_id, recurso) do nothing;

  update public."TB_SOLICITACAO_ACESSO"
     set status = 'aprovado', perfil_solicitado = p_grupo, "CO_COORDENACAO" = coalesce(v_coordenacao, "CO_COORDENACAO"),
         avaliado_por = (select auth.uid()), avaliado_em = now(),
         observacao_admin = nullif(btrim(p_observacao_admin), ''), updated_at = now()
   where id = v_req.id;

  insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
  values (v_perfil_id, '#grupo', '(solicitação)', p_grupo, (select auth.uid()),
          coalesce(nullif(btrim(p_observacao_admin), ''), 'Solicitação de acesso aprovada'));

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_perfil_id, 'grupo', p_grupo, 'coordenacao', v_coordenacao);
end;
$$;

create or replace function public.recusar_solicitacao_acesso(p_solicitacao_id uuid, p_observacao_admin text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
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
$$;

-- Quem ainda não tem perfil também chama estas três (escolher e pedir acesso).
create function public.listar_coordenacoes_ativas()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('codigo', c."CO_COORDENACAO", 'nome', c."NO_COORDENACAO",
                                               'area', c."CO_AREA", 'area_nome', a."NO_AREA")
                            order by a."NU_ORDEM", c."NO_COORDENACAO"), '[]'::jsonb)
    from public."TB_COORDENACAO" c
    join public."TB_AREA" a on a."CO_AREA" = c."CO_AREA"
   where c."ST_ATIVO" and (select auth.uid()) is not null;
$$;

create function public.registrar_solicitacao_acesso(
  p_nome text, p_setor text default null, p_justificativa text default null, p_coordenacao text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
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
$$;

create function public.obter_minha_solicitacao_acesso()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
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
$$;

-- 8. Permissões de execução --------------------------------------------------------------------
revoke all on function
  public.obter_matriz_acessos(text, integer, text, text), public.salvar_matriz_acessos(jsonb, text),
  public.salvar_grupo_acesso(jsonb, text), public.remover_grupo_acesso(text, text),
  public.salvar_coordenacao(jsonb, text), public.desativar_coordenacao(text, text),
  public.obter_contexto_de_usuario(uuid), public.listar_solicitacoes_acesso(text),
  public.aprovar_solicitacao_acesso(uuid, text, text, text[], text), public.recusar_solicitacao_acesso(uuid, text),
  public.listar_coordenacoes_ativas(), public.registrar_solicitacao_acesso(text, text, text, text),
  public.obter_minha_solicitacao_acesso()
  from public, anon;
grant execute on function
  public.obter_matriz_acessos(text, integer, text, text), public.salvar_matriz_acessos(jsonb, text),
  public.salvar_grupo_acesso(jsonb, text), public.remover_grupo_acesso(text, text),
  public.salvar_coordenacao(jsonb, text), public.desativar_coordenacao(text, text),
  public.obter_contexto_de_usuario(uuid), public.listar_solicitacoes_acesso(text),
  public.aprovar_solicitacao_acesso(uuid, text, text, text[], text), public.recusar_solicitacao_acesso(uuid, text),
  public.listar_coordenacoes_ativas(), public.registrar_solicitacao_acesso(text, text, text, text),
  public.obter_minha_solicitacao_acesso()
  to authenticated;

commit;
