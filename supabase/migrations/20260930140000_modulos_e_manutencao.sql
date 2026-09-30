/*
  MÓDULOS E ABAS: ATIVAR, DESATIVAR, MANUTENÇÃO E SELO BETA

  Configurações ganha a seção "Módulos e abas". A situação de cada coisa fica
  no banco, em quatro níveis:
    - sistema inteiro  public."TB_SITUACAO_SISTEMA" (uma linha só);
    - área             public."TB_AREA"      (+ ST_ATIVO, situação);
    - aba              public."TB_ABA"       (ST_ATIVO já existia; + situação, ST_BETA);
    - aba numa área    public."RL_ABA_AREA"  (ST_ATIVO já existia; + situação);
    - painel externo   public."TB_PAINEL_EXTERNO" (ativo/em_manutencao já existiam).
  Situação: ATIVA ou MANUTENCAO, com mensagem e previsão de volta opcionais.
  Desativado = some do menu; em manutenção = aparece com aviso e, ao abrir,
  quem não é administrador global vê a tela de manutenção (o administrador
  entra, para testar). O selo BETA deixa de ser fixo no código (ST_BETA).

  RPCs
    obter_situacao_do_sistema()                 todos (logados): sistema + áreas
    listar_abas_do_menu()                       + tp_situacao, mensagem, previsão e beta
    obter_modulos_e_abas()                      admin global: a árvore inteira + histórico
    salvar_situacao_modulos(p_alteracoes, p_motivo)  admin global, em lote, com histórico
  Guardas: não desativa a última área ativa; motivo de 3 a 500 caracteres.
  Histórico: public."TH_SITUACAO_MODULO".

  Nesta fase a manutenção é aplicada pela tela (menu + página); as RPCs de cada
  aba não bloqueiam. Rollback: supabase/rollback/20260930140000_modulos_e_manutencao.sql
*/
begin;

-- 1. Situação nas tabelas que já existem -------------------------------------------
alter table public."TB_AREA"
  add column "ST_ATIVO" varchar(1) not null default 'S',
  add column "TP_SITUACAO" text not null default 'ATIVA',
  add column "DS_MENSAGEM_MANUTENCAO" text,
  add column "DT_PREVISAO_RETORNO" date,
  add constraint "CK_AREA_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  add constraint "CK_AREA_TPSITUACAO" check ("TP_SITUACAO" in ('ATIVA', 'MANUTENCAO')),
  add constraint "CK_AREA_MENSAGEM" check (coalesce(length("DS_MENSAGEM_MANUTENCAO"), 0) <= 500);
comment on column public."TB_AREA"."ST_ATIVO" is 'S: a área aparece no menu; N: desativada (some para todos).';
comment on column public."TB_AREA"."TP_SITUACAO" is 'ATIVA ou MANUTENCAO (aparece com aviso; só administrador global entra).';
comment on column public."TB_AREA"."DS_MENSAGEM_MANUTENCAO" is 'Mensagem mostrada na manutenção (até 500 caracteres).';
comment on column public."TB_AREA"."DT_PREVISAO_RETORNO" is 'Previsão de volta da manutenção (opcional).';
comment on constraint "CK_AREA_STATIVO" on public."TB_AREA" is 'Flag S/N.';
comment on constraint "CK_AREA_TPSITUACAO" on public."TB_AREA" is 'Situações válidas.';
comment on constraint "CK_AREA_MENSAGEM" on public."TB_AREA" is 'Mensagem até 500 caracteres.';

alter table public."TB_ABA"
  add column "TP_SITUACAO" text not null default 'ATIVA',
  add column "DS_MENSAGEM_MANUTENCAO" text,
  add column "DT_PREVISAO_RETORNO" date,
  add column "ST_BETA" varchar(1) not null default 'N',
  add constraint "CK_ABA_TPSITUACAO" check ("TP_SITUACAO" in ('ATIVA', 'MANUTENCAO')),
  add constraint "CK_ABA_MENSAGEM" check (coalesce(length("DS_MENSAGEM_MANUTENCAO"), 0) <= 500),
  add constraint "CK_ABA_STBETA" check ("ST_BETA" in ('S', 'N'));
