/*
  ENSAIO DE 20261117190000_cronograma_manual_e_datas_do_cadastro

  Roda a migration inteira dentro de uma transação que termina em ROLLBACK: nada fica gravado.
  Reprova (raise exception) se:
    - algum edital com o cálculo automático mudar de status, etapa, percentual, próxima etapa
      ou datas no estado do cronograma (só os manuais podem mudar);
    - o 120/2026 não sair com tem_cronograma, cálculo manual, situação suspenso, 13 etapas e
      percentual, próxima etapa e datas preenchidos;
    - sobrar edital automático com as datas do cadastro diferentes das etapas;
    - o gatilho não acompanhar uma etapa nova e a retirada dela;
    - algum edital manual tiver as datas do cadastro mudadas.
  Mostra: os editais cujo estado mudou e os que tiveram as datas do cadastro refeitas.
*/
begin;

create temp table ensaio_antes on commit drop as
select m.id, m.edital, m.cronograma_automatico as auto, m.data_inicio, m.data_fim,
       private."FC_ESTADO_DO_CRONOGRAMA"(m.id, (now() at time zone 'America/Sao_Paulo')::date) as estado
  from public."TB_MONITORAMENTO_INDIGENA" m;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date)')), chr(13), ''))
       is distinct from 'f1a2b05143c74861b1a4971f937ac9cf' then
    raise exception 'FC_ESTADO_DO_CRONOGRAMA: o corpo no banco não é o de 17/11/2026 (md5). Já aplicada, ou alguém mudou: junte as mudanças antes.';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.get_nucleo_cronograma_resumo()')), chr(13), ''))
       is distinct from '436e0e97170a4d8ee43e01705ff574fb' then
    raise exception 'get_nucleo_cronograma_resumo: o corpo no banco não é o de 17/11/2026 (md5). Já aplicada, ou alguém mudou: junte as mudanças antes.';
  end if;
  if to_regprocedure('private."FC_TG_DATAS_DO_CADASTRO"()') is not null then
    raise exception 'FC_TG_DATAS_DO_CADASTRO já existe: migration já aplicada.';
  end if;
end;
$guarda$;

