/*
  A FALHA AO REMONTAR UM PACOTE APARECE NO STATUS DAS ATUALIZAÇÕES

  Por quê: atualizar_cache_painel_analises, atualizar_cache_aprovados e
  atualizar_cache_painel_entrevistas engolem o erro de cada área com
  `raise warning` (de propósito: chamadas pela RPC de leitura, não podem
  derrubar quem lê — a tela monta na hora). Mas o pg_cron também as chama
  (agsus_analises_cache_do_painel, agsus_aprovados_cache_por_area,
  agsus_entrevistas_cache_do_painel), e o warning não vai para
  cron.job_run_details: a execução saía "succeeded" mesmo sem remontar nada,
  e o Status das atualizações (get_saude_das_cargas, que lê as execuções dos
  jobs agsus_*) mostrava tudo verde com o pacote parado.

  O QUE MUDA
    1. atualizar_cache_painel_entrevistas devolve também "falhas"
       ([{area, erro}]), como as outras duas já devolvem (ok: false, erro).
       Mesmo corpo, mesmo warning.
    2. private."FC_FALHAS_DO_CACHE"(jsonb): o texto das falhas de uma dessas
       respostas ("área: erro; …"), ou null. "ocupado" (outra montagem da mesma
       área em curso) não é falha.
    3. private."PR_REMONTAR_CACHE_AGENDADO"(p_cache): o que o agendamento chama.
       Pega a mesma trava de antes, remonta, GRAVA (commit) o que deu certo e,
       se alguma área falhou, termina com erro: a execução do job fica
       "failed", com a mensagem, no Status. As áreas que deram certo ficam
       gravadas. É procedure (precisa do commit no meio), SECURITY INVOKER e
       sem SET (o Postgres não deixa commit com SET na procedure): o
       search_path vazio vai por set_config, e todo nome é qualificado. Só o
       postgres (dono dos jobs) executa.
    4. Os três jobs passam a chamar a procedure.
  As RPCs de leitura continuam chamando as funções, que seguem sem derrubar
  ninguém.

  Ensaio: supabase/ensaios/20261022165000_falha_do_cache_aparece_no_status.sql
  Rollback: supabase/rollback/20261022165000_falha_do_cache_aparece_no_status.sql
*/
begin;

-- 1. Entrevistas: as falhas também na resposta ------------------------------------------------
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
  v_falhas jsonb := '[]'::jsonb;
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
      -- Nunca derruba quem chamou (a RPC monta na hora); o agendamento lê "falhas".
      raise warning 'Pacote das entrevistas (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
      v_falhas := v_falhas || jsonb_build_object('area', v_area, 'erro', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('remontadas', v_feitas, 'falhas', v_falhas);
end;
$$;

-- 2. O texto das falhas -----------------------------------------------------------------------
create or replace function private."FC_FALHAS_DO_CACHE"(p_resposta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(coalesce(f ->> 'area', '?') || ': ' || coalesce(f ->> 'erro', 'erro'), '; ' order by o)
    from jsonb_array_elements(
           case jsonb_typeof(p_resposta)
             when 'array' then p_resposta
             when 'object' then coalesce(p_resposta -> 'falhas', '[]'::jsonb)
             else '[]'::jsonb
           end) with ordinality x(f, o)
   where (jsonb_typeof(p_resposta) = 'object' or (f ->> 'ok')::boolean is false)
     and coalesce(f ->> 'erro', '') <> 'ocupado';
$$;

comment on function private."FC_FALHAS_DO_CACHE"(jsonb) is
  'As áreas que não foram remontadas numa resposta de atualizar_cache_* ("área: erro; …"), ou null; "ocupado" não conta (20261022165000).';

revoke all on function private."FC_FALHAS_DO_CACHE"(jsonb) from public, anon, authenticated;

-- 3. O que o agendamento chama ----------------------------------------------------------------
create or replace procedure private."PR_REMONTAR_CACHE_AGENDADO"(p_cache text)
language plpgsql
as $$
declare
  v_resposta jsonb;
  v_falhas text;
begin
  perform pg_catalog.set_config('search_path', '', true);
  -- A mesma trava de antes: uma rodada de cada vez.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext(case p_cache
       when 'ANALISES' then 'agsus_analises_cache_do_painel'
       when 'APROVADOS' then 'agsus_aprovados_cache_por_area'
       when 'ENTREVISTAS' then 'agsus_entrevistas_cache_do_painel' end)) then
    return;
  end if;
  v_resposta := case p_cache
    when 'ANALISES' then public.atualizar_cache_painel_analises_vencidos()
    when 'APROVADOS' then public.atualizar_cache_aprovados_vencidos()
    when 'ENTREVISTAS' then public.atualizar_cache_painel_entrevistas()
  end;
  if v_resposta is null then
    raise exception 'Cache desconhecido: %', p_cache using errcode = '22023';
  end if;
  v_falhas := private."FC_FALHAS_DO_CACHE"(v_resposta);
  -- O que deu certo fica gravado; a falha vai para a execução do job (Status das atualizações).
  commit;
  if v_falhas is not null then
    raise exception 'Pacote % não remontado: %', lower(p_cache), left(v_falhas, 400);
  end if;
end;
$$;

comment on procedure private."PR_REMONTAR_CACHE_AGENDADO"(text) is
  'Remonta os pacotes vencidos (ANALISES, APROVADOS ou ENTREVISTAS) pelo pg_cron, grava o que deu certo e termina com erro se alguma área falhou, para a execução aparecer como falha no Status das atualizações (20261022165000).';

revoke all on procedure private."PR_REMONTAR_CACHE_AGENDADO"(text) from public, anon, authenticated;

-- 4. Os três jobs -----------------------------------------------------------------------------
select cron.alter_job(j.jobid, command := v.comando)
  from cron.job j
  join (values
    ('agsus_analises_cache_do_painel', 'call private."PR_REMONTAR_CACHE_AGENDADO"(''ANALISES'');'),
    ('agsus_aprovados_cache_por_area', 'call private."PR_REMONTAR_CACHE_AGENDADO"(''APROVADOS'');'),
    ('agsus_entrevistas_cache_do_painel', 'call private."PR_REMONTAR_CACHE_AGENDADO"(''ENTREVISTAS'');')
  ) as v(nome, comando) on v.nome = j.jobname;

commit;