comment on column public."TB_ABA"."TP_SITUACAO" is 'ATIVA ou MANUTENCAO em todas as áreas (RL_ABA_AREA pode pôr só numa área).';
comment on column public."TB_ABA"."DS_MENSAGEM_MANUTENCAO" is 'Mensagem mostrada na manutenção (até 500 caracteres).';
comment on column public."TB_ABA"."DT_PREVISAO_RETORNO" is 'Previsão de volta da manutenção (opcional).';
comment on column public."TB_ABA"."ST_BETA" is 'S: mostra o selo BETA no menu.';
comment on constraint "CK_ABA_TPSITUACAO" on public."TB_ABA" is 'Situações válidas.';
comment on constraint "CK_ABA_MENSAGEM" on public."TB_ABA" is 'Mensagem até 500 caracteres.';
comment on constraint "CK_ABA_STBETA" on public."TB_ABA" is 'Flag S/N.';
update public."TB_ABA" set "ST_BETA" = 'S' where "CO_ABA" in ('entrevistas', 'recursos');

alter table public."RL_ABA_AREA"
  add column "TP_SITUACAO" text not null default 'ATIVA',
  add column "DS_MENSAGEM_MANUTENCAO" text,
  add column "DT_PREVISAO_RETORNO" date,
  add constraint "CK_ABAAREA_TPSITUACAO" check ("TP_SITUACAO" in ('ATIVA', 'MANUTENCAO')),
  add constraint "CK_ABAAREA_MENSAGEM" check (coalesce(length("DS_MENSAGEM_MANUTENCAO"), 0) <= 500);
comment on column public."RL_ABA_AREA"."TP_SITUACAO" is 'ATIVA ou MANUTENCAO só nesta área.';
comment on column public."RL_ABA_AREA"."DS_MENSAGEM_MANUTENCAO" is 'Mensagem mostrada na manutenção (até 500 caracteres).';
comment on column public."RL_ABA_AREA"."DT_PREVISAO_RETORNO" is 'Previsão de volta da manutenção (opcional).';
comment on constraint "CK_ABAAREA_TPSITUACAO" on public."RL_ABA_AREA" is 'Situações válidas.';
comment on constraint "CK_ABAAREA_MENSAGEM" on public."RL_ABA_AREA" is 'Mensagem até 500 caracteres.';

-- 2. Sistema inteiro ---------------------------------------------------------------
create table public."TB_SITUACAO_SISTEMA" (
  "CO_SITUACAO_SISTEMA" smallint not null default 1,
  "TP_SITUACAO" text not null default 'ATIVA',
  "DS_MENSAGEM_MANUTENCAO" text,
  "DT_PREVISAO_RETORNO" date,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_TB_SITUACAO_SISTEMA" primary key ("CO_SITUACAO_SISTEMA"),
  constraint "CK_SITUACAOSISTEMA_UMA" check ("CO_SITUACAO_SISTEMA" = 1),
  constraint "CK_SITUACAOSISTEMA_TPSITUACAO" check ("TP_SITUACAO" in ('ATIVA', 'MANUTENCAO')),
  constraint "CK_SITUACAOSISTEMA_MENSAGEM" check (coalesce(length("DS_MENSAGEM_MANUTENCAO"), 0) <= 500)
);
comment on table public."TB_SITUACAO_SISTEMA" is 'Situação do MONITORA inteiro (uma linha): em manutenção, só administrador global entra.';
comment on column public."TB_SITUACAO_SISTEMA"."CO_SITUACAO_SISTEMA" is 'Sempre 1 (linha única).';
comment on column public."TB_SITUACAO_SISTEMA"."TP_SITUACAO" is 'ATIVA ou MANUTENCAO.';
comment on column public."TB_SITUACAO_SISTEMA"."DS_MENSAGEM_MANUTENCAO" is 'Mensagem mostrada na manutenção (até 500 caracteres).';
comment on column public."TB_SITUACAO_SISTEMA"."DT_PREVISAO_RETORNO" is 'Previsão de volta (opcional).';
comment on column public."TB_SITUACAO_SISTEMA"."DT_ATUALIZACAO" is 'Última alteração.';
comment on column public."TB_SITUACAO_SISTEMA"."CO_USUARIO_ATUALIZACAO" is 'Autor da última alteração (auth.users.id).';
comment on constraint "CK_SITUACAOSISTEMA_UMA" on public."TB_SITUACAO_SISTEMA" is 'Linha única.';
comment on constraint "CK_SITUACAOSISTEMA_TPSITUACAO" on public."TB_SITUACAO_SISTEMA" is 'Situações válidas.';
comment on constraint "CK_SITUACAOSISTEMA_MENSAGEM" on public."TB_SITUACAO_SISTEMA" is 'Mensagem até 500 caracteres.';
insert into public."TB_SITUACAO_SISTEMA" ("CO_SITUACAO_SISTEMA") values (1);
alter table public."TB_SITUACAO_SISTEMA" enable row level security;
revoke all on public."TB_SITUACAO_SISTEMA" from public, anon, authenticated;

