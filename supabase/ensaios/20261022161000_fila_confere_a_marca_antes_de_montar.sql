/*
  ENSAIO da migration 20261022161000_fila_confere_a_marca_antes_de_montar.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado.

  Montagem (como nos outros ensaios):
    { echo begin;
      sed -n '/^-- == ANTES ==/,/^-- == aplicar a migration aqui ==/p' supabase/ensaios/20261022161000_fila_confere_a_marca_antes_de_montar.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261022161000_fila_confere_a_marca_antes_de_montar.sql;
      sed -n '/^-- == DEPOIS ==/,$p' supabase/ensaios/20261022161000_fila_confere_a_marca_antes_de_montar.sql;
    } > /tmp/ensaio.sql   (o arquivo termina em rollback)

  Para a conta do setor (coordenação, a01afddb…) e um analista do 114/2026, como
  role authenticated, antes e depois da migration, com os mesmos argumentos:
    - inteira (sem p_desde): mesma resposta (jsonb sem gerado_em) e mesma marca;
    - parcial (p_desde = 1 dia atrás, marca certa): mesma resposta;
    - marca errada: mesma resposta (a inteira) — e o tempo, que deve cair.
  Mostra só tempos, tamanhos e se bateu (nenhum dado de pessoa).
*/
-- == ANTES ==
create temporary table t_fila (quem text, chamada text, fase text, rodada int, ms numeric, bytes bigint, j jsonb)
  on commit drop;
grant all on t_fila to authenticated;
create temporary table t_quem (quem text primary key, claims text, marca text) on commit drop;
grant all on t_quem to authenticated;
insert into t_quem (quem, claims) values
  ('coordenacao', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}'),
  ('analista', '{"sub":"0fe8b974-bd07-4b78-9827-0c38cf37f748","role":"authenticated"}');

create or replace function pg_temp.medir_fila(p_fase text) returns void
language plpgsql as $$
declare
  e constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  r record;
  i int;
  t0 timestamptz;
  j json;
begin
  for r in select * from t_quem order by quem loop
    perform set_config('request.jwt.claims', r.claims, true);
    execute 'set local role authenticated';
    perform public.obter_fila_avaliacao_desde(e, null, null); -- aquecimento
    for i in 1..3 loop
      t0 := clock_timestamp(); j := public.obter_fila_avaliacao_desde(e, null, null);
      insert into t_fila values (r.quem, 'inteira', p_fase, i,
        extract(epoch from clock_timestamp() - t0) * 1000, octet_length(j::text), j::jsonb - 'gerado_em');
      if p_fase = 'antes' and i = 1 then
        update t_quem set marca = j ->> 'marca' where quem = r.quem returning * into r;
      end if;
      t0 := clock_timestamp(); j := public.obter_fila_avaliacao_desde(e, now() - interval '1 day', r.marca);
      insert into t_fila values (r.quem, 'parcial', p_fase, i,
        extract(epoch from clock_timestamp() - t0) * 1000, octet_length(j::text), j::jsonb - 'gerado_em');
      t0 := clock_timestamp(); j := public.obter_fila_avaliacao_desde(e, now() - interval '1 day', 'marca-velha');
      insert into t_fila values (r.quem, 'marca errada', p_fase, i,
        extract(epoch from clock_timestamp() - t0) * 1000, octet_length(j::text), j::jsonb - 'gerado_em');
    end loop;
    execute 'reset role';
  end loop;
end;
$$;

select pg_temp.medir_fila('antes');
-- == aplicar a migration aqui ==

-- == DEPOIS ==
select pg_temp.medir_fila('depois');

do $$
begin
  if exists (
    select 1 from t_fila a join t_fila d using (quem, chamada, rodada)
     where a.fase = 'antes' and d.fase = 'depois' and a.j is distinct from d.j) then
    raise exception 'Ensaio reprovado: a resposta mudou em %',
      (select json_agg(distinct a.quem || '/' || a.chamada) from t_fila a join t_fila d using (quem, chamada, rodada)
        where a.fase = 'antes' and d.fase = 'depois' and a.j is distinct from d.j);
  end if;
  if exists (select 1 from t_fila where chamada = 'parcial' and (j ->> 'parcial')::boolean is not true)
     or exists (select 1 from t_fila where chamada = 'marca errada' and (j ->> 'parcial')::boolean is not false) then
    raise exception 'Ensaio reprovado: parcial/inteira trocadas.';
  end if;
end;
$$;

select quem, chamada, fase, round(avg(ms), 1) as ms_medio, round(min(ms), 1) as ms_min, max(bytes) as bytes
  from t_fila group by quem, chamada, fase order by quem, chamada, fase;

rollback;
