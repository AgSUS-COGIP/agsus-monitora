/*
  ENSAIO de 20261022154000_limpeza_do_manifesto_das_analises.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Mostra e confere:
    1. quanto sairia hoje (linhas e tamanho do manifesto com mais de 2 dias de
       sync que não está em andamento);
    2. a função e a tarefa entram (3h40 de Brasília, sem EXECUTE para
       anon/authenticated/service_role);
    3. sync EM ANDAMENTO não perde o manifesto, mesmo velho: o ensaio marca o
       sync dono do manifesto como "processando" e a função não apaga nada;
    4. de volta ao estado real, a função apaga o que o item 1 mostrou;
    5. o rollback tira a função e a tarefa.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- 1. O que sairia.
create temporary table ensaio_sairia on commit drop as
  select m."CO_SYNC", count(*) as linhas, sum(pg_column_size(m.*)) as bytes
    from public."TM_MANIFESTO_ANALISE" m
   where m."DT_CRIACAO" < now() - interval '2 days'
     and not exists (select 1 from public."TL_SYNC_ANALISE" l
                      where l.sync_id = m."CO_SYNC"
                        and l.status in ('iniciado', 'carregado', 'processando')
                        and l.finished_at is null)
   group by 1;

select coalesce(sum(linhas), 0) as linhas_que_sairiam,
       pg_size_pretty(coalesce(sum(bytes), 0)::bigint) as dados_que_sairiam,
       pg_size_pretty(pg_total_relation_size('public."TM_MANIFESTO_ANALISE"')) as tabela_com_indices_hoje,
       count(*) as syncs
  from ensaio_sairia;

-- 2. A migration (corpo de supabase/migrations/20261022154000_…).

create or replace function private."FC_LIMPAR_MANIFESTO_ANALISE"(p_dias integer default 2)
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  v_n integer;
begin
  if p_dias is null or p_dias not between 1 and 30 then
    raise exception 'p_dias deve estar entre 1 e 30' using errcode = '22023';
  end if;

  delete from public."TM_MANIFESTO_ANALISE" m
   where m."DT_CRIACAO" < now() - make_interval(days => p_dias)
     and not exists (
       select 1 from public."TL_SYNC_ANALISE" l
        where l.sync_id = m."CO_SYNC"
          and l.status in ('iniciado', 'carregado', 'processando')
          and l.finished_at is null);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

comment on function private."FC_LIMPAR_MANIFESTO_ANALISE"(integer) is
  'Apaga o manifesto (TM_MANIFESTO_ANALISE) com mais de p_dias (1 a 30; padrão 2) de sync de análises que não está em andamento (erro, processado ou sem log); o sync em andamento nunca é tocado. Devolve as linhas apagadas. Chamada pela tarefa agsus_analises_limpar_manifesto (20261022154000). Só o dono (pg_cron).';
revoke all on function private."FC_LIMPAR_MANIFESTO_ANALISE"(integer) from public, anon, authenticated, service_role;

do $$
declare
  v_comando constant text :=
    'select private."FC_LIMPAR_MANIFESTO_ANALISE"(2) where pg_try_advisory_xact_lock(hashtext(''agsus_analises_limpar_manifesto''));';
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_analises_limpar_manifesto';
  if v_id is null then
    perform cron.schedule('agsus_analises_limpar_manifesto', '40 6 * * *', v_comando);
  else
    perform cron.alter_job(v_id, schedule => '40 6 * * *', command => v_comando, active => true);
  end if;
end;
$$;

do $ensaio$
declare
  v_oid oid := 'private."FC_LIMPAR_MANIFESTO_ANALISE"(integer)'::regprocedure;
begin
  assert exists (select 1 from cron.job where jobname = 'agsus_analises_limpar_manifesto'
                   and schedule = '40 6 * * *' and active), 'tarefa não agendada';
  assert not has_function_privilege('authenticated', v_oid, 'execute'), 'authenticated executa';
  assert not has_function_privilege('anon', v_oid, 'execute'), 'anon executa';
  assert not has_function_privilege('service_role', v_oid, 'execute'), 'service_role executa';
  begin
    perform private."FC_LIMPAR_MANIFESTO_ANALISE"(0);
    assert false, 'aceitou p_dias = 0';
  exception when sqlstate '22023' then
    null;
  end;
end;
$ensaio$;

-- 3. Sync em andamento: nada sai.
create temporary table ensaio_syncs on commit drop as
  select l.id, l.status, l.finished_at
    from public."TL_SYNC_ANALISE" l
   where l.sync_id in (select "CO_SYNC" from ensaio_sairia);

update public."TL_SYNC_ANALISE" l
   set status = 'processando', finished_at = null
 where l.id in (select id from ensaio_syncs);

do $ensaio$
declare
  v_n integer;
begin
  v_n := private."FC_LIMPAR_MANIFESTO_ANALISE"(2);
  assert v_n = coalesce((select sum(e.linhas) from ensaio_sairia e
                          where not exists (select 1 from public."TL_SYNC_ANALISE" l
                                             where l.sync_id = e."CO_SYNC")), 0),
         'apagou manifesto de sync em andamento: ' || v_n;
end;
$ensaio$;

-- 4. De volta ao estado real: sai o que o item 1 mostrou.
update public."TL_SYNC_ANALISE" l
   set status = e.status, finished_at = e.finished_at
  from ensaio_syncs e
 where l.id = e.id;

do $ensaio$
declare
  v_n integer;
begin
  v_n := private."FC_LIMPAR_MANIFESTO_ANALISE"(2);
  raise notice 'apagadas: %', v_n;
  assert not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      join ensaio_sairia e using ("CO_SYNC")
                     where m."DT_CRIACAO" < now() - interval '2 days'),
         'sobrou manifesto velho de sync encerrado';
end;
$ensaio$;

-- 5. O rollback.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'agsus_analises_limpar_manifesto') then
    perform cron.unschedule('agsus_analises_limpar_manifesto');
  end if;
end;
$$;

drop function if exists private."FC_LIMPAR_MANIFESTO_ANALISE"(integer);

do $ensaio$
begin
  assert not exists (select 1 from cron.job where jobname = 'agsus_analises_limpar_manifesto'),
         'o rollback não tirou a tarefa';
  assert to_regprocedure('private."FC_LIMPAR_MANIFESTO_ANALISE"(integer)') is null,
         'o rollback não tirou a função';
end;
$ensaio$;

select 'ensaio ok' as resultado,
       (select coalesce(sum(linhas), 0) from ensaio_sairia) as linhas_que_sairiam,
       (select pg_size_pretty(coalesce(sum(bytes), 0)::bigint) from ensaio_sairia) as dados_que_sairiam;

rollback;
