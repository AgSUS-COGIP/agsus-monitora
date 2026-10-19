/*
  ENSAIO da migration 20261019150000_fila_parcial_sem_montar_tudo.sql — begin … rollback.

  NÃO É MIGRATION. Tudo numa transação só, desfeita no fim:
    1. a parte ANTES deste arquivo (até a marca "-- == aplicar a migration aqui =="),
       com as funções de hoje;
    2. o corpo da migration (sem begin/commit/notify);
    3. a parte DEPOIS;
    4. rollback.
  Por exemplo:
    { echo begin;
      sed -n '/^-- == ANTES ==/,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261019150000_fila_parcial_sem_montar_tudo.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' -e '/^notify pgrst/d' supabase/migrations/20261019150000_fila_parcial_sem_montar_tudo.sql;
      sed -n '/^-- == DEPOIS ==/,$p' supabase/ensaios/20261019150000_fila_parcial_sem_montar_tudo.sql;
      echo rollback; } > /tmp/ensaio.sql

  Para a conta do setor (coordenação, a01afddb…) e um analista do 114/2026, como
  role authenticated: guarda a fila inteira (obter_fila_avaliacao e
  obter_fila_avaliacao_desde sem p_desde) e a parcial (p_desde = 10 min atrás e a
  marca de agora; e, para a coordenação, 1 dia atrás, com mais linhas) das funções
  de hoje; aplica a migration; chama as novas com os mesmos argumentos e compara
  (jsonb, sem gerado_em; e a ordem das chaves). Mede o tempo de cada chamada
  (clock_timestamp; a primeira chamada de hoje é só aquecimento, fora da conta).
  Não grava nada no banco (só a tabela temporária do ensaio).
*/
-- == ANTES ==
create temporary table t_fila (quem text, chamada text, fase text, ms numeric, bytes bigint, j jsonb, chaves text)
  on commit drop;
grant all on t_fila to authenticated;
create temporary table t_args (quem text primary key, claims text, desde timestamptz, desde_dia timestamptz, marca text)
  on commit drop;
grant all on t_args to authenticated;
insert into t_args (quem, claims) values
  ('coordenacao', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}'),
  ('analista', '{"sub":"0fe8b974-bd07-4b78-9827-0c38cf37f748","role":"authenticated"}');

create or replace function pg_temp.medir_fila(p_fase text) returns void
language plpgsql as $$
declare
  e constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  r record;
  t0 timestamptz;
  j json;
begin
  for r in select * from t_args order by quem loop
    perform set_config('request.jwt.claims', r.claims, true);
    execute 'set local role authenticated';
    if p_fase = 'antes' then
      perform public.obter_fila_avaliacao(e); -- aquecimento
      update t_args set desde = now() - interval '10 minutes', desde_dia = now() - interval '1 day'
       where quem = r.quem returning * into r;
    end if;

    t0 := clock_timestamp(); j := public.obter_fila_avaliacao(e);
    insert into t_fila values (r.quem, 'obter_fila_avaliacao', p_fase,
      extract(epoch from clock_timestamp() - t0) * 1000, octet_length(j::text), j::jsonb,
      (select string_agg(k, ',' order by o) from json_object_keys(j) with ordinality x(k, o)));

    t0 := clock_timestamp(); j := public.obter_fila_avaliacao_desde(e, null, null);
    insert into t_fila values (r.quem, 'desde: inteira', p_fase,
      extract(epoch from clock_timestamp() - t0) * 1000, octet_length(j::text), j::jsonb,
      (select string_agg(k, ',' order by o) from json_object_keys(j) with ordinality x(k, o)));
    if p_fase = 'antes' then
      update t_args set marca = j ->> 'marca' where quem = r.quem returning * into r;
    end if;

    t0 := clock_timestamp(); j := public.obter_fila_avaliacao_desde(e, r.desde, r.marca);
    insert into t_fila values (r.quem, 'desde: parcial 10 min', p_fase,
      extract(epoch from clock_timestamp() - t0) * 1000, octet_length(j::text), j::jsonb,
      (select string_agg(k, ',' order by o) from json_object_keys(j) with ordinality x(k, o)));

    if r.quem = 'coordenacao' then
      t0 := clock_timestamp(); j := public.obter_fila_avaliacao_desde(e, r.desde_dia, r.marca);
      insert into t_fila values (r.quem, 'desde: parcial 1 dia', p_fase,
        extract(epoch from clock_timestamp() - t0) * 1000, octet_length(j::text), j::jsonb,
        (select string_agg(k, ',' order by o) from json_object_keys(j) with ordinality x(k, o)));

      t0 := clock_timestamp(); j := public.obter_fila_avaliacao_desde(e, r.desde, 'outra');
      insert into t_fila values (r.quem, 'desde: outra marca', p_fase,
        extract(epoch from clock_timestamp() - t0) * 1000, octet_length(j::text), j::jsonb,
        (select string_agg(k, ',' order by o) from json_object_keys(j) with ordinality x(k, o)));
    end if;
    execute 'reset role';
  end loop;
end;
$$;

select pg_temp.medir_fila('antes');
reset role;
-- == aplicar a migration aqui ==

-- == DEPOIS ==
select pg_temp.medir_fila('depois');
reset role;

select a.quem, a.chamada,
       round(a.ms) as ms_antes, round(d.ms) as ms_depois,
       a.bytes as bytes_antes, d.bytes as bytes_depois,
       (a.j - 'gerado_em') = (d.j - 'gerado_em') as identica,
       a.chaves = d.chaves as mesmas_chaves_na_ordem,
       jsonb_array_length(d.j -> 'candidatos') as linhas,
       jsonb_array_length(d.j -> 'saiu') as saiu,
       d.j ->> 'total_nucleo' as total_nucleo
  from t_fila a
  join t_fila d on d.quem = a.quem and d.chamada = a.chamada and d.fase = 'depois'
 where a.fase = 'antes'
 order by a.quem, a.chamada;