-- 1. Estado do cronograma: etapas, cálculo e situação separados.
create or replace function private."FC_ESTADO_DO_CRONOGRAMA"(p_monitoramento_id uuid, p_data date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_monitor public."TB_MONITORAMENTO_INDIGENA"%rowtype;
  v_total integer := 0;
  v_concluidas integer := 0;
  v_primeira public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_ultima public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_atual public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_proxima public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_status text;
  v_etapa text;
  v_percentual numeric := 0;
  v_dias integer;
  v_calculo text;
  v_situacao text;
begin
  select * into v_monitor
  from public."TB_MONITORAMENTO_INDIGENA"
  where id = p_monitoramento_id;

  if not found then
    return jsonb_build_object('status', null, 'etapa', null, 'tem_cronograma', false);
  end if;

  v_calculo := case when v_monitor.cronograma_automatico then 'automatico' else 'manual' end;

  select count(*)::integer,
         count(*) filter (where data_fim < p_data)::integer
  into v_total, v_concluidas
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id;

  if v_total = 0 then
    v_status := coalesce(nullif(v_monitor.status_override,''), nullif(v_monitor.status,''), 'Cronograma pendente');
    v_etapa := coalesce(nullif(v_monitor.etapa_override,''), nullif(v_monitor.etapa,''), 'Cronograma pendente');
  else
    select * into v_primeira
    from public."TB_CRONOGRAMA_MONIT_INDIG"
    where monitoramento_id = p_monitoramento_id
    order by data_inicio, ordem
    limit 1;

    select * into v_ultima
    from public."TB_CRONOGRAMA_MONIT_INDIG"
    where monitoramento_id = p_monitoramento_id
    order by data_fim desc, ordem desc
    limit 1;

    select * into v_atual
    from public."TB_CRONOGRAMA_MONIT_INDIG"
    where monitoramento_id = p_monitoramento_id
      and p_data between data_inicio and data_fim
    order by data_inicio desc, ordem desc
    limit 1;

    select * into v_proxima
    from public."TB_CRONOGRAMA_MONIT_INDIG"
    where monitoramento_id = p_monitoramento_id
      and data_inicio > p_data
    order by data_inicio, ordem
    limit 1;

    v_percentual := round(least(100, greatest(0, (v_concluidas::numeric / nullif(v_total,0)) * 100)), 1);

    if p_data < v_primeira.data_inicio then
      v_status := 'Planejado';
      v_etapa := 'Aguardando: ' || v_primeira.atividade;
    elsif p_data > v_ultima.data_fim then
      v_status := 'Concluído';
      v_etapa := v_ultima.atividade;
      v_percentual := 100;
    elsif v_atual.id is not null then
      v_status := 'Em andamento';
      v_etapa := v_atual.atividade;
    elsif v_proxima.id is not null then
      v_status := 'Em andamento';
      v_etapa := 'Aguardando: ' || v_proxima.atividade;
    else
      v_status := 'Em andamento';
      v_etapa := coalesce(v_ultima.atividade, 'Cronograma em andamento');
    end if;

    if v_proxima.id is not null then
      v_dias := v_proxima.data_inicio - p_data;
    end if;

    if v_monitor.cronograma_automatico then
      v_status := coalesce(nullif(v_monitor.status_override,''), v_status);
      v_etapa := coalesce(nullif(v_monitor.etapa_override,''), v_etapa);
    else
      -- Cálculo manual: valem o status e a etapa digitados; sem eles, o calculado.
      v_status := coalesce(nullif(v_monitor.status_override,''), nullif(v_monitor.status,''), v_status);
      v_etapa := coalesce(nullif(v_monitor.etapa_override,''), nullif(v_monitor.etapa,''), v_etapa);
    end if;
  end if;

  v_situacao := case
    when translate(lower(v_status), 'áâãàéêíóôõúç', 'aaaaeeiooouc') like '%suspens%' then 'suspenso'
    when translate(lower(v_status), 'áâãàéêíóôõúç', 'aaaaeeiooouc') like '%parali%' then 'paralisado'
    when translate(lower(v_status), 'áâãàéêíóôõúç', 'aaaaeeiooouc') like '%cancel%' then 'cancelado'
  end;

  if v_total = 0 then
    return jsonb_build_object(
      'status', v_status,
      'etapa', v_etapa,
      'tem_cronograma', false,
      'calculo', v_calculo,
      'situacao', v_situacao,
      'percentual', 0,
      'proxima_atividade', null,
      'proxima_data', null,
      'dias_para_proxima', null
    );
  end if;

  return jsonb_build_object(
    'status', v_status,
    'etapa', v_etapa,
    'tem_cronograma', true,
    'calculo', v_calculo,
    'situacao', v_situacao,
    'percentual', v_percentual,
    'atividade_atual', case when v_atual.id is null then null else v_atual.atividade end,
    'proxima_atividade', case when v_proxima.id is null then null else v_proxima.atividade end,
    'proxima_data', case when v_proxima.id is null then null else v_proxima.data_inicio end,
    'dias_para_proxima', v_dias,
    'data_inicio', v_primeira.data_inicio,
    'data_fim', v_ultima.data_fim,
    'total_etapas', v_total,
    'etapas_concluidas', v_concluidas
  );
end;
$function$;

comment on function private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date) is 'Estado do cronograma de um edital no dia p_data: o cálculo de public.get_monitoramento_cronograma_estado sem a checagem de permissão. tem_cronograma = há etapas; calculo = automatico | manual (no manual valem o status e a etapa digitados; percentual, atividade atual, próxima etapa e datas saem das etapas nos dois); situacao = suspenso | paralisado | cancelado | null, do status final (20261117190000). Só para funções SECURITY DEFINER do banco; ninguém executa direto.';

-- 2. Resumo do Núcleo: manual com etapas não é "sem cronograma".
create or replace function public.get_nucleo_cronograma_resumo()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then
    raise exception 'Sem permissao para consultar resumo da Equipe Nucleo';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'edital', m.edital,
      'unidade', m.unidade,
      'status', e ->> 'status',
      'etapa', e ->> 'etapa',
      'cronograma_automatico', m.cronograma_automatico,
      'cronograma_total', coalesce(c.total, 0),
      'tem_cronograma', coalesce(c.total, 0) > 0,
      'calculo', e ->> 'calculo',
      'situacao', e ->> 'situacao',
      'tem_resultado_final', coalesce(c.tem_resultado_final, false),
      'percentual', coalesce((e ->> 'percentual')::numeric, 0),
      'proxima_atividade', e ->> 'proxima_atividade',
      'proxima_data', e ->> 'proxima_data',
      'dias_para_proxima', (e ->> 'dias_para_proxima')::integer,
      'status_override', m.status_override,
      'alerta_tipo', case
        when nullif(m.status_override, '') is not null or (e ->> 'situacao') is not null then 'excepcional'
        when coalesce(c.total, 0) = 0 then 'sem_cronograma'
        when coalesce(c.total, 0) < 2 or not coalesce(c.tem_resultado_final, false) then 'incompleto'
        when (e ->> 'dias_para_proxima')::integer between 0 and 3 then 'proxima_3d'
        when (e ->> 'dias_para_proxima')::integer between 4 and 6 then 'proxima_7d'
        else 'ok'
      end
    ) order by m.unidade, m.edital)
    from public."TB_MONITORAMENTO_INDIGENA" m
    cross join lateral public.get_monitoramento_cronograma_estado(m.id, (now() at time zone 'America/Sao_Paulo')::date) e
    left join lateral (
      select
        count(*)::integer as total,
        bool_or(lower(atividade) like '%resultado final%') as tem_resultado_final
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = m.id
    ) c on true
    where m.ativo is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  ), '[]'::jsonb);
