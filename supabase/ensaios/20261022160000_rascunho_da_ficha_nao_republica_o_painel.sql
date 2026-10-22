/*
  ENSAIO da migration 20261022160000_rascunho_da_ficha_nao_republica_o_painel.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado.

  Montagem (como nos outros ensaios):
    { echo begin;
      sed -n '/^-- == ANTES ==/,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261022160000_rascunho_da_ficha_nao_republica_o_painel.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261022160000_rascunho_da_ficha_nao_republica_o_painel.sql;
      sed -n '/^-- == DEPOIS ==/,$p' supabase/ensaios/20261022160000_rascunho_da_ficha_nao_republica_o_painel.sql;
    } > /tmp/ensaio.sql   (o arquivo termina em rollback)

  Com EXPLAIN ANALYZE (que conta as chamadas de cada gatilho), antes e depois:
    1. "rascunho": DS_PARECER e DS_RESULTADO mudam numa ficha que não está
       concluída nem em revisão → antes, o gatilho de publicação roda; depois, não;
    2. "concluída": o mesmo numa ficha CONCLUIDA → roda antes e depois;
    3. "nota": a nota apurada da ficha CONCLUIDA muda → roda antes e depois.
  Reprova se o resultado não for esse. Não mostra dados de ninguém (só contagens).
*/
-- == ANTES ==
create temporary table t_gatilho (fase text, caso text, chamadas int) on commit drop;

create or replace function pg_temp.chamadas_do_gatilho(p_sql text) returns int
language plpgsql as $$
declare
  l text;
  n int := 0;
begin
  for l in execute 'explain (analyze, format text) ' || p_sql loop
    if l ~ 'Trigger TG_FICHAANALISE_PUBLICA_UPD' then
      n := n + coalesce(substring(l from 'calls=(\d+)')::int, 0);
    end if;
  end loop;
  return n;
end;
$$;

create or replace function pg_temp.medir(p_fase text) returns void
language plpgsql as $$
declare
  v_rascunho uuid := (select f."CO_FICHA_ANALISE" from public."TB_FICHA_ANALISE" f
                       where f."TP_SITUACAO" not in ('CONCLUIDA', 'REVISAR') order by 1 limit 1);
  v_concluida uuid := (select f."CO_FICHA_ANALISE" from public."TB_FICHA_ANALISE" f
                        where f."TP_SITUACAO" = 'CONCLUIDA' order by 1 limit 1);
begin
  insert into t_gatilho values (p_fase, 'rascunho', pg_temp.chamadas_do_gatilho(format(
    $q$update public."TB_FICHA_ANALISE" set "DS_PARECER" = coalesce("DS_PARECER", '') || ' (ensaio %s)',
         "DS_RESULTADO" = coalesce("DS_RESULTADO", '{}'::jsonb) || jsonb_build_object('ensaio', %L)
       where "CO_FICHA_ANALISE" = %L$q$, p_fase, p_fase, v_rascunho)));
  insert into t_gatilho values (p_fase, 'concluída', pg_temp.chamadas_do_gatilho(format(
    $q$update public."TB_FICHA_ANALISE" set "DS_PARECER" = coalesce("DS_PARECER", '') || ' (ensaio %s)'
       where "CO_FICHA_ANALISE" = %L$q$, p_fase, v_concluida)));
  insert into t_gatilho values (p_fase, 'nota', pg_temp.chamadas_do_gatilho(format(
    $q$update public."TB_FICHA_ANALISE" set "VL_NOTA_APURADA" = coalesce("VL_NOTA_APURADA", 0) + 0.001
       where "CO_FICHA_ANALISE" = %L$q$, v_concluida)));
end;
$$;

select pg_temp.medir('antes');
-- == aplicar a migration aqui ==

-- == DEPOIS ==
select pg_temp.medir('depois');

do $$
begin
  if (select chamadas from t_gatilho where fase = 'antes' and caso = 'rascunho') <> 1
     or (select chamadas from t_gatilho where fase = 'depois' and caso = 'rascunho') <> 0
     or exists (select 1 from t_gatilho where caso <> 'rascunho' and chamadas <> 1) then
    raise exception 'Ensaio reprovado: %', (select json_agg(t) from t_gatilho t);
  end if;
end;
$$;

select fase, caso, chamadas from t_gatilho order by fase, caso;

rollback;