-- 3. Histórico ---------------------------------------------------------------------
create table public."TH_SITUACAO_MODULO" (
  "CO_HISTORICO_SITUACAO" bigint generated always as identity,
  "TP_ESCOPO" text not null,
  "CO_AREA" text,
  "CO_ABA" text,
  "CO_PAINEL" uuid,
  "DS_CAMPO" text not null,
  "DS_VALOR_ANTERIOR" text,
  "DS_VALOR_NOVO" text,
  "DS_MOTIVO" text not null,
  "DT_ALTERACAO" timestamptz not null default now(),
  "CO_USUARIO" uuid,
  constraint "PK_TH_SITUACAO_MODULO" primary key ("CO_HISTORICO_SITUACAO"),
  constraint "CK_HISTSITUACAO_TPESCOPO" check ("TP_ESCOPO" in ('sistema', 'area', 'aba', 'aba_area', 'painel'))
);
comment on table public."TH_SITUACAO_MODULO" is 'Histórico (auditoria) das mudanças de situação de sistema, áreas, abas e painéis.';
comment on column public."TH_SITUACAO_MODULO"."CO_HISTORICO_SITUACAO" is 'Identificador do registro.';
comment on column public."TH_SITUACAO_MODULO"."TP_ESCOPO" is 'sistema, area, aba, aba_area ou painel.';
comment on column public."TH_SITUACAO_MODULO"."CO_AREA" is 'Área (escopos area e aba_area).';
comment on column public."TH_SITUACAO_MODULO"."CO_ABA" is 'Aba (escopos aba e aba_area).';
comment on column public."TH_SITUACAO_MODULO"."CO_PAINEL" is 'Painel externo (escopo painel).';
comment on column public."TH_SITUACAO_MODULO"."DS_CAMPO" is 'ativo, situacao, mensagem, previsao ou beta.';
comment on column public."TH_SITUACAO_MODULO"."DS_VALOR_ANTERIOR" is 'Valor antes.';
comment on column public."TH_SITUACAO_MODULO"."DS_VALOR_NOVO" is 'Valor depois.';
comment on column public."TH_SITUACAO_MODULO"."DS_MOTIVO" is 'Motivo informado.';
comment on column public."TH_SITUACAO_MODULO"."DT_ALTERACAO" is 'Quando.';
comment on column public."TH_SITUACAO_MODULO"."CO_USUARIO" is 'Quem (auth.users.id).';
comment on constraint "CK_HISTSITUACAO_TPESCOPO" on public."TH_SITUACAO_MODULO" is 'Escopos válidos.';
create index "IN_HISTSITUACAO_DTALTERACAO" on public."TH_SITUACAO_MODULO" ("DT_ALTERACAO" desc);
comment on index public."IN_HISTSITUACAO_DTALTERACAO" is 'Histórico do mais recente ao mais antigo.';
alter table public."TH_SITUACAO_MODULO" enable row level security;
revoke all on public."TH_SITUACAO_MODULO" from public, anon, authenticated;