end;
$function$;

comment on function public.get_nucleo_cronograma_resumo() is 'Resumo do cronograma de cada edital ativo da área (Núcleo e Cronograma): status, etapa, cálculo, situação, percentual, próxima etapa e o alerta. excepcional = status_override ou situação suspenso/paralisado/cancelado; sem_cronograma = nenhuma etapa (o manual com etapas segue as regras de prazo) (20261117190000).';

-- 3. Datas do cadastro acompanham as etapas (automático ligado). Gatilho de restrição adiado:
--    roda no fim da transação, com as etapas já completas. salvar_monitoramento_com_cronograma
--    apaga e reinsere etapa por etapa; um gatilho imediato gravaria (e poria no histórico) um
--    período parcial a cada etapa.
create function private."FC_TG_DATAS_DO_CADASTRO"()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_ids uuid[];
begin
  if tg_op = 'INSERT' then
    v_ids := array[new.monitoramento_id];
  elsif tg_op = 'DELETE' then
    v_ids := array[old.monitoramento_id];
  else
    v_ids := array[new.monitoramento_id, old.monitoramento_id];
  end if;

  -- Sem etapas, as datas ficam (como em salvar_monitoramento_com_cronograma).
  update public."TB_MONITORAMENTO_INDIGENA" m
     set data_inicio = c.inicio,
         data_fim = c.fim
    from (select e.monitoramento_id, min(e.data_inicio) as inicio, max(e.data_fim) as fim
            from public."TB_CRONOGRAMA_MONIT_INDIG" e
           where e.monitoramento_id = any (v_ids)
           group by e.monitoramento_id) c
   where m.id = c.monitoramento_id
     and m.cronograma_automatico
     and (m.data_inicio is distinct from c.inicio or m.data_fim is distinct from c.fim);
  return null;
end;
$function$;

comment on function private."FC_TG_DATAS_DO_CADASTRO"() is 'Gatilho (de restrição, adiado ao fim da transação) de TB_CRONOGRAMA_MONIT_INDIG: com o cronograma automático ligado, o cadastro do edital (data_inicio, data_fim) recebe o início da primeira etapa e o fim da última sempre que as etapas mudam, por qualquer caminho. Sem etapas, as datas ficam; só grava o que muda. data_fim alimenta FC_VENCIMENTO_DO_EDITAL (20261117190000).';

revoke all on function private."FC_TG_DATAS_DO_CADASTRO"() from public;

create constraint trigger "TG_DATAS_DO_CADASTRO"
  after insert or update or delete on public."TB_CRONOGRAMA_MONIT_INDIG"
  deferrable initially deferred
  for each row execute function private."FC_TG_DATAS_DO_CADASTRO"();

-- 4. Acerto pontual: os editais com o automático ligado cujas datas divergem das etapas.
do $acerto$
declare
  v_qt integer;
begin
  update public."TB_MONITORAMENTO_INDIGENA" m
     set data_inicio = c.inicio,
         data_fim = c.fim
    from (select e.monitoramento_id, min(e.data_inicio) as inicio, max(e.data_fim) as fim
            from public."TB_CRONOGRAMA_MONIT_INDIG" e
           group by e.monitoramento_id) c
   where m.id = c.monitoramento_id
     and m.cronograma_automatico
     and (m.data_inicio is distinct from c.inicio or m.data_fim is distinct from c.fim);
  get diagnostics v_qt = row_count;
  raise notice 'Datas do cadastro refeitas pelas etapas: % edital(is).', v_qt;
end;
$acerto$;


-- Conferências -------------------------------------------------------------------------------

create temp table ensaio_depois on commit drop as
select m.id, m.edital, m.cronograma_automatico as auto, m.data_inicio, m.data_fim,
       private."FC_ESTADO_DO_CRONOGRAMA"(m.id, (now() at time zone 'America/Sao_Paulo')::date) as estado
  from public."TB_MONITORAMENTO_INDIGENA" m;

