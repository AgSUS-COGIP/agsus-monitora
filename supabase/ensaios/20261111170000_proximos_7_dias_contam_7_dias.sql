/*
  ENSAIO de 20261111170000_proximos_7_dias_contam_7_dias.sql
  Roda no SQL Editor (papel postgres) ANTES de aplicar. Termina em rollback.
  Confere: o corpo vigente é o conhecido; aplica o corpo novo (igual ao da migration;
  o teste confere); o md5 novo e a faixa nova de proxima_7d (4 a 6). A função pede
  usuário logado (pode_recurso), por isso o ensaio não a chama.
  Ok = NOTICE "Ensaio 20261111170000 ok" e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_nucleo_cronograma_resumo()'))) is distinct from '92b67beb8bc97e20271b46d1ec50cedf' then
    raise exception 'Ensaio: o corpo vigente de get_nucleo_cronograma_resumo não é o que a migration conhece.';
  end if;
end;
$guarda$;

CREATE OR REPLACE FUNCTION public.get_nucleo_cronograma_resumo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'tem_resultado_final', coalesce(c.tem_resultado_final, false),
      'percentual', coalesce((e ->> 'percentual')::numeric, 0),
      'proxima_atividade', e ->> 'proxima_atividade',
      'proxima_data', e ->> 'proxima_data',
      'dias_para_proxima', (e ->> 'dias_para_proxima')::integer,
      'status_override', m.status_override,
      'alerta_tipo', case
        when nullif(m.status_override, '') is not null then 'excepcional'
        when not m.cronograma_automatico or coalesce(c.total, 0) = 0 then 'sem_cronograma'
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

do $confere$
begin
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_nucleo_cronograma_resumo()'))) is distinct from '436e0e97170a4d8ee43e01705ff574fb' then
    raise exception 'Ensaio: o corpo aplicado não é o da migration.';
  end if;
  if position('between 4 and 6 then ''proxima_7d''' in
       (select prosrc from pg_proc where oid = to_regprocedure('public.get_nucleo_cronograma_resumo()'))) = 0 then
    raise exception 'Ensaio: a faixa de proxima_7d não é 4 a 6.';
  end if;
  raise notice 'Ensaio 20261111170000 ok.';
end;
$confere$;

rollback;