-- 4. Leitura para todos (logados) --------------------------------------------------
create function public.obter_situacao_do_sistema()
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
    'admin_global', private.is_master(),
    'sistema', (select json_build_object(
        'situacao', s."TP_SITUACAO", 'mensagem', s."DS_MENSAGEM_MANUTENCAO",
        'previsao', s."DT_PREVISAO_RETORNO", 'atualizado_em', s."DT_ATUALIZACAO")
      from public."TB_SITUACAO_SISTEMA" s where s."CO_SITUACAO_SISTEMA" = 1),
    'areas', coalesce((select json_agg(json_build_object(
        'co_area', a."CO_AREA", 'ativo', a."ST_ATIVO" = 'S', 'situacao', a."TP_SITUACAO",
        'mensagem', a."DS_MENSAGEM_MANUTENCAO", 'previsao', a."DT_PREVISAO_RETORNO")
        order by a."NU_ORDEM") from public."TB_AREA" a), '[]'::json)
  )
  where (select auth.uid()) is not null;
$function$;
comment on function public.obter_situacao_do_sistema() is
  'Situação do sistema inteiro e de cada área (ativo, manutenção, mensagem, previsão) para o menu e a tela de manutenção. Qualquer pessoa logada.';
revoke all on function public.obter_situacao_do_sistema() from public, anon;
grant execute on function public.obter_situacao_do_sistema() to authenticated, service_role;

create or replace function public.listar_abas_do_menu()
 returns json
 language sql
 stable
 set search_path to ''
as $function$
  select coalesce(json_agg(json_build_object(
      'co_aba', a."CO_ABA",
      'no_aba', a."NO_ABA",
      'ds_icone', a."DS_ICONE",
      'nu_ordem', a."NU_ORDEM",
      'co_view', a."CO_VIEW",
      'co_recurso', a."CO_RECURSO",
      'tp_aba', a."TP_ABA",
      'st_beta', a."ST_BETA" = 'S',
      'tp_situacao', a."TP_SITUACAO",
      'ds_mensagem', a."DS_MENSAGEM_MANUTENCAO",
      'dt_previsao', a."DT_PREVISAO_RETORNO",
      'areas', coalesce((
        select json_agg(json_build_object(
            'co_area', r."CO_AREA",
            'nu_ordem', coalesce(r."NU_ORDEM", a."NU_ORDEM"),
            'co_view', coalesce(r."CO_VIEW", a."CO_VIEW"),
            'ds_icone', coalesce(r."DS_ICONE", a."DS_ICONE"),
            'tp_situacao', r."TP_SITUACAO",
            'ds_mensagem', r."DS_MENSAGEM_MANUTENCAO",
            'dt_previsao', r."DT_PREVISAO_RETORNO"
          ) order by ar."NU_ORDEM", r."CO_AREA")
        from public."RL_ABA_AREA" r
        join public."TB_AREA" ar on ar."CO_AREA" = r."CO_AREA"
        where r."CO_ABA" = a."CO_ABA"
          and r."ST_ATIVO" = 'S'
          and ar."ST_ATIVO" = 'S'
      ), '[]'::json)
    ) order by a."NU_ORDEM", a."CO_ABA"), '[]'::json)
  from public."TB_ABA" a
  where a."ST_ATIVO" = 'S';
$function$;

