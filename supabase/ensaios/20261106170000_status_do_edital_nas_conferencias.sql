/*
  ENSAIO da migration 20261106170000_status_do_edital_nas_conferencias.sql — begin … rollback.
  NÃO É MIGRATION; nada fica gravado.

  Montagem (como nos outros ensaios):
    { sed -n '1,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261106170000_status_do_edital_nas_conferencias.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261106170000_status_do_edital_nas_conferencias.sql;
      sed -n '/^-- == DEPOIS ==/,/^rollback;$/p' supabase/ensaios/20261106170000_status_do_edital_nas_conferencias.sql;
    } > /tmp/ensaio.sql

  Confere:
    1. conferencia_ler_contexto() depois, sem "status" e sem "gerado_em", é igual à de antes (md5);
    2. todo edital traz "status" igual ao de TB_MONITORAMENTO_INDIGENA;
    3. o 30/2026 (projetos) vem Concluído.
  Termina com a contagem de editais por status e ativo (sem dado de pessoa).
*/
begin;
set local statement_timeout = '30s';

create temporary table t_contexto on commit drop as
select 'antes'::text as fase, public.conferencia_ler_contexto() - 'gerado_em' as c;

-- == aplicar a migration aqui ==

-- == DEPOIS ==
insert into t_contexto select 'depois', public.conferencia_ler_contexto() - 'gerado_em';

do $$
declare
  v_antes jsonb := (select c from t_contexto where fase = 'antes');
  v_depois jsonb := (select c from t_contexto where fase = 'depois');
  v_sem_status jsonb;
begin
  select jsonb_set(v_depois, '{editais}', coalesce(jsonb_agg(e - 'status' order by n), '[]'::jsonb))
    into v_sem_status
    from jsonb_array_elements(v_depois -> 'editais') with ordinality as x(e, n);
  -- 1.
  if md5(v_sem_status::text) <> md5(v_antes::text) then
    raise exception 'ENSAIO 1: o contexto mudou além do status';
  end if;
  -- 2.
  if exists (
    select 1 from jsonb_array_elements(v_depois -> 'editais') e
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = (e ->> 'id')::uuid
     where (e ->> 'status') is distinct from m.status
  ) or jsonb_array_length(v_depois -> 'editais') <> (select count(*) from public."TB_MONITORAMENTO_INDIGENA") then
    raise exception 'ENSAIO 2: status diferente do edital';
  end if;
  -- 3.
  if not exists (
    select 1 from jsonb_array_elements(v_depois -> 'editais') e
     where e ->> 'numero' = '30/2026' and e ->> 'area' = 'projetos' and e ->> 'status' = 'Concluído'
  ) then
    raise exception 'ENSAIO 3: o 30/2026 não veio Concluído';
  end if;
end $$;

select e ->> 'status' as status, (e ->> 'ativo')::boolean as ativo, count(*) as editais
  from t_contexto t, jsonb_array_elements(t.c -> 'editais') e
 where t.fase = 'depois'
 group by 1, 2
 order by 1, 2;

rollback;
