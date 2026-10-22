/*
  Rollback de 20261022165000_falha_do_cache_aparece_no_status.sql: os três jobs
  voltam a chamar as funções direto (com a trava no where), a procedure e
  FC_FALHAS_DO_CACHE saem e atualizar_cache_painel_entrevistas volta a devolver
  só "remontadas".
*/
begin;

select cron.alter_job(j.jobid, command := v.comando)
  from cron.job j
  join (values
    ('agsus_analises_cache_do_painel',
     'select public.atualizar_cache_painel_analises_vencidos() where pg_try_advisory_xact_lock(hashtext(''agsus_analises_cache_do_painel''));'),
    ('agsus_aprovados_cache_por_area',
     'select public.atualizar_cache_aprovados_vencidos() where pg_try_advisory_xact_lock(hashtext(''agsus_aprovados_cache_por_area''));'),
    ('agsus_entrevistas_cache_do_painel',
     'select public.atualizar_cache_painel_entrevistas() where pg_try_advisory_xact_lock(hashtext(''agsus_entrevistas_cache_do_painel''));')
  ) as v(nome, comando) on v.nome = j.jobname;

drop procedure if exists private."PR_REMONTAR_CACHE_AGENDADO"(text);
drop function if exists private."FC_FALHAS_DO_CACHE"(jsonb);

create or replace function public.atualizar_cache_painel_entrevistas(p_area text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area text;
  v_inicio timestamptz;
  v_payload json;
  v_feitas jsonb := '[]'::jsonb;
begin
  -- Só a área com marca, sem pacote ou com pacote de mais de 24 h.
  for v_area in
    select a."CO_AREA"
      from public."TB_AREA" a
      left join private."TA_PAINEL_ENTREVISTA" c on c."CO_AREA" = a."CO_AREA"
     where (p_area is null or a."CO_AREA" = p_area)
       and (c."CO_AREA" is null
            or c."DT_GERACAO" < now() - interval '24 hours'
            or private."FC_CACHE_DESATUALIZADO"('ENTREVISTAS', a."CO_AREA"))
     order by a."CO_AREA"
  loop
    begin
      v_inicio := clock_timestamp();
      delete from private."TL_ALTERACAO_CACHE" t
       where t."TP_CACHE" = 'ENTREVISTAS' and t."CO_AREA" = v_area;
      v_payload := private."FC_MONTAR_ENTREVISTAS_AREA"(v_area, null);
      insert into private."TA_PAINEL_ENTREVISTA" as c
        ("CO_AREA", "DS_PAYLOAD", "QT_ENTREVISTA", "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS")
      values (v_area, v_payload, json_array_length(v_payload->'entrevistas'),
              (extract(epoch from v_inicio) * 1000000)::bigint::text, v_inicio,
              (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer)
      on conflict ("CO_AREA") do update set
        "DS_PAYLOAD" = excluded."DS_PAYLOAD", "QT_ENTREVISTA" = excluded."QT_ENTREVISTA",
        "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS", "DT_GERACAO" = excluded."DT_GERACAO",
        "NU_DURACAO_MS" = excluded."NU_DURACAO_MS";
      v_feitas := v_feitas || to_jsonb(v_area);
    exception when others then
      raise warning 'Pacote das entrevistas (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
    end;
  end loop;
  return jsonb_build_object('remontadas', v_feitas);
end;
$$;

commit;
