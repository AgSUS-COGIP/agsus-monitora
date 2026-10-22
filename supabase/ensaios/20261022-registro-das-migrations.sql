/*
  ENSAIO de supabase/correcoes/20261022-registro-das-migrations.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Confere:
    1. antes: as linhas com "supabase/" e a órfã 20260928160000_analises_por_area;
    2. depois: nenhuma com prefixo, nenhuma fora do formato, a órfã fora, o
       total menor só pela órfã e o hash de cada migration preservado;
    3. rodar de novo não muda nada.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table ensaio_antes on commit drop as
  select regexp_replace(caminho, '^supabase/', '') as caminho, hash
    from public.migracoes_aplicadas;

select count(*) filter (where caminho like 'supabase/%') as com_prefixo_antes,
       count(*) filter (where caminho = 'migrations/20260928160000_analises_por_area.sql') as orfa_antes,
       count(*) as total_antes
  from public.migracoes_aplicadas;

-- 1. A correção (corpo do arquivo).

-- 1a. Já existe a mesma migration sem o prefixo, com o mesmo hash: sai a com prefixo.
delete from public.migracoes_aplicadas a
 using public.migracoes_aplicadas b
 where a.caminho like 'supabase/%'
   and b.caminho = substr(a.caminho, length('supabase/') + 1)
   and b.hash = a.hash;

-- 1b. As demais perdem o prefixo "supabase/".
update public.migracoes_aplicadas a
   set caminho = substr(a.caminho, length('supabase/') + 1)
 where a.caminho like 'supabase/%'
   and not exists (select 1 from public.migracoes_aplicadas b
                    where b.caminho = substr(a.caminho, length('supabase/') + 1));

-- 2. A órfã sem arquivo e sem efeito (desfeita pela 20260928190000).
delete from public.migracoes_aplicadas
 where caminho = 'migrations/20260928160000_analises_por_area.sql'
   and to_regprocedure('public.get_analises_da_area(text, text)') is null
   and to_regprocedure('public.get_analise_detalhe_da_area(uuid)') is null;

-- Conferência (esperado: 0 com prefixo, 0 fora do formato, órfã 0).
select count(*) filter (where caminho like 'supabase/%') as com_prefixo,
       count(*) filter (where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$') as fora_do_formato,
       count(*) filter (where caminho = 'migrations/20260928160000_analises_por_area.sql') as orfa,
       count(*) as total
  from public.migracoes_aplicadas;

do $ensaio$
declare
  v_orfa integer;
begin
  select count(*) into v_orfa from ensaio_antes
   where caminho = 'migrations/20260928160000_analises_por_area.sql';
  assert not exists (select 1 from public.migracoes_aplicadas where caminho like 'supabase/%'),
         'sobrou caminho com supabase/';
  assert not exists (select 1 from public.migracoes_aplicadas
                      where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$'),
         'sobrou caminho fora do formato';
  assert not exists (select 1 from public.migracoes_aplicadas
                      where caminho = 'migrations/20260928160000_analises_por_area.sql'),
         'a órfã continua';
  assert (select count(*) from public.migracoes_aplicadas)
         = (select count(distinct caminho) from ensaio_antes) - v_orfa,
         'o total mudou além da órfã';
  assert not exists (
    select 1 from ensaio_antes a
     where a.caminho <> 'migrations/20260928160000_analises_por_area.sql'
       and not exists (select 1 from public.migracoes_aplicadas m
                        where m.caminho = a.caminho and m.hash = a.hash)),
    'alguma migration perdeu o registro ou o hash';
end;
$ensaio$;

-- 2. De novo: nada muda.
create temporary table ensaio_depois on commit drop as
  select caminho, hash, origem, aplicada_em from public.migracoes_aplicadas;

-- 1a. Já existe a mesma migration sem o prefixo, com o mesmo hash: sai a com prefixo.
delete from public.migracoes_aplicadas a
 using public.migracoes_aplicadas b
 where a.caminho like 'supabase/%'
   and b.caminho = substr(a.caminho, length('supabase/') + 1)
   and b.hash = a.hash;

-- 1b. As demais perdem o prefixo "supabase/".
update public.migracoes_aplicadas a
   set caminho = substr(a.caminho, length('supabase/') + 1)
 where a.caminho like 'supabase/%'
   and not exists (select 1 from public.migracoes_aplicadas b
                    where b.caminho = substr(a.caminho, length('supabase/') + 1));

-- 2. A órfã sem arquivo e sem efeito (desfeita pela 20260928190000).
delete from public.migracoes_aplicadas
 where caminho = 'migrations/20260928160000_analises_por_area.sql'
   and to_regprocedure('public.get_analises_da_area(text, text)') is null
   and to_regprocedure('public.get_analise_detalhe_da_area(uuid)') is null;

-- Conferência (esperado: 0 com prefixo, 0 fora do formato, órfã 0).
select count(*) filter (where caminho like 'supabase/%') as com_prefixo,
       count(*) filter (where caminho !~ '^(migrations|correcoes)/[^/]+\.sql$') as fora_do_formato,
       count(*) filter (where caminho = 'migrations/20260928160000_analises_por_area.sql') as orfa,
       count(*) as total
  from public.migracoes_aplicadas;

do $ensaio$
begin
  assert not exists (
    (select caminho, hash, origem, aplicada_em from public.migracoes_aplicadas
     except select * from ensaio_depois)
    union all
    (select * from ensaio_depois
     except select caminho, hash, origem, aplicada_em from public.migracoes_aplicadas)),
    'a segunda rodada mudou o registro';
end;
$ensaio$;

select 'ensaio ok' as resultado;

rollback;
