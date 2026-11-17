/*
  CRONOGRAMA COM CÁLCULO MANUAL E DATAS DO CADASTRO PELAS ETAPAS (17/11/2026)

  POR QUE (conferência de 17/11/2026)
  1. "Cálculo manual" era tratado como "sem etapas". private."FC_ESTADO_DO_CRONOGRAMA" parava em
     `if not cronograma_automatico or v_total = 0` e devolvia tem_cronograma = false, percentual 0
     e nenhuma próxima etapa. O 120/2026 tem 13 etapas, cálculo automático desligado e status
     "Suspenso" digitado, e a Visão geral dizia "Sem cronograma". get_nucleo_cronograma_resumo
     repetia o erro (alerta 'sem_cronograma' para todo edital manual).
  2. As datas do cadastro (data_inicio, data_fim) só eram refeitas quando o edital era salvo com o
     automático ligado (salvar_monitoramento_com_cronograma). Scripts de errata mudaram etapas sem
     refazê-las: 8 editais com o automático ligado divergiam das etapas (42, 46, 54, 60, 83, 105,
     107 e 118/2026). data_fim alimenta a validade das listas (FC_VENCIMENTO_DO_EDITAL, usada por
     FC_INATIVAR_LISTAS_VENCIDAS e definir_lista_aprovados_ativa): as listas do 54/2026 venceriam
     14 dias antes do certo. Nenhuma lista desses 8 venceu ainda (validade de 6 meses a 1 ano).

  O QUE MUDA
    - FC_ESTADO_DO_CRONOGRAMA separa três coisas:
        * existe etapa cadastrada: tem_cronograma = total de etapas > 0 (só isso);
        * cálculo ('automatico' | 'manual'): com o manual, o status e a etapa digitados valem
          (status_override/etapa_override por cima; sem nada digitado, o calculado); percentual,
          atividade atual, próxima etapa, dias e datas saem das etapas nos dois casos;
        * situacao: 'suspenso' | 'paralisado' | 'cancelado' | null, lida do status final (o
          excepcional status_override ou, no manual, o digitado).
      Sem etapas, devolve o mesmo de antes, mais calculo e situacao. search_path passa a ''.
    - get_nucleo_cronograma_resumo: alerta 'excepcional' também para situacao não nula;
      'sem_cronograma' só sem etapas (o manual com etapas segue as regras de prazo); devolve
      tem_cronograma, calculo e situacao.
    - Gatilho novo em TB_CRONOGRAMA_MONIT_INDIG (TG_DATAS_DO_CADASTRO, de restrição, adiado ao
      fim da transação; private."FC_TG_DATAS_DO_CADASTRO"): com o automático ligado, o cadastro
      recebe o início da primeira etapa e o fim da última sempre que as etapas mudam, por
      qualquer caminho (tela, script de errata, SQL Editor). Sem etapas, as datas ficam (como em
      salvar_monitoramento_com_cronograma). Só grava o que muda: depois do salvar, que já acerta
      as datas, não grava nada (nem histórico).
    - Acerto pontual, uma vez: o mesmo cálculo nos editais com o automático ligado cujas datas
      divergem das etapas (8 hoje; o ensaio conta).

  O QUE NÃO MUDA
  Nenhuma etapa de edital (a etapa 11 do 120/2026 a equipe confere na retificação). Os editais
  com o cálculo manual mantêm as datas do cadastro (o gatilho e o acerto só tocam o automático).
  Nenhuma assinatura de RPC muda; o JSON do estado e do resumo ganha chaves.

  Efeito visível: o 120/2026 passa a mostrar percentual, próxima etapa e datas das etapas na
  Visão geral, no Painel (data final = 25/02/2027, a do recurso das entrevistas) e na API de
  editais; o alerta dele no Núcleo vira 'excepcional' (suspenso).

  GUARDA: md5 do prosrc (sem \r) de FC_ESTADO_DO_CRONOGRAMA e de get_nucleo_cronograma_resumo
  como em produção em 17/11/2026; o gatilho não pode existir.
  ENSAIO:   supabase/ensaios/20261117190000_cronograma_manual_e_datas_do_cadastro.sql
  ROLLBACK: supabase/rollback/20261117190000_cronograma_manual_e_datas_do_cadastro.sql
*/
begin;

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

commit;
