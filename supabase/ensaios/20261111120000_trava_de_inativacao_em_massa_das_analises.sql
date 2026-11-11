/*
  ENSAIO de 20261111120000_trava_de_inativacao_em_massa_das_analises.sql
  Roda no SQL Editor (papel postgres) ANTES de aplicar. Termina em rollback.
  Confere: o corpo vigente é o conhecido; aplica a função da trava e o corpo novo
  (iguais aos da migration; o teste confere); a trava recusa 11.089 na Saúde
  Indígena, aceita 10, aceita 11.089 com a liberação da sessão; o md5 novo.
  Ok = NOTICE "Ensaio 20261111120000 ok" e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.finalizar_sync_analises_lotes(uuid)'))) is distinct from '087cfc07ca94fecee3e822ccf8cbcdfb' then
    raise exception 'Ensaio: o corpo vigente de finalizar_sync_analises_lotes não é o que a migration conhece.';
  end if;
end;
$guarda$;

create function private."FC_CONFERIR_INATIVACAO_EM_MASSA"(p_planilha text, p_a_inativar integer)
returns text
language plpgsql
stable
set search_path to ''
as $guarda_fn$
declare
  v_ativas integer;
  v_limite integer;
begin
  if coalesce(p_a_inativar, 0) <= 0 then
    return null;
  end if;
  -- O mesmo limite do incremental (FC_DESATIVAR_AUSENTES_DA_PLANILHA): 2% das ativas, no mínimo 25.
  select count(*)::integer into v_ativas
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
     and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha);
  v_limite := greatest(25, ceil(v_ativas * 0.02)::integer);
  if p_a_inativar <= v_limite then
    return null;
  end if;
  -- Limpeza intencional: só quem opera o banco liga, na própria sessão do SQL Editor.
  if coalesce(current_setting('monitora.permitir_inativacao_em_massa', true), '') = 'sim' then
    return null;
  end if;
  return format(
    'Envio completo recusado: desativaria %s análises da planilha %s (limite %s, 2%% das %s ativas). '
    'Nada foi desativado. Confira se a planilha tem todos os editais; uma limpeza intencional é feita '
    'por quem opera o banco (set monitora.permitir_inativacao_em_massa = ''sim'').',
    p_a_inativar, p_planilha, v_limite, v_ativas);
end;
$guarda_fn$;

comment on function private."FC_CONFERIR_INATIVACAO_EM_MASSA"(text, integer) is
  'Trava do envio completo das análises (finalizar_sync_analises_lotes): devolve o motivo da recusa quando desativaria mais que 2% das ativas da planilha (mínimo 25), ou null. Liberada só com monitora.permitir_inativacao_em_massa = sim na sessão. 20261111120000.';

revoke all on function private."FC_CONFERIR_INATIVACAO_EM_MASSA"(text, integer) from public;

CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_lotes(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_normalizados integer:=0;
  v_inativados integer:=0;
  v_a_inativar integer:=0;
  v_bloqueio text;
  v_editais integer:=0;
  v_editais_inativados integer:=0;
  v_editais_monitora integer:=0;
  v_removido integer:=0;
  v_alteradas integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
  v_modo text;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync % nao esta em processamento por lotes.',p_sync_id; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0),
         modo
    into v_cursor,v_alteradas,v_modo
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status='processando'
  order by id desc limit 1;
  if not found then raise exception 'Sync % nao esta em processamento por lotes.',p_sync_id; end if;

  -- [so-full] (20261022140000) A finalização FULL desativa o que não está no staging. Num sync
  -- INCREMENTAL_ACTIVE o staging tem só as linhas alteradas: finalizar como FULL desativaria o
  -- resto da planilha. O incremental finaliza por finalizar_sync_analises_incremental.
  if coalesce(v_modo, 'FULL') <> 'FULL' then
    raise exception 'Sync % é % e não é finalizado pelo fluxo FULL (finalizar_sync_analises_lotes). O incremental usa finalizar_sync_analises_incremental.', p_sync_id, v_modo
      using errcode = '22023';
  end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_cursor<v_max then
    raise exception 'Ainda existem linhas FATO pendentes: cursor %, max %.',v_cursor,v_max;
  end if;

  -- [por-planilha] porteiro antes de qualquer desativação.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_keys on commit drop as
  select distinct public.analises_make_chave_natural(
    public.jsonb_text_or_null(s.payload,'grupo'),
    coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
    coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
    public.jsonb_text_or_null(s.payload,'codigo_vaga'),
    public.jsonb_text_or_null(s.payload,'id'),
    public.jsonb_text_or_null(s.payload,'candidato')) as chave_natural
  from public."TM_ANALISE_CURRICULAR" s
  where s.sync_id=p_sync_id and s.entidade='FATO_ANALISES';

  select count(*)::integer into v_normalizados from tmp_keys;
  create unique index tmp_keys_idx on tmp_keys(chave_natural);
  analyze tmp_keys;

  -- [trava-em-massa] 20261111120000: conta antes de desativar e recusa o envio que
  -- desativaria em massa (11/11/2026: um FULL com a planilha só dos editais novos
  -- desativou 11.089 análises). Os lotes já gravados ficam; nada é desativado e o
  -- sync termina em erro com o motivo (o Apps Script descarta o estado e segue).
  select count(*)::integer into v_a_inativar
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo is true
     and a."CO_PLANILHA"=v_planilha
     and a."TP_ORIGEM_REGISTRO"='PLANILHA'
     and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
     and not exists(select 1 from tmp_keys k where k.chave_natural=a.chave_natural);
  v_bloqueio := private."FC_CONFERIR_INATIVACAO_EM_MASSA"(v_planilha, v_a_inativar);
  if v_bloqueio is not null then
    delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
    update public."TL_SYNC_ANALISE"
    set status='erro', erro=v_bloqueio, finished_at=now(), updated_at=now()
    where sync_id=p_sync_id;
    return jsonb_build_object('ok',false,'sync_id',p_sync_id,'bloqueado',true,
      'a_inativar',v_a_inativar,'motivo',v_bloqueio);
  end if;

  -- [por-planilha] só desativa análises desta planilha.
  -- [monitora] nunca a linha publicada pela ficha (TP_ORIGEM_REGISTRO MONITORA).
  update public."TB_ANALISE_CURRICULAR" a
  set ativo=false,updated_at=now()
  where a.ativo is true
    and a."CO_PLANILHA"=v_planilha
    and a."TP_ORIGEM_REGISTRO"='PLANILHA'
    and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
    and not exists(select 1 from tmp_keys k where k.chave_natural=a.chave_natural);
  get diagnostics v_inativados=row_count;

  create temporary table tmp_editais on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by grupo,unidade,edital order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  -- [monitora] o edital com a avaliação no MONITORA não é cadastrado nem mudado pela planilha.
  delete from tmp_editais x where public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, x.edital);
  get diagnostics v_editais_monitora=row_count;

  if v_total_editais>0 then
    -- [por-planilha] edital já cadastrado por outra planilha: recusa.
    select count(*)::integer into v_conflitos
    from public."TB_EDITAL_ANALISE" e
    join tmp_editais x
      on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
     and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
     and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
    where e."CO_PLANILHA"<>v_planilha;
    if v_conflitos>0 then
      raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
        using errcode = '22023';
    end if;

    insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
    select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
    from tmp_editais
    on conflict(grupo,unidade,edital) do update set
      ativo=excluded.ativo,
      data_inicio_analise=excluded.data_inicio_analise,
      data_fim_analise=excluded.data_fim_analise,
      updated_at=now()
    where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA";
    get diagnostics v_editais=row_count;

    -- [por-planilha] só desativa editais desta planilha.
    -- [monitora] nem o edital com a avaliação no MONITORA.
    update public."TB_EDITAL_ANALISE" e
    set ativo=false,updated_at=now()
    where e.ativo is true
      and e."CO_PLANILHA"=v_planilha
      and not public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, e.edital)
      and not exists(select 1 from tmp_editais x
        where e.grupo is not distinct from x.grupo
          and e.unidade=x.unidade
          and e.edital=x.edital);
    get diagnostics v_editais_inativados=row_count;
  end if;

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','lotes',
    'planilha',v_planilha,
    'staging',v_total_staging,
    'fato_analises_recebidas',v_total_fato,
    'fato_analises_normalizadas',v_normalizados,
    'fato_analises_upsert',v_alteradas,
    'fato_analises_inativadas',v_inativados,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais,
    'analises_editais_inativados',v_editais_inativados,
    'analises_editais_monitora_ignorados',v_editais_monitora,
    'staging_removido',v_removido);

  update public."TL_SYNC_ANALISE"
  set status='processado',
      resultado=v_result,
      erro=null,
      total_processados=v_normalizados,
      finished_at=now(),
      updated_at=now()
  where sync_id=p_sync_id;

  return v_result;
end;
$function$;

do $confere$
declare
  v_msg text;
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.finalizar_sync_analises_lotes(uuid)'))) is distinct from '18df29fd6b152d7981ab91579849ded6' then
    raise exception 'Ensaio: o corpo aplicado não é o da migration.';
  end if;
  v_msg := private."FC_CONFERIR_INATIVACAO_EM_MASSA"('saude-indigena', 11089);
  if v_msg is null then raise exception 'Ensaio: a trava deixou passar 11.089.'; end if;
  raise notice 'Recusa: %', v_msg;
  if private."FC_CONFERIR_INATIVACAO_EM_MASSA"('saude-indigena', 10) is not null then
    raise exception 'Ensaio: a trava recusou 10.';
  end if;
  if private."FC_CONFERIR_INATIVACAO_EM_MASSA"('saude-indigena', 0) is not null then
    raise exception 'Ensaio: a trava recusou 0.';
  end if;
  perform set_config('monitora.permitir_inativacao_em_massa', 'sim', true);
  if private."FC_CONFERIR_INATIVACAO_EM_MASSA"('saude-indigena', 11089) is not null then
    raise exception 'Ensaio: a liberação da sessão não liberou.';
  end if;
  raise notice 'Ensaio 20261111120000 ok.';
end;
$confere$;

rollback;
