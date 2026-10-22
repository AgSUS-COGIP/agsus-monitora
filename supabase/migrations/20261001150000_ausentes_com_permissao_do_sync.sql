/*
  Correção de 20261001140000: a sincronização incremental travou.

  A sincronização roda com a conta de serviço (service_role), que não tem uso
  do esquema private. finalizar_sync_analises_incremental passou a chamar
  private."FC_DESATIVAR_AUSENTES_DA_PLANILHA" e falhava ("permission denied
  for schema private"): o sync da Saúde Indígena das 09:45 de 01/10/2026 ficou
  em "processando" e nenhum outro rodou depois.

  A função vai para public, como as outras peças da sincronização
  (FC_PLANILHA_DO_SYNC_ANALISE, FC_VALIDAR_GRUPO_STAGING_ANALISE): execução só
  para service_role. O finalizar passa a chamá-la de lá. A de private sai.

  Rollback: supabase/rollback/20261001150000_ausentes_com_permissao_do_sync.sql
*/
begin;

CREATE FUNCTION public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id uuid, p_planilha text, p_total_local integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_manifesto integer;
  v_ativas integer;
  v_limite integer;
  v_ausentes integer;
  v_desativadas integer := 0;
begin
  select count(*)::integer into v_manifesto from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id;
  if v_manifesto = 0 then
    return jsonb_build_object('desativadas', 0, 'motivo', 'sem manifesto (script incremental antigo)');
  end if;
  if v_manifesto <> coalesce(p_total_local, -1) then
    return jsonb_build_object('desativadas', 0,
      'motivo', format('manifesto incompleto: %s de %s linhas', v_manifesto, p_total_local));
  end if;

  select count(*)::integer into v_ativas
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo and a."CO_PLANILHA" = p_planilha;
  v_limite := greatest(25, ceil(v_ativas * 0.02)::integer);

  select count(*)::integer into v_ausentes
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      where m."CO_SYNC" = p_sync_id and m."DS_CHAVE_NATURAL" = a.chave_natural);

  if v_ausentes > v_limite then
    return jsonb_build_object('desativadas', 0, 'ausentes', v_ausentes,
      'motivo', format('remoção bloqueada: %s ausentes passa do limite de %s', v_ausentes, v_limite));
  end if;

  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      where m."CO_SYNC" = p_sync_id and m."DS_CHAVE_NATURAL" = a.chave_natural);
  get diagnostics v_desativadas = row_count;
  return jsonb_build_object('desativadas', v_desativadas, 'ausentes', v_ausentes, 'limite', v_limite);
end;
$function$;
comment on function public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(uuid, text, integer) is 'Fim do sync incremental: desativa análises ativas da planilha (de editais ativos) que não vieram no manifesto. Não faz nada com manifesto vazio/incompleto ou remoção acima de 2% (mín. 25). Só service_role.';
revoke all on function public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(uuid, text, integer) from public, anon, authenticated;
grant execute on function public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(uuid, text, integer) to service_role;

CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_esperado integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_editais_upsert integer:=0;
  v_editais_inativados integer:=0;
  v_removido integer:=0;
  v_total_ativos_local integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
  v_duplicadas integer:=0;
  v_ausentes jsonb;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(linhas_staging,0),
         coalesce(nullif(resultado->>'incremental_total_ativos_local','')::integer,0)
    into v_cursor,v_esperado,v_total_ativos_local
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')
    and coalesce((resultado->>'incremental_preparado')::boolean,false)=true
  order by id desc limit 1;
  if not found then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_total_staging <> v_esperado then raise exception 'Staging incremental divergente: esperado %, encontrado %.',v_esperado,v_total_staging; end if;
  if v_cursor < v_max then raise exception 'Ainda existem linhas FATO incrementais pendentes: cursor %, max %.',v_cursor,v_max; end if;
  if v_total_editais < 1 then raise exception 'DIM_EDITAIS ausente no incremental.'; end if;

  -- [por-planilha] porteiro antes de gravar editais.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_editais_incremental on commit drop as
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
    select *,row_number() over(partition by coalesce(public.analises_norm_key(grupo),''),coalesce(public.analises_norm_key(unidade),''),coalesce(public.analises_norm_key(edital),'') order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  -- [por-planilha] edital já cadastrado por outra planilha: recusa.
  select count(*)::integer into v_conflitos
  from public."TB_EDITAL_ANALISE" e
  join tmp_editais_incremental x
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
  from tmp_editais_incremental
  -- Pela chave normalizada (uq_analises_editais_norm): "DSEI  Parintins" e
  -- "DSEI Parintins" são o mesmo edital; o texto passa a ser o da planilha.
  on conflict(grupo_norm,unidade_norm,edital_norm) do update set
    grupo=excluded.grupo,
    unidade=excluded.unidade,
    edital=excluded.edital,
    ativo=excluded.ativo,
    data_inicio_analise=excluded.data_inicio_analise,
    data_fim_analise=excluded.data_fim_analise,
    updated_at=now()
  where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA";
  get diagnostics v_editais_upsert=row_count;

  -- [por-planilha] só desativa editais desta planilha.
  update public."TB_EDITAL_ANALISE" e
  set ativo=false,updated_at=now()
  where e.ativo is true
    and e."CO_PLANILHA"=v_planilha
    and not exists(select 1 from tmp_editais_incremental x
      where e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
        and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
        and e.edital_norm=coalesce(public.analises_norm_key(x.edital),''));
  get diagnostics v_editais_inativados=row_count;

  -- [por-planilha] Mesmo candidato (id_origem) duas vezes na mesma vaga e edital:
  -- fica ativo só o registro mais recente. O incremental só envia o que mudou;
  -- quando o nome é corrigido na planilha, a chave natural muda, entra um
  -- registro novo e o antigo ficava ativo como "Pendente" (14 casos em 30/09).
  with r as (
    select a.id,
           row_number() over (partition by a.edital_norm, a.codigo_vaga, a.id_origem
                              order by a.updated_at desc, a.id desc) as rn
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo
       and a."CO_PLANILHA" = v_planilha
       and nullif(btrim(a.id_origem), '') is not null
       and nullif(btrim(a.codigo_vaga), '') is not null
  )
  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
    from r
   where a.id = r.id and r.rn > 1;
  get diagnostics v_duplicadas=row_count;

  -- Quem saiu da planilha (manifesto da comparação): ver 20261001140000.
  v_ausentes := public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id, v_planilha, v_total_ativos_local);
  delete from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id or "DT_CRIACAO" < now() - interval '2 days';

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','incremental',
    'planilha',v_planilha,
    'total_ativos_local',v_total_ativos_local,
    'fato_analises_enviadas',v_total_fato,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais_upsert,
    'analises_editais_inativados',v_editais_inativados,
    'staging',v_total_staging,
    'staging_removido',v_removido,
    'historico_inativado',coalesce((v_ausentes->>'desativadas')::integer,0),
    'ausentes',v_ausentes,
    'analises_duplicadas_inativadas',v_duplicadas
  );

  update public."TL_SYNC_ANALISE"
  set status='processado',resultado=v_result,erro=null,total_processados=v_total_fato,
      finished_at=now(),updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return v_result;
end;
$function$;

drop function private."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(uuid, text, integer);

commit;