-- 5. Administração (admin global) --------------------------------------------------
create function public.obter_modulos_e_abas()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global gerencia módulos e abas' using errcode = '42501';
  end if;
  return json_build_object(
    'sistema', (select json_build_object(
        'situacao', s."TP_SITUACAO", 'mensagem', s."DS_MENSAGEM_MANUTENCAO",
        'previsao', s."DT_PREVISAO_RETORNO", 'atualizado_em', s."DT_ATUALIZACAO")
      from public."TB_SITUACAO_SISTEMA" s where s."CO_SITUACAO_SISTEMA" = 1),
    'areas', coalesce((select json_agg(json_build_object(
        'co_area', a."CO_AREA", 'no_area', a."NO_AREA", 'ativo', a."ST_ATIVO" = 'S',
        'situacao', a."TP_SITUACAO", 'mensagem', a."DS_MENSAGEM_MANUTENCAO",
        'previsao', a."DT_PREVISAO_RETORNO",
        'abas', coalesce((select json_agg(json_build_object(
            'co_aba', r."CO_ABA", 'ativo', r."ST_ATIVO" = 'S', 'situacao', r."TP_SITUACAO",
            'mensagem', r."DS_MENSAGEM_MANUTENCAO", 'previsao', r."DT_PREVISAO_RETORNO")
            order by coalesce(r."NU_ORDEM", b."NU_ORDEM"), r."CO_ABA")
          from public."RL_ABA_AREA" r join public."TB_ABA" b on b."CO_ABA" = r."CO_ABA"
          where r."CO_AREA" = a."CO_AREA"), '[]'::json))
        order by a."NU_ORDEM") from public."TB_AREA" a), '[]'::json),
    'abas', coalesce((select json_agg(json_build_object(
        'co_aba', b."CO_ABA", 'no_aba', b."NO_ABA", 'ds_icone', b."DS_ICONE", 'nu_ordem', b."NU_ORDEM",
        'ativo', b."ST_ATIVO" = 'S', 'situacao', b."TP_SITUACAO", 'mensagem', b."DS_MENSAGEM_MANUTENCAO",
        'previsao', b."DT_PREVISAO_RETORNO", 'beta', b."ST_BETA" = 'S')
        order by b."NU_ORDEM") from public."TB_ABA" b), '[]'::json),
    'paineis', coalesce((select json_agg(json_build_object(
        'id', p.id, 'titulo', p.titulo, 'ativo', p.ativo, 'em_manutencao', p.em_manutencao)
        order by p.ordem, p.titulo) from public."TB_PAINEL_EXTERNO" p), '[]'::json),
    'historico', coalesce((select json_agg(h order by h.quando desc) from (
        select t."TP_ESCOPO" escopo, t."CO_AREA" area, t."CO_ABA" aba, t."CO_PAINEL" painel,
               t."DS_CAMPO" campo, t."DS_VALOR_ANTERIOR" anterior, t."DS_VALOR_NOVO" novo,
               t."DS_MOTIVO" motivo, t."DT_ALTERACAO" quando,
               (select u.email from public."TB_PERFIL_USUARIO" u where u.user_id = t."CO_USUARIO" limit 1) autor
          from public."TH_SITUACAO_MODULO" t
         order by t."DT_ALTERACAO" desc, t."CO_HISTORICO_SITUACAO" desc limit 50) h), '[]'::json)
  );
end;
$function$;
comment on function public.obter_modulos_e_abas() is
  'Árvore de Módulos e abas para Configurações (sistema, áreas com suas abas, abas, painéis externos e as 50 últimas mudanças). Só administrador global.';
revoke all on function public.obter_modulos_e_abas() from public, anon;
grant execute on function public.obter_modulos_e_abas() to authenticated, service_role;

