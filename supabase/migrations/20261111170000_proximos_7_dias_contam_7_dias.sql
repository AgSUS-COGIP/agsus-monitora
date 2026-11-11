/*
  EDITAIS: "PRÓXIMOS 7 DIAS" CONTA 7 DIAS

  O cartão "Próximos 7 dias" de Editais (get_nucleo_cronograma_resumo, alertas
  proxima_3d e proxima_7d) contava a próxima etapa de hoje até daqui a 7 dias: 8 dias.
  Decisão de 11/11/2026: 7 dias contando hoje (hoje + 6). proxima_3d segue de 0 a 3
  dias; proxima_7d passa de 4 a 7 para 4 a 6. As boas-vindas usam a mesma janela
  (src/lib/boas-vindas.ts, no mesmo PR); o Resumo do dia já contava 7 (Hoje e os 7
  seguintes, em blocos separados) e não muda.

  O resto do corpo é o de produção, letra por letra (o teste confere); mesmas opções
  e permissões.

  GUARDAS: já aplicada (md5 436e0e97170a4d8ee43e01705ff574fb) ou corpo diferente do lido em 11/11/2026
  (md5 92b67beb8bc97e20271b46d1ec50cedf): recusa.

  Ensaio: supabase/ensaios/20261111170000_proximos_7_dias_contam_7_dias.sql   Rollback: supabase/rollback/20261111170000_proximos_7_dias_contam_7_dias.sql
  Teste: tests/proximos-7-dias.test.ts
*/
begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_md5 text := md5((select prosrc from pg_proc where oid = to_regprocedure('public.get_nucleo_cronograma_resumo()')));
begin
  if v_md5 = '436e0e97170a4d8ee43e01705ff574fb' then
    raise exception 'A migration 20261111170000 já foi aplicada.';
  end if;
  if v_md5 is distinct from '92b67beb8bc97e20271b46d1ec50cedf' then
    raise exception 'get_nucleo_cronograma_resumo mudou depois de 11/11/2026 (md5 %): junte as mudanças antes de aplicar.', v_md5;
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

commit;
