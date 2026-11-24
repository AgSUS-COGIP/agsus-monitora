/*
  DESFAZER 20261124210000_ampliar_pedido_de_acesso

  Volta TB_SOLICITACAO_ACESSO e as RPCs do pedido de acesso como estavam antes (corpos e
  comentários copiados do retrato supabase/esquema-atual.sql de 24/11/2026, letra por letra):
    - registrar_solicitacao_acesso volta à assinatura de 7 parâmetros;
    - aprovar_solicitacao_acesso, obter_minha_solicitacao_acesso e listar_solicitacoes_acesso
      voltam ao corpo de antes;
    - saem private."FC_REGISTRAR_AMPLIACAO_ACESSO" e private."FC_APROVAR_AMPLIACAO_ACESSO";
    - saem CK_SOLICACESSO_TIPO, CK_SOLICACESSO_AMPLIACAO e as colunas "TP_SOLICITACAO",
      "NO_RECURSO" e "TP_NIVEL"; o comentário da tabela volta.

  GUARDAS (nada muda se falhar)
    - A migration não está aplicada ("TP_SOLICITACAO" não existe).
    - Há pedido de mais acesso PENDENTE: sem o tipo, ele viraria um pedido de entrada e
      aprová-lo trocaria o grupo, a coordenação e as áreas da pessoa. Decida (aprove, recuse) ou
      peça para cancelar antes.

  O QUE FICA (dado não se desfaz)
    - O que os pedidos aprovados concederam (permissões, áreas, grupos) e o histórico em
      TH_PERMISSAO_RECURSO.
    - Os pedidos de mais acesso já decididos ou cancelados ficam na tabela; o tipo, o módulo e o
      nível deles são copiados antes para arquivo."TB_SOLICITACAO_AMPLIACAO_ANTES" (fora da Data
      API), para não se perderem.

  Depois: o front que usa os parâmetros novos precisa voltar antes, ou junto. Tire o registro:
    delete from public.migracoes_aplicadas where caminho = 'migrations/20261124210000_ampliar_pedido_de_acesso.sql';
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'TB_SOLICITACAO_ACESSO'
                    and column_name = 'TP_SOLICITACAO') then
    raise exception '20261124210000 não está aplicada: nada a desfazer.';
  end if;
  if exists (select 1 from public."TB_SOLICITACAO_ACESSO"
              where "TP_SOLICITACAO" <> 'ACESSO' and status = 'pendente') then
    raise exception 'Há pedido de mais acesso pendente: decida (aprove ou recuse) antes de desfazer.';
  end if;
end;
$$;

-- 1. Guarda o tipo dos pedidos de mais acesso já decididos ----------------------------------------
create table if not exists arquivo."TB_SOLICITACAO_AMPLIACAO_ANTES" (
  "CO_SOLICITACAO_ACESSO" uuid not null,
  "TP_SOLICITACAO" text not null,
  "NO_RECURSO" text,
  "TP_NIVEL" text,
  "CO_AREA" text,
  "CO_GRUPO_SOLICITADO" text,
  "DT_COPIA" timestamp with time zone not null default now(),
  constraint "PK_SOLICITACAO_AMPLIACAO_ANTES" primary key ("CO_SOLICITACAO_ACESSO")
);
comment on table arquivo."TB_SOLICITACAO_AMPLIACAO_ANTES" is
  'Cópia do tipo dos pedidos de mais acesso (TB_SOLICITACAO_ACESSO) feita pelo rollback de 20261124210000_ampliar_pedido_de_acesso, antes de as colunas saírem.';
insert into arquivo."TB_SOLICITACAO_AMPLIACAO_ANTES"
       ("CO_SOLICITACAO_ACESSO", "TP_SOLICITACAO", "NO_RECURSO", "TP_NIVEL", "CO_AREA", "CO_GRUPO_SOLICITADO")
select id, "TP_SOLICITACAO", "NO_RECURSO", "TP_NIVEL", "CO_AREA", perfil_solicitado
  from public."TB_SOLICITACAO_ACESSO"
 where "TP_SOLICITACAO" <> 'ACESSO'
on conflict ("CO_SOLICITACAO_ACESSO") do nothing;

-- 2. As RPCs de antes --------------------------------------------------------------------------
drop function public.registrar_solicitacao_acesso(text, text, text, text, text, text, text, text, text, text, text);

CREATE FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_area text DEFAULT NULL::text, p_cargo text DEFAULT NULL::text, p_cargo_outro text DEFAULT NULL::text, p_lotacao text DEFAULT NULL::text, p_justificativa text DEFAULT NULL::text, p_coordenacao text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_area text := nullif(btrim(coalesce(p_area, '')), '');
  v_cargo text := nullif(btrim(coalesce(p_cargo, '')), '');
  v_cargo_outro text := nullif(btrim(coalesce(p_cargo_outro, '')), '');
  v_lotacao text := nullif(btrim(coalesce(p_lotacao, '')), '');
  v_justificativa text := btrim(coalesce(p_justificativa, ''));
  v_justificativa_limpa text := btrim(regexp_replace(coalesce(p_justificativa, ''), '\s+', ' ', 'g'));
  v_coordenacao text := nullif(btrim(coalesce(p_coordenacao, '')), '');
  v_reativacao boolean;
  v_id uuid;
begin
  if v_uid is null or v_email = '' then raise exception 'Usuário não autenticado' using errcode = '42501'; end if;
  if length(v_nome) not between 2 and 120 then
    raise exception 'Informe seu nome completo (2 a 120 caracteres).' using errcode = '22023';
  end if;
  if length(v_justificativa_limpa) not between 20 and 2000
     or not private."FC_MOTIVO_PARECE_TEXTO"(v_justificativa_limpa, 3) then
    raise exception 'Explique por que precisa do acesso: de 20 a 2.000 caracteres, com pelo menos 3 palavras.' using errcode = '22023';
  end if;

  -- Conta desativada pede reativação: o administrador já sabe a área de antes.
  v_reativacao := exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where not u.ativo and (u.user_id = v_uid or lower(u.email) = v_email));

  if v_area is null and not v_reativacao then
    raise exception 'Escolha a área: Projetos, Saúde Indígena ou SEDE.' using errcode = '22023';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;
  if v_area is null then
    v_cargo := null; v_cargo_outro := null; v_lotacao := null;
  else
    if v_cargo is null or private."FC_CARGO_SOLICITACAO_ACESSO"(v_area, v_cargo) is null then
      raise exception 'Escolha o cargo ou a função na lista da área.' using errcode = '22023';
    end if;
    if v_cargo = 'OUTRO' then
      if length(coalesce(v_cargo_outro, '')) not between 3 and 120 then
        raise exception 'Descreva o cargo ou a função (3 a 120 caracteres).' using errcode = '22023';
      end if;
    else
      v_cargo_outro := null;
    end if;
    if v_lotacao is null or length(v_lotacao) > 200 then
      raise exception 'Informe a unidade ou a lotação (até 200 caracteres).' using errcode = '22023';
    end if;
    if v_area = 'saude-indigena' and not exists (
         select 1 from public."TD_UNIDADE" t where t.ativo and t.nome_oficial = v_lotacao) then
      raise exception 'Escolha o DSEI ou a CASAI na lista.' using errcode = '22023';
    end if;
    if v_area = 'projetos' and not exists (
         select 1 from public."TA_UNIDADE_AREA" x where x."CO_AREA" = 'projetos' and x."NO_UNIDADE" = v_lotacao) then
      raise exception 'Escolha o projeto na lista.' using errcode = '22023';
    end if;
  end if;
  if v_coordenacao is not null and not exists (
       select 1 from public."TB_COORDENACAO" c
        where c."CO_COORDENACAO" = v_coordenacao and c."ST_ATIVO"
          and (v_area is null or c."CO_AREA" = v_area)) then
    raise exception 'Coordenação inválida para a área escolhida.' using errcode = '22023';
  end if;

  -- Pedido pendente: editar (a pessoa corrige o que pediu enquanto aguarda).
  update public."TB_SOLICITACAO_ACESSO"
     set nome = v_nome, setor = v_lotacao, justificativa = v_justificativa,
         "CO_AREA" = v_area, "CO_CARGO_SOLICITADO" = v_cargo, "DS_CARGO_OUTRO" = v_cargo_outro,
         "CO_COORDENACAO" = v_coordenacao, updated_at = now()
   where user_id = v_uid and status = 'pendente'
  returning id into v_id;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente', 'atualizado', true);
  end if;

  insert into public."TB_SOLICITACAO_ACESSO" (user_id, email, nome, setor, justificativa, perfil_solicitado, status,
                                              "CO_COORDENACAO", "CO_AREA", "CO_CARGO_SOLICITADO", "DS_CARGO_OUTRO")
  values (v_uid, v_email, v_nome, v_lotacao, v_justificativa, 'usuario', 'pendente',
          v_coordenacao, v_area, v_cargo, v_cargo_outro)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pendente', 'atualizado', false);
end;
$$;

COMMENT ON FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_area text, p_cargo text, p_cargo_outro text, p_lotacao text, p_justificativa text, p_coordenacao text) IS 'Registra o pedido de acesso de quem está autenticado (área, cargo da lista, lotação, justificativa com 3 palavras) ou, com pedido pendente, o atualiza. Conta desativada (reativação): área opcional. Nunca concede acesso.';

REVOKE ALL ON FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_area text, p_cargo text, p_cargo_outro text, p_lotacao text, p_justificativa text, p_coordenacao text) FROM PUBLIC, anon, service_role;
GRANT ALL ON FUNCTION public.registrar_solicitacao_acesso(p_nome text, p_area text, p_cargo text, p_cargo_outro text, p_lotacao text, p_justificativa text, p_coordenacao text) TO authenticated;

CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_acesso(p_solicitacao_id uuid, p_grupo text, p_coordenacao text DEFAULT NULL::text, p_areas text[] DEFAULT NULL::text[], p_observacao_admin text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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

-- Antes da migration, aprovar_solicitacao_acesso não tinha comentário.
COMMENT ON FUNCTION public.aprovar_solicitacao_acesso(uuid, text, text, text[], text) IS NULL;

CREATE OR REPLACE FUNCTION public.obter_minha_solicitacao_acesso() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object('id', s.id, 'status', s.status, 'nome', s.nome, 'setor', s.setor,
                            'justificativa', s.justificativa, 'created_at', s.created_at,
                            'updated_at', s.updated_at, 'avaliado_em', s.avaliado_em,
                            'observacao_admin', s.observacao_admin, 'coordenacao', s."CO_COORDENACAO",
                            'coordenacao_nome', c."NO_COORDENACAO",
                            'area', s."CO_AREA", 'area_nome', a."NO_AREA",
                            'cargo', s."CO_CARGO_SOLICITADO",
                            'cargo_rotulo', private."FC_CARGO_SOLICITACAO_ACESSO"(null, s."CO_CARGO_SOLICITADO"),
                            'cargo_outro', s."DS_CARGO_OUTRO",
                            'motivo_recusa', s."CO_MOTIVO_RECUSA")
    from public."TB_SOLICITACAO_ACESSO" s
    left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
    left join public."TB_AREA" a on a."CO_AREA" = s."CO_AREA"
   where s.user_id = (select auth.uid())
      or lower(s.email) = lower(coalesce((select auth.jwt() ->> 'email'), '-'))
   order by (s.status = 'pendente') desc, s.created_at desc
   limit 1;
$$;

COMMENT ON FUNCTION public.obter_minha_solicitacao_acesso() IS 'Último pedido de acesso de quem está autenticado, com área, cargo, lotação (setor), coordenação e motivo da recusa.';

CREATE OR REPLACE FUNCTION public.listar_solicitacoes_acesso(p_status text DEFAULT 'pendente'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'user_id', s.user_id, 'email', s.email, 'nome', s.nome, 'setor', s.setor,
      'justificativa', s.justificativa, 'status', s.status, 'created_at', s.created_at,
      'updated_at', s.updated_at,
      'observacao_admin', s.observacao_admin, 'coordenacao', s."CO_COORDENACAO",
      'coordenacao_nome', c."NO_COORDENACAO", 'area', coalesce(s."CO_AREA", c."CO_AREA"),
      'area_nome', ar."NO_AREA",
      'cargo', s."CO_CARGO_SOLICITADO",
      'cargo_rotulo', private."FC_CARGO_SOLICITACAO_ACESSO"(null, s."CO_CARGO_SOLICITADO"),
      'cargo_outro', s."DS_CARGO_OUTRO",
      'reativacao', p.id is not null,
      'desativada_em', h.alterado_em,
      'desativada_por', h.autor,
      'motivo_desativacao', h.motivo,
      'grupo_anterior', p.perfil
    ) order by s.created_at)
      from public."TB_SOLICITACAO_ACESSO" s
      left join public."TB_COORDENACAO" c on c."CO_COORDENACAO" = s."CO_COORDENACAO"
      left join public."TB_AREA" ar on ar."CO_AREA" = coalesce(s."CO_AREA", c."CO_AREA")
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
$$;

COMMENT ON FUNCTION public.listar_solicitacoes_acesso(p_status text) IS 'Pedidos de acesso (admin global: todos; coordenador: os da própria coordenação), com área, cargo, lotação (setor), justificativa e dados da reativação.';

drop function private."FC_APROVAR_AMPLIACAO_ACESSO"(uuid, text);
drop function private."FC_REGISTRAR_AMPLIACAO_ACESSO"(public."TB_PERFIL_USUARIO", text, text, text, text, text, text);

-- 3. A tabela ------------------------------------------------------------------------------------
alter table public."TB_SOLICITACAO_ACESSO"
  drop constraint "CK_SOLICACESSO_AMPLIACAO",
  drop constraint "CK_SOLICACESSO_TIPO",
  drop column "TP_NIVEL",
  drop column "NO_RECURSO",
  drop column "TP_SOLICITACAO";

COMMENT ON TABLE public."TB_SOLICITACAO_ACESSO" IS 'Pedidos de acesso ao MONITORA de quem entrou com Google e não tem perfil ativo (só por aprovação). Status: pendente, aprovado, recusado, cancelado.';

commit;
