/*
  ENSAIO da migration 20261022164000_cronograma_pelo_dia_de_brasilia.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado.

  Montagem (como nos outros ensaios):
    { echo begin;
      sed -n '/^-- == ANTES ==/,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261022164000_cronograma_pelo_dia_de_brasilia.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261022164000_cronograma_pelo_dia_de_brasilia.sql;
      sed -n '/^-- == DEPOIS ==/,$p' supabase/ensaios/20261022164000_cronograma_pelo_dia_de_brasilia.sql;
    } > /tmp/ensaio.sql   (o arquivo termina em rollback)

  1. As colunas da view não mudam (nomes, tipos e ordem) e ela segue
     security_invoker.
  2. Depois: cada linha da view traz o cronograma do dia de Brasília (o mesmo que
     get_monitoramento_cronograma_estado(id, dia de Brasília)); chamar a função
     sem p_data dá o mesmo que com o dia de Brasília.
  3. Fora das 21:00–23:59 de Brasília os dois dias coincidem e a view inteira
     (todas as linhas e colunas) fica igual à de antes; nesse horário, mostra
     quantos editais mudam de etapa.
  Mostra só contagens.
*/
-- == ANTES ==
-- A função confere a permissão de quem lê: a conta do setor (admin global).
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);
create temporary table t_colunas (fase text, ordem int, nome text, tipo text) on commit drop;
insert into t_colunas
select 'antes', a.attnum, a.attname, format_type(a.atttypid, a.atttypmod)
  from pg_attribute a
 where a.attrelid = 'public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL"'::regclass and a.attnum > 0;
create temporary table t_view (fase text, linha jsonb) on commit drop;
insert into t_view select 'antes', to_jsonb(v) from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v;
-- == aplicar a migration aqui ==

-- == DEPOIS ==
insert into t_colunas
select 'depois', a.attnum, a.attname, format_type(a.atttypid, a.atttypmod)
  from pg_attribute a
 where a.attrelid = 'public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL"'::regclass and a.attnum > 0;
insert into t_view select 'depois', to_jsonb(v) from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v;

do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mesmo_dia boolean := (now() at time zone 'America/Sao_Paulo')::date = current_date;
  v_diferentes int;
begin
  if exists (select ordem, nome, tipo from t_colunas where fase = 'antes'
             except select ordem, nome, tipo from t_colunas where fase = 'depois')
     or (select count(*) from t_colunas where fase = 'antes') <> (select count(*) from t_colunas where fase = 'depois') then
    raise exception 'Ensaio: as colunas da view mudaram.';
  end if;
  if not exists (select 1 from pg_class c where c.oid = 'public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL"'::regclass
                    and 'security_invoker=true' = any (c.reloptions)) then
    raise exception 'Ensaio: a view deixou de ser security_invoker.';
  end if;
  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
              where public.get_monitoramento_cronograma_estado(m.id)
                    is distinct from public.get_monitoramento_cronograma_estado(m.id, v_hoje)) then
    raise exception 'Ensaio: o padrão de p_data não é o dia de Brasília.';
  end if;
  select count(*) into v_diferentes
    from (select linha from t_view where fase = 'antes'
          except select linha from t_view where fase = 'depois') x;
  if v_mesmo_dia and v_diferentes > 0 then
    raise exception 'Ensaio: no mesmo dia, % linhas da view mudaram.', v_diferentes;
  end if;
  raise notice 'Ensaio ok: mesmo dia em UTC e em Brasília = %, linhas diferentes = %', v_mesmo_dia, v_diferentes;
end;
$$;

select (select count(*) from t_view where fase = 'antes') as linhas_antes,
       (select count(*) from t_view where fase = 'depois') as linhas_depois,
       (select count(*) from (select linha from t_view where fase = 'antes'
                              except select linha from t_view where fase = 'depois') x) as linhas_diferentes,
       (now() at time zone 'America/Sao_Paulo')::date = current_date as mesmo_dia;

rollback;