-- Editais cujo estado do cronograma mudou (sem contar as chaves novas calculo e situacao):
select a.edital, a.auto,
       a.estado ->> 'tem_cronograma' as tem_antes, d.estado ->> 'tem_cronograma' as tem_depois,
       a.estado ->> 'status' as status_antes, d.estado ->> 'status' as status_depois,
       d.estado ->> 'percentual' as percentual, d.estado ->> 'proxima_atividade' as proxima,
       d.estado ->> 'data_inicio' as inicio, d.estado ->> 'data_fim' as fim
  from ensaio_antes a join ensaio_depois d using (id)
 where (a.estado - 'calculo' - 'situacao') is distinct from (d.estado - 'calculo' - 'situacao')
 order by a.edital;

-- Datas do cadastro refeitas pelas etapas:
select a.edital, a.data_inicio as inicio_antes, d.data_inicio as inicio_depois,
       a.data_fim as fim_antes, d.data_fim as fim_depois, d.data_fim - a.data_fim as dias
  from ensaio_antes a join ensaio_depois d using (id)
 where a.data_inicio is distinct from d.data_inicio or a.data_fim is distinct from d.data_fim
 order by a.edital;

do $conferir$
declare
  v_qt integer;
  v_e jsonb;
  v_id uuid;
  v_fim date;
begin
  select count(*) into v_qt
    from ensaio_antes a join ensaio_depois d using (id)
   where a.auto and (a.estado - 'calculo' - 'situacao') is distinct from (d.estado - 'calculo' - 'situacao');
  if v_qt > 0 then
    raise exception 'REPROVADO: % edital(is) com cálculo automático mudaram de estado.', v_qt;
  end if;

  select count(*) into v_qt
    from ensaio_antes a join ensaio_depois d using (id)
   where not a.auto and (a.data_inicio is distinct from d.data_inicio or a.data_fim is distinct from d.data_fim);
  if v_qt > 0 then
    raise exception 'REPROVADO: % edital(is) com cálculo manual tiveram as datas do cadastro mudadas.', v_qt;
  end if;

  select count(*) into v_qt
    from public."TB_MONITORAMENTO_INDIGENA" m
    join (select e.monitoramento_id, min(e.data_inicio) as inicio, max(e.data_fim) as fim
            from public."TB_CRONOGRAMA_MONIT_INDIG" e group by 1) c on c.monitoramento_id = m.id
   where m.cronograma_automatico
     and (m.data_inicio is distinct from c.inicio or m.data_fim is distinct from c.fim);
  if v_qt > 0 then
    raise exception 'REPROVADO: ainda há % edital(is) automático(s) com datas diferentes das etapas.', v_qt;
  end if;

  select d.estado into v_e from ensaio_depois d where d.edital = '120/2026';
  if v_e is null then
    raise notice 'O 120/2026 não está no banco: conferência dele pulada.';
  elsif not (v_e ->> 'tem_cronograma')::boolean or v_e ->> 'calculo' <> 'manual'
        or v_e ->> 'situacao' is distinct from 'suspenso' or (v_e ->> 'total_etapas')::integer <> 13
        or v_e ->> 'data_inicio' is null or v_e ->> 'data_fim' is null
        or (v_e ->> 'percentual')::numeric <= 0 or v_e ->> 'proxima_atividade' is null then
    raise exception 'REPROVADO: estado do 120/2026 inesperado: %', v_e;
  else
    raise notice '120/2026: %', v_e;
  end if;

  -- O gatilho (adiado) acompanha uma etapa nova e a retirada dela, num edital automático.
  set constraints "TG_DATAS_DO_CADASTRO" immediate;
  select m.id, m.data_fim into v_id, v_fim
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.cronograma_automatico and m.data_fim is not null
     and exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = m.id)
   order by m.edital limit 1;
  insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, data_inicio, data_fim, origem)
  values (v_id, 999, 'Etapa do ensaio', v_fim + 10, v_fim + 20, 'MANUAL');
  if (select m.data_fim from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_id) <> v_fim + 20 then
    raise exception 'REPROVADO: o gatilho não levou o fim do cadastro à etapa nova.';
  end if;
  delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = v_id and ordem = 999;
  if (select m.data_fim from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_id) <> v_fim then
    raise exception 'REPROVADO: o gatilho não voltou o fim do cadastro depois de tirar a etapa.';
  end if;
  raise notice 'APROVADO.';
end;
$conferir$;

rollback;
