-- Desfaz comemorações e marcos (volta as três funções de 20260930140000).
begin;

drop function if exists public.obter_marcos_da_area(text);

CREATE OR REPLACE FUNCTION public.obter_situacao_do_sistema()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.obter_modulos_e_abas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.salvar_situacao_modulos(p_alteracoes jsonb, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

alter table public."TB_SITUACAO_SISTEMA"
  drop constraint if exists "CK_SITUACAOSISTEMA_STCOMEMORACAO",
  drop column if exists "ST_COMEMORACAO";

commit;
