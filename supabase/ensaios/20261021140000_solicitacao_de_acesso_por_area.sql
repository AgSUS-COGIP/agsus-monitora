/*
  ENSAIO de 20261021140000_solicitacao_de_acesso_por_area.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica a migration dentro
  da transação e confere, como pessoas reais (claims do JWT, papel
  authenticated):
    1. listar_opcoes_da_solicitacao_acesso: as três áreas, DSEI/CASAI e
       projetos;
    2. registrar_solicitacao_acesso como um usuário comum: justificativa
       aleatória, cargo de outra área e DSEI fora da lista recusados (22023);
       pedido válido da Saúde Indígena gravado; o segundo envio EDITA o
       mesmo pedido; cancelar deixa 'cancelado'; novo pedido de Projetos;
    3. um usuário comum não lista nem recusa pedidos (42501);
    4. recusar_solicitacao_acesso como administrador global: "Outro" curto
       recusado; motivo da lista com complemento grava o código e o texto
       legível; a pessoa vê o motivo em obter_minha_solicitacao_acesso.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 1. Colunas novas do pedido ------------------------------------------------
alter table public."TB_SOLICITACAO_ACESSO"
  add column if not exists "CO_AREA" text,
  add column if not exists "CO_CARGO_SOLICITADO" text,
  add column if not exists "DS_CARGO_OUTRO" text,
  add column if not exists "CO_MOTIVO_RECUSA" text;

do $colunas$
begin
  if not exists (select 1 from pg_constraint where conname = 'FK_AREA_SOLICACESSO') then
    alter table public."TB_SOLICITACAO_ACESSO"
      add constraint "FK_AREA_SOLICACESSO" foreign key ("CO_AREA")
      references public."TB_AREA" ("CO_AREA") on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'CK_SOLICACESSO_CARGO') then
    alter table public."TB_SOLICITACAO_ACESSO"
      add constraint "CK_SOLICACESSO_CARGO" check (
        "CO_CARGO_SOLICITADO" is null
        or ("CO_AREA" is not null and "CO_CARGO_SOLICITADO" in (
          'AVALIADOR', 'GESTOR', 'CONTRATACAO', 'COORDENACAO_DSEI', 'COORDENACAO_PROJETO',
          'COORDENACAO_SEDE', 'JURIDICO', 'APOIO', 'CONSULTA', 'OUTRO')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'CK_SOLICACESSO_CARGOOUTRO') then
    alter table public."TB_SOLICITACAO_ACESSO"
      add constraint "CK_SOLICACESSO_CARGOOUTRO" check (
        case when "CO_CARGO_SOLICITADO" = 'OUTRO'
             then length(btrim(coalesce("DS_CARGO_OUTRO", ''))) between 3 and 120
             else "DS_CARGO_OUTRO" is null end);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'CK_SOLICACESSO_MOTIVORECUSA') then
    alter table public."TB_SOLICITACAO_ACESSO"
      add constraint "CK_SOLICACESSO_MOTIVORECUSA" check (
        "CO_MOTIVO_RECUSA" is null
        or (status = 'recusado' and "CO_MOTIVO_RECUSA" in (
          'FORA_DO_PUBLICO', 'VINCULO_NAO_CONFIRMADO', 'AREA_OU_LOTACAO', 'JA_TEM_ACESSO',
          'JUSTIFICATIVA_INSUFICIENTE', 'OUTRO')));
  end if;
end;
$colunas$;

create index if not exists "IN_FKSOLICACESSO_COAREA" on public."TB_SOLICITACAO_ACESSO" ("CO_AREA");

comment on table public."TB_SOLICITACAO_ACESSO" is
  'Pedidos de acesso ao MONITORA de quem entrou com Google e não tem perfil ativo (só por aprovação). Status: pendente, aprovado, recusado, cancelado.';
comment on column public."TB_SOLICITACAO_ACESSO".setor is
  'Unidade ou lotação informada: DSEI/CASAI (Saúde Indígena), projeto (Projetos) ou setor/diretoria (SEDE); nos pedidos anteriores a 20261021140000, "Área / setor" livre.';
comment on column public."TB_SOLICITACAO_ACESSO"."CO_AREA" is
  'Área do pedido (aba da tela): projetos, saude-indigena ou sede. Nulo nos pedidos antigos e na reativação sem área.';
comment on column public."TB_SOLICITACAO_ACESSO"."CO_CARGO_SOLICITADO" is
  'Cargo/função da lista fixa da área (private."FC_CARGO_SOLICITACAO_ACESSO"); sugere o grupo na aprovação.';
comment on column public."TB_SOLICITACAO_ACESSO"."DS_CARGO_OUTRO" is
  'Descrição do cargo quando "CO_CARGO_SOLICITADO" = OUTRO (3 a 120 caracteres).';
comment on column public."TB_SOLICITACAO_ACESSO"."CO_MOTIVO_RECUSA" is
  'Motivo da recusa (private."FC_MOTIVO_RECUSA_SOLICITACAO"); o texto legível fica em observacao_admin.';

-- 2. Listas fixas -----------------------------------------------------------
create or replace function private."FC_CARGO_SOLICITACAO_ACESSO"(p_area text, p_codigo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select c.rotulo
    from (values
      ('AVALIADOR', 'Avaliador(a) da análise curricular', '{projetos,saude-indigena,sede}'::text[]),
      ('GESTOR', 'Gestor(a) de processo seletivo', '{projetos,saude-indigena,sede}'::text[]),
      ('CONTRATACAO', 'Contratação e admissão', '{projetos,saude-indigena,sede}'::text[]),
      ('COORDENACAO_DSEI', 'Coordenação de DSEI ou CASAI', '{saude-indigena}'::text[]),
      ('COORDENACAO_PROJETO', 'Coordenação de projeto', '{projetos}'::text[]),
      ('COORDENACAO_SEDE', 'Coordenação ou diretoria', '{sede}'::text[]),
      ('JURIDICO', 'Jurídico', '{sede}'::text[]),
      ('APOIO', 'Apoio administrativo', '{projetos,saude-indigena,sede}'::text[]),
      ('CONSULTA', 'Consulta e acompanhamento', '{projetos,saude-indigena,sede}'::text[]),
      ('OUTRO', 'Outro', '{projetos,saude-indigena,sede}'::text[])
    ) as c(codigo, rotulo, areas)
   where c.codigo = p_codigo and (p_area is null or p_area = any (c.areas));
$function$;
comment on function private."FC_CARGO_SOLICITACAO_ACESSO"(text, text) is
  'Rótulo do cargo/função do pedido de acesso, se o código existe e vale para a área (área nula: só o código). A mesma lista de CARGOS_DA_SOLICITACAO (src/lib/solicitacao-de-acesso.ts).';
revoke all on function private."FC_CARGO_SOLICITACAO_ACESSO"(text, text) from public, anon, authenticated;

create or replace function private."FC_MOTIVO_RECUSA_SOLICITACAO"(p_codigo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select m.rotulo
    from (values
      ('FORA_DO_PUBLICO', 'Não faz parte do público do MONITORA'),
      ('VINCULO_NAO_CONFIRMADO', 'Vínculo com a área não confirmado'),
      ('AREA_OU_LOTACAO', 'Área ou lotação não confere'),
      ('JA_TEM_ACESSO', 'Já tem acesso por outra conta'),
      ('JUSTIFICATIVA_INSUFICIENTE', 'Justificativa insuficiente'),
      ('OUTRO', 'Outro')
    ) as m(codigo, rotulo)
   where m.codigo = p_codigo;
$function$;
comment on function private."FC_MOTIVO_RECUSA_SOLICITACAO"(text) is
  'Rótulo do motivo de recusa do pedido de acesso. A mesma lista de MOTIVOS_DE_RECUSA (src/lib/solicitacao-de-acesso.ts).';
revoke all on function private."FC_MOTIVO_RECUSA_SOLICITACAO"(text) from public, anon, authenticated;

-- 3. Opções da tela ---------------------------------------------------------
drop function if exists public.listar_coordenacoes_ativas();

create or replace function public.listar_opcoes_da_solicitacao_acesso()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', a."CO_AREA", 'nome', a."NO_AREA") order by a."NU_ORDEM")
        from public."TB_AREA" a), '[]'::jsonb),
    'unidades', coalesce((
      select jsonb_agg(u.item order by u.area, u.tipo, u.nome)
        from (
          select 'saude-indigena' as area, t.tipo, t.nome_oficial as nome,
                 jsonb_build_object('area', 'saude-indigena', 'nome', t.nome_oficial, 'sigla', t.sigla, 'tipo', t.tipo) as item
            from public."TD_UNIDADE" t
           where t.ativo
          union all
          select 'projetos', '', x."NO_UNIDADE",
                 jsonb_build_object('area', 'projetos', 'nome', x."NO_UNIDADE", 'sigla', null, 'tipo', null)
            from public."TA_UNIDADE_AREA" x
           where x."CO_AREA" = 'projetos'
        ) u), '[]'::jsonb),
    'coordenacoes', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', c."CO_COORDENACAO", 'nome', c."NO_COORDENACAO", 'area', c."CO_AREA")
                       order by c."NO_COORDENACAO")
        from public."TB_COORDENACAO" c
       where c."ST_ATIVO"), '[]'::jsonb));
end;
$function$;
comment on function public.listar_opcoes_da_solicitacao_acesso() is
  'Opções da tela de solicitação de acesso (autenticado, mesmo sem perfil): áreas, unidades (DSEI/CASAI de TD_UNIDADE; projetos de TA_UNIDADE_AREA) e coordenações ativas.';
revoke all on function public.listar_opcoes_da_solicitacao_acesso() from public, anon;
grant execute on function public.listar_opcoes_da_solicitacao_acesso() to authenticated;

-- 4. Registrar (ou editar o pendente) ---------------------------------------
drop function if exists public.registrar_solicitacao_acesso(text, text, text, text);

create or replace function public.registrar_solicitacao_acesso(
  p_nome text,
  p_area text default null,
  p_cargo text default null,
  p_cargo_outro text default null,
  p_lotacao text default null,
  p_justificativa text default null,
  p_coordenacao text default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
comment on function public.registrar_solicitacao_acesso(text, text, text, text, text, text, text) is
  'Registra o pedido de acesso de quem está autenticado (área, cargo da lista, lotação, justificativa com 3 palavras) ou, com pedido pendente, o atualiza. Conta desativada (reativação): área opcional. Nunca concede acesso.';
revoke all on function public.registrar_solicitacao_acesso(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.registrar_solicitacao_acesso(text, text, text, text, text, text, text) to authenticated;

-- 5. Cancelar o próprio pedido pendente ---------------------------------------
create or replace function public.cancelar_minha_solicitacao_acesso()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Usuário não autenticado' using errcode = '42501'; end if;
  update public."TB_SOLICITACAO_ACESSO"
     set status = 'cancelado', updated_at = now()
   where user_id = v_uid and status = 'pendente'
  returning id into v_id;
  if v_id is null then
    raise exception 'Nenhum pedido pendente para cancelar.' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'cancelado');
end;
$function$;
comment on function public.cancelar_minha_solicitacao_acesso() is
  'Cancela o pedido de acesso pendente de quem está autenticado (status cancelado).';
revoke all on function public.cancelar_minha_solicitacao_acesso() from public, anon;
grant execute on function public.cancelar_minha_solicitacao_acesso() to authenticated;

-- 6. Leituras com área, cargo e motivo ----------------------------------------
create or replace function public.obter_minha_solicitacao_acesso()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
comment on function public.obter_minha_solicitacao_acesso() is
  'Último pedido de acesso de quem está autenticado, com área, cargo, lotação (setor), coordenação e motivo da recusa.';
revoke all on function public.obter_minha_solicitacao_acesso() from public, anon;
grant execute on function public.obter_minha_solicitacao_acesso() to authenticated;

create or replace function public.listar_solicitacoes_acesso(p_status text DEFAULT 'pendente'::text)
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
$function$;
comment on function public.listar_solicitacoes_acesso(text) is
  'Pedidos de acesso (admin global: todos; coordenador: os da própria coordenação), com área, cargo, lotação (setor), justificativa e dados da reativação.';
revoke all on function public.listar_solicitacoes_acesso(text) from public, anon;
grant execute on function public.listar_solicitacoes_acesso(text) to authenticated;

-- 7. Recusar com motivo da lista ----------------------------------------------
drop function if exists public.recusar_solicitacao_acesso(uuid, text);

create or replace function public.recusar_solicitacao_acesso(p_solicitacao_id uuid, p_motivo text, p_complemento text default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_req public."TB_SOLICITACAO_ACESSO";
  v_rotulo text := private."FC_MOTIVO_RECUSA_SOLICITACAO"(p_motivo);
  v_complemento text := nullif(btrim(regexp_replace(coalesce(p_complemento, ''), '\s+', ' ', 'g')), '');
  v_texto text;
begin
  if v_rotulo is null then
    raise exception 'Escolha o motivo da recusa na lista.' using errcode = '22023';
  end if;
  if p_motivo = 'OUTRO' then
    if length(coalesce(v_complemento, '')) not between 15 and 500
       or not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 3) then
      raise exception 'Descreva o motivo: de 15 a 500 caracteres, com pelo menos 3 palavras.' using errcode = '22023';
    end if;
    v_texto := v_complemento;
  else
    if v_complemento is not null
       and (length(v_complemento) > 500 or not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 1)) then
      raise exception 'O complemento precisa ser um texto de até 500 caracteres.' using errcode = '22023';
    end if;
    v_texto := v_rotulo || coalesce(' — ' || v_complemento, '');
  end if;

  select * into v_req from public."TB_SOLICITACAO_ACESSO" where id = p_solicitacao_id for update;
  if v_req.id is null then raise exception 'Solicitação de acesso não encontrada'; end if;
  if v_req.status <> 'pendente' then raise exception 'Solicitação já avaliada (status atual: %)', v_req.status; end if;
  if v_gestor = 'coordenador' and v_req."CO_COORDENACAO" is distinct from private."FC_COORDENACAO_USUARIO"() then
    raise exception 'Solicitação de outra coordenação' using errcode = '42501';
  end if;
  update public."TB_SOLICITACAO_ACESSO"
     set status = 'recusado', avaliado_por = (select auth.uid()), avaliado_em = now(),
         "CO_MOTIVO_RECUSA" = p_motivo, observacao_admin = v_texto, updated_at = now()
   where id = p_solicitacao_id;
  return jsonb_build_object('ok', true, 'solicitacao_id', v_req.id, 'email', v_req.email, 'status', 'recusado',
                            'motivo', p_motivo, 'observacao_admin', v_texto);
end;
$function$;
comment on function public.recusar_solicitacao_acesso(uuid, text, text) is
  'Recusa o pedido de acesso com motivo da lista fixa (OUTRO pede descrição); grava quem avaliou, quando e o texto legível que a pessoa vê. Admin global ou coordenador da coordenação pedida.';
revoke all on function public.recusar_solicitacao_acesso(uuid, text, text) from public, anon;
grant execute on function public.recusar_solicitacao_acesso(uuid, text, text) to authenticated;


-- Quem faz o ensaio: um usuário comum ativo e um administrador global.
select set_config('ensaio.usuario', json_build_object('sub', u.user_id, 'email', lower(u.email), 'role', 'authenticated')::text, true)
  from public."TB_PERFIL_USUARIO" u
 where u.ativo and u.perfil = 'usuario' and u.user_id is not null
   and not exists (select 1 from public."TB_SOLICITACAO_ACESSO" s where s.user_id = u.user_id and s.status = 'pendente')
 order by u.updated_at desc limit 1;
select set_config('ensaio.admin', json_build_object('sub', u.user_id, 'email', lower(u.email), 'role', 'authenticated')::text, true)
  from public."TB_PERFIL_USUARIO" u join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = u.perfil
 where u.ativo and g."ST_ADMIN_GLOBAL" and u.user_id is not null
 order by u.updated_at desc limit 1;
select set_config('ensaio.dsei', (select t.nome_oficial from public."TD_UNIDADE" t where t.ativo and t.tipo = 'DSEI' order by 1 limit 1), true);
select set_config('ensaio.projeto', (select x."NO_UNIDADE" from public."TA_UNIDADE_AREA" x where x."CO_AREA" = 'projetos' order by 1 limit 1), true);

set local role authenticated;

do $ensaio$
declare
  v_opcoes jsonb;
  v_r jsonb;
  v_id uuid;
  v_minha jsonb;
  v_falhou boolean;
  v_just text := 'Vou avaliar as fichas da análise curricular do edital do DSEI.';
begin
  perform set_config('request.jwt.claims', current_setting('ensaio.usuario'), true);

  -- 1. Opções.
  v_opcoes := public.listar_opcoes_da_solicitacao_acesso();
  assert jsonb_array_length(v_opcoes -> 'areas') = 3, 'áreas: ' || (v_opcoes -> 'areas')::text;
  assert (select count(*) from jsonb_array_elements(v_opcoes -> 'unidades') e where e ->> 'area' = 'saude-indigena') >= 34, 'sem DSEI/CASAI';
  assert (select count(*) from jsonb_array_elements(v_opcoes -> 'unidades') e where e ->> 'area' = 'projetos') >= 1, 'sem projetos';

  -- 2. Recusas de validação.
  begin
    perform public.registrar_solicitacao_acesso('Pessoa do Ensaio', 'saude-indigena', 'AVALIADOR', null,
                                                current_setting('ensaio.dsei'), 'dsdfsdfsfsa dvdddddddd TESTE FDFDF', null);
    v_falhou := false;
  exception when sqlstate '22023' then v_falhou := true;
  end;
  assert v_falhou, 'justificativa aleatória passou';
  begin
    perform public.registrar_solicitacao_acesso('Pessoa do Ensaio', 'saude-indigena', 'JURIDICO', null,
                                                current_setting('ensaio.dsei'), v_just, null);
    v_falhou := false;
  exception when sqlstate '22023' then v_falhou := true;
  end;
  assert v_falhou, 'cargo da SEDE passou na Saúde Indígena';
  begin
    perform public.registrar_solicitacao_acesso('Pessoa do Ensaio', 'saude-indigena', 'AVALIADOR', null,
                                                'DSEI Inexistente', v_just, null);
    v_falhou := false;
  exception when sqlstate '22023' then v_falhou := true;
  end;
  assert v_falhou, 'DSEI fora da lista passou';

  -- Pedido válido, edição e cancelamento.
  v_r := public.registrar_solicitacao_acesso('Pessoa do Ensaio', 'saude-indigena', 'AVALIADOR', null,
                                             current_setting('ensaio.dsei'), v_just, null);
  v_id := (v_r ->> 'id')::uuid;
  assert (v_r ->> 'atualizado')::boolean = false, 'primeiro envio: ' || v_r::text;
  v_r := public.registrar_solicitacao_acesso('Pessoa do Ensaio Editada', 'saude-indigena', 'OUTRO', 'Apoio técnico distrital',
                                             current_setting('ensaio.dsei'), v_just, null);
  assert (v_r ->> 'id')::uuid = v_id and (v_r ->> 'atualizado')::boolean, 'edição criou outro pedido: ' || v_r::text;
  v_minha := public.obter_minha_solicitacao_acesso();
  assert v_minha ->> 'cargo' = 'OUTRO' and v_minha ->> 'cargo_outro' = 'Apoio técnico distrital'
     and v_minha ->> 'area_nome' = 'Saúde Indígena' and v_minha ->> 'setor' = current_setting('ensaio.dsei'),
     'leitura do pedido: ' || v_minha::text;
  v_r := public.cancelar_minha_solicitacao_acesso();
  assert v_r ->> 'status' = 'cancelado', 'cancelar: ' || v_r::text;
  assert public.obter_minha_solicitacao_acesso() ->> 'status' = 'cancelado', 'não cancelou';
  v_r := public.registrar_solicitacao_acesso('Pessoa do Ensaio', 'projetos', 'COORDENACAO_PROJETO', null,
                                             current_setting('ensaio.projeto'), 'Coordeno a equipe do projeto e acompanho os editais.', null);
  v_id := (v_r ->> 'id')::uuid;

  -- 3. Usuário comum não lista nem recusa.
  begin
    perform public.listar_solicitacoes_acesso('pendente');
    v_falhou := false;
  exception when sqlstate '42501' then v_falhou := true;
  end;
  assert v_falhou, 'usuário comum listou os pedidos';
  begin
    perform public.recusar_solicitacao_acesso(v_id, 'FORA_DO_PUBLICO', null);
    v_falhou := false;
  exception when sqlstate '42501' then v_falhou := true;
  end;
  assert v_falhou, 'usuário comum recusou um pedido';

  -- 4. Administrador global recusa com motivo.
  perform set_config('request.jwt.claims', current_setting('ensaio.admin'), true);
  assert exists (select 1 from jsonb_array_elements(public.listar_solicitacoes_acesso('pendente')) e
                  where (e ->> 'id')::uuid = v_id and e ->> 'cargo_rotulo' = 'Coordenação de projeto'
                    and e ->> 'area' = 'projetos'), 'pedido sem área/cargo na lista do admin';
  begin
    perform public.recusar_solicitacao_acesso(v_id, 'OUTRO', 'curto');
    v_falhou := false;
  exception when sqlstate '22023' then v_falhou := true;
  end;
  assert v_falhou, 'Outro curto passou';
  v_r := public.recusar_solicitacao_acesso(v_id, 'AREA_OU_LOTACAO', '  o projeto   informado é outro ');
  assert v_r ->> 'observacao_admin' = 'Área ou lotação não confere — o projeto informado é outro', 'texto: ' || v_r::text;

  -- A pessoa vê a recusa (no ensaio tudo tem o mesmo now(): lê o pedido pelo id).
  perform set_config('request.jwt.claims', current_setting('ensaio.usuario'), true);
  assert exists (select 1 from public."TB_SOLICITACAO_ACESSO" s where s.id = v_id and s.status = 'recusado'
                   and s."CO_MOTIVO_RECUSA" = 'AREA_OU_LOTACAO'), 'recusa não gravada';
  v_minha := public.obter_minha_solicitacao_acesso();
  assert v_minha ? 'motivo_recusa', 'leitura sem motivo_recusa';
end;
$ensaio$;

select 'ensaio ok' as resultado;

rollback;
