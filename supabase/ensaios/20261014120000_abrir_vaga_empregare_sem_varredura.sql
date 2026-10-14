/*
  Ensaio de 20261014120000 (abrir a vaga sem varrer as análises). Sempre
  termina em rollback. Cole a migration no ponto marcado (dentro do mesmo
  begin/rollback): reprova se FC_EMPREGARE_VAGAS_DO_QUADRO mudar de resultado
  (lista inteira e cada código ativo) e mostra o tempo de uma busca por código.
*/
begin;

create temp table t_antes_todas as select * from private."FC_EMPREGARE_VAGAS_DO_QUADRO"();
create temp table t_antes_uma as
select v.vaga as pedido, q.*
  from (select distinct btrim(codigo_vaga) vaga from public."TB_ANALISE_CURRICULAR" where ativo
        union select ' 182528' union select 'x') v,
       lateral private."FC_EMPREGARE_VAGAS_DO_QUADRO"(v.vaga) q;

-- >>> cole aqui supabase/migrations/20261014120000_abrir_vaga_empregare_sem_varredura.sql <<<

create temp table t_tempo (etapa text, ms numeric);
do $$
declare
  t0 timestamptz;
  x uuid;
  v_dif integer;
begin
  select count(*) into v_dif from (
    (select * from t_antes_todas except all select * from private."FC_EMPREGARE_VAGAS_DO_QUADRO"())
    union all
    (select * from private."FC_EMPREGARE_VAGAS_DO_QUADRO"() except all select * from t_antes_todas)) d;
  if v_dif > 0 then
    raise exception 'FC_EMPREGARE_VAGAS_DO_QUADRO() mudou % linha(s)', v_dif;
  end if;
  select count(*) into v_dif from (
    select a.* from t_antes_uma a
    except all
    select v.pedido, q.* from (select distinct pedido from t_antes_uma) v,
           lateral private."FC_EMPREGARE_VAGAS_DO_QUADRO"(v.pedido) q) d;
  if v_dif > 0 then
    raise exception 'FC_EMPREGARE_VAGAS_DO_QUADRO(código) mudou % linha(s)', v_dif;
  end if;
  for i in 1..3 loop
    t0 := clock_timestamp();
    select q.edital_id into x from private."FC_EMPREGARE_VAGAS_DO_QUADRO"('182528') q limit 1;
    insert into t_tempo values ('vaga 182528 #' || i, round(extract(epoch from clock_timestamp() - t0) * 1000));
  end loop;
end;
$$;

select etapa, ms from t_tempo;

rollback;
