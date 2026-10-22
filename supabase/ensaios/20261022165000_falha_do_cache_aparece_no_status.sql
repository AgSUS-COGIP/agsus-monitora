/*
  ENSAIO da migration 20261022165000_falha_do_cache_aparece_no_status.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado (nem os jobs: cron.job
  é tabela comum e volta com o rollback).

  Montagem (como nos outros ensaios):
    { echo begin;
      sed -n '/^-- == ANTES ==/,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261022165000_falha_do_cache_aparece_no_status.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261022165000_falha_do_cache_aparece_no_status.sql;
      sed -n '/^-- == DEPOIS ==/,$p' supabase/ensaios/20261022165000_falha_do_cache_aparece_no_status.sql;
    } > /tmp/ensaio.sql   (o arquivo termina em rollback)

  1. FC_FALHAS_DO_CACHE com respostas de exemplo das três funções (sem falha,
     com falha, "ocupado").
  2. atualizar_cache_painel_entrevistas devolve "remontadas" e "falhas".
  3. Os três jobs chamam a procedure; a procedure roda até o commit (dentro do
     ensaio o commit é recusado com 2D000, o que mostra que ela chegou lá sem
     erro antes).
*/
-- == ANTES ==
create temporary table t_jobs (jobname text, antes text, depois text) on commit drop;
insert into t_jobs (jobname, antes)
select jobname, command from cron.job
 where jobname in ('agsus_analises_cache_do_painel', 'agsus_aprovados_cache_por_area', 'agsus_entrevistas_cache_do_painel');
-- == aplicar a migration aqui ==

-- == DEPOIS ==
update t_jobs t set depois = j.command from cron.job j where j.jobname = t.jobname;

do $$
declare
  v jsonb;
begin
  if private."FC_FALHAS_DO_CACHE"('[{"area":"sede","ok":true},{"area":"projetos","ok":true}]') is not null
     or private."FC_FALHAS_DO_CACHE"('[{"area":"sede","ok":false,"erro":"ocupado"}]') is not null
     or private."FC_FALHAS_DO_CACHE"('{"remontadas":["sede"],"falhas":[]}') is not null
     or private."FC_FALHAS_DO_CACHE"('{"remontadas":[]}') is not null
     or private."FC_FALHAS_DO_CACHE"('[{"area":"sede","ok":true},{"area":"projetos","ok":false,"erro":"x"}]') <> 'projetos: x'
     or private."FC_FALHAS_DO_CACHE"('{"remontadas":[],"falhas":[{"area":"sede","erro":"y"},{"area":"projetos","erro":"z"}]}')
        <> 'sede: y; projetos: z' then
    raise exception 'Ensaio: FC_FALHAS_DO_CACHE errou.';
  end if;

  v := public.atualizar_cache_painel_entrevistas();
  if not (v ? 'remontadas' and v ? 'falhas') then
    raise exception 'Ensaio: a resposta das entrevistas veio sem falhas: %', v;
  end if;

  if (select count(*) from t_jobs where depois like 'call private."PR_REMONTAR_CACHE_AGENDADO"(%') <> 3 then
    raise exception 'Ensaio: os jobs não chamam a procedure: %', (select json_agg(t) from t_jobs t);
  end if;

  begin
    call private."PR_REMONTAR_CACHE_AGENDADO"('ENTREVISTAS');
    raise exception 'Ensaio: a procedure não chegou ao commit.';
  exception when invalid_transaction_termination then
    null; -- chegou ao commit (recusado dentro do ensaio)
  end;
end;
$$;

select jobname, depois from t_jobs order by jobname;

rollback;