create function public.salvar_situacao_modulos(p_alteracoes jsonb, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  item jsonb;
  v_escopo text;
  v_area text;
  v_aba text;
  v_painel uuid;
  v_campo text;
  v_valor text;
  v_anterior text;
  v_qt integer := 0;
  v_uid uuid := (select auth.uid());
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global gerencia módulos e abas' using errcode = '42501';
  end if;
  if jsonb_typeof(p_alteracoes) is distinct from 'array' or jsonb_array_length(p_alteracoes) not between 1 and 200 then
    raise exception 'Alterações inválidas' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe um motivo entre 3 e 500 caracteres' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_alteracoes) loop
    v_escopo := item ->> 'escopo';
    v_area := nullif(item ->> 'area', '');
    v_aba := nullif(item ->> 'aba', '');
    v_painel := nullif(item ->> 'painel', '')::uuid;
    v_campo := item ->> 'campo';
    v_valor := nullif(btrim(coalesce(item ->> 'valor', '')), '');

    if v_campo not in ('ativo', 'situacao', 'mensagem', 'previsao', 'beta') then
      raise exception 'Campo inválido: %', v_campo using errcode = '22023';
    end if;
    if v_campo in ('ativo', 'beta') and v_valor not in ('S', 'N') then
      raise exception 'Use S ou N em %', v_campo using errcode = '22023';
    end if;
    if v_campo = 'situacao' and v_valor not in ('ATIVA', 'MANUTENCAO') then
      raise exception 'Situação inválida: %', v_valor using errcode = '22023';
    end if;
    if v_campo = 'mensagem' and length(coalesce(v_valor, '')) > 500 then
      raise exception 'Mensagem com mais de 500 caracteres' using errcode = '22023';
    end if;
    if v_campo = 'previsao' and v_valor is not null and v_valor !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Previsão deve ser uma data (aaaa-mm-dd)' using errcode = '22023';
    end if;
    if v_campo = 'beta' and v_escopo <> 'aba' then
      raise exception 'O selo BETA é da aba' using errcode = '22023';
    end if;

    if v_escopo = 'sistema' then
      if v_campo not in ('situacao', 'mensagem', 'previsao') then
        raise exception 'O sistema inteiro só entra ou sai de manutenção' using errcode = '22023';
      end if;
      select case v_campo when 'situacao' then s."TP_SITUACAO" when 'mensagem' then s."DS_MENSAGEM_MANUTENCAO"
                          else s."DT_PREVISAO_RETORNO"::text end
        into v_anterior from public."TB_SITUACAO_SISTEMA" s where s."CO_SITUACAO_SISTEMA" = 1;
      if v_anterior is not distinct from v_valor then continue; end if;
      update public."TB_SITUACAO_SISTEMA" set
        "TP_SITUACAO" = case when v_campo = 'situacao' then v_valor else "TP_SITUACAO" end,
        "DS_MENSAGEM_MANUTENCAO" = case when v_campo = 'mensagem' then v_valor else "DS_MENSAGEM_MANUTENCAO" end,
        "DT_PREVISAO_RETORNO" = case when v_campo = 'previsao' then v_valor::date else "DT_PREVISAO_RETORNO" end,
        "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
       where "CO_SITUACAO_SISTEMA" = 1;

    elsif v_escopo = 'area' then
      if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
        raise exception 'Área inválida' using errcode = '22023';
      end if;
      select case v_campo when 'ativo' then a."ST_ATIVO" when 'situacao' then a."TP_SITUACAO"
                          when 'mensagem' then a."DS_MENSAGEM_MANUTENCAO" else a."DT_PREVISAO_RETORNO"::text end
        into v_anterior from public."TB_AREA" a where a."CO_AREA" = v_area;
      if v_anterior is not distinct from v_valor then continue; end if;
      update public."TB_AREA" set
        "ST_ATIVO" = case when v_campo = 'ativo' then v_valor else "ST_ATIVO" end,
        "TP_SITUACAO" = case when v_campo = 'situacao' then v_valor else "TP_SITUACAO" end,
        "DS_MENSAGEM_MANUTENCAO" = case when v_campo = 'mensagem' then v_valor else "DS_MENSAGEM_MANUTENCAO" end,
        "DT_PREVISAO_RETORNO" = case when v_campo = 'previsao' then v_valor::date else "DT_PREVISAO_RETORNO" end
       where "CO_AREA" = v_area;

    elsif v_escopo = 'aba' then
      if not exists (select 1 from public."TB_ABA" b where b."CO_ABA" = v_aba) then
        raise exception 'Aba inválida' using errcode = '22023';
      end if;
      select case v_campo when 'ativo' then b."ST_ATIVO" when 'situacao' then b."TP_SITUACAO"
                          when 'mensagem' then b."DS_MENSAGEM_MANUTENCAO" when 'beta' then b."ST_BETA"
                          else b."DT_PREVISAO_RETORNO"::text end
        into v_anterior from public."TB_ABA" b where b."CO_ABA" = v_aba;
      if v_anterior is not distinct from v_valor then continue; end if;
      update public."TB_ABA" set
        "ST_ATIVO" = case when v_campo = 'ativo' then v_valor else "ST_ATIVO" end,
        "TP_SITUACAO" = case when v_campo = 'situacao' then v_valor else "TP_SITUACAO" end,
        "DS_MENSAGEM_MANUTENCAO" = case when v_campo = 'mensagem' then v_valor else "DS_MENSAGEM_MANUTENCAO" end,
        "DT_PREVISAO_RETORNO" = case when v_campo = 'previsao' then v_valor::date else "DT_PREVISAO_RETORNO" end,
        "ST_BETA" = case when v_campo = 'beta' then v_valor else "ST_BETA" end,
        "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
       where "CO_ABA" = v_aba;

    elsif v_escopo = 'aba_area' then
      if not exists (select 1 from public."RL_ABA_AREA" r where r."CO_ABA" = v_aba and r."CO_AREA" = v_area) then
        raise exception 'Aba % não existe na área %', v_aba, v_area using errcode = '22023';
      end if;
      select case v_campo when 'ativo' then r."ST_ATIVO" when 'situacao' then r."TP_SITUACAO"
                          when 'mensagem' then r."DS_MENSAGEM_MANUTENCAO" else r."DT_PREVISAO_RETORNO"::text end
        into v_anterior from public."RL_ABA_AREA" r where r."CO_ABA" = v_aba and r."CO_AREA" = v_area;
      if v_anterior is not distinct from v_valor then continue; end if;
      update public."RL_ABA_AREA" set
        "ST_ATIVO" = case when v_campo = 'ativo' then v_valor else "ST_ATIVO" end,
        "TP_SITUACAO" = case when v_campo = 'situacao' then v_valor else "TP_SITUACAO" end,
        "DS_MENSAGEM_MANUTENCAO" = case when v_campo = 'mensagem' then v_valor else "DS_MENSAGEM_MANUTENCAO" end,
        "DT_PREVISAO_RETORNO" = case when v_campo = 'previsao' then v_valor::date else "DT_PREVISAO_RETORNO" end,
        "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
       where "CO_ABA" = v_aba and "CO_AREA" = v_area;

    elsif v_escopo = 'painel' then
      if v_campo not in ('ativo', 'situacao') then
        raise exception 'Painel externo aceita só ativo e situação' using errcode = '22023';
      end if;
      select case v_campo when 'ativo' then case when p.ativo then 'S' else 'N' end
                          else case when p.em_manutencao then 'MANUTENCAO' else 'ATIVA' end end
        into v_anterior from public."TB_PAINEL_EXTERNO" p where p.id = v_painel;
      if not found then raise exception 'Painel inválido' using errcode = '22023'; end if;
      if v_anterior is not distinct from v_valor then continue; end if;
      update public."TB_PAINEL_EXTERNO" set
        ativo = case when v_campo = 'ativo' then v_valor = 'S' else ativo end,
        em_manutencao = case when v_campo = 'situacao' then v_valor = 'MANUTENCAO' else em_manutencao end,
        updated_at = now()
       where id = v_painel;

    else
      raise exception 'Escopo inválido: %', v_escopo using errcode = '22023';
    end if;

    insert into public."TH_SITUACAO_MODULO"
      ("TP_ESCOPO", "CO_AREA", "CO_ABA", "CO_PAINEL", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
    values (v_escopo, v_area, v_aba, v_painel, v_campo, v_anterior, v_valor, btrim(p_motivo), v_uid);
    v_qt := v_qt + 1;
  end loop;

  -- Guarda: pelo menos uma área ativa (senão ninguém teria menu).
  if not exists (select 1 from public."TB_AREA" a where a."ST_ATIVO" = 'S') then
    raise exception 'Pelo menos uma área precisa ficar ativa' using errcode = '23514';
  end if;

  return jsonb_build_object('alteradas', v_qt);
end;
$function$;
comment on function public.salvar_situacao_modulos(jsonb, text) is
  'Grava, em lote, ativo/situação/mensagem/previsão/beta de sistema, áreas, abas, abas por área e painéis externos, com histórico em TH_SITUACAO_MODULO. Itens: {escopo, area?, aba?, painel?, campo, valor}. Só administrador global.';
revoke all on function public.salvar_situacao_modulos(jsonb, text) from public, anon;
grant execute on function public.salvar_situacao_modulos(jsonb, text) to authenticated, service_role;

commit;
